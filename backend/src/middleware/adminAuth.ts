import { Request, Response, NextFunction } from 'express';
import { validateAdminSession, revokeAdminSession } from '../services/adminSessionService';
import { authenticateAgentToken, getAgentStatus, ADMIN_ROLES } from '../utils/agentToken';
import logger from '../utils/logger';

type AdminSession = {
  adminId: string;
  agentName: string;
  token: string;
  expiresAt: number;
  role: string;
  permissions: string[];
};

declare global {
  namespace Express {
    interface Request {
      adminSession?: AdminSession;
    }
  }
}

/** Re-reads role/permissions/isActive from the database so deactivation and permission changes apply to live sessions. */
const refreshSession = async (session: AdminSession): Promise<AdminSession | null> => {
  const status = await getAgentStatus(session.adminId);
  if (!status || !status.isActive) {
    return null;
  }
  return { ...session, role: status.role, permissions: status.permissions };
};

// ──────────────────────────────────────────────────────────────────────────────
// requireAdminAuth middleware
// ──────────────────────────────────────────────────────────────────────────────
// Checks for a valid admin identity in this order:
//   1. Server-side session cookie (MongoDB-backed, set on admin login).
//   2. Bearer token in the Authorization header validated against in-memory
//      store (backward compatibility).
//   3. JWT token signed with AGENT_JWT_SECRET (for AceAdmin dashboard).
// ──────────────────────────────────────────────────────────────────────────────
export const requireAdminAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    // ── 1. Check MongoDB session first (preferred, survives restarts) ──
    if (req.session?.adminSession) {
      const sessionAdmin = req.session.adminSession;

      if (sessionAdmin.expiresAt > Date.now()) {
        const refreshed = await refreshSession(sessionAdmin);
        if (refreshed) {
          req.adminSession = refreshed;
          return next();
        }
        logger.warn('❌ Admin session belongs to an inactive or deleted agent:', { agentName: sessionAdmin.agentName });
      }

      delete req.session.adminSession;
    }

    // ── 2. Fall back to Bearer token ──
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
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
      const refreshed = await refreshSession(session);
      if (refreshed) {
        req.adminSession = refreshed;
        return next();
      }
      revokeAdminSession(token);
    }

    // ── 2b. JWT verification (AceAdmin dashboard uses JWT directly) ──
    const agent = await authenticateAgentToken(token);
    if (agent && (ADMIN_ROLES as readonly string[]).includes(agent.role)) {
      req.adminSession = {
        adminId: agent.agentId,
        agentName: agent.username,
        token,
        expiresAt: (agent.exp || 0) * 1000,
        role: agent.role,
        permissions: agent.permissions,
      };
      return next();
    }

    logger.warn('❌ Admin auth failed: Invalid or expired session');
    res.status(401).json({
      success: false,
      message: 'Invalid or expired admin session. Please login again.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Use after requireAdminAuth. super_admin / admin always pass; agents need at
 * least one of the listed permissions.
 */
export const requireAgentPermission = (...permissions: string[]) =>
  (req: Request, res: Response, next: NextFunction): void => {
    const session = req.adminSession;
    if (!session) {
      res.status(401).json({ success: false, message: 'Not authenticated.' });
      return;
    }
    if ((ADMIN_ROLES as readonly string[]).includes(session.role)) {
      next();
      return;
    }
    if (permissions.some((p) => session.permissions.includes(p))) {
      next();
      return;
    }
    res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
  };

/** Use after requireAdminAuth to restrict a route to super_admin / admin. */
export const requireAdminSessionRole = (req: Request, res: Response, next: NextFunction): void => {
  const role = req.adminSession?.role;
  if (role && (ADMIN_ROLES as readonly string[]).includes(role)) {
    next();
    return;
  }
  res.status(403).json({ success: false, message: 'Admin or super admin access required.' });
};
