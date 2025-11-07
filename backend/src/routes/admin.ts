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

    // Perform agent login to FortunePanda API to establish session
    // This ensures agentKey is cached and ready for all admin operations
    let agentBalance = '0.00';
    try {
      console.log('🔐 Performing agent login to FortunePanda API...');
      const loginResult = await agentLoginService.loginAgent();
      if (!loginResult.success) {
        console.warn('⚠️ FortunePanda agent login failed:', loginResult.message);
        // Still allow admin login, but operations may fail
        console.warn('⚠️ Admin login allowed, but FortunePanda operations may not work until agent login succeeds');
      } else {
        console.log('✅ FortunePanda agent login successful - agentKey cached and ready');
        console.log('✅ Agent session established for admin operations');
        // Capture agent balance from login response
        agentBalance = loginResult.data?.balance || loginResult.data?.Balance || '0.00';
        console.log('💰 Agent balance from login:', agentBalance);
      }
    } catch (error) {
      // If login fails, still allow admin access (credentials are correct)
      // This handles cases where API might be temporarily unavailable
      console.warn('⚠️ FortunePanda agent login error, but allowing admin login:', error instanceof Error ? error.message : 'Unknown error');
      console.warn('⚠️ Admin can still access panel, but FortunePanda operations may fail until agent login succeeds');
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
        agentName,
        agentBalance
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
    
    console.log('🔍 Querying user info from FortunePanda:', {
      account: user.fortunePandaUsername,
      accountLength: user.fortunePandaUsername?.length,
      hasPassword: !!user.fortunePandaPassword,
      passwordHashLength: passwdMd5.length
    });
    
    const result = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);

    console.log('📥 FortunePanda queryUserInfo result:', {
      success: result.success,
      message: result.message,
      hasData: !!result.data,
      userbalance: result.data?.userbalance,
      agentBalance: result.data?.agentBalance
    });

    if (result.success) {
      // Update user balance in database
      if (result.data?.userbalance || result.data?.userBalance) {
        user.fortunePandaBalance = parseFloat(result.data.userbalance || result.data.userBalance || '0');
        user.fortunePandaLastSync = new Date();
        await user.save();
      }

      return res.json({
        success: true,
        message: 'User info retrieved successfully',
        data: {
          fortunePandaUsername: user.fortunePandaUsername,
          userBalance: result.data?.userbalance || result.data?.userBalance || '0.00',
          agentBalance: result.data?.agentBalance || '0.00',
          gameId: result.data?.gameId,
          lastLogin: result.data?.lastLogin,
          ...result.data
        }
      });
    } else {
      // Check if it's an account not found error
      const errorMsg = result.message || 'Failed to get user info';
      console.error('❌ Failed to get user info:', {
        account: user.fortunePandaUsername,
        error: errorMsg,
        code: result.data?.code
      });
      
      return res.status(400).json({
        success: false,
        message: errorMsg,
        debug: {
          account: user.fortunePandaUsername,
          accountExists: !!user.fortunePandaUsername,
          hasPassword: !!user.fortunePandaPassword
        }
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

// Sync all users from FortunePanda
router.post('/users/sync-fortune-panda', async (req: Request, res: Response) => {
  try {
    const users = await User.find({
      fortunePandaUsername: { $exists: true, $ne: null },
      fortunePandaPassword: { $exists: true, $ne: null }
    }).select('fortunePandaUsername fortunePandaPassword');

    const results = [];
    const errors = [];

    for (const user of users) {
      try {
        if (!user.fortunePandaUsername || !user.fortunePandaPassword) continue;

        const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
        const result = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);

        if (result.success) {
          // Update user in database
          await User.updateOne(
            { _id: user._id },
            {
              $set: {
                fortunePandaBalance: parseFloat(result.data?.userbalance || '0'),
                fortunePandaLastSync: new Date()
              }
            }
          );

          results.push({
            userId: user._id,
            account: user.fortunePandaUsername,
            balance: result.data?.userbalance || '0.00',
            agentBalance: result.data?.agentBalance || '0.00',
            gameId: result.data?.gameId
          });
        } else {
          errors.push({
            account: user.fortunePandaUsername,
            error: result.message
          });
        }
      } catch (error: any) {
        errors.push({
          account: user.fortunePandaUsername,
          error: error.message || 'Failed to sync'
        });
      }
    }

    return res.json({
      success: true,
      message: `Synced ${results.length} users from FortunePanda`,
      data: {
        synced: results,
        errors: errors,
        total: users.length,
        successful: results.length,
        failed: errors.length
      }
    });
  } catch (error) {
    console.error('Sync users from FortunePanda error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users list (from database, but can be synced with FortunePanda)
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

    console.log('💰 Deposit request received:', { userId, amount, userIdType: typeof userId });

    if (!userId || !amount) {
      console.error('❌ Missing required fields:', { hasUserId: !!userId, hasAmount: !!amount });
      return res.status(400).json({
        success: false,
        message: 'userId and amount are required'
      });
    }

    // Try to find user by ID
    let user;
    try {
      user = await User.findById(userId);
    } catch (error: any) {
      console.error('❌ Error finding user by ID:', error.message);
      return res.status(400).json({
        success: false,
        message: `Invalid userId format: ${error.message}`
      });
    }

    if (!user) {
      console.error('❌ User not found in database:', userId);
      // Check if any user exists with this ID format
      const allUsers = await User.find({}).select('_id username').limit(5);
      console.log('📋 Sample user IDs in database:', allUsers.map(u => ({ id: u._id.toString(), username: u.username })));
      return res.status(404).json({
        success: false,
        message: `User not found with ID: ${userId}`,
        debug: {
          userId,
          userIdType: typeof userId,
          sampleUserIds: allUsers.map(u => u._id.toString())
        }
      });
    }

    console.log('👤 User found:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      hasFPUsername: !!user.fortunePandaUsername,
      hasFPPassword: !!user.fortunePandaPassword,
      fpUsername: user.fortunePandaUsername
    });

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      console.error('❌ User missing FortunePanda credentials:', {
        userId: user._id.toString(),
        hasFPUsername: !!user.fortunePandaUsername,
        hasFPPassword: !!user.fortunePandaPassword
      });
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account. Please sync users from FortunePanda first or create an account for this user.',
        debug: {
          userId: user._id.toString(),
          username: user.username,
          hasFPUsername: !!user.fortunePandaUsername,
          hasFPPassword: !!user.fortunePandaPassword
        }
      });
    }

    // Get the actual FP account name (with _GAGame suffix)
    const fpAccountName = fortunePandaService.getFortunePandaAccountName(user.fortunePandaUsername);
    
    // Verify account exists in FortunePanda first
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const verifyResult = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);
    
    if (!verifyResult.success) {
      console.error('❌ FortunePanda account not found:', {
        dbUsername: user.fortunePandaUsername,
        fpAccountName,
        error: verifyResult.message
      });
      return res.status(400).json({
        success: false,
        message: `FortunePanda account not found. FP Account: ${fpAccountName}. ${verifyResult.message || 'Please verify the account exists in FortunePanda.'}`,
        debug: {
          dbUsername: user.fortunePandaUsername,
          fpAccountName,
          error: verifyResult.message
        }
      });
    }
    
    console.log('🔐 Calling FortunePanda agentDeposit:', {
      dbAccount: user.fortunePandaUsername,
      fpAccount: fpAccountName,
      amount: amount.toString(),
      passwdLength: passwdMd5.length
    });

    const result = await fortunePandaService.agentDeposit(
      user.fortunePandaUsername, // Service will append _GAGame internally
      passwdMd5,
      amount.toString()
    );

    console.log('📥 FortunePanda agentDeposit result:', {
      success: result.success,
      message: result.message,
      hasData: !!result.data
    });

    if (result.success) {
      // Update user balance in database
      if (result.data?.userbalance || result.data?.userBalance) {
        user.fortunePandaBalance = parseFloat(result.data.userbalance || result.data.userBalance || '0');
        user.fortunePandaLastSync = new Date();
        await user.save();
        console.log('✅ User balance updated in database:', user.fortunePandaBalance);
      }

      return res.json({
        success: true,
        message: result.message,
        data: {
          userbalance: result.data?.userbalance || result.data?.userBalance || '0.00',
          agentBalance: result.data?.agentBalance || result.data?.agentbalance || '0.00',
          ...result.data
        }
      });
    } else {
      console.error('❌ Deposit failed from FortunePanda:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message || 'Deposit failed',
        debug: {
          account: user.fortunePandaUsername,
          amount: amount.toString()
        }
      });
    }
  } catch (error: any) {
    console.error('❌ Deposit error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
    });
  }
});

