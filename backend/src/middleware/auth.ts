import { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../utils/jwt';
import User, { IUser } from '../models/User';

// Extend Express Request interface to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

/**
 * Resolves the caller's user id from the session cookie (preferred) or a
 * Bearer JWT. Returns undefined when neither is present; throws when a
 * Bearer token is present but invalid.
 */
const resolveUserId = (req: Request): string | undefined => {
  if (req.session?.user?.id) {
    return req.session.user.id;
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return undefined;
  }

  return verifyToken(authHeader.substring(7)).userId;
};

const loadUser = async (userId: string, withGameCredentials: boolean): Promise<IUser | null> => {
  // .lean() returns a plain JS object instead of a Mongoose Document,
  // skipping prototype hydration (getters, setters, save(), etc.).
  // This is 2-5× faster and is safe because no route calls req.user.save().
  const projection = withGameCredentials ? '-password +fortunePandaPassword' : '-password';
  return await User.findById(userId).select(projection).lean() as unknown as IUser | null;
};

// ──────────────────────────────────────────────────────────────────────────────
// authenticate middleware
// ──────────────────────────────────────────────────────────────────────────────
// Checks for a valid user identity in this order:
//   1. Server-side session cookie (MongoDB-backed, set on login).
//   2. Bearer JWT token in the Authorization header (backward compatibility).
//
// If a session is found, the full user document is loaded from the DB and
// attached to req.user (same as the JWT path), so downstream route handlers
// don't need to care which method was used.
// ──────────────────────────────────────────────────────────────────────────────
const createAuthenticate = (withGameCredentials: boolean) =>
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = resolveUserId(req);

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Access denied. No session or token provided.'
        });
        return;
      }

      const user = await loadUser(userId, withGameCredentials);

      if (!user) {
        res.status(401).json({
          success: false,
          message: 'User no longer exists.'
        });
        return;
      }

      if (!user.isActive) {
        res.status(401).json({
          success: false,
          message: 'Account is deactivated.'
        });
        return;
      }

      if ((user as any).isBanned) {
        // Destroy session so the banned user is fully logged out
        if (req.session) {
          req.session.destroy(() => {});
        }
        res.status(403).json({
          success: false,
          message: 'Your account has been suspended.',
          code: 'ACCOUNT_BANNED'
        });
        return;
      }

      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({
        success: false,
        message: 'Invalid or expired session/token.'
      });
    }
  };

export const authenticate = createAuthenticate(false);

/** Same as authenticate, but also loads fortunePandaPassword onto req.user. Only for game-account routes. */
export const authenticateWithGameCredentials = createAuthenticate(true);

/** Attaches req.user when a valid, active, non-banned identity is present; never rejects. */
export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const userId = resolveUserId(req);
    if (userId) {
      const user = await loadUser(userId, false);
      if (user && user.isActive && !(user as any).isBanned) {
        req.user = user;
      }
    }
  } catch {
    // Invalid token: continue as anonymous
  }
  next();
};

export const authorize = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: 'Access denied. User not authenticated.'
      });
      return;
    }

    if (!roles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: 'Access denied. Insufficient permissions.'
      });
      return;
    }

    next();
  };
};
