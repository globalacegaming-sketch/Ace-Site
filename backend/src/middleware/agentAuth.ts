import { Request, Response, NextFunction } from 'express';
import { authenticateAgentToken, ADMIN_ROLES } from '../utils/agentToken';

declare global {
  namespace Express {
    interface Request {
      agentSession?: {
        username: string;
        displayName?: string;
        role: string;
        userId?: string;
      };
    }
  }
}

export const requireAgentAuth = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No agent token provided.'
    });
    return;
  }

  try {
    const agent = await authenticateAgentToken(authHeader.substring(7));
    if (!agent) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired agent token. Please login again.'
      });
      return;
    }

    req.agentSession = {
      username: agent.username,
      displayName: agent.displayName,
      role: agent.role,
      userId: agent.agentId
    };

    next();
  } catch (error) {
    next(error);
  }
};

/** Use after requireAgentAuth to restrict a route to super_admin / admin tokens. */
export const requireAgentAdminRole = (req: Request, res: Response, next: NextFunction): void => {
  const role = req.agentSession?.role;
  if (role && (ADMIN_ROLES as readonly string[]).includes(role)) {
    next();
    return;
  }
  res.status(403).json({ success: false, message: 'Admin or super admin access required.' });
};
