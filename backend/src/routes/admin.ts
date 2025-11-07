import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';
import agentLoginService from '../services/agentLoginService';
import User from '../models/User';
import crypto from 'crypto';

const router = Router();

// Debug endpoint to check env vars (remove in production)
router.get('/debug/env', (req: Request, res: Response) => {
  res.json({
    AGENT_NAME: process.env.AGENT_NAME || 'not set',
    FORTUNE_PANDA_AGENT_NAME: process.env.FORTUNE_PANDA_AGENT_NAME || 'not set',
    FORTUNE_AGENT_USER: process.env.FORTUNE_AGENT_USER || 'not set',
    hasAGENT_PASSWORD: !!process.env.AGENT_PASSWORD,
    hasFORTUNE_PANDA_AGENT_PASSWORD: !!process.env.FORTUNE_PANDA_AGENT_PASSWORD,
    hasFORTUNE_AGENT_PASS: !!process.env.FORTUNE_AGENT_PASS,
    resolvedAgentName: process.env.AGENT_NAME || 
                      process.env.FORTUNE_PANDA_AGENT_NAME || 
                      process.env.FORTUNE_AGENT_USER || 
                      'agent01 (default)',
  });
});

// Admin login route (no auth required)
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { agentName, agentPassword } = req.body;

    console.log('🔐 Admin login attempt:', { agentName, hasPassword: !!agentPassword });

    if (!agentName || !agentPassword) {
      return res.status(400).json({
        success: false,
        message: 'agentName and agentPassword are required'
      });
    }

    // Verify credentials against environment variables
    // Check multiple possible env var names
    const envAgentName = process.env.AGENT_NAME || 
                        process.env.FORTUNE_PANDA_AGENT_NAME || 
                        process.env.FORTUNE_AGENT_USER || 
                        'agent01';
    const envAgentPassword = process.env.AGENT_PASSWORD || 
                            process.env.FORTUNE_PANDA_AGENT_PASSWORD || 
                            process.env.FORTUNE_AGENT_PASS || 
                            '123456';

    console.log('🔍 Checking credentials:', { 
      providedName: agentName, 
      envName: envAgentName,
      nameMatch: agentName === envAgentName 
    });

    if (agentName !== envAgentName) {
      console.log('❌ Agent name mismatch');
      return res.status(401).json({
        success: false,
        message: 'Invalid agent name'
      });
    }

    // Compare password (MD5 hash)
    const providedPasswordMd5 = crypto.createHash('md5').update(agentPassword).digest('hex');
    const envPasswordMd5 = crypto.createHash('md5').update(envAgentPassword).digest('hex');

    console.log('🔍 Password check:', { 
      providedHash: providedPasswordMd5.substring(0, 8) + '...',
      envHash: envPasswordMd5.substring(0, 8) + '...',
      passwordMatch: providedPasswordMd5 === envPasswordMd5 
    });

    if (providedPasswordMd5 !== envPasswordMd5) {
      console.log('❌ Password mismatch');
      return res.status(401).json({
        success: false,
        message: 'Invalid agent password'
      });
    }

    console.log('✅ Credentials verified successfully');

    // Try to login to FortunePanda to verify credentials work (non-blocking)
    // This is optional - if it fails, we still allow login since credentials match env vars
    try {
      const loginResult = await agentLoginService.loginAgent();
      if (!loginResult.success) {
        console.warn('⚠️ FortunePanda API verification failed, but allowing login (credentials match env vars)');
      } else {
        console.log('✅ FortunePanda API verification successful');
      }
    } catch (error) {
      // If login fails, still allow admin access (credentials are correct)
      // This handles cases where API might be temporarily unavailable
      console.warn('⚠️ FortunePanda API verification error, but allowing login:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Create a simple session token (in production, use JWT)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    console.log('✅ Admin login successful, creating session token');

    // Store session (in production, use Redis or database)
    // For now, we'll return the token and verify it matches on subsequent requests
    res.json({
      success: true,
      message: 'Admin login successful',
      data: {
        token: sessionToken,
        expiresAt,
        agentName
      }
    });
  } catch (error) {
    console.error('Admin login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Middleware to verify admin session
const verifyAdminSession = (req: Request, res: Response, next: any) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access denied. No admin token provided.'
    });
  }

  const token = authHeader.substring(7);
  
  // In production, verify token against stored sessions
  // For now, we'll accept any Bearer token (you can enhance this)
  // For better security, store sessions in Redis or database
  
  next();
};

