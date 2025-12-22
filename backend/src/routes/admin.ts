import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';
import agentLoginService from '../services/agentLoginService';
import User from '../models/User';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createAdminSession } from '../services/adminSessionService';
import { requireAdminAuth } from '../middleware/adminAuth';
import { authLimiter } from '../middleware/rateLimiter';
import logger from '../utils/logger';
import { sendSuccess, sendError } from '../utils/response';

const router = Router();

// Debug endpoint removed for production security

// Admin login route (no auth required) - apply rate limiting
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { agentName, agentPassword } = req.body;

    logger.debug('🔐 Admin login attempt:', { agentName, hasPassword: !!agentPassword });

    if (!agentName || !agentPassword) {
      return sendError(res, 'agentName and agentPassword are required', 400);
    }

    // Verify credentials against environment variables
    // Use standardized Fortune Panda environment variables
    const envAgentName = process.env.FORTUNE_PANDA_AGENT_NAME || 'agent01';
    const envAgentPassword = process.env.FORTUNE_PANDA_AGENT_PASSWORD || '123456';

    logger.debug('🔍 Checking credentials:', { 
      providedName: agentName, 
      envName: envAgentName,
      nameMatch: agentName === envAgentName 
    });

    if (agentName !== envAgentName) {
      logger.warn('❌ Agent name mismatch');
      return sendError(res, 'Invalid agent name', 401);
    }

    // Compare password (MD5 hash)
    const providedPasswordMd5 = crypto.createHash('md5').update(agentPassword).digest('hex');
    const envPasswordMd5 = crypto.createHash('md5').update(envAgentPassword).digest('hex');

    // Don't log password hashes - security best practice
    if (providedPasswordMd5 !== envPasswordMd5) {
      // Log failed attempt without password details
      logger.warn('❌ Admin login failed: Invalid credentials');
      return sendError(res, 'Invalid agent password', 401);
    }

    logger.info('✅ Credentials verified successfully');

    // Perform agent login to FortunePanda API to establish session
    // This ensures agentKey is cached and ready for all admin operations
    let agentBalance = '0.00';
    try {
      logger.debug('🔐 Performing agent login to FortunePanda API...');
      const loginResult = await agentLoginService.loginAgent();
      if (!loginResult.success) {
        logger.warn('⚠️ FortunePanda agent login failed:', loginResult.message);
        // Still allow admin login, but operations may fail
        logger.warn('⚠️ Admin login allowed, but FortunePanda operations may not work until agent login succeeds');
      } else {
        logger.info('✅ FortunePanda agent login successful - agentKey cached and ready');
        logger.info('✅ Agent session established for admin operations');
        // Capture agent balance from login response
        agentBalance = loginResult.data?.balance || loginResult.data?.Balance || '0.00';
        logger.debug('💰 Agent balance from login:', agentBalance);
      }
    } catch (error) {
      // If login fails, still allow admin access (credentials are correct)
      // This handles cases where API might be temporarily unavailable
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.warn('⚠️ FortunePanda agent login error, but allowing admin login:', errorMessage);
      logger.warn('⚠️ Admin can still access panel, but FortunePanda operations may fail until agent login succeeds');
    }

    // Create a simple session token (in production, use JWT)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    logger.info('✅ Admin login successful, creating session token');

    // Store session (in production, use Redis or database)
    createAdminSession({
      agentName,
      token: sessionToken,
      expiresAt
    });

    // Return session information to client
    return sendSuccess(res, 'Admin login successful', {
      token: sessionToken,
      expiresAt,
      agentName,
      agentBalance
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('Admin login error:', errorMessage);
    return sendError(res, 'Internal server error', 500);
  }
});

