import { Response } from 'express';

/**
 * Standard API response format
 */
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  requestId?: string;
  count?: number;
  error?: string; // Only in development
  stack?: string; // Only in development
}

/**
 * Send a successful response
 */
export const sendSuccess = <T = any>(
  res: Response,
  message: string,
  data?: T,
  statusCode: number = 200,
  count?: number
): Response => {
  const response: ApiResponse<T> = {
    success: true,
    message,
    ...(data !== undefined && { data }),
    ...(count !== undefined && { count }),
    ...(res.locals.requestId && { requestId: res.locals.requestId })
  };

  return res.status(statusCode).json(response);
};

/**
 * Send an error response
 */
export const sendError = (
  res: Response,
  message: string,
  statusCode: number = 400,
  error?: string
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(error && process.env.NODE_ENV === 'development' && { error }),
    ...(res.locals.requestId && { requestId: res.locals.requestId })
  };

  return res.status(statusCode).json(response);
};

/**
 * Send a validation error response
 */
export const sendValidationError = (
  res: Response,
  message: string,
  errors?: Record<string, string[]>
): Response => {
  const response: ApiResponse = {
    success: false,
    message,
    ...(errors && { data: { errors } }),
    ...(res.locals.requestId && { requestId: res.locals.requestId })
  };

  return res.status(400).json(response);
};

