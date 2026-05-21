/**
 * Lightweight, ad-hoc health checks for the integrations Ace relies on.
 *
 * Each helper is intentionally network-bounded with an aggressive timeout
 * so the `/api/health/integrations` endpoint never blocks the event loop
 * waiting on a flaky third party. Failures degrade gracefully — we return
 * `{ ok: false, error }` instead of throwing, so callers can render a
 * traffic-light style status board.
 */

import axios from 'axios';
import mongoose from 'mongoose';
import cloudinary, { isCloudinaryEnabled } from '../config/cloudinary';

const REQUEST_TIMEOUT_MS = 15_000;

export type IntegrationStatus = {
  ok: boolean;
  /** Optional human readable explanation (e.g. "Brevo not configured"). */
  message?: string;
  /** Error message when `ok === false`. */
  error?: string;
  /** Round-trip latency in milliseconds. */
  latencyMs?: number;
  /** Implementation-specific extra metadata (kept small + safe to publish). */
  details?: Record<string, unknown>;
};

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function elapsed(start: number): number {
  return Math.round(nowMs() - start);
}

/* ------------------------------------------------------------------------- */
/* MongoDB                                                                   */
/* ------------------------------------------------------------------------- */

/**
 * `mongoose.connection.readyState`
 *   0 = disconnected · 1 = connected · 2 = connecting · 3 = disconnecting
 * We treat anything besides `1` as a hard failure.
 */
export async function checkMongo(): Promise<IntegrationStatus> {
  const start = nowMs();
  try {
    if (mongoose.connection.readyState !== 1) {
      return {
        ok: false,
        error: `MongoDB not connected (readyState=${mongoose.connection.readyState})`,
        latencyMs: elapsed(start),
      };
    }
    const db = mongoose.connection.db;
    if (!db) {
      return {
        ok: false,
        error: 'MongoDB connection has no db handle',
        latencyMs: elapsed(start),
      };
    }
    const ping = (await db.admin().ping()) as { ok?: number };
    const ok = Number(ping?.ok) === 1;
    return {
      ok,
      latencyMs: elapsed(start),
      details: { readyState: mongoose.connection.readyState },
      error: ok ? undefined : 'Ping returned non-OK result',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: elapsed(start),
    };
  }
}

/* ------------------------------------------------------------------------- */
/* Brevo                                                                     */
/* ------------------------------------------------------------------------- */

export async function checkBrevo(): Promise<IntegrationStatus> {
  const start = nowMs();
  const apiKey = process.env.BREVO_API_KEY;
  if (!apiKey) {
    return {
      ok: false,
      message: 'Brevo not configured (BREVO_API_KEY missing)',
      latencyMs: 0,
    };
  }
  try {
    const res = await axios.get('https://api.brevo.com/v3/account', {
      headers: { 'api-key': apiKey, accept: 'application/json' },
      timeout: REQUEST_TIMEOUT_MS,
      validateStatus: () => true,
    });
    const ok = res.status >= 200 && res.status < 300;
    return {
      ok,
      latencyMs: elapsed(start),
      details: { httpStatus: res.status, plan: res.data?.plan?.[0]?.type },
      error: ok ? undefined : `Brevo returned HTTP ${res.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: elapsed(start),
    };
  }
}

/* ------------------------------------------------------------------------- */
/* Cloudinary                                                                */
/* ------------------------------------------------------------------------- */

export async function checkCloudinary(): Promise<IntegrationStatus> {
  const start = nowMs();
  if (!isCloudinaryEnabled()) {
    return {
      ok: false,
      message:
        'Cloudinary not configured (uses local /uploads fallback). This is optional.',
      latencyMs: 0,
    };
  }
  try {
    const result = (await Promise.race([
      cloudinary.api.ping(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error('Cloudinary ping timed out')),
          REQUEST_TIMEOUT_MS,
        ),
      ),
    ])) as { status?: string };
    const ok = result?.status === 'ok';
    return {
      ok,
      latencyMs: elapsed(start),
      details: { status: result?.status },
      error: ok ? undefined : 'Cloudinary ping returned non-OK status',
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
      latencyMs: elapsed(start),
    };
  }
}
