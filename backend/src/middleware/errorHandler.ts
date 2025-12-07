import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
  isOperational?: boolean;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  let error = { ...err };
  error.message = err.message;

  // CORS errors are expected and shouldn't be logged as errors (they're security features)
  // Only log them at debug level to avoid spam
  if (err.message && err.message.includes('CORS')) {
    logger.debug('CORS rejection (expected):', {
      message: err.message,
      url: req.url,
      method: req.method,
      origin: req.headers.origin || 'no-origin',
      requestId: req.requestId
    });
  } else {
    // Log other errors normally
    logger.error('Error:', {
      message: err.message,
      stack: err.stack,
      url: req.url,
      method: req.method,
      requestId: req.requestId,
      timestamp: new Date().toISOString()
    });
  }

  // Mongoose bad ObjectId
  if (err.name === 'CastError') {
    const message = 'Resource not found';
    error = { message, statusCode: 404 } as AppError;
  }

  // Mongoose duplicate key - handle both MongoError (older) and MongoServerError (newer)
  if ((err.name === 'MongoError' || err.name === 'MongoServerError') && (err as any).code === 11000) {
    const message = 'Duplicate field value entered';
    error = { message, statusCode: 400 } as AppError;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const message = Object.values((err as any).errors).map((val: any) => val.message).join(', ');
    error = { message, statusCode: 400 } as AppError;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    const message = 'Invalid token';
    error = { message, statusCode: 401 } as AppError;
  }

  if (err.name === 'TokenExpiredError') {
    const message = 'Token expired';
    error = { message, statusCode: 401 } as AppError;
  }

  res.status(error.statusCode || 500).json({
    success: false,
    message: error.message || 'Server Error',
    requestId: req.requestId,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};
