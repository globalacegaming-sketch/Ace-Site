import { Router, Request, Response, NextFunction } from 'express';
import { validateAdminSession } from '../services/adminSessionService';
import WheelConfig from '../models/WheelConfig';
import WheelSpin from '../models/WheelSpin';
import User from '../models/User';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';

const router = Router();

// Middleware to accept both admin and agent authentication
const requireAdminOrAgentAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
    return;
  }

  const token = authHeader.substring(7);

  // Try admin auth first
  const adminSession = validateAdminSession(token);
  if (adminSession) {
    (req as any).adminSession = adminSession;
    return next();
  }

  // Try agent auth
  try {
    const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;

    if (decoded.role === 'agent' && decoded.type === 'agent') {
      (req as any).agentSession = {
        username: decoded.username,
        role: decoded.role,
        userId: decoded.userId
      };
      return next();
    }
    logger.warn('Wheel auth: Invalid token role/type', { role: decoded.role, type: decoded.type });
  } catch (error: any) {
    logger.debug('Wheel auth: JWT verification failed', { error: (error as Error).message });
  }

  logger.warn('Wheel auth: Both admin and agent auth failed');
  res.status(401).json({
    success: false,
    message: 'Invalid or expired session. Please login again.'
  });
};

// Use middleware that accepts both admin and agent
router.use(requireAdminOrAgentAuth);

// Get wheel configuration
router.get('/config', async (req: Request, res: Response) => {
  try {
    let config = await WheelConfig.findOne();
    
    if (!config) {
      config = await WheelConfig.create({});
    }

    return res.json({
      success: true,
      data: config
    });
  } catch (error: any) {
    logger.error('Error fetching wheel config:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch wheel configuration',
      error: error.message
    });
  }
});

// Update wheel configuration
router.put('/config', async (req: Request, res: Response) => {
  try {
    const {
      isEnabled,
      spinsPerUser,
      spinsPerDay,
      rewards
    } = req.body;

    let config = await WheelConfig.findOne();
    
    if (!config) {
      config = await WheelConfig.create({});
    }

    // Update fields
    if (typeof isEnabled === 'boolean') {
      config.isEnabled = isEnabled;
    }
    if (typeof spinsPerUser === 'number' && spinsPerUser >= -1) {
      config.spinsPerUser = spinsPerUser;
    }
    if (typeof spinsPerDay === 'number' && spinsPerDay >= -1) {
      config.spinsPerDay = spinsPerDay;
    }
    if (rewards && typeof rewards === 'object') {
      if (typeof rewards.betterLuck === 'number' && rewards.betterLuck >= 0) {
        config.rewards.betterLuck = rewards.betterLuck;
      }
      if (typeof rewards.tryAgain === 'number' && rewards.tryAgain >= 0) {
        config.rewards.tryAgain = rewards.tryAgain;
      }
      if (typeof rewards.bonus1 === 'number' && rewards.bonus1 >= 0) {
        config.rewards.bonus1 = rewards.bonus1;
      }
      if (typeof rewards.bonus5 === 'number' && rewards.bonus5 >= 0) {
        config.rewards.bonus5 = rewards.bonus5;
      }
      if (typeof rewards.bonus10 === 'number' && rewards.bonus10 >= 0) {
        config.rewards.bonus10 = rewards.bonus10;
      }
      if (typeof rewards.bonus50Percent === 'number' && rewards.bonus50Percent >= 0) {
        config.rewards.bonus50Percent = rewards.bonus50Percent;
      }
    }

    // Track who updated
    if (req.adminSession?.agentName) {
      config.updatedBy = req.adminSession.agentName;
    } else if ((req as any).agentSession?.username) {
      config.updatedBy = (req as any).agentSession.username;
    }

    await config.save();

    logger.info('Wheel configuration updated', {
      updatedBy: config.updatedBy,
      isEnabled: config.isEnabled
    });

    return res.json({
      success: true,
      message: 'Wheel configuration updated successfully',
      data: config
    });
  } catch (error: any) {
    logger.error('Error updating wheel config:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update wheel configuration',
      error: error.message
    });
  }
});

// Get all spins (for audit)
router.get('/spins', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, userId, startDate, endDate } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Math.min(Number(limit) || 50, 100);

    // Build query
    const query: any = {};
    if (userId) {
      query.userId = userId;
    }
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    const [spins, total] = await Promise.all([
      WheelSpin.find(query)
        .populate('userId', 'username email firstName lastName')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      WheelSpin.countDocuments(query)
    ]);

    return res.json({
      success: true,
      data: spins,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error: any) {
    logger.error('Error fetching wheel spins:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch wheel spins',
      error: error.message
    });
  }
});

// Get spin statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate } = req.query;

    const query: any = {};
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate as string);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate as string);
      }
    }

    const [
      totalSpins,
      uniqueUsers,
      rewardBreakdown,
      bonusSentCount
    ] = await Promise.all([
      WheelSpin.countDocuments(query),
      WheelSpin.distinct('userId', query).then(ids => ids.length),
      WheelSpin.aggregate([
        { $match: query },
        {
          $group: {
            _id: '$rewardType',
            count: { $sum: 1 }
          }
        }
      ]),
      WheelSpin.countDocuments({ ...query, bonusSent: true })
    ]);

    return res.json({
      success: true,
      data: {
        totalSpins,
        uniqueUsers,
        rewardBreakdown: rewardBreakdown.reduce((acc: any, item: any) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        bonusSentCount,
        bonusSentPercentage: totalSpins > 0 ? ((bonusSentCount / totalSpins) * 100).toFixed(2) : '0.00'
      }
    });
  } catch (error: any) {
    logger.error('Error fetching wheel stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch wheel statistics',
      error: error.message
    });
  }
});

// ── POST /reset-all-bonus-spins — reset every user's bonus spins to 0 ────────
router.post('/reset-all-bonus-spins', requireAdminOrAgentAuth, async (req: Request, res: Response) => {
  try {
    const result = await User.updateMany({}, { $set: { bonusSpins: 0 } });
    logger.info('Admin reset ALL users bonus spins to 0', { modifiedCount: result.modifiedCount });
    return res.json({
      success: true,
      message: `Reset bonus spins to 0 for ${result.modifiedCount} users`,
      data: { modifiedCount: result.modifiedCount }
    });
  } catch (error: any) {
    logger.error('Error resetting all bonus spins:', error);
    return res.status(500).json({ success: false, message: 'Failed to reset bonus spins', error: error.message });
  }
});

// ── PUT /user/:userId/bonus-spins — set a user's bonus spin count ────────────
router.put('/user/:userId/bonus-spins', requireAdminOrAgentAuth, async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { bonusSpins } = req.body;

    if (bonusSpins === undefined || typeof bonusSpins !== 'number' || bonusSpins < 0) {
      return res.status(400).json({
        success: false,
        message: 'bonusSpins must be a non-negative number'
      });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { $set: { bonusSpins } },
      { new: true }
    ).select('firstName lastName email bonusSpins');

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info('Admin reset bonus spins', {
      userId,
      newBonusSpins: bonusSpins,
      userName: `${user.firstName} ${user.lastName}`
    });

    return res.json({
      success: true,
      message: `Bonus spins set to ${bonusSpins}`,
      data: {
        userId: user._id,
        name: `${user.firstName} ${user.lastName}`,
        email: user.email,
        bonusSpins: (user as any).bonusSpins
      }
    });
  } catch (error: any) {
    logger.error('Error setting user bonus spins:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to set bonus spins',
      error: error.message
    });
  }
});

export default router;
