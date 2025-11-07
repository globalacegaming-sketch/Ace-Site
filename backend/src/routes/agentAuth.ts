import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';

const router = Router();

// Agent credentials from environment variables
const AGENT_USERNAME = process.env.AGENT_USERNAME;
const AGENT_PASSWORD = process.env.AGENT_PASSWORD;
const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Validate that credentials are set
if (!AGENT_USERNAME || !AGENT_PASSWORD) {
  console.error('⚠️ WARNING: AGENT_USERNAME or AGENT_PASSWORD not set in environment variables!');
  console.error('Please set AGENT_USERNAME and AGENT_PASSWORD in your .env file');
}

// Agent login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    // Check if credentials are configured
    if (!AGENT_USERNAME || !AGENT_PASSWORD) {
      console.error('Agent credentials not configured in environment variables');
      return res.status(500).json({
        success: false,
        message: 'Server configuration error. Please contact administrator.'
      });
    }

    // Trim whitespace from input and environment variables
    const trimmedUsername = username.trim();
    const trimmedPassword = password.trim();
    const trimmedEnvUsername = AGENT_USERNAME?.trim();
    const trimmedEnvPassword = AGENT_PASSWORD?.trim();

    // Debug logging (only in development)
    if (process.env.NODE_ENV === 'development') {
      console.log('🔐 Agent login attempt:', {
        receivedUsername: trimmedUsername,
        receivedPasswordLength: trimmedPassword.length,
        envUsernameLength: trimmedEnvUsername?.length,
        envPasswordLength: trimmedEnvPassword?.length,
        usernameMatch: trimmedUsername === trimmedEnvUsername,
        passwordMatch: trimmedPassword === trimmedEnvPassword
      });
    }

    // Verify credentials (exact match, case-sensitive)
    if (trimmedUsername === trimmedEnvUsername && trimmedPassword === trimmedEnvPassword) {
      // Generate JWT token
      const token = jwt.sign(
        {
          username: trimmedUsername,
          role: 'agent',
          type: 'agent'
        },
        AGENT_JWT_SECRET,
        { expiresIn: '24h' }
      );

      // Store session info
      const sessionData = {
        token,
        username: trimmedUsername,
        role: 'agent',
        expiresAt: Date.now() + 24 * 60 * 60 * 1000 // 24 hours
      };

      return res.json({
        success: true,
        message: 'Agent login successful',
        data: sessionData
      });
    } else {
      return res.status(401).json({
        success: false,
        message: 'Invalid credentials'
      });
    }
  } catch (error: any) {
    console.error('Agent login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message
    });
  }
});

// Verify agent token
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided'
      });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;
      
      if (decoded.role !== 'agent' || decoded.type !== 'agent') {
        return res.status(403).json({
          success: false,
          message: 'Invalid token type'
        });
      }

      return res.json({
        success: true,
        message: 'Token is valid',
        data: {
          username: decoded.username,
          role: decoded.role
        }
      });
    } catch (error) {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token'
      });
    }
  } catch (error: any) {
    console.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message
    });
  }
});

export default router;

