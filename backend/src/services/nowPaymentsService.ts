import axios, { AxiosError } from 'axios';
import crypto from 'crypto';
import logger from '../utils/logger';

const NOWPAYMENTS_BASE = 'https://api.nowpayments.io/v1';

// --- Types ---

export interface CreateInvoiceParams {
  price_amount: number;
  price_currency: string;
  order_id: string;
  order_description: string;
  ipn_callback_url: string;
  success_url: string;
  cancel_url: string;
  pay_currency?: string;
}

export interface NowPaymentsInvoiceResponse {
  id?: string;
  token_id?: string;
  order_id?: string;
  order_description?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number | null;
  pay_currency?: string;
  pay_address?: string;
  created_at?: string;
  updated_at?: string;
  purchase_id?: string;
  invoice_id?: string;
  /** Hosted payment page URL - redirect user here */
  invoice_url?: string;
}

/** IPN payload from NowPayments (subset of fields we use) */
export interface NowPaymentsIPNPayload {
  payment_id?: number | string;
  payment_status?: string;
  pay_address?: string;
  price_amount?: number;
  price_currency?: string;
  pay_amount?: number;
  pay_currency?: string;
  order_id?: string;
  order_description?: string;
  actually_paid?: number;
  outcome_amount?: number;
  outcome_currency?: string;
  purchase_id?: string;
  [key: string]: unknown;
}

// --- Helpers ---

function getApiKey(): string {
  const key = process.env.NOWPAYMENTS_API_KEY;
  if (!key) {
    throw new Error('NOWPAYMENTS_API_KEY is not set');
  }
  return key;
}

function getIpnSecret(): string {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET;
  if (!secret) {
    throw new Error('NOWPAYMENTS_IPN_SECRET is not set');
  }
  return secret;
}

/**
 * Sort object keys alphabetically and return JSON string.
 * Used for IPN signature verification per NowPayments docs.
 */
function getSortedBodyString(obj: Record<string, unknown>): string {
  const sorted: Record<string, unknown> = {};
  for (const k of Object.keys(obj).sort()) {
    sorted[k] = obj[k];
  }
  return JSON.stringify(sorted);
}

// --- API ---

/**
 * Create an invoice (custodial flow). Returns the hosted payment URL.
 */
export async function createInvoice(params: CreateInvoiceParams): Promise<{
  success: boolean;
  invoiceUrl?: string;
  invoiceId?: string;
  paymentId?: string;
  payAddress?: string;
  payAmount?: number;
  payCurrency?: string;
  orderId?: string;
  error?: string;
}> {
  const apiKey = getApiKey();

  try {
    const body: Record<string, unknown> = {
      price_amount: params.price_amount,
      price_currency: params.price_currency.toLowerCase(),
      order_id: params.order_id,
      order_description: params.order_description,
      ipn_callback_url: params.ipn_callback_url,
      success_url: params.success_url,
      cancel_url: params.cancel_url
    };
    if (params.pay_currency) {
      body.pay_currency = params.pay_currency;
    }

    const { data } = await axios.post<NowPaymentsInvoiceResponse>(
      `${NOWPAYMENTS_BASE}/invoice`,
      body,
      {
        headers: {
          'x-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        timeout: 15000
      }
    );

    const invoiceUrl = data.invoice_url || (data as unknown as { payment_url?: string }).payment_url;

    if (!invoiceUrl) {
      logger.warn('NowPayments invoice created but no invoice_url in response', { data });
    }

    return {
      success: true,
      invoiceUrl: invoiceUrl || undefined,
      invoiceId: data.invoice_id || data.id || undefined,
      paymentId: String(data.purchase_id ?? data.id ?? ''),
      payAddress: data.pay_address,
      payAmount: data.pay_amount ?? undefined,
      payCurrency: data.pay_currency,
      orderId: data.order_id
    };
  } catch (err) {
    const ax = err as AxiosError<{ message?: string; code?: string }>;
    const message = ax.response?.data?.message || ax.message || 'Unknown error';
    const code = ax.response?.data?.code || ax.response?.status;
    logger.error('NowPayments createInvoice failed', {
      message,
      code,
      orderId: params.order_id
    });
    return {
      success: false,
      error: message || 'Failed to create invoice'
    };
  }
}

/**
 * Verify IPN webhook signature (x-nowpayments-sig).
 * Uses HMAC-SHA512 of the sorted JSON body with IPN secret.
 */
export function verifyIpnSignature(rawBody: string, signature: string): boolean {
  if (!signature || typeof signature !== 'string') return false;
  const secret = getIpnSecret();
  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return false;
  }
  const sorted = getSortedBodyString(parsed);
  const expected = crypto.createHmac('sha512', secret).update(sorted).digest('hex');
  if (expected.length !== signature.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
  } catch {
    return false;
  }
}

/**
 * Check if IPN payment_status indicates a completed payment we should credit.
 */
export function isPaymentCompleted(status: string | undefined): boolean {
  if (!status) return false;
  const s = status.toLowerCase();
  return s === 'finished' || s === 'confirmed' || s === 'sending';
}
