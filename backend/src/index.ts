import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { Server } from 'socket.io';

// Load environment variables
dotenv.config();

// Import database connection
import connectDB from './config/database';

// Import Fortune Panda service
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

// Import middleware
import { errorHandler } from './middleware/errorHandler';
import { notFound } from './middleware/notFound';

const app = express();
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:5173",
    methods: ["GET", "POST"]
  }
});

// Middleware
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || "http://localhost:5173",
  credentials: true
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    service: 'Global Ace Gaming Backend',
    version: '1.0.0'
  });
});

// Ping endpoint to keep service alive
app.get('/ping', (req, res) => {
  res.json({ 
    status: 'pong', 
    timestamp: new Date().toISOString(),
    message: 'Service is alive'
  });
});


// Force Fortune Panda re-login endpoint
app.post('/api/health/fortune-panda/relogin', async (req, res) => {
  try {
    const result = await fortunePandaService.forceReLogin();
    res.json({
      status: result.success ? 'OK' : 'ERROR',
      timestamp: new Date().toISOString(),
      service: 'Fortune Panda Agent',
      message: result.message,
      data: result.data
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      service: 'Fortune Panda Agent',
      message: 'Force re-login failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Public Fortune Panda users endpoint (for admin dashboard)
app.get('/api/fortune-panda/users', async (req, res) => {
  try {
    const result = await fortunePandaService.getAllUsersWithFortunePandaInfo();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
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

// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
  
  // Handle game-related events
  socket.on('join-game', (data) => {
    console.log('User joining game:', data);
    socket.join(`game-${data.gameId}`);
  });
  
  socket.on('leave-game', (data) => {
    console.log('User leaving game:', data);
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
    // Connect to MongoDB
    await connectDB();
    
    // Start server first
    server.listen(PORT, () => {
      console.log(`🚀 Global Ace Gaming Backend Server running on port ${PORT}`);
      console.log(`🌍 Environment: ${NODE_ENV}`);
      console.log(`🔗 API Base URL: http://localhost:${PORT}/api`);
      console.log(`📡 WebSocket Server: ws://localhost:${PORT}`);
    });
    
    // Fortune Panda service will be initialized on first API call
    console.log('🔄 Fortune Panda service will be initialized on first API call');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  fortunePandaService.cleanup();
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  fortunePandaService.cleanup();
  server.close(() => {
    console.log('Process terminated');
  });
});

export { app, io };
