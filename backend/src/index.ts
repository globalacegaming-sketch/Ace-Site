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

// CORS configuration for multiple origins
const isProduction = process.env.NODE_ENV === 'production';

// Base allowed origins - always allowed
const baseAllowedOrigins = [
  "https://www.globalacegaming.com",
  "https://globalacegaming.com",
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

app.use(cors({
  origin: function (origin, callback) {
    // In production, reject requests with no origin (except for specific cases)
    if (!origin) {
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
          allowNoOrigin: process.env.ALLOW_NO_ORIGIN 
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
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(
  '/uploads',
  express.static(path.resolve(__dirname, '../uploads'))
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
app.use('/api/admin/messages', adminChatRoutes);
app.use('/api/support-tickets', supportTicketRoutes);

// WebSocket connection handling
io.use(async (socket, next) => {
  try {
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
      const session = validateAdminSession(adminToken);
      if (!session) {
        return next(new Error('Unauthorized'));
      }

      socket.data.role = 'admin';
      socket.data.adminSession = session;
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
