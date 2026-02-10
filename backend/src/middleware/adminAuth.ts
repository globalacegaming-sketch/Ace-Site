import { Request, Response, NextFunction } from 'express';
import { validateAdminSession } from '../services/adminSessionService';
import logger from '../utils/logger';

declare global {
  namespace Express {
    interface Request {
      adminSession?: {
        adminId: string;
        agentName: string;
        token: string;
        expiresAt: number;
        role: string;
        permissions: string[];
      };
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────────
// requireAdminAuth middleware
// ──────────────────────────────────────────────────────────────────────────────
// Checks for a valid admin identity in this order:
//   1. Server-side session cookie (MongoDB-backed, set on admin login).
//   2. Bearer token in the Authorization header validated against in-memory
//      store (backward compatibility).
// ──────────────────────────────────────────────────────────────────────────────
export const requireAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  // ── 1. Check MongoDB session first (preferred, survives restarts) ──
  if (req.session?.adminSession) {
    const sessionAdmin = req.session.adminSession;

    // Validate the session hasn't expired
    if (sessionAdmin.expiresAt > Date.now()) {
      logger.debug('✅ Admin auth via session cookie:', { agentName: sessionAdmin.agentName });
      req.adminSession = sessionAdmin;
      return next();
    }

    // Session expired – clear it from the store
    logger.debug('⏰ Admin session in cookie expired, clearing');
    delete req.session.adminSession;
  }

  // ── 2. Fall back to Bearer token + in-memory validation ──
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    logger.warn('❌ Admin auth failed: No session cookie or Bearer token');
    res.status(401).json({
      success: false,
      message: 'Access denied. No admin session or token provided.'
    });
    return;
  }

  const token = authHeader.substring(7);
  logger.debug('🔍 Validating admin token (fallback):', token.substring(0, 10) + '...');

  const session = validateAdminSession(token);

  if (!session) {
    logger.warn('❌ Admin auth failed: Invalid or expired session');
    res.status(401).json({
      success: false,
      message: 'Invalid or expired admin session. Please login again.'
    });
    return;
  }

  logger.debug('✅ Admin auth successful (Bearer fallback):', { agentName: session.agentName });
  req.adminSession = session;
  next();
};

