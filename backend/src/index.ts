import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// Load environment variables
dotenv.config();

// Import database connection
import connectDB from './config/database';

// Import Agent Login service
import agentLoginService from './services/agentLoginService';
import fortunePandaService from './services/fortunePandaService';

// Import routes
import authRoutes from './routes/auth';
import userRoutes from './routes/user';
import gameRoutes from './routes/games';
import transactionRoutes from './routes/transactions';
import contentRoutes from './routes/content';
import adminRoutes from './routes/admin';
import fortunePandaRoutes from './routes/fortunePanda';
import fortunePandaUserRoutes from './routes/fortunePandaUser';
import proxyRoutes from './routes/proxy';
import platformRoutes from './routes/platform';
import bonusRoutes from './routes/bonus';
import agentAuthRoutes from './routes/agentAuth';
import faqRoutes from './routes/faq';
import noticeRoutes from './routes/notice';
import notificationRoutes from './routes/notification';
import contactsRoutes from './routes/contacts';
import chatRoutes from './routes/chat';
import adminChatRoutes from './routes/adminChat';
import supportTicketRoutes from './routes/supportTicket';
import emailPromotionsRoutes from './routes/emailPromotions';
import wheelRoutes from './routes/wheel';
import adminWheelRoutes from './routes/adminWheel';
import agentWheelRoutes from './routes/agentWheel';
import agentReferralRoutes from './routes/agentReferrals';
import webhooksRoutes from './routes/webhooks';
import walletRoutes from './routes/wallet';

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';
import { requestIdMiddleware } from './middleware/requestId';
import { setSocketServerInstance } from './utils/socketManager';
import { verifyToken } from './utils/jwt';
import User from './models/User';
import { validateAdminSession } from './services/adminSessionService';
import logger from './utils/logger';
import timeout from 'connect-timeout';

// ── Session middleware (MongoDB-backed, shared with Socket.io) ──
import sessionMiddleware from './config/session';

// CORS configuration for multiple origins
const isProduction = process.env.NODE_ENV === 'production';

// Base allowed origins - always allowed
const baseAllowedOrigins = [
  "https://www.globalacegaming.com",
  "https://globalacegaming.com",
  "https://aceadmin.globalacegaming.com",
  "https://aceagent.globalacegaming.com",
  process.env.FRONTEND_URL,
  process.env.PRODUCTION_FRONTEND_URL
].filter(Boolean); // Remove any undefined values

// Development origins - only allowed in non-production or when explicitly allowed
// Also allow localhost if ALLOW_LOCALHOST_IN_PROD is set to 'true' (useful for local dev with production-like setup)
const allowLocalhostInProd = process.env.ALLOW_LOCALHOST_IN_PROD === 'true';
const devAllowedOrigins = (isProduction && !allowLocalhostInProd) ? [] : [
  "http://localhost:5173",
  "http://localhost:3000",
  "http://127.0.0.1:5173",
  "http://127.0.0.1:3000"
];

// Note: Vercel preview URLs are handled dynamically in the CORS callback function
// (lines 128-151) based on environment and ALLOW_VERCEL_PREVIEWS config

const allowedOrigins = [...baseAllowedOrigins, ...devAllowedOrigins];

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: allowedOrigins,
    methods: ["GET", "POST"],
    credentials: true
  }
});
setSocketServerInstance(io);

// Middleware
// Configure helmet to allow CORS
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginEmbedderPolicy: false
}));

// Request timeout middleware (30 seconds default, configurable via env)
const requestTimeout = process.env.REQUEST_TIMEOUT || '30s';
app.use(timeout(requestTimeout));

// Request ID middleware for tracing
app.use(requestIdMiddleware);

// Track rejected origins to avoid spam logging
const rejectedOrigins = new Set<string>();
const lastLogTime = new Map<string, number>();
const LOG_THROTTLE_MS = 60000; // Only log each unique origin once per minute

// Store current request for CORS callback access
let currentRequest: any = null;

// Middleware to capture request for CORS callback
app.use((req, res, next) => {
  currentRequest = req;
  next();
});

