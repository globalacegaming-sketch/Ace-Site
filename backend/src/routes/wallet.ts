import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import mongoose from 'mongoose';
import { authenticate } from '../middleware/auth';
import { paymentCreateLimiter } from '../middleware/rateLimiter';
import Wallet from '../models/Wallet';
import CryptoTransaction from '../models/CryptoTransaction';
import { createInvoice, NowPaymentsIPNPayload, isPaymentCompleted, verifyIpnSignature } from '../services/nowPaymentsService';
import logger from '../utils/logger';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// --- Constants ---
// NowPayments requires minimum crypto amounts (e.g. 5 USDT). $6 USD ensures the converted
// amount stays above their minimum after exchange-rate rounding.
const MIN_AMOUNT_USD = 6;
const MAX_AMOUNT_USD = 10_000;

/** Map frontend pay_currency to NowPayments ticker */
const PAY_CURRENCY_MAP: Record<string, string> = {
  'usdttrc20': 'usdttrc20',
  'usdtbep20': 'usdtbep20',
  'ltc': 'ltc'
};

/**
 * Get or create wallet for user. Returns wallet doc.
 */
async function getOrCreateWallet(userId: mongoose.Types.ObjectId | string) {
  const id = typeof userId === 'string' ? new mongoose.Types.ObjectId(userId) : userId;
  let w = await Wallet.findOne({ userId: id });
  if (!w) {
    w = await Wallet.create({ userId: id, balance: 0, currency: 'USD' });
    logger.info('Wallet created for user', { userId: id.toString() });
  }
  return w;
}

// --- GET /api/wallet/balance ---
router.get('/balance', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const wallet = await getOrCreateWallet(userId);
    return sendSuccess(res, 'Balance retrieved', {
      balance: Number(wallet.balance) || 0,
      currency: wallet.currency || 'USD',
      updatedAt: wallet.updatedAt
    });
  } catch (e) {
    logger.error('Wallet get balance error:', e);
    return sendError(res, 'Failed to get balance', 500);
  }
});

// --- GET /api/wallet/crypto-transactions ---
router.get('/crypto-transactions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const limit = Math.min(parseInt(String(req.query.limit || '50'), 10) || 50, 100);
    const skip = parseInt(String(req.query.skip || '0'), 10) || 0;

    const [items, total] = await Promise.all([
      CryptoTransaction.find({ userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CryptoTransaction.countDocuments({ userId })
    ]);

    return sendSuccess(res, 'Crypto transactions retrieved', {
      items,
      total
    });
  } catch (e) {
    logger.error('Wallet crypto-transactions list error:', e);
    return sendError(res, 'Failed to list transactions', 500);
  }
});

// --- POST /api/wallet/create-crypto-payment ---
router.post(
  '/create-crypto-payment',
  authenticate,
  paymentCreateLimiter,
  async (req: Request, res: Response) => {
    try {
      const userId = req.user!._id;
      const { amountUSD, payCurrency } = req.body;

      const amount = parseFloat(amountUSD);
      if (isNaN(amount) || amount < MIN_AMOUNT_USD || amount > MAX_AMOUNT_USD) {
        return sendError(
          res,
          `Amount must be between $${MIN_AMOUNT_USD} and $${MAX_AMOUNT_USD}`,
          400
        );
      }

      const orderId = `wallet-${uuidv4()}`;
      const orderDescription = `Wallet load – $${amount.toFixed(2)} USD`;

      const apiKey = process.env.NOWPAYMENTS_API_KEY;
      const ipnSecret = process.env.NOWPAYMENTS_IPN_SECRET;
      if (!apiKey || !ipnSecret) {
        logger.error('NowPayments env vars missing (NOWPAYMENTS_API_KEY, NOWPAYMENTS_IPN_SECRET)');
        return sendError(res, 'Payment provider is not configured', 503);
      }

      const baseUrl = process.env.BACKEND_URL || process.env.API_URL || 'http://localhost:3001';
      const frontendUrl = process.env.FRONTEND_URL || process.env.PRODUCTION_FRONTEND_URL || 'http://localhost:5173';
      const base = (frontendUrl || '').replace(/\/$/, '');
      const successUrl = `${base}/wallet?success=1&order=${encodeURIComponent(orderId)}`;
      const cancelUrl = `${base}/wallet?cancel=1&order=${encodeURIComponent(orderId)}`;
      const ipnCallbackUrl = `${baseUrl.replace(/\/$/, '')}/api/webhooks/nowpayments`;

      const payCurrencyOpt = payCurrency && PAY_CURRENCY_MAP[String(payCurrency).toLowerCase()]
        ? PAY_CURRENCY_MAP[String(payCurrency).toLowerCase()]
        : undefined;

      const result = await createInvoice({
        price_amount: amount,
        price_currency: 'USD',
        order_id: orderId,
        order_description: orderDescription,
        ipn_callback_url: ipnCallbackUrl,
        success_url: successUrl,
        cancel_url: cancelUrl,
        pay_currency: payCurrencyOpt
      });

      if (!result.success || !result.invoiceUrl) {
        let msg = result.error || 'Could not create payment';
        if (/less than minimal|below minimum|minimum amount/i.test(msg)) {
          msg = `Amount is below the minimum for this cryptocurrency. Please try at least $${MIN_AMOUNT_USD} or a higher amount.`;
        }
        return sendError(res, msg, 400);
      }

      await CryptoTransaction.create({
        userId,
        paymentId: result.paymentId || orderId,
        invoiceId: result.invoiceId || '',
        orderId,
        amount,
        currency: 'USD',
        payCurrency: payCurrencyOpt || result.payCurrency,
        status: 'pending'
      });

      logger.info('Crypto payment created', {
        userId: userId.toString(),
        orderId,
        amount,
        payCurrency: payCurrencyOpt
      });

      return sendSuccess(res, 'Payment created', {
        paymentUrl: result.invoiceUrl,
        orderId,
        amount,
        currency: 'USD'
      });
    } catch (e) {
      logger.error('Create crypto payment error:', e);
      return sendError(res, 'Failed to create payment', 500);
    }
  }
);

export default router;
