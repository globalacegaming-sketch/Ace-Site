// ──────────────────────────────────────────────────────────────────────────────
// Session Configuration with MongoDB Store
// ──────────────────────────────────────────────────────────────────────────────
// This module configures express-session backed by connect-mongo so that:
//   1. Sessions are persisted in MongoDB (survives server restarts).
//   2. The session cookie is httpOnly & secure in production.
//   3. The TTL in MongoDB matches the cookie maxAge exactly.
//   4. Socket.io shares the same session middleware (see index.ts).
// ──────────────────────────────────────────────────────────────────────────────

import session from 'express-session';
import MongoStore from 'connect-mongo';
import logger from '../utils/logger';

// ── Extend the express-session SessionData type ─────────────────────────────
// This tells TypeScript what custom properties we store on each session.
declare module 'express-session' {
  interface SessionData {
    /** Populated after user login – lightweight user identity */
    user?: {
      id: string;
      username: string;
      email: string;
      firstName: string;
      lastName: string;
      role: string;
    };
    /** Device info stored at login — used by Active Sessions UI */
    userAgent?: string;
    ip?: string;
    /** Populated after admin login */
    adminSession?: {
      agentName: string;
      token: string;
      expiresAt: number;
    };
  }
}

// ── Constants ────────────────────────────────────────────────────────────────
const SESSION_SECRET = process.env.SESSION_SECRET || 'change-this-session-secret-in-production';
const MONGO_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/global-ace-gaming';
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Cookie / session lifetime: 7 days.
// This matches the default JWT_EXPIRES_IN so existing tokens & new sessions
// expire at the same time, avoiding confusion.
const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

// ── Warn about default secret in production ─────────────────────────────────
if (IS_PRODUCTION && SESSION_SECRET === 'change-this-session-secret-in-production') {
  logger.warn(
    '⚠️  SESSION_SECRET is using the default value! ' +
    'Set a strong random string in your environment variables for production.'
  );
}

// ── Build the session middleware ─────────────────────────────────────────────
export const sessionMiddleware = session({
  // Secret used to sign the session ID cookie.
  // In production you MUST set SESSION_SECRET env var to a strong random string.
  secret: SESSION_SECRET,

  // resave: false → Don't re-save the session to the store if it wasn't
  // modified during the request. Avoids unnecessary writes & race conditions.
  resave: false,

  // saveUninitialized: false → Don't create a session for unauthenticated
  // visitors. Saves storage and avoids setting cookies before login.
  saveUninitialized: false,

  // MongoDB-backed store via connect-mongo.
  // Sessions are stored as documents in the "sessions" collection.
  store: MongoStore.create({
    mongoUrl: MONGO_URI,
    collectionName: 'sessions',       // Collection that holds session documents
    ttl: COOKIE_MAX_AGE_MS / 1000,    // TTL in seconds – MUST match cookie maxAge
    autoRemove: 'native',             // Use MongoDB's native TTL index for cleanup
    touchAfter: 24 * 3600,            // Only touch (update expiry) once per 24 h
                                      // unless session data actually changes

    // Graceful deserialization — if a session document is corrupted (e.g. leftover
    // encrypted data from the old crypto config), discard it instead of crashing
    // the entire request. The user will simply get a fresh session.
    serialize: (session: Record<string, unknown>) => JSON.stringify(session),
    unserialize: (raw: string) => {
      try {
        return JSON.parse(raw);
      } catch {
        logger.warn('⚠️  Discarding corrupted session (unserialize failed)');
        return {};
      }
    },
  }),

  // Cookie options
  cookie: {
    maxAge: COOKIE_MAX_AGE_MS,        // 7 days – matches the MongoDB TTL above
    httpOnly: true,                   // JS cannot read this cookie (XSS protection)
    secure: IS_PRODUCTION,            // Only send over HTTPS in production
    sameSite: IS_PRODUCTION ? 'none' as const : 'lax' as const,
    // 'none' is required when frontend & backend are on different origins
    // (e.g. globalacegaming.com ↔ api.globalacegaming.com).
    // 'lax' is fine for same-origin / same-site development.
    path: '/',
  },

  // Custom cookie name to avoid the default 'connect.sid' fingerprint.
  name: 'gag.sid',
});

export default sessionMiddleware;
