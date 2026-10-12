import express, { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Wallet from '../models/Wallet';
import CryptoTransaction, { ICryptoTransaction } from '../models/CryptoTransaction';
import { verifyIpnSignature, isPaymentCompleted, isPaymentFailed, NowPaymentsIPNPayload } from '../services/nowPaymentsService';
import logger from '../utils/logger';

const router = Router();

const AMOUNT_TOLERANCE_USD = 0.01;

const isTransactionUnsupported = (err: unknown): boolean => {
  const e = err as { message?: string; code?: number };
  return !!e && (
    e.code === 20 ||
    e.code === 251 ||
    !!e.message?.includes('replica set') ||
    !!e.message?.includes('Transaction numbers')
  );
};

/** Flip pending → confirmed and credit the wallet. Returns the transaction if this call performed the credit. */
const confirmAndCredit = async (
  orderId: string,
  confirmFields: Record<string, unknown>
): Promise<ICryptoTransaction | null> => {
  const confirm = (session?: mongoose.ClientSession) =>
    CryptoTransaction.findOneAndUpdate(
      { orderId, status: 'pending' },
      { $set: { status: 'confirmed', ...confirmFields } },
      { new: true, session }
    );

  const credit = (tx: ICryptoTransaction, session?: mongoose.ClientSession) =>
    Wallet.findOneAndUpdate(
      { userId: tx.userId },
      { $inc: { balance: tx.amount }, $set: { currency: 'USD' } },
      { upsert: true, new: true, session }
    );

  const session = await mongoose.startSession();
  try {
    let credited: ICryptoTransaction | null = null;
    await session.withTransaction(async () => {
      credited = null;
      const tx = await confirm(session);
      if (!tx) return;
      await credit(tx, session);
      credited = tx;
    });
    return credited;
  } catch (err) {
    if (!isTransactionUnsupported(err)) throw err;
    logger.warn('NowPayments IPN: MongoDB transactions unavailable, crediting without a transaction', { orderId });
    const tx = await confirm();
    if (!tx) return null;
    await credit(tx);
    return tx;
  } finally {
    await session.endSession();
  }
};

/**
 * POST /api/webhooks/nowpayments
 * IPN callback from NowPayments. Uses raw body for signature verification.
 * Mount this router BEFORE express.json() so the body is not consumed.
 *
 * Response within 3000ms; no Authorization header from NowPayments.
 */
router.post(
  '/nowpayments',
  express.raw({ type: 'application/json' }),
  (req: Request, _res: Response, next: express.NextFunction) => {
    const r = req as Request & { body: Buffer; rawBody?: string };
    r.rawBody = r.body && Buffer.isBuffer(r.body) ? r.body.toString('utf8') : '';
    try {
      (req as Request & { body: NowPaymentsIPNPayload }).body = r.rawBody ? (JSON.parse(r.rawBody) as NowPaymentsIPNPayload) : {};
    } catch {
      (req as Request & { body: NowPaymentsIPNPayload }).body = {};
    }
    next();
  },
  async (req: Request, res: Response) => {
    try {
      const rawBody = (req as unknown as { rawBody?: string }).rawBody ?? '';
      const sig = (req.headers['x-nowpayments-sig'] as string) || '';

      if (!rawBody) {
        logger.warn('NowPayments IPN: missing body');
        res.status(400).json({ ok: false, reason: 'missing body' });
        return;
      }

      if (!verifyIpnSignature(rawBody, sig)) {
        logger.warn('NowPayments IPN: invalid signature');
        res.status(400).json({ ok: false, reason: 'invalid signature' });
        return;
      }

      const payload = (req as Request & { body: NowPaymentsIPNPayload }).body || {};

      const orderId = payload.order_id;
      const paymentStatus = payload.payment_status;
      const paymentId = payload.payment_id != null ? String(payload.payment_id) : '';

      logger.info('NowPayments IPN received', { orderId, paymentStatus, paymentId });

      if (!orderId || typeof orderId !== 'string') {
        logger.warn('NowPayments IPN: missing order_id');
        res.status(200).json({ ok: true });
        return;
      }

      if (isPaymentFailed(paymentStatus)) {
        await CryptoTransaction.updateOne(
          { orderId, status: 'pending' },
          { $set: { status: 'failed', ipnReceivedAt: new Date() } }
        );
        res.status(200).json({ ok: true });
        return;
      }

      if (!isPaymentCompleted(paymentStatus)) {
        // Acknowledge but do not credit
        res.status(200).json({ ok: true });
        return;
      }

      const pending = await CryptoTransaction.findOne({ orderId, status: 'pending' }).lean();
      if (!pending) {
        logger.info('NowPayments IPN: order already processed or not found', { orderId });
        res.status(200).json({ ok: true });
        return;
      }

      const paidCurrency = typeof payload.price_currency === 'string' ? payload.price_currency.toLowerCase() : '';
      const paidAmount = Number(payload.price_amount);
      if (paidCurrency !== 'usd' || !Number.isFinite(paidAmount) || Math.abs(paidAmount - pending.amount) > AMOUNT_TOLERANCE_USD) {
        logger.error('NowPayments IPN: amount/currency mismatch, not crediting (manual review required)', {
          orderId,
          expectedAmount: pending.amount,
          priceAmount: payload.price_amount,
          priceCurrency: payload.price_currency,
          actuallyPaid: payload.actually_paid
        });
        res.status(200).json({ ok: true });
        return;
      }

      const tx = await confirmAndCredit(orderId, {
        txHash: payload.txHash ?? payload.pay_address ?? undefined,
        ipnReceivedAt: new Date()
      });

      if (!tx) {
        logger.info('NowPayments IPN: order already processed', { orderId });
        res.status(200).json({ ok: true });
        return;
      }

      logger.info('Wallet credited via NowPayments IPN', {
        orderId,
        userId: tx.userId.toString(),
        amount: tx.amount
      });

      res.status(200).json({ ok: true });
    } catch (err) {
      logger.error('NowPayments IPN processing error', err);
      // Non-2xx so NowPayments retries; crediting is idempotent on orderId + status.
      res.status(500).json({ ok: false });
    }
  }
);

export default router;
