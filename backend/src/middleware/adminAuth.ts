import { Request, Response, NextFunction } from 'express';
import { validateAdminSession } from '../services/adminSessionService';

declare global {
  namespace Express {
    interface Request {
      adminSession?: {
        agentName: string;
        token: string;
        expiresAt: number;
      };
    }
  }
}

export const requireAdminAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No admin token provided.'
    });
    return;
  }

  const token = authHeader.substring(7);
  const session = validateAdminSession(token);

  if (!session) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired admin session.'
    });
    return;
  }

  req.adminSession = session;
  next();
};

