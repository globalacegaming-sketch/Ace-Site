import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';
import agentLoginService from '../services/agentLoginService';
import User from '../models/User';
import Wallet from '../models/Wallet';
import Agent, { AGENT_PERMISSIONS } from '../models/Agent';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { createAdminSession, revokeAdminSession } from '../services/adminSessionService';
import { requireAdminAuth } from '../middleware/adminAuth';
import { adminAuthLimiter } from '../middleware/rateLimiter';
import logger from '../utils/logger';
import { sendSuccess, sendError } from '../utils/response';
import { getClientIP } from '../utils/requestUtils';
import { banUserIPs, findUsersByIP, unbanUserIPs } from '../utils/ipBanUtils';
import ChatMessage from '../models/ChatMessage';
import AnalyticsEvent from '../models/AnalyticsEvent';
import Notification from '../models/Notification';
import SupportTicket from '../models/SupportTicket';
import UserNote from '../models/UserNote';
import WheelSpin from '../models/WheelSpin';
import Referral from '../models/Referral';
import BannedIP from '../models/BannedIP';
import Bonus from '../models/Bonus';
import CryptoTransaction from '../models/CryptoTransaction';
import Loan from '../models/Loan';
import LoanAccount from '../models/LoanAccount';
import LoanRequest from '../models/LoanRequest';
import LoanLedger from '../models/LoanLedger';
import LoanAgentLog from '../models/LoanAgentLog';
import LoanLimitHistory from '../models/LoanLimitHistory';

const router = Router();

// Debug endpoint removed for production security

// Admin login route (no auth required) - apply rate limiting
router.post('/login', adminAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { agentName, agentPassword } = req.body;

    logger.debug('🔐 Admin login attempt:', { agentName, hasPassword: !!agentPassword });

    if (!agentName || !agentPassword) {
      return sendError(res, 'agentName and agentPassword are required', 400);
    }

    // Authenticate against the Agent collection (agent role only for this panel)
    const agent = await Agent.findOne({ agentName, isActive: true, role: 'agent' }).select('+passwordHash');

    if (!agent) {
      logger.warn('❌ Agent not found or inactive:', agentName);
      return sendError(res, 'Invalid agent name or account inactive', 401);
    }

    const passwordValid = await agent.comparePassword(agentPassword);
    if (!passwordValid) {
      logger.warn('❌ Admin login failed: Invalid credentials');
      return sendError(res, 'Invalid agent password', 401);
    }

    // Strip deprecated permissions before saving
    const validPerms = new Set(AGENT_PERMISSIONS as readonly string[]);
    agent.permissions = agent.permissions.filter((p: string) => validPerms.has(p));

    // Update lastLogin
    agent.lastLogin = new Date();
    await agent.save();

    logger.info('✅ Credentials verified successfully');

    // Fire-and-forget FortunePanda API login — don't block the admin login response.
    const agentBalance = '0.00';
    agentLoginService.loginAgent()
      .then(loginResult => {
        if (loginResult.success) {
          logger.info('✅ FortunePanda agent login successful (background)');
        } else {
          logger.warn('⚠️ FortunePanda agent login failed (background):', loginResult.message);
        }
      })
      .catch(error => {
        const errorMessage = error instanceof Error ? error.message : 'Unknown error';
        logger.warn('⚠️ FortunePanda agent login error (background):', errorMessage);
      });

    // Create a session token for backward-compatible Bearer-token auth
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const expiresAt = Date.now() + (24 * 60 * 60 * 1000); // 24 hours

    logger.info('✅ Admin login successful, creating session');

    // ── Store admin session in MongoDB via express-session ──
    req.session.adminSession = {
      adminId: agent._id.toString(),
      agentName: agent.agentName,
      token: sessionToken,
      expiresAt,
      role: agent.role,
      permissions: agent.permissions,
    };

    // Also keep the in-memory store as a fallback for Bearer-token clients
    createAdminSession({
      adminId: agent._id.toString(),
      agentName: agent.agentName,
      token: sessionToken,
      expiresAt,
      role: agent.role,
      permissions: agent.permissions,
    });

    // Force session save before responding
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    // Return session information to client
    return sendSuccess(res, 'Admin login successful', {
      token: sessionToken,
      expiresAt,
      agentName: agent.agentName,
      agentBalance,
      role: agent.role,
      permissions: agent.permissions,
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('Admin login error:', errorMessage);
    return sendError(res, 'Internal server error', 500);
  }
});

