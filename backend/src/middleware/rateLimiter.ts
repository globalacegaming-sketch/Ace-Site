import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';

// General API rate limiter - applies to all routes
// This provides basic DDoS protection by limiting request frequency per IP
const isProduction = process.env.NODE_ENV === 'production';

export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isProduction ? 300 : 1000, // 300 in production, 1000 in dev
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    if (req.path === '/health' || req.path === '/' || req.path.startsWith('/uploads')) return true;
    // Authenticated API calls (chat, loan, admin) have their own per-user limiters;
    // skip the per-IP general limiter for them to prevent shared-IP exhaustion.
    const hasAuth = !!req.headers.authorization;
    if (hasAuth && (
      req.path.startsWith('/api/chat') ||
      req.path.startsWith('/api/loan') ||
      req.path.startsWith('/api/agent/loan') ||
      req.path.startsWith('/api/admin/messages') ||
      req.path.startsWith('/api/notifications')
    )) return true;
    return false;
  },
});

// Progressive rate limiting - slows down responses after initial burst
// express-slow-down v2+: delayMs is (used, req, res) => delay in ms; used = hits in current window
const DELAY_AFTER = 50;
const DELAY_MS_PER_HIT = 100;
const MAX_DELAY_MS = 2000;

export const speedLimiter = slowDown({
  windowMs: 15 * 60 * 1000, // 15 minutes
  delayAfter: DELAY_AFTER,
  delayMs: (used) => Math.min(MAX_DELAY_MS, Math.max(0, (used - DELAY_AFTER) * DELAY_MS_PER_HIT)),
  skip: (req) => {
    if (req.path === '/health' || req.path === '/' || req.path.startsWith('/uploads')) return true;
    const hasAuth = !!req.headers.authorization;
    if (hasAuth && (
      req.path.startsWith('/api/chat') ||
      req.path.startsWith('/api/loan') ||
      req.path.startsWith('/api/agent/loan') ||
      req.path.startsWith('/api/admin/messages') ||
      req.path.startsWith('/api/notifications')
    )) return true;
    return false;
  },
});

// Rate limiter for authentication endpoints - prevents brute force attacks
// Increased limits to prevent blocking legitimate users
export const authLimiter = rateLimit({
  windowMs: 10 * 60 * 1000, // 10 minutes
  max: 15, // Limit each IP to 15 requests per windowMs (increased from 5)
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 10 minutes.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

// More lenient rate limiter for admin/agent logins
// These accounts need higher limits for legitimate access
export const adminAuthLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again after 15 minutes.'
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

// Loan request: per-user limit (must run after authenticate so req.user is set)
export const loanRequestLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 5,
  message: {
    success: false,
    message: 'Too many loan requests. Please wait a moment and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    const uid = req.user?._id ?? req.user?.id;
    return uid ? `loan:${uid}` : 'loan:anonymous';
  },
});

// Wheel spin: per-user limit (must run after authenticate so req.user is set)
// Prevents rapid repeated spin attempts / scripted abuse
export const wheelSpinLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // Max 10 spin attempts per minute per user (covers double-click + a few retries)
  message: {
    success: false,
    message: 'Too many spin attempts. Please wait a moment and try again.'
  },
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req: any) => {
    // This limiter runs after `authenticate`, so req.user is always set.
    // We key on user ID (not IP) to rate-limit per user.
    // Fallback to a static key (never req.ip) to avoid ERR_ERL_KEY_GEN_IPV6.
    const uid = req.user?._id ?? req.user?.id;
    return uid ? `wheel:${uid}` : 'wheel:anonymous';
  },
});

