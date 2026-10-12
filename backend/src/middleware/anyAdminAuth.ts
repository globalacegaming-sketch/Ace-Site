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
import { validateAdminSession, revokeAdminSession } from '../services/adminSessionService';
import { authenticateAgentToken, getAgentStatus } from '../utils/agentToken';
import logger from '../utils/logger';

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

export const requireAnyAdminAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // ── 1. Try session-based auth (AceAgent panel) ──
    if (req.session?.adminSession) {
      const s = req.session.adminSession;
      if (s.expiresAt > Date.now()) {
        const status = await getAgentStatus(s.adminId);
        if (status?.isActive) {
          req.adminSession = { ...s, role: status.role, permissions: status.permissions };
          req.callerIdentity = {
            id: s.adminId,
            name: s.agentName,
            role: status.role,
            permissions: status.permissions,
          };
          return next();
        }
      }
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
      const status = await getAgentStatus(memSession.adminId);
      if (status?.isActive) {
        req.adminSession = { ...memSession, role: status.role, permissions: status.permissions };
        req.callerIdentity = {
          id: memSession.adminId,
          name: memSession.agentName,
          role: status.role,
          permissions: status.permissions,
        };
        return next();
      }
      revokeAdminSession(token);
    }

    // 2b. Try agent JWT verification (AceAdmin panel). Player tokens lack type: 'agent' and are rejected.
    const agent = await authenticateAgentToken(token);
    if (agent) {
      req.callerIdentity = {
        id: agent.agentId,
        name: agent.username,
        role: agent.role,
        permissions: agent.permissions,
      };
      return next();
    }

    logger.warn('❌ anyAdminAuth: all auth methods failed');
    res.status(401).json({ success: false, message: 'Invalid or expired authentication. Please login again.' });
  } catch (error) {
    next(error);
  }
};

// Helper: restrict to admin/super_admin roles (no agents)
export const requireAdminRole = (req: Request, res: Response, next: NextFunction): void => {
  const role = req.callerIdentity?.role;
  if (role === 'super_admin' || role === 'admin') {
    return next();
  }
  res.status(403).json({ success: false, message: 'Admin or super admin access required.' });
};
