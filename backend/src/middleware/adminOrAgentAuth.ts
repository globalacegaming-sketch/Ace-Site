import { Request, Response, NextFunction } from 'express';
import { validateAdminSession, revokeAdminSession } from '../services/adminSessionService';
import { authenticateAgentToken, getAgentStatus, ADMIN_ROLES } from '../utils/agentToken';

interface AdminOrAgentAuthOptions {
  /** Roles accepted on the agent-JWT path. Defaults to all agent roles. */
  jwtRoles?: readonly string[];
  /** Permission an AceAgent session (role 'agent') must hold. Admin roles always pass. */
  permission?: string;
}

/**
 * Accepts an AceAgent bearer session token (in-memory store) or an agent JWT.
 * Populates req.adminSession or req.agentSession respectively.
 */
export const requireAdminOrAgentAuth = (options: AdminOrAgentAuthOptions = {}) => {
  const jwtRoles = options.jwtRoles ?? ['super_admin', 'admin', 'agent'];

  const hasPermission = (role: string, permissions: string[]): boolean =>
    !options.permission ||
    (ADMIN_ROLES as readonly string[]).includes(role) ||
    permissions.includes(options.permission);

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ') || authHeader === 'Bearer null') {
      res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
      return;
    }

    const token = authHeader.substring(7);

    try {
      const adminSession = validateAdminSession(token);
      if (adminSession) {
        const status = await getAgentStatus(adminSession.adminId);
        if (status?.isActive) {
          if (!hasPermission(status.role, status.permissions)) {
            res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
            return;
          }
          req.adminSession = { ...adminSession, role: status.role, permissions: status.permissions };
          return next();
        }
        revokeAdminSession(token);
      }

      const agent = await authenticateAgentToken(token);
      if (agent && jwtRoles.includes(agent.role)) {
        if (!hasPermission(agent.role, agent.permissions)) {
          res.status(403).json({ success: false, message: 'You do not have permission to perform this action.' });
          return;
        }
        req.agentSession = {
          username: agent.username,
          displayName: agent.displayName,
          role: agent.role,
          userId: agent.agentId,
        };
        return next();
      }

      res.status(401).json({ success: false, message: 'Invalid or expired session. Please login again.' });
    } catch (error) {
      next(error);
    }
  };
};