app.use(cors({
  origin: function (origin, callback) {
    const req = currentRequest;
    const contentType = req?.headers?.['content-type'] || '';
    const isFileUpload = contentType.includes('multipart/form-data');
    const isUploadEndpoint = req?.path?.includes('/messages') || req?.path?.includes('/chat');
    const isUploadMethod = req?.method === 'POST';
    const isStaticFile = req?.path?.startsWith('/uploads');
    
    // Skip CORS check for static file requests (handled by static file middleware)
    if (isStaticFile && req?.method === 'GET') {
      return callback(null, true);
    }
    
    // In production, reject requests with no origin (except for specific cases)
    if (!origin) {
      // Allow file upload requests without origin (FormData sometimes doesn't send origin)
      if ((isFileUpload || isUploadEndpoint) && isUploadMethod) {
        if (!isProduction || process.env.ALLOW_NO_ORIGIN === 'true') {
          return callback(null, true);
        }
      }
      
      // Allow no-origin requests only in development or for specific internal services
      if (!isProduction || process.env.ALLOW_NO_ORIGIN === 'true') {
        return callback(null, true);
      }
      // Throttle logging for no-origin requests
      const now = Date.now();
      const lastLog = lastLogTime.get('no-origin') || 0;
      if (now - lastLog > LOG_THROTTLE_MS) {
        logger.warn('CORS: Rejected request with no origin', { 
          isProduction,
          allowNoOrigin: process.env.ALLOW_NO_ORIGIN,
          path: req?.path,
          method: req?.method,
          isFileUpload,
          isUploadEndpoint
        });
        lastLogTime.set('no-origin', now);
      }
      return callback(new Error('Not allowed by CORS - origin required in production'));
    }
    
    // Check exact match first
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // In development or when explicitly allowed, allow localhost variations
    if ((!isProduction || allowLocalhostInProd) && origin.includes('localhost')) {
      // Validate it's actually localhost (not malicious subdomain)
      try {
        const url = new URL(origin);
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          return callback(null, true);
        }
        // Explicitly reject if hostname doesn't match (e.g., fake-localhost.example.com)
        // This prevents malicious origins from bypassing validation
        if (!rejectedOrigins.has(origin)) {
          logger.warn('CORS: Rejected localhost-like origin with invalid hostname', { 
            origin, 
            hostname: url.hostname 
          });
          rejectedOrigins.add(origin);
        }
        return callback(new Error('Not allowed by CORS - invalid localhost hostname'));
      } catch (e) {
        // Throttle logging
        if (!rejectedOrigins.has(origin)) {
          logger.warn('CORS: Invalid localhost origin format', { origin });
          rejectedOrigins.add(origin);
        }
        return callback(new Error('Invalid origin format'));
      }
    }
    
    // In development, allow Vercel preview URLs (but validate format)
    if (!isProduction && origin.includes('.vercel.app')) {
      // Validate it's a proper Vercel preview URL
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith('.vercel.app') && url.protocol === 'https:') {
          return callback(null, true);
        }
        // Explicitly reject if hostname doesn't end with .vercel.app or protocol isn't https
        // This prevents malicious origins from bypassing validation
        if (!rejectedOrigins.has(origin)) {
          logger.warn('CORS: Rejected Vercel-like origin with invalid format', { 
            origin, 
            hostname: url.hostname,
            protocol: url.protocol
          });
          rejectedOrigins.add(origin);
        }
        return callback(new Error('Not allowed by CORS - invalid Vercel origin format'));
      } catch (e) {
        // Throttle logging
        if (!rejectedOrigins.has(origin)) {
          logger.warn('CORS: Invalid Vercel origin format', { origin });
          rejectedOrigins.add(origin);
        }
        return callback(new Error('Invalid origin format'));
      }
    }
    
    // In production with explicit permission, allow specific Vercel previews
    if (isProduction && process.env.ALLOW_VERCEL_PREVIEWS === 'true' && origin.includes('.vercel.app')) {
      try {
        const url = new URL(origin);
        if (url.hostname.endsWith('.vercel.app') && url.protocol === 'https:') {
          return callback(null, true);
        }
        // Explicitly reject if hostname doesn't end with .vercel.app or protocol isn't https
        // This prevents malicious origins from bypassing validation
        if (!rejectedOrigins.has(origin)) {
          logger.warn('CORS: Rejected Vercel-like origin with invalid format', { 
            origin, 
            hostname: url.hostname,
            protocol: url.protocol
          });
          rejectedOrigins.add(origin);
        }
        return callback(new Error('Not allowed by CORS - invalid Vercel origin format'));
      } catch (e) {
        // Throttle logging
        if (!rejectedOrigins.has(origin)) {
          logger.warn('CORS: Invalid Vercel origin format', { origin });
          rejectedOrigins.add(origin);
        }
        return callback(new Error('Invalid origin format'));
      }
    }
    
    // Throttle logging for rejected origins (only log once per minute per unique origin)
    const now = Date.now();
    const lastLog = lastLogTime.get(origin) || 0;
    if (now - lastLog > LOG_THROTTLE_MS) {
      logger.warn('CORS: Rejected origin', { 
        origin,
        allowedOrigins: allowedOrigins.slice(0, 3), // Log first 3 for reference
        isProduction 
      });
      lastLogTime.set(origin, now);
      rejectedOrigins.add(origin);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept', 'Origin'],
  exposedHeaders: ['Content-Type', 'Content-Length', 'Content-Disposition'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));

// Webhooks must be mounted before express.json so NowPayments IPN gets raw body for signature verification
app.use('/api/webhooks', webhooksRoutes);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ── Mount session middleware (with path filter) ──
// Session middleware reads the cookie, then loads the session from MongoDB.
// For paths that never use sessions (health checks, static files, root),
// we skip it entirely to avoid the MongoDB round-trip.
app.use((req, res, next) => {
  if (req.path === '/' || req.path === '/health' || req.path.startsWith('/uploads')) {
    return next();
  }
  return sessionMiddleware(req, res, next);
});

// Serve uploads with CORS headers for image previews
// This must handle CORS properly for image fetching
// Note: Images loaded in <img> tags don't send Origin header, so we need to be permissive
app.use(
  '/uploads',
  (req, res, next) => {
    const origin = req.headers.origin;
    
    // Handle preflight OPTIONS request
    if (req.method === 'OPTIONS') {
      // Be permissive for static file OPTIONS - allow all origins in dev, check in prod
      if (origin) {
        const isAllowed = allowedOrigins.includes(origin) || 
                         (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) ||
                         (isProduction && process.env.ALLOW_NO_ORIGIN === 'true');
        
        if (isAllowed || !isProduction) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
          res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
          res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
          return res.status(204).end();
        }
      } else if (!isProduction || process.env.ALLOW_NO_ORIGIN === 'true') {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
        return res.status(204).end();
      }
      return res.status(403).end();
    }
    
    // Handle GET requests for static files
    // For images loaded via <img> tags, browsers don't send Origin header
    // We need to set permissive CORS headers to allow image loading
    if (req.method === 'GET') {
      if (origin) {
        // If origin is provided, check if it's allowed
        const isAllowed = allowedOrigins.includes(origin) || 
                         (!isProduction && (origin.includes('localhost') || origin.includes('127.0.0.1'))) ||
                         (isProduction && process.env.ALLOW_NO_ORIGIN === 'true');
        
        if (isAllowed || !isProduction) {
          res.setHeader('Access-Control-Allow-Origin', origin);
          res.setHeader('Access-Control-Allow-Credentials', 'true');
        } else {
          // In production with origin but not allowed, still allow but don't set CORS
          // This allows same-origin requests
        }
      } else {
        // No origin header - this happens with <img> tags or same-origin requests
        // Set permissive CORS to allow image loading
        // In development, always allow; in production, only if ALLOW_NO_ORIGIN is set
        if (!isProduction || process.env.ALLOW_NO_ORIGIN === 'true') {
          res.setHeader('Access-Control-Allow-Origin', '*');
        }
        // If same-origin, no CORS headers needed, but setting them doesn't hurt
      }
    }
    
    next();
  },
  express.static(path.resolve(__dirname, '../uploads'), {
    setHeaders: (res, filePath) => {
      // Always set CORS headers for static files to allow image loading
      // Images loaded via <img> tags don't send Origin header, so we need to be permissive
      const existingOrigin = res.getHeader('Access-Control-Allow-Origin');
      if (!existingOrigin) {
        // If no origin header was set by middleware, set a permissive one
        // In production, only if ALLOW_NO_ORIGIN is set; in dev, always allow
        if (!isProduction || process.env.ALLOW_NO_ORIGIN === 'true') {
          res.setHeader('Access-Control-Allow-Origin', '*');
        } else {
          // In production without ALLOW_NO_ORIGIN, try to get origin from request
          // But we can't access req here, so we'll be more restrictive
          // The middleware above should have handled this
        }
      }
      // Always set these headers for static files
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  })
);

// Request logging middleware
// Request logging removed for production

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Global Ace Gaming Backend API',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    endpoints: {
      health: '/health',
      api: '/api'
    }
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Global Ace Gaming Backend',
    version: '1.0.0',
    cors: {
      allowedOrigins: allowedOrigins,
      requestOrigin: req.headers.origin
    }
  });
});


