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
import { setSocketServerInstance } from './utils/socketManager';
import { verifyToken } from './utils/jwt';
import User from './models/User';
import { validateAdminSession } from './services/adminSessionService';
import logger from './utils/logger';

// CORS configuration for multiple origins
const allowedOrigins = [
  "http://localhost:5173",
  "http://localhost:3000", 
  "https://ace-site-rouge.vercel.app",
  "https://www.globalacegaming.com",
  "https://globalacegaming.com",
  process.env.FRONTEND_URL,
  process.env.VITE_FRONTEND_URL,
  process.env.PRODUCTION_FRONTEND_URL
].filter(Boolean); // Remove any undefined values

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
app.use(helmet());

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }
    
    // Allow any Vercel preview URLs
    if (origin && origin.includes('.vercel.app')) {
      return callback(null, true);
    }
    
    // Allow any localhost development
    if (origin && origin.includes('localhost')) {
      return callback(null, true);
    }
    
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
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
