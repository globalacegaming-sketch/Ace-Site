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
export const authenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    let userId: string | undefined;

    // ── 1. Check session cookie first (preferred) ──
    if (req.session?.user?.id) {
      userId = req.session.user.id;
    }

    // ── 2. Fall back to Bearer JWT token ──
    if (!userId) {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          success: false,
          message: 'Access denied. No session or token provided.'
        });
        return;
      }

      const token = authHeader.substring(7); // Remove 'Bearer ' prefix
      const decoded = verifyToken(token);
      userId = decoded.userId;
    }

    // ── Load the user document ──
    // .lean() returns a plain JS object instead of a Mongoose Document,
    // skipping prototype hydration (getters, setters, save(), etc.).
    // This is 2-5× faster and is safe because no route calls req.user.save().
    const user = await User.findById(userId).select('-password +fortunePandaPassword').lean() as unknown as IUser | null;

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

    // Add user to request object
    req.user = user;
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      message: 'Invalid or expired session/token.'
    });
  }
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