// All other admin routes require admin session
router.use(requireAdminAuth);

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
      return sendError(res, 'No FortunePanda user found to query agent balance', 404);
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);

    if (result.success) {
      return sendSuccess(res, 'Agent balance retrieved successfully', {
        agentBalance: result.data?.agentBalance || '0.00',
        userBalance: result.data?.userbalance || '0.00',
        account: user.fortunePandaUsername
      });
    } else {
      return sendError(res, result.message || 'Failed to get agent balance', 400);
    }
  } catch (error) {
    // Check if response was already sent to prevent "headers already sent" error
    if (res.headersSent) {
      logger.error('Get agent balance error (response already sent):', error);
      return;
    }
    logger.error('Get agent balance error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Get user info from FortunePanda API
router.get('/users/:userId/fortune-panda', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account'
      });
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    
    logger.debug('🔍 Querying user info from FortunePanda:', {
      account: user.fortunePandaUsername,
      accountLength: user.fortunePandaUsername?.length,
      hasPassword: !!user.fortunePandaPassword,
      passwordHashLength: passwdMd5.length
    });
    
    const result = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);

    logger.debug('📥 FortunePanda queryUserInfo result:', {
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
      logger.error('❌ Failed to get user info:', {
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
    logger.error('Get user FortunePanda info error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Sync all users from FortunePanda
router.post('/users/sync-fortune-panda', async (req: Request, res: Response) => {
  try {
    // Include users with username (even if password is missing)
    const users = await User.find({
      fortunePandaUsername: { $exists: true, $ne: null }
    }).select('fortunePandaUsername fortunePandaPassword _id firstName username');

    logger.info(`🔄 Starting sync for ${users.length} users from FortunePanda...`);

    const results = [];
    const errors = [];

    for (const user of users) {
      try {
        if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
          logger.debug(`⏭️ Skipping user ${user._id} - missing FP credentials`);
          continue;
        }

        // Use FP account name as stored in database
        const fpAccountName = user.fortunePandaUsername || 'N/A';
        
        logger.debug(`🔍 Syncing user ${user.username || user._id}:`, {
          dbUsername: user.fortunePandaUsername,
          fpAccountName,
          userId: user._id
        });

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

          logger.info(`✅ Successfully synced ${user.username || user._id}:`, {
            fpAccount: fpAccountName,
            balance: result.data?.userbalance || '0.00'
          });

          results.push({
            userId: user._id,
            username: user.username,
            dbAccount: user.fortunePandaUsername,
            fpAccount: fpAccountName,
            balance: result.data?.userbalance || '0.00',
            agentBalance: result.data?.agentBalance || '0.00',
            gameId: result.data?.gameId
          });
        } else {
          logger.error(`❌ Failed to sync ${user.username || user._id}:`, {
            dbAccount: user.fortunePandaUsername,
            fpAccount: fpAccountName,
            error: result.message
          });

          errors.push({
            userId: user._id,
            username: user.username,
            dbAccount: user.fortunePandaUsername,
            fpAccount: fpAccountName,
            error: result.message || 'Account not found in FortunePanda'
          });
        }
      } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        const fpAccountName = user.fortunePandaUsername 
          ? user.fortunePandaUsername
          : 'N/A';
        
        logger.error(`❌ Error syncing user ${user.username || user._id}:`, {
          dbAccount: user.fortunePandaUsername,
          fpAccount: fpAccountName,
          error: errorMessage
        });

        errors.push({
          userId: user._id,
          username: user.username,
          dbAccount: user.fortunePandaUsername,
          fpAccount: fpAccountName,
          error: errorMessage || 'Failed to sync'
        });
      }
    }

    logger.info(`✅ Sync completed: ${results.length} successful, ${errors.length} failed out of ${users.length} total`);

    return res.json({
      success: true,
      message: `Synced ${results.length} of ${users.length} users from FortunePanda${errors.length > 0 ? ` (${errors.length} failed)` : ''}`,
      data: {
        synced: results,
        errors: errors,
        total: users.length,
        successful: results.length,
        failed: errors.length
      }
    });
  } catch (error) {
    logger.error('❌ Sync users from FortunePanda error:', error);
    return sendError(res, 'Internal server error', 500);
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
    logger.error('Get users error:', error);
    return sendError(res, 'Internal server error', 500);
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
      return sendError(res, 'User not found', 404);
    }

    return res.json({
      success: true,
      message: 'User retrieved successfully',
      data: user
    });
  } catch (error) {
    logger.error('Get user error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Agent Deposit (Load money to user account)
router.post('/deposit', async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    logger.debug('💰 Deposit request received:', { userId, amount, userIdType: typeof userId });

    if (!userId || amount === undefined || amount === null) {
      logger.error('❌ Missing required fields:', { hasUserId: !!userId, hasAmount: amount !== undefined && amount !== null });
      return res.status(400).json({
        success: false,
        message: 'userId and amount are required'
      });
    }

    // Validate amount: must be a valid positive number
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    
    if (isNaN(amountNum) || !isFinite(amountNum)) {
      return sendError(res, 'Amount must be a valid number', 400);
    }

    if (amountNum <= 0) {
      return sendError(res, 'Amount must be a positive number greater than zero', 400);
    }

    // Prevent extremely large amounts (max 1 billion to prevent overflow)
    const MAX_AMOUNT = 1000000000;
    if (amountNum > MAX_AMOUNT) {
      return sendError(res, `Amount cannot exceed ${MAX_AMOUNT.toLocaleString()}`, 400);
    }

    // Round to 2 decimal places for currency
    const validatedAmount = Math.round(amountNum * 100) / 100;

    // Try to find user by ID
    let user;
    try {
      user = await User.findById(userId);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Error finding user by ID:', errorMessage);
      return res.status(400).json({
        success: false,
        message: `Invalid userId format: ${errorMessage}`
      });
    }

    if (!user) {
      logger.error('❌ User not found in database:', userId);
      // Check if any user exists with this ID format
      const allUsers = await User.find({}).select('_id username').limit(5);
      logger.debug('📋 Sample user IDs in database:', allUsers.map(u => ({ id: u._id.toString(), username: u.username })));
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

    logger.debug('👤 User found:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      hasFPUsername: !!user.fortunePandaUsername,
      hasFPPassword: !!user.fortunePandaPassword,
      fpUsername: user.fortunePandaUsername
    });

    if (!user.fortunePandaUsername) {
      logger.error('❌ User missing FortunePanda username:', {
        userId: user._id.toString(),
        username: user.username
      });
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda username. Please sync users from FortunePanda first or create an account for this user.',
        debug: {
          userId: user._id.toString(),
          username: user.username,
          hasFPUsername: false
        }
      });
    }

    // Use FP account name as stored in database
    const fpAccountName = user.fortunePandaUsername || 'N/A';
    
    logger.debug('🔐 Calling FortunePanda recharge:', {
      dbAccount: user.fortunePandaUsername,
      fpAccount: fpAccountName,
      amount: validatedAmount.toString()
    });

    // Call recharge API directly (no password needed, uses agent authentication via sign)
    const result = await fortunePandaService.agentDeposit(
      user.fortunePandaUsername, // Use account name directly as stored
      validatedAmount.toString()
    );

    logger.debug('📥 FortunePanda agentDeposit result:', {
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
        logger.info('✅ User balance updated in database:', user.fortunePandaBalance);
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
      logger.error('❌ Deposit failed from FortunePanda:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message || 'Deposit failed',
        debug: {
          account: user.fortunePandaUsername,
          amount: validatedAmount.toString()
        }
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Deposit error:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// Agent Redeem (Withdraw money from user account)
router.post('/redeem', async (req: Request, res: Response) => {
  try {
    const { userId, amount } = req.body;

    logger.debug('💸 Redeem request received:', { userId, amount, userIdType: typeof userId });

    if (!userId || amount === undefined || amount === null) {
      logger.error('❌ Missing required fields:', { hasUserId: !!userId, hasAmount: amount !== undefined && amount !== null });
      return res.status(400).json({
        success: false,
        message: 'userId and amount are required'
      });
    }

    // Validate amount: must be a valid positive number
    const amountNum = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    
    if (isNaN(amountNum) || !isFinite(amountNum)) {
      return sendError(res, 'Amount must be a valid number', 400);
    }

    if (amountNum <= 0) {
      return sendError(res, 'Amount must be a positive number greater than zero', 400);
    }

    // Prevent extremely large amounts (max 1 billion to prevent overflow)
    const MAX_AMOUNT = 1000000000;
    if (amountNum > MAX_AMOUNT) {
      return sendError(res, `Amount cannot exceed ${MAX_AMOUNT.toLocaleString()}`, 400);
    }

    // Round to 2 decimal places for currency
    const validatedAmount = Math.round(amountNum * 100) / 100;

    // Try to find user by ID
    let user;
    try {
      user = await User.findById(userId);
    } catch (error: any) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('❌ Error finding user by ID:', errorMessage);
      return res.status(400).json({
        success: false,
        message: `Invalid userId format: ${errorMessage}`
      });
    }

    if (!user) {
      logger.error('❌ User not found in database:', userId);
      // Check if any user exists with this ID format
      const allUsers = await User.find({}).select('_id username').limit(5);
      logger.debug('📋 Sample user IDs in database:', allUsers.map(u => ({ id: u._id.toString(), username: u.username })));
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

    logger.debug('👤 User found:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      hasFPUsername: !!user.fortunePandaUsername,
      hasFPPassword: !!user.fortunePandaPassword,
      fpUsername: user.fortunePandaUsername
    });

    if (!user.fortunePandaUsername) {
      logger.error('❌ User missing FortunePanda username:', {
        userId: user._id.toString(),
        username: user.username
      });
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda username. Please sync users from FortunePanda first or create an account for this user.',
        debug: {
          userId: user._id.toString(),
          username: user.username,
          hasFPUsername: false
        }
      });
    }

    // Use FP account name as stored in database
    const fpAccountName = user.fortunePandaUsername || 'N/A';
    
    logger.debug('🔐 Calling FortunePanda redeem:', {
      dbAccount: user.fortunePandaUsername,
      fpAccount: fpAccountName,
      amount: validatedAmount.toString()
    });

    // Call redeem API directly (no password needed, uses agent authentication via sign)
    const result = await fortunePandaService.agentRedeem(
      user.fortunePandaUsername, // Use account name directly as stored
      validatedAmount.toString()
    );

    logger.debug('📥 FortunePanda agentRedeem result:', {
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
        logger.info('✅ User balance updated in database:', user.fortunePandaBalance);
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
      logger.error('❌ Redeem failed from FortunePanda:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message || 'Redeem failed',
        debug: {
          account: user.fortunePandaUsername,
          amount: validatedAmount.toString()
        }
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Redeem error:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage
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
      return sendError(res, 'User not found', 404);
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
    logger.error('Get trade records error:', error);
    return sendError(res, 'Internal server error', 500);
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
      return sendError(res, 'User not found', 404);
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
    logger.error('Get JP records error:', error);
    return sendError(res, 'Internal server error', 500);
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
      return sendError(res, 'User not found', 404);
    }

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda account'
      });
    }

    // Validate kindId if provided (optional parameter)
    let validatedKindId: string | undefined = undefined;
    if (kindId) {
      if (typeof kindId !== 'string' || kindId.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Game ID (kindId) must be a non-empty string if provided'
        });
      }

      const trimmedKindId = kindId.trim();
      
      // Validate length (1-50 characters)
      if (trimmedKindId.length < 1 || trimmedKindId.length > 50) {
        return res.status(400).json({
          success: false,
          message: 'Game ID (kindId) must be between 1 and 50 characters'
        });
      }

      // Validate format: alphanumeric, hyphens, underscores only (prevents injection)
      const kindIdRegex = /^[a-zA-Z0-9_-]+$/;
      if (!kindIdRegex.test(trimmedKindId)) {
        return res.status(400).json({
          success: false,
          message: 'Game ID (kindId) can only contain letters, numbers, hyphens, and underscores'
        });
      }

      validatedKindId = trimmedKindId;
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
    const result = await fortunePandaService.getGameRecord(
      user.fortunePandaUsername,
      passwdMd5,
      fromDate as string,
      toDate as string,
      validatedKindId
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
    logger.error('Get game records error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Manually verify user email (admin only)
router.put('/users/:userId/verify-email', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    logger.info('✅ Email manually verified by admin:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      verifiedBy: req.adminSession?.agentName
    });

    return res.json({
      success: true,
      message: 'User email verified successfully',
      data: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        isEmailVerified: user.isEmailVerified
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Error verifying user email:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// Reset user password (admin only)
router.put('/users/:userId/reset-password', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { newPassword } = req.body;

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'New password is required and must be at least 6 characters long'
      });
    }

    // Need to explicitly select password field since it has select: false
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Store old password hash for comparison (for debugging)
    const oldPasswordHash = user.password;
    
    // Set the plain password - the pre-save hook will automatically hash it
    // This ensures consistent hashing with the same salt rounds (12) as registration
    // We need to set it as plain text so the pre-save hook can detect the change and hash it
    user.password = newPassword;
    
    // Verify password is marked as modified
    if (!user.isModified('password')) {
      logger.warn('⚠️ Password field not detected as modified, forcing modification');
      user.markModified('password');
    }
    
    // Clear any password reset tokens
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    
    // Save will trigger the pre-save hook which hashes the password
    // The pre-save hook checks isModified('password') and will hash it with salt rounds 12
    await user.save();
    
    // Verify the password was actually changed and hashed
    const updatedUser = await User.findById(userId).select('+password');
    const newPasswordHash = updatedUser?.password;
    
    logger.info('✅ Password reset by admin:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      resetBy: req.adminSession?.agentName,
      passwordChanged: oldPasswordHash !== newPasswordHash,
      passwordIsHashed: newPasswordHash && newPasswordHash !== newPassword && newPasswordHash.length > 50
    });

    logger.info('✅ Password reset by admin:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      resetBy: req.adminSession?.agentName
    });

    return res.json({
      success: true,
      message: 'User password reset successfully',
      data: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Error resetting user password:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// Set/Update FortunePanda password for a user
router.put('/users/:userId/fortune-panda-password', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { password } = req.body;

    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (!user.fortunePandaUsername) {
      return res.status(400).json({
        success: false,
        message: 'User does not have FortunePanda username. Cannot set password without username.'
      });
    }

    // Update the password in database
    user.fortunePandaPassword = password;
    await user.save();

    logger.info('✅ FortunePanda password updated for user:', {
      userId: user._id.toString(),
      username: user.username,
      fpUsername: user.fortunePandaUsername
    });

    return res.json({
      success: true,
      message: 'FortunePanda password updated successfully',
      data: {
        userId: user._id.toString(),
        username: user.username,
        fortunePandaUsername: user.fortunePandaUsername
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Error updating FortunePanda password:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

export default router;
