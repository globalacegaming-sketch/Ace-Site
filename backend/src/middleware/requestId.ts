import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extend Express Request interface to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
    }
  }
}

/**
 * Middleware to add a unique request ID to each request
 * This helps with tracing requests across services and logs
 */
export const requestIdMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Use existing request ID from header if present, otherwise generate new one
  const requestId = (req.headers['x-request-id'] as string) || uuidv4();
  
  // Add to request object for use in routes
  req.requestId = requestId;
  
  // Add to response locals for use in response utilities
  res.locals.requestId = requestId;
  
  // Add to response headers for client tracing
  res.setHeader('X-Request-ID', requestId);
  
  next();
};

