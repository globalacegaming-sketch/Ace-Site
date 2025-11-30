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
    console.log('❌ Admin auth failed: No Bearer token in header');
    res.status(401).json({
      success: false,
      message: 'Access denied. No admin token provided.'
    });
    return;
  }

  const token = authHeader.substring(7);
  console.log('🔍 Validating admin token:', token.substring(0, 10) + '...');
  
  const session = validateAdminSession(token);

  if (!session) {
    console.log('❌ Admin auth failed: Invalid or expired session');
    res.status(401).json({
      success: false,
      message: 'Invalid or expired admin session. Please login again.'
    });
    return;
  }

  console.log('✅ Admin auth successful:', { agentName: session.agentName });
  req.adminSession = session;
  next();
};

