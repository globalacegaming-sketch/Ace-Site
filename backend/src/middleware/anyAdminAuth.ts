// ──────────────────────────────────────────────────────────────────────────────
// requireAnyAdminAuth middleware
// ──────────────────────────────────────────────────────────────────────────────
// Accepts authentication from EITHER:
//   1. Session-based auth (AceAgent panel) → req.adminSession
//   2. JWT-based auth (AceAdmin panel)     → Authorization: Bearer <jwt>
//
// On success, populates req.callerIdentity with a normalised shape so
// downstream handlers don't need to care which panel the request came from.
// ──────────────────────────────────────────────────────────────────────────────

import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { validateAdminSession } from '../services/adminSessionService';
import logger from '../utils/logger';

const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';

export interface CallerIdentity {
  id: string;       // agentId / adminId
  name: string;     // agentName / username
  role: string;     // super_admin | admin | agent
  permissions: string[];
}

declare global {
  namespace Express {
    interface Request {
      callerIdentity?: CallerIdentity;
    }
  }
}

export const requireAnyAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  // ── 1. Try session-based auth (AceAgent panel) ──
  if (req.session?.adminSession) {
    const s = req.session.adminSession;
    if (s.expiresAt > Date.now()) {
      req.adminSession = s;
      req.callerIdentity = {
        id: s.adminId,
        name: s.agentName,
        role: s.role,
        permissions: s.permissions || [],
      };
      return next();
    }
    // Expired – clear
    delete req.session.adminSession;
  }

  // ── 2. Try Bearer token ──
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access denied. No admin session or token provided.' });
    return;
  }

  const token = authHeader.substring(7);

  // 2a. Try in-memory admin session validation (AceAgent fallback)
  const memSession = validateAdminSession(token);
  if (memSession) {
    req.adminSession = memSession;
    req.callerIdentity = {
      id: memSession.adminId,
      name: memSession.agentName,
      role: memSession.role,
      permissions: memSession.permissions || [],
    };
    return next();
  }

  // 2b. Try JWT verification (AceAdmin panel)
  try {
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;
    req.callerIdentity = {
      id: decoded.agentId || decoded.userId || '',
      name: decoded.username || '',
      role: decoded.role || '',
      permissions: [],
    };
    return next();
  } catch {
    // JWT invalid
  }

  logger.warn('❌ anyAdminAuth: all auth methods failed');
  res.status(401).json({ success: false, message: 'Invalid or expired authentication. Please login again.' });
};

// Helper: restrict to admin/super_admin roles (no agents)
export const requireAdminRole = (req: Request, res: Response, next: NextFunction): void => {
  const role = req.callerIdentity?.role;
  if (role === 'super_admin' || role === 'admin') {
    return next();
  }
  res.status(403).json({ success: false, message: 'Admin or super admin access required.' });
};