// Agent Redeem (Withdraw money from user account)
router.post('/redeem', async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    console.log('💸 Redeem request received:', { userId, amount, userIdType: typeof userId });

    if (!userId || !amount) {
      console.error('❌ Missing required fields:', { hasUserId: !!userId, hasAmount: !!amount });
      return res.status(400).json({
        success: false,
        message: 'userId and amount are required'
      });
    }

    // Try to find user by ID
    let user;
    try {
      user = await User.findById(userId);
    } catch (error: any) {
      console.error('❌ Error finding user by ID:', error.message);
      return res.status(400).json({
        success: false,
        message: `Invalid userId format: ${error.message}`
      });
    }

    if (!user) {
      console.error('❌ User not found in database:', userId);
      // Check if any user exists with this ID format
      const allUsers = await User.find({}).select('_id username').limit(5);
      console.log('📋 Sample user IDs in database:', allUsers.map(u => ({ id: u._id.toString(), username: u.username })));
      return res.status(404).json({
        success: false,
        message: `User not found with ID: ${userId}`,
        debug: {
          userId,
          userIdType: typeof userId,
          sampleUserIds: allUsers.map(u => u._id.toString())
        }
      });
    }

    console.log('👤 User found:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      hasFPUsername: !!user.fortunePandaUsername,
      hasFPPassword: !!user.fortunePandaPassword,
      fpUsername: user.fortunePandaUsername
    });

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      console.error('❌ User missing FortunePanda credentials:', {
        userId: user._id.toString(),
        hasFPUsername: !!user.fortunePandaUsername,
        hasFPPassword: !!user.fortunePandaPassword
      });
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account. Please sync users from FortunePanda first or create an account for this user.',
        debug: {
          userId: user._id.toString(),
          username: user.username,
          hasFPUsername: !!user.fortunePandaUsername,
          hasFPPassword: !!user.fortunePandaPassword
        }
      });
    }

    // Get the actual FP account name (with _GAGame suffix)
    const fpAccountName = fortunePandaService.getFortunePandaAccountName(user.fortunePandaUsername);
    
    // Verify account exists in FortunePanda first
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const verifyResult = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);
    
    if (!verifyResult.success) {
      console.error('❌ FortunePanda account not found:', {
        dbUsername: user.fortunePandaUsername,
        fpAccountName,
        error: verifyResult.message
      });
      return res.status(400).json({
        success: false,
        message: `FortunePanda account not found. FP Account: ${fpAccountName}. ${verifyResult.message || 'Please verify the account exists in FortunePanda.'}`,
        debug: {
          dbUsername: user.fortunePandaUsername,
          fpAccountName,
          error: verifyResult.message
        }
      });
    }
    
    console.log('🔐 Calling FortunePanda agentRedeem:', {
      dbAccount: user.fortunePandaUsername,
      fpAccount: fpAccountName,
      amount: amount.toString(),
      passwdLength: passwdMd5.length
    });

    const result = await fortunePandaService.agentRedeem(
      user.fortunePandaUsername, // Service will append _GAGame internally
      passwdMd5,
      amount.toString()
    );

    console.log('📥 FortunePanda agentRedeem result:', {
      success: result.success,
      message: result.message,
      hasData: !!result.data
    });

    if (result.success) {
      // Update user balance in database
      if (result.data?.userbalance || result.data?.userBalance) {
        user.fortunePandaBalance = parseFloat(result.data.userbalance || result.data.userBalance || '0');
        user.fortunePandaLastSync = new Date();
        await user.save();
        console.log('✅ User balance updated in database:', user.fortunePandaBalance);
      }

      return res.json({
        success: true,
        message: result.message,
        data: {
          userbalance: result.data?.userbalance || result.data?.userBalance || '0.00',
          agentBalance: result.data?.agentBalance || result.data?.agentbalance || '0.00',
          ...result.data
        }
      });
    } else {
      console.error('❌ Redeem failed from FortunePanda:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message || 'Redeem failed',
        debug: {
          account: user.fortunePandaUsername,
          amount: amount.toString()
        }
      });
    }
  } catch (error: any) {
    console.error('❌ Redeem error:', error);
    return res.status(500).json({
      success: false,
      message: error.message || 'Internal server error',
      error: error.message
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
