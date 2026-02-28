import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
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
//   3. JWT token signed with AGENT_JWT_SECRET (for AceAdmin dashboard).
// ──────────────────────────────────────────────────────────────────────────────
export const requireAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  // ── 1. Check MongoDB session first (preferred, survives restarts) ──
  if (req.session?.adminSession) {
    const sessionAdmin = req.session.adminSession;

    if (sessionAdmin.expiresAt > Date.now()) {
      logger.debug('✅ Admin auth via session cookie:', { agentName: sessionAdmin.agentName });
      req.adminSession = sessionAdmin;
      return next();
    }

    logger.debug('⏰ Admin session in cookie expired, clearing');
    delete req.session.adminSession;
  }

  // ── 2. Fall back to Bearer token ──
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

  // ── 2a. In-memory session validation ──
  const session = validateAdminSession(token);
  if (session) {
    logger.debug('✅ Admin auth successful (in-memory session):', { agentName: session.agentName });
    req.adminSession = session;
    return next();
  }

  // ── 2b. JWT verification (AceAdmin dashboard uses JWT directly) ──
  try {
    const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;
    const adminRoles = ['super_admin', 'admin'];
    if (decoded.type === 'agent' && adminRoles.includes(decoded.role)) {
      req.adminSession = {
        adminId: decoded.agentId || decoded.userId,
        agentName: decoded.username,
        token,
        expiresAt: (decoded.exp || 0) * 1000,
        role: decoded.role,
        permissions: decoded.permissions || [],
      };
      logger.debug('✅ Admin auth successful (JWT):', { agentName: decoded.username });
      return next();
    }
  } catch { /* JWT verification failed */ }

  logger.warn('❌ Admin auth failed: Invalid or expired session');
  res.status(401).json({
    success: false,
    message: 'Invalid or expired admin session. Please login again.'
  });
};

