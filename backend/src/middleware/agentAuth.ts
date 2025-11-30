import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';

declare global {
  namespace Express {
    interface Request {
      agentSession?: {
        username: string;
        role: string;
        userId?: string;
      };
    }
  }
}

export const requireAgentAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No agent token provided.'
    });
    return;
  }

  const token = authHeader.substring(7);

  try {
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;
    
    if (decoded.role !== 'agent' || decoded.type !== 'agent') {
      res.status(403).json({
        success: false,
        message: 'Invalid token type. Agent token required.'
      });
      return;
    }

    // Add agent session to request
    req.agentSession = {
      username: decoded.username,
      role: decoded.role,
      userId: decoded.userId
    };

    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired agent token. Please login again.'
    });
  }
};