// Admin logout route (requires auth)
router.post('/logout', requireAdminAuth, async (req: Request, res: Response) => {
  try {
    // Revoke the in-memory session
    if (req.adminSession?.token) {
      revokeAdminSession(req.adminSession.token);
    }

    // Destroy the express-session
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });

    // Clear the session cookie
    res.clearCookie('gag.sid');

    logger.info('✅ Admin logout successful:', { agentName: req.adminSession?.agentName });
    return sendSuccess(res, 'Logged out successfully');
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('Admin logout error:', errorMessage);
    return sendError(res, 'Logout failed', 500);
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

// Sync a single user's balance from FortunePanda
router.post('/users/:userId/sync-balance', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) return sendError(res, 'User not found', 404);

    if (!user.fortunePandaUsername || !user.fortunePandaPassword) {
      if (!user.firstName) {
        return sendError(res, 'User has no FortunePanda account and no firstName to link one', 400);
      }

      const fpUsername = user.fortunePandaUsername || `${user.firstName}_Aces9F`;
      const fpPassword = user.fortunePandaPassword || fortunePandaService.generateFortunePandaPassword();
      const passwdMd5 = fortunePandaService.generateMD5(fpPassword);

      // Try to query the existing FP account first (link, not create)
      const queryResult = await fortunePandaService.queryUserInfo(fpUsername, passwdMd5);

      if (queryResult.success) {
        user.fortunePandaUsername = fpUsername;
        user.fortunePandaPassword = fpPassword;
        await user.save();
        logger.info(`✅ Linked existing FP account for user ${userId}: ${fpUsername}`);
      } else {
        // Account doesn't exist yet — create it
        const createResult = await fortunePandaService.createFortunePandaUserWithAccount(fpUsername, fpPassword);
        if (createResult.success) {
          user.fortunePandaUsername = fpUsername;
          user.fortunePandaPassword = fpPassword;
          await user.save();
          logger.info(`✅ Created FP account for user ${userId}: ${fpUsername}`);
        } else {
          return sendError(res, `Could not link or create FortunePanda account: ${createResult.message}`, 400);
        }
      }
    }

    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword!);
    const result = await fortunePandaService.queryUserInfo(user.fortunePandaUsername!, passwdMd5);

    if (result.success && result.data) {
      const userbalance = result.data.userbalance || result.data.userBalance || '0.00';
      user.fortunePandaBalance = parseFloat(userbalance);
      user.fortunePandaLastSync = new Date();
      await user.save();

      return res.json({
        success: true,
        message: 'Balance synced',
        data: {
          userId: user._id,
          balance: user.fortunePandaBalance,
          agentBalance: result.data.agentBalance || result.data.agentbalance || '0.00',
        }
      });
    }

    return sendError(res, result.message || 'Failed to query FortunePanda', 400);
  } catch (error) {
    logger.error('Sync single user balance error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Get all users list (from database, but can be synced with FortunePanda)
router.get('/users', async (req: Request, res: Response) => {
  try {
    const users = await User.find({})
      .select('-password -fortunePandaPassword')
      .populate('labels')
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

// Adjust internal wallet balance (from agent/admin panel). For deducting when user plays or manual adjust.
router.put('/users/:userId/wallet-adjust', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { amount, note } = req.body;

    const amountNum = typeof amount === 'string' ? parseFloat(amount) : Number(amount);
    if (isNaN(amountNum) || !isFinite(amountNum)) {
      return sendError(res, 'Amount must be a valid number', 400);
    }

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    let wallet = await Wallet.findOne({ userId: user._id });
    if (!wallet) {
      wallet = await Wallet.create({ userId: user._id, balance: 0, currency: 'USD' });
    }

    const newBalance = wallet.balance + amountNum;
    if (newBalance < 0) {
      return sendError(res, `Insufficient wallet balance. Current: ${wallet.balance.toFixed(2)}`, 400);
    }

    wallet.balance = Math.round(newBalance * 100) / 100;
    await wallet.save();

    logger.info('Wallet adjusted by admin/agent', {
      userId: userId,
      amount: amountNum,
      newBalance: wallet.balance,
      note: note || ''
    });

    return sendSuccess(res, 'Wallet adjusted', {
      balance: wallet.balance,
      amount: amountNum,
      note: note || ''
    });
  } catch (error) {
    logger.error('Wallet adjust error:', error);
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
      // Recharge API doesn't return userbalance, so query it via queryInfo
      let userbalance = '0.00';
      let agentBalance = '0.00';
      try {
        if (user.fortunePandaUsername && user.fortunePandaPassword) {
          const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
          const infoResult = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);
          if (infoResult.success && infoResult.data) {
            userbalance = infoResult.data.userbalance || infoResult.data.userBalance || '0.00';
            agentBalance = infoResult.data.agentBalance || infoResult.data.agentbalance || '0.00';
            user.fortunePandaBalance = parseFloat(userbalance);
            user.fortunePandaLastSync = new Date();
            await user.save();
            logger.info('✅ User balance updated in database after deposit:', user.fortunePandaBalance);
          }
        }
      } catch (queryError) {
        logger.warn('⚠️ Could not query balance after deposit:', queryError);
      }

      return res.json({
        success: true,
        message: result.message,
        data: {
          userbalance,
          agentBalance,
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
      // Redeem API doesn't return userbalance, so query it via queryInfo
      let userbalance = '0.00';
      let agentBalance = '0.00';
      try {
        if (user.fortunePandaUsername && user.fortunePandaPassword) {
          const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
          const infoResult = await fortunePandaService.queryUserInfo(user.fortunePandaUsername, passwdMd5);
          if (infoResult.success && infoResult.data) {
            userbalance = infoResult.data.userbalance || infoResult.data.userBalance || '0.00';
            agentBalance = infoResult.data.agentBalance || infoResult.data.agentbalance || '0.00';
            user.fortunePandaBalance = parseFloat(userbalance);
            user.fortunePandaLastSync = new Date();
            await user.save();
            logger.info('✅ User balance updated in database after redeem:', user.fortunePandaBalance);
          }
        }
      } catch (queryError) {
        logger.warn('⚠️ Could not query balance after redeem:', queryError);
      }

      return res.json({
        success: true,
        message: result.message,
        data: {
          userbalance,
          agentBalance,
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

// Ban user (permanent ban with IP blocking)
router.put('/users/:userId/ban', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { reason } = req.body;

    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Get user's last known IP address
    const userIP = user.lastLoginIP;
    
    // Ban the user
    user.isBanned = true;
    user.bannedAt = new Date();
    user.banReason = reason || 'Suspicious activity';
    
    // Add IP to banned IPs if it exists
    if (userIP) {
      if (!user.bannedIPs) {
        user.bannedIPs = [];
      }
      if (!user.bannedIPs.includes(userIP)) {
        user.bannedIPs.push(userIP);
      }
    }

    await user.save();

    // Ban all IPs associated with this user globally
    const bannedIPs = await banUserIPs(userId, {
      bannedBy: req.adminSession?.agentName || 'Admin',
      reason: reason || 'Suspicious activity - user banned'
    });

    // Also find and ban any other users that have used these IPs
    for (const ip of bannedIPs) {
      const usersWithSameIP = await findUsersByIP(ip);
      for (const otherUser of usersWithSameIP) {
        if (otherUser._id.toString() !== userId && !otherUser.isBanned) {
          logger.warn(`User ${otherUser._id} has used banned IP ${ip}, considering ban`);
          // Optionally ban other users with the same IP - uncomment if needed
          // otherUser.isBanned = true;
          // otherUser.bannedAt = new Date();
          // otherUser.banReason = `Associated IP ${ip} was banned`;
          // await otherUser.save();
        }
      }
    }

    // Force-disconnect the banned user's socket connections in real-time
    try {
      const { getSocketServerInstance } = await import('../utils/socketManager');
      const ioServer = getSocketServerInstance();
      const userRoom = `user:${user._id.toString()}`;

      // Notify the client to log out before disconnecting
      ioServer.to(userRoom).emit('account:banned', {
        reason: user.banReason,
      });

      // Forcefully disconnect all sockets in the user's room
      const sockets = await ioServer.in(userRoom).fetchSockets();
      for (const s of sockets) {
        s.disconnect(true);
      }
      logger.info(`🔌 Disconnected ${sockets.length} socket(s) for banned user ${user._id.toString()}`);
    } catch (socketErr) {
      logger.warn('⚠️ Could not disconnect banned user sockets:', socketErr);
    }

    logger.info('🚫 User banned by admin:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      bannedIP: userIP,
      globallyBannedIPs: bannedIPs,
      reason: user.banReason,
      bannedBy: req.adminSession?.agentName
    });

    return res.json({
      success: true,
      message: 'User banned successfully. All associated IPs have been globally banned.',
      data: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        isBanned: user.isBanned,
        bannedAt: user.bannedAt,
        bannedIPs: user.bannedIPs,
        globallyBannedIPs: bannedIPs,
        banReason: user.banReason
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Error banning user:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// Fix single user's Fortune Panda account (assign new unique username and create account)
router.post('/users/:userId/fix-fortune-panda', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (!user.firstName) {
      return sendError(res, 'User missing firstName. Cannot generate Fortune Panda username.', 400);
    }

    // Generate password if missing
    if (!user.fortunePandaPassword) {
      user.fortunePandaPassword = fortunePandaService.generateFortunePandaPassword();
    }

    // Username candidates: try different patterns to find one that works on FP
    const name = user.firstName;
    const rand3 = () => Math.random().toString(36).substring(2, 5).toUpperCase();
    const rand4 = () => Math.random().toString(36).substring(2, 6).toUpperCase();
    const candidates = [
      `${name}_Aces9F`,
      `${name}_Ace${rand3()}`,
      `${name}_FP${rand4()}`,
      `${name}_G${rand4()}`,
      `${name}_${rand4()}${rand3()}`,
    ];

    for (const candidate of candidates) {
      // Skip if another local user already has this username
      const localDupe = await User.findOne({
        fortunePandaUsername: candidate,
        _id: { $ne: userId }
      });
      if (localDupe) continue;

      const createResult = await fortunePandaService.createFortunePandaUserWithAccount(
        candidate,
        user.fortunePandaPassword
      );

      if (createResult.success) {
        user.fortunePandaUsername = candidate;
        await user.save();

        logger.info(`✅ Fixed Fortune Panda account for user ${userId}: ${candidate}`);

        return sendSuccess(res, 'Fortune Panda account fixed successfully', {
          userId: user._id.toString(),
          newUsername: candidate,
          message: 'Account created and username assigned'
        });
      }

      if (createResult.message?.toLowerCase().includes('already exist')) {
        // Account exists on FP — check if it belongs to this user (password matches)
        const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword);
        const verifyResult = await fortunePandaService.queryUserInfo(candidate, passwdMd5);

        if (verifyResult.success) {
          user.fortunePandaUsername = candidate;
          await user.save();

          logger.info(`✅ FP account already existed, linked for user ${userId}: ${candidate}`);

          return sendSuccess(res, 'Fortune Panda account linked successfully', {
            userId: user._id.toString(),
            newUsername: candidate,
            message: 'Account already existed on Fortune Panda and has been linked'
          });
        }

        // Credentials don't match — try next candidate
        logger.info(`⏭️ FP account ${candidate} exists with different credentials, trying next pattern...`);
        continue;
      }

      // Some other error (not "already exists") — stop trying
      logger.error(`❌ FP account creation failed for user ${userId}: ${createResult.message}`);
      return sendError(res, `Fortune Panda account creation failed: ${createResult.message || 'Unknown error'}. The user's existing account was not changed.`, 400);
    }

    return sendError(res, 'Could not create Fortune Panda account — all username patterns were taken. Please try again.', 400);
  } catch (error) {
    logger.error('Fix user Fortune Panda account error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Fix duplicate Fortune Panda usernames and retry account creation
router.post('/fix-fortune-panda-usernames', async (req: Request, res: Response) => {
  try {
    logger.info('🔧 Starting Fortune Panda username fix process...');

    // Find all users with Fortune Panda usernames
    const users = await User.find({
      fortunePandaUsername: { $exists: true, $ne: null }
    }).select('_id firstName fortunePandaUsername fortunePandaPassword').sort({ createdAt: 1 });

    // Group by Fortune Panda username to find duplicates
    const usernameMap = new Map<string, typeof users>();
    for (const user of users) {
      const fpUsername = user.fortunePandaUsername?.trim();
      if (!fpUsername) continue;
      
      if (!usernameMap.has(fpUsername)) {
        usernameMap.set(fpUsername, []);
      }
      usernameMap.get(fpUsername)!.push(user);
    }

    const duplicates: Array<{ username: string; users: typeof users }> = [];
    for (const [username, userList] of usernameMap.entries()) {
      if (userList.length > 1) {
        duplicates.push({ username, users: userList });
      }
    }

    logger.info(`Found ${duplicates.length} duplicate Fortune Panda usernames`);

    const results = {
      duplicatesFixed: 0,
      accountsCreated: 0,
      errors: [] as Array<{ userId: string; error: string }>
    };

    // Helper to generate unique Fortune Panda username
    const generateUniqueFortunePandaUsername = async (baseFirstName: string): Promise<string> => {
      const baseUsername = `${baseFirstName}_Aces9F`;
      let candidate = baseUsername;
      let attempts = 0;
      const MAX_ATTEMPTS = 20;

      while (attempts < MAX_ATTEMPTS) {
        const existing = await User.findOne({ fortunePandaUsername: candidate });
        if (!existing) {
          return candidate;
        }
        const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        candidate = `${baseFirstName}_Aces9F${suffix}`;
        attempts++;
      }
      return `${baseFirstName}_Aces9F${Date.now().toString().slice(-6)}`;
    };

    // Fix duplicates: keep first user, fix the rest
    for (const { username, users: userList } of duplicates) {
      logger.info(`Fixing duplicate: ${username} (${userList.length} users)`);
      
      // Keep the first user (oldest), fix the rest
      for (let i = 1; i < userList.length; i++) {
        const user = userList[i];
        try {
          const newUsername = await generateUniqueFortunePandaUsername(user.firstName || 'User');
          user.fortunePandaUsername = newUsername;
          
          // Generate new password if missing
          if (!user.fortunePandaPassword) {
            user.fortunePandaPassword = fortunePandaService.generateFortunePandaPassword();
          }
          
          await user.save();
          results.duplicatesFixed++;
          logger.info(`✅ Fixed user ${user._id}: ${username} → ${newUsername}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error';
          results.errors.push({ userId: user._id.toString(), error: `Failed to fix: ${errorMsg}` });
          logger.error(`❌ Failed to fix user ${user._id}:`, error);
        }
      }
    }

    // Retry creating Fortune Panda accounts for users without passwords or with failed accounts
    const usersNeedingAccount = await User.find({
      $or: [
        { fortunePandaPassword: { $exists: false } },
        { fortunePandaPassword: null },
        { fortunePandaPassword: '' }
      ],
      fortunePandaUsername: { $exists: true, $ne: null }
    }).select('_id firstName fortunePandaUsername fortunePandaPassword');

    logger.info(`Found ${usersNeedingAccount.length} users needing Fortune Panda account creation`);

    for (const user of usersNeedingAccount) {
      try {
        if (!user.fortunePandaUsername || !user.firstName) {
          continue;
        }

        // Generate password if missing
        if (!user.fortunePandaPassword) {
          user.fortunePandaPassword = fortunePandaService.generateFortunePandaPassword();
        }

        // Try to create Fortune Panda account
        const createResult = await fortunePandaService.createFortunePandaUserWithAccount(
          user.fortunePandaUsername,
          user.fortunePandaPassword
        );

        if (createResult.success) {
          await user.save();
          results.accountsCreated++;
          logger.info(`✅ Created Fortune Panda account for user ${user._id}: ${user.fortunePandaUsername}`);
        } else {
          results.errors.push({
            userId: user._id.toString(),
            error: `Failed to create FP account: ${createResult.message}`
          });
          logger.warn(`⚠️ Failed to create FP account for user ${user._id}: ${createResult.message}`);
        }
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : 'Unknown error';
        results.errors.push({ userId: user._id.toString(), error: `Exception: ${errorMsg}` });
        logger.error(`❌ Error creating FP account for user ${user._id}:`, error);
      }
    }

    return sendSuccess(res, 'Fortune Panda username fix completed', {
      duplicatesFound: duplicates.length,
      duplicatesFixed: results.duplicatesFixed,
      accountsCreated: results.accountsCreated,
      errors: results.errors,
      summary: {
        totalProcessed: duplicates.reduce((sum, d) => sum + d.users.length, 0) + usersNeedingAccount.length,
        successful: results.duplicatesFixed + results.accountsCreated,
        failed: results.errors.length
      }
    });
  } catch (error) {
    logger.error('Fix Fortune Panda usernames error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Unban user
router.put('/users/:userId/unban', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Unban the user first
    user.isBanned = false;
    user.bannedAt = undefined;
    user.banReason = undefined;

    await user.save();

    // Unban all IPs associated with this user (only if they're not used by other banned users)
    const unbannedIPs = await unbanUserIPs(userId);

    logger.info('✅ User unbanned by admin:', {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      unbannedIPs: unbannedIPs,
      unbannedBy: req.adminSession?.agentName
    });

    return res.json({
      success: true,
      message: `User unbanned successfully. ${unbannedIPs.length} IP(s) were also unbanned.`,
      data: {
        userId: user._id.toString(),
        username: user.username,
        email: user.email,
        isBanned: user.isBanned,
        unbannedIPs: unbannedIPs
      }
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Error unbanning user:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// Delete user account and all associated data
router.delete('/users/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { confirmUsername } = req.body;

    const user = await User.findById(userId);
    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    if (!confirmUsername || confirmUsername !== user.username) {
      return sendError(res, 'You must confirm the username to delete this account', 400);
    }

    const deletedBy = req.adminSession?.agentName || 'admin';
    const userSnapshot = {
      userId: user._id.toString(),
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    };

    logger.info('🗑️ Starting account deletion:', { ...userSnapshot, deletedBy });

    const results = await Promise.allSettled([
      ChatMessage.deleteMany({ userId: user._id }),
      AnalyticsEvent.deleteMany({ userId: user._id.toString() }),
      Notification.deleteMany({ userId: user._id }),
      SupportTicket.deleteMany({ userId: user._id }),
      UserNote.deleteMany({ userId: user._id }),
      WheelSpin.deleteMany({ userId: user._id }),
      Referral.deleteMany({ $or: [{ referredUser: user._id }, { referredBy: user._id }] }),
      BannedIP.deleteMany({ userId: user._id.toString() }),
      Bonus.updateMany(
        { 'claims.userId': user._id.toString() },
        { $pull: { claims: { userId: user._id.toString() } } }
      ),
      CryptoTransaction.deleteMany({ userId: user._id }),
      Loan.deleteMany({ userId: user._id }),
      LoanAccount.deleteMany({ userId: user._id }),
      LoanRequest.deleteMany({ userId: user._id }),
      LoanLedger.deleteMany({ userId: user._id }),
      LoanAgentLog.deleteMany({ targetUserId: user._id }),
      LoanLimitHistory.deleteMany({ userId: user._id }),
      Wallet.deleteMany({ userId: user._id }),
    ]);

    const summary: Record<string, string> = {};
    const modelNames = [
      'ChatMessage', 'AnalyticsEvent', 'Notification', 'SupportTicket',
      'UserNote', 'WheelSpin', 'Referral', 'BannedIP', 'Bonus',
      'CryptoTransaction', 'Loan', 'LoanAccount', 'LoanRequest',
      'LoanLedger', 'LoanAgentLog', 'LoanLimitHistory', 'Wallet',
    ];
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') {
        const val = r.value as any;
        summary[modelNames[i]] = `${val.deletedCount ?? val.modifiedCount ?? 0} removed`;
      } else {
        summary[modelNames[i]] = `error: ${r.reason?.message || 'unknown'}`;
        logger.error(`Failed to clean ${modelNames[i]} for user ${userId}:`, r.reason);
      }
    });

    await User.findByIdAndDelete(userId);

    logger.info('✅ Account deleted successfully:', { ...userSnapshot, deletedBy, summary });

    return res.json({
      success: true,
      message: `Account "${userSnapshot.username}" and all associated data have been permanently deleted.`,
      data: { user: userSnapshot, cleanupSummary: summary },
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Error deleting user account:', errorMessage);
    return res.status(500).json({ success: false, message: errorMessage });
  }
});

export default router;
