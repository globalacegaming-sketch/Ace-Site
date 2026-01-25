import express, { Router, Request, Response } from 'express';
import Wallet from '../models/Wallet';
import CryptoTransaction from '../models/CryptoTransaction';
import { verifyIpnSignature, isPaymentCompleted, NowPaymentsIPNPayload } from '../services/nowPaymentsService';
import logger from '../utils/logger';

const router = Router();

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

    if (!isPaymentCompleted(paymentStatus)) {
      // Acknowledge but do not credit
      res.status(200).json({ ok: true });
      return;
    }

    if (!orderId || typeof orderId !== 'string') {
      logger.warn('NowPayments IPN: missing order_id');
      res.status(200).json({ ok: true });
      return;
    }

    // Idempotent: only transition from pending -> confirmed
    const tx = await CryptoTransaction.findOneAndUpdate(
      { orderId, status: 'pending' },
      {
        $set: {
          status: 'confirmed',
          txHash: payload.txHash ?? payload.pay_address ?? undefined,
          ipnReceivedAt: new Date()
        }
      },
      { new: true }
    );

    if (!tx) {
      // Already processed or unknown order_id
      logger.info('NowPayments IPN: order already processed or not found', { orderId });
      res.status(200).json({ ok: true });
      return;
    }

    // Atomic credit: upsert wallet and increment
    await Wallet.findOneAndUpdate(
      { userId: tx.userId },
      { $inc: { balance: tx.amount }, $set: { currency: 'USD' } },
      { upsert: true, new: true }
    );

    logger.info('Wallet credited via NowPayments IPN', {
      orderId,
      userId: tx.userId.toString(),
      amount: tx.amount
    });

    res.status(200).json({ ok: true });
  }
);

export default router;