// All other admin routes require admin session
router.use(verifyAdminSession);

// Get agent balance (from FortunePanda)
router.get('/agent-balance', async (req: Request, res: Response) => {
  try {
    // Query any user to get agent balance, or use a test account
    // Agent balance is returned in queryUserInfo response
    // For now, we'll try to get it from the first user with FP account
    const user = await User.findOne({ 
      fortunePandaUsername: { $exists: true, $ne: null },
      fortunePandaPassword: { $exists: true, $ne: null }
    }).select('fortunePandaUsername fortunePandaPassword');

    if (!user || !user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(404).json({
        success: false,
        message: 'No FortunePanda user found to query agent balance'
      });
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Agent balance retrieved successfully',
        data: {
          agentBalance: result.data?.agentBalance || '0.00',
          userBalance: result.data?.userbalance || '0.00',
          account: user.fortunePandaUsername
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to get agent balance'
      });
    }
  } catch (error) {
    console.error('Get agent balance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user info from FortunePanda API
router.get('/users/:userId/fortune-panda', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account'
      });
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);

    if (result.success) {
      // Update user balance in database
      if (result.data?.userbalance) {
        user.fortunePandaBalance = parseFloat(result.data.userbalance);
        user.fortunePandaLastSync = new Date();
        await user.save();
      }

      return res.json({
        success: true,
        message: 'User info retrieved successfully',
        data: {
          fortunePandaUsername: user.fortunePandaUsername,
          userBalance: result.data?.userbalance || '0.00',
          agentBalance: result.data?.agentBalance || '0.00',
          lastLogin: result.data?.lastLogin,
          ...result.data
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to get user info'
      });
    }
  } catch (error) {
    console.error('Get user FortunePanda info error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users list
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await User.find({})
      .select('-password -fortunePandaPassword')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      message: 'Users retrieved successfully',
      data: users,
      count: users.length
    });
  } catch (error) {
    console.error('Get users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get single user details
router.get('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId)
      .select('-password -fortunePandaPassword')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    return res.json({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });
  } catch (error) {
    console.error('Get user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Agent Deposit (Load money to user account)
router.post('/deposit', async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'userId and amount are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account'
      });
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.agentDeposit(
      user.fortunePandaUsername,
      passwdMd5,
      amount.toString()
    );

    if (result.success) {
      // Update user balance in database
      if (result.data?.userbalance) {
        user.fortunePandaBalance = parseFloat(result.data.userbalance);
        user.fortunePandaLastSync = new Date();
        await user.save();
      }

      return res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Deposit error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Agent Redeem (Withdraw money from user account)
router.post('/redeem', async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    if (!userId || !amount) {
      return res.status(400).json({
        success: false,
        message: 'userId and amount are required'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account'
      });
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.agentRedeem(
      user.fortunePandaUsername,
      passwdMd5,
      amount.toString()
    );

    if (result.success) {
      // Update user balance in database
      if (result.data?.userbalance) {
        user.fortunePandaBalance = parseFloat(result.data.userbalance);
        user.fortunePandaLastSync = new Date();
        await user.save();
      }

      return res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Redeem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get Trade Record
router.get('/trades', async (req: Request, res: Response) => {
  try {
    const { userId, fromDate, toDate } = req.query;

    if (!userId || !fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'userId, fromDate, and toDate are required (format: YYYY-MM-DD)'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account'
      });
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.getTradeRecord(
      user.fortunePandaUsername,
      passwdMd5,
      fromDate as string,
      toDate as string
    );

    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Get trade records error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get JP Record (Jackpot Record)
router.get('/jackpots', async (req: Request, res: Response) => {
  try {
    const { userId, fromDate, toDate } = req.query;

    if (!userId || !fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'userId, fromDate, and toDate are required (format: YYYY-MM-DD)'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account'
      });
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.getJpRecord(
      user.fortunePandaUsername,
      passwdMd5,
      fromDate as string,
      toDate as string
    );

    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Get JP records error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get Game Record
router.get('/game-records', async (req: Request, res: Response) => {
  try {
    const { userId, fromDate, toDate, kindId } = req.query;

    if (!userId || !fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'userId, fromDate, and toDate are required (format: YYYY-MM-DD)'
      });
    }

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account'
      });
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.getGameRecord(
      user.fortunePandaUsername,
      passwdMd5,
      fromDate as string,
      toDate as string,
      kindId as string | undefined
    );

    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    console.error('Get game records error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
