/**
 * Service-health endpoints.
 *
 * Mounted at `/api`, so the public surface is:
 *   GET /api/health                – lightweight "is the API up?" probe (used
 *                                    by uptime monitors). Safe to expose.
 *   GET /api/health/integrations   – aggregated Mongo + Brevo + Cloudinary
 *                                    checks. Gated behind
 *                                    `ALLOW_INTEGRATION_HEALTH=true` (or any
 *                                    non-production environment) to avoid
 *                                    leaking integration topology in prod.
 *
 * Both endpoints are intentionally session- and rate-limit-free (see the
 * skip lists in `index.ts` and `middleware/rateLimiter.ts`) so monitors
 * can poll without paying the auth round-trip on every hit.
 */

import { Router, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import {
  checkBrevo,
  checkCloudinary,
  checkMongo,
} from '../services/integrationHealth';

const router = Router();

const STATE_LABELS: Record<number, string> = {
  0: 'disconnected',
  1: 'connected',
  2: 'connecting',
  3: 'disconnecting',
  99: 'uninitialized',
};

router.get('/health', (_req: Request, res: Response) => {
  const state = mongoose.connection.readyState as keyof typeof STATE_LABELS;
  res.json({
    ok: true,
    service: 'ace-gaming-api',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    mongo: {
      state: STATE_LABELS[state] ?? `unknown(${state})`,
      readyState: state,
      connected: state === 1,
    },
  });
});

router.get('/health/integrations', async (_req: Request, res: Response) => {
  const enabled =
    process.env.NODE_ENV !== 'production' ||
    process.env.ALLOW_INTEGRATION_HEALTH === 'true';

  if (!enabled) {
    return res.status(404).json({
      ok: false,
      message:
        'Integration health endpoint is disabled. Set ALLOW_INTEGRATION_HEALTH=true to enable.',
    });
  }

  const [mongo, brevo, cloudinaryStatus] = await Promise.all([
    checkMongo(),
    checkBrevo(),
    checkCloudinary(),
  ]);

  // Cloudinary is optional — it's "ok-ish" when not configured, since we
  // gracefully fall back to local /uploads. We report the field but don't
  // let it veto the top-level `ok`.
  const ok = mongo.ok && brevo.ok;

  return res.status(ok ? 200 : 503).json({
    ok,
    timestamp: new Date().toISOString(),
    mongo,
    brevo,
    cloudinary: cloudinaryStatus,
  });
});

export default router;