// Agent login health check endpoint
app.post('/api/health/agent/relogin', async (req, res) => {
  try {
    const result = await agentLoginService.forceReLogin();
    res.json({
      status: result.success ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      service: 'Agent Login Service',
      message: result.message,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      service: 'Agent Login Service',
      message: 'Force re-login failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/games', gameRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/content', contentRoutes);
// Mount /api/admin/wheel and /api/admin/messages before /api/admin so they are matched first.
// /api/admin would otherwise catch /api/admin/wheel/* and run requireAdminAuth, which rejects agent JWTs.
app.use('/api/admin/wheel', adminWheelRoutes);
app.use('/api/admin/messages', adminChatRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/fortune-panda', fortunePandaRoutes);
app.use('/api/fortune-panda-user', fortunePandaUserRoutes);
app.use('/api', proxyRoutes);
app.use('/api/platforms', platformRoutes);
app.use('/api/bonuses', bonusRoutes);
app.use('/api/agent-auth', agentAuthRoutes);
app.use('/api/faqs', faqRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/contacts', contactsRoutes);
app.use('/api/chat', chatRoutes);
app.use('/api/support-tickets', supportTicketRoutes);
app.use('/api/email-promotions', emailPromotionsRoutes);
app.use('/api/wheel', wheelRoutes);
app.use('/api/agent/wheel', agentWheelRoutes);
app.use('/api/agent/referrals', agentReferralRoutes);
app.use('/api/wallet', walletRoutes);

// ── Share session with Socket.io ──
// Wrap the Express session middleware so it runs on the Socket.io handshake
// HTTP request. This parses the session cookie and loads the session from
// MongoDB, making it available as socket.request.session.
io.engine.use(sessionMiddleware);

// WebSocket connection handling
// Checks the MongoDB session FIRST (set by login cookie), then falls back
// to token-based auth for backward compatibility (e.g. mobile clients).
io.use(async (socket, next) => {
  try {
    // ── 1. Try session cookie (preferred – shared with Express) ──
    const session = (socket.request as any).session;

    // Check if session has a logged-in user
    if (session?.user?.id) {
      socket.data.role = session.user.role === 'admin' ? 'admin' : 'user';
      socket.data.user = {
        id: session.user.id,
        username: session.user.username,
        email: session.user.email,
        role: session.user.role,
      };
      return next();
    }

    // Check if session has an admin login
    if (session?.adminSession && session.adminSession.expiresAt > Date.now()) {
      socket.data.role = 'admin';
      socket.data.adminSession = session.adminSession;
      return next();
    }

    // ── 2. Fall back to token-based auth (backward compatibility) ──
    const auth = (socket.handshake.auth || {}) as {
      token?: string;
      adminToken?: string;
    };

    const headerAuth = typeof socket.handshake.headers.authorization === 'string'
      ? socket.handshake.headers.authorization
      : undefined;

    const bearerToken = headerAuth?.startsWith('Bearer ')
      ? headerAuth.substring(7)
      : undefined;

    const queryAdminToken = socket.handshake.query.adminToken;
    const adminToken =
      typeof auth.adminToken === 'string'
        ? auth.adminToken
        : typeof queryAdminToken === 'string'
          ? queryAdminToken
          : undefined;

    if (typeof adminToken === 'string') {
      const adminSession = validateAdminSession(adminToken);
      if (!adminSession) {
        return next(new Error('Unauthorized'));
      }

      socket.data.role = 'admin';
      socket.data.adminSession = adminSession;
      return next();
    }

    const queryToken = socket.handshake.query.token;
    const tokenCandidate =
      typeof auth.token === 'string'
        ? auth.token
        : typeof queryToken === 'string'
          ? queryToken
          : bearerToken;

    const token = typeof tokenCandidate === 'string' ? tokenCandidate : undefined;

    if (!token || typeof token !== 'string') {
      return next(new Error('Unauthorized'));
    }

    const payload = verifyToken(token);
    const user = await User.findById(payload.userId)
      .select('username email role isActive')
      .lean();

    if (!user || !user.isActive) {
      return next(new Error('Unauthorized'));
    }

    socket.data.role = user.role === 'admin' ? 'admin' : 'user';
    socket.data.user = {
      id: user._id?.toString(),
      username: user.username,
      email: user.email,
      role: user.role
    };

    next();
  } catch (error) {
    next(new Error('Unauthorized'));
  }
});

io.on('connection', (socket) => {
  if (socket.data.role === 'admin') {
    socket.join('admins');
    socket.emit('chat:connected', {
      role: 'admin',
      agentName: socket.data.adminSession?.agentName
    });
  } else if (socket.data.user?.id) {
    const room = `user:${socket.data.user.id}`;
    socket.join(room);
    socket.emit('chat:connected', {
      role: 'user',
      userId: socket.data.user.id
    });
  }

  socket.on('disconnect', () => {
    // Client disconnected
  });
  
  // Handle game-related events
  socket.on('join-game', (data) => {
    socket.join(`game-${data.gameId}`);
  });
  
  socket.on('leave-game', (data) => {
    socket.leave(`game-${data.gameId}`);
  });
});

// Error handling middleware
app.use(notFound);
app.use(errorHandler);

// Connect to database and start server
const PORT = process.env.PORT || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';

const startServer = async () => {
  try {
    logger.init('🔧 Starting server initialization...');
    logger.info(`📊 Environment: ${NODE_ENV}`);
    logger.info(`🔌 Port: ${PORT}`);
    
    // Connect to MongoDB
    logger.init('🗄️ Connecting to MongoDB...');
    await connectDB();
    logger.success('✅ MongoDB connected successfully');

    // One-time cleanup: drop sessions that were encrypted under the old crypto
    // config. They contain raw certificate data instead of JSON and crash
    // connect-mongo's unserialize(). Safe to remove — users just re-login.
    try {
      const mongoose = (await import('mongoose')).default;
      const db = mongoose.connection.db;
      if (db) {
        const sessions = db.collection('sessions');
        const result = await sessions.deleteMany({
          session: { $not: { $regex: /^\{/ } },
        });
        if (result.deletedCount > 0) {
          logger.warn(`🧹 Purged ${result.deletedCount} corrupted session(s) from MongoDB`);
        }
      }
    } catch (cleanupErr) {
      logger.warn('⚠️  Session cleanup skipped:', cleanupErr);
    }

    // Start server first
    logger.init('🚀 Starting HTTP server...');
    server.listen(PORT, () => {
      logger.success(`🚀 Global Ace Gaming Backend Server running on port ${PORT}`);
      logger.info(`🌍 Environment: ${NODE_ENV}`);
      logger.info(`🔗 API Base URL: http://localhost:${PORT}/api`);
      logger.info(`📡 WebSocket Server: ws://localhost:${PORT}`);
      logger.success('✅ Server started successfully!');
    });
    
    // Initialize Agent Login service
    logger.init('🎰 Initializing Agent Login service...');
    try {
      await agentLoginService.initialize();
      // Service logs its own success message
    } catch (error) {
      logger.warn('⚠️ Agent Login service initialization failed, but continuing:', error);
    }
    
    // Initialize Fortune Panda service
    logger.init('🎰 Initializing Fortune Panda service...');
    try {
      await fortunePandaService.initialize();
      // Service logs its own success message
    } catch (error) {
      logger.warn('⚠️ Fortune Panda service initialization failed, but continuing:', error);
    }

    // NowPayments (crypto wallet): warn if not configured
    if (!process.env.NOWPAYMENTS_API_KEY || !process.env.NOWPAYMENTS_IPN_SECRET) {
      logger.warn('⚠️ NowPayments not configured: set NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET in .env to enable crypto wallet loading. POST /api/wallet/create-crypto-payment will return 503 until then.');
    }
    
    // Services are now ready for game list fetching
    logger.info('🔄 Services are ready for game list fetching');
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  agentLoginService.cleanup();
  fortunePandaService.cleanup();
  server.close(() => {
    logger.info('Process terminated');
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  agentLoginService.cleanup();
  fortunePandaService.cleanup();
  server.close(() => {
    logger.info('Process terminated');
  });
});

export { app, io };
