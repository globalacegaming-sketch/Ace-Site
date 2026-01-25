import rateLimit from 'express-rate-limit';

// General API rate limiter - applies to all routes
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Strict rate limiter for authentication endpoints - prevents brute force attacks
export const authLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 5, // Limit each IP to 5 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 5 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// Moderate rate limiter for password reset and verification
export const passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // Limit each IP to 3 requests per hour
  message: {
    success: false,
    message: 'Too many password reset attempts, please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiter for crypto payment creation - prevents abuse
export const paymentCreateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 payment creations per 15 min per IP
  message: {
    success: false,
    message: 'Too many payment requests. Please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// Strict rate limiter for registration
export const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10, // Limit each IP to 10 registrations per hour
  message: {
    success: false,
    message: 'Too many registration attempts, please try again after 1 hour.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Note: We count ALL registration attempts (successful and failed) to prevent abuse
  // This prevents attackers from creating unlimited accounts from a single IP
});

