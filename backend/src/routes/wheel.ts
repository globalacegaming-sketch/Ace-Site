import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth';
import WheelSpin from '../models/WheelSpin';
import WheelConfig from '../models/WheelConfig';
import WheelCampaign from '../models/WheelCampaign';
import WheelSlice from '../models/WheelSlice';
import ChatMessage from '../models/ChatMessage';
import User from '../models/User';
import { getSocketServerInstance } from '../utils/socketManager';
import wheelSpinService from '../services/wheelSpinService';
import logger from '../utils/logger';

const router = Router();

// Reward types and their display values
const REWARD_TYPES = {
  better_luck: { label: 'Better Luck Next Time', value: null, color: '#6B7280' },
  try_again: { label: 'Free Spin +1', value: null, color: '#F59E0B' },
  bonus_1: { label: '$1 Bonus', value: '$1', color: '#10B981' },
  bonus_5: { label: '$5 Bonus', value: '$5', color: '#3B82F6' },
  bonus_10: { label: '$10 Bonus', value: '$10', color: '#8B5CF6' },
  bonus_50_percent: { label: '50% Bonus', value: '50%', color: '#EC4899' }
} as const;

// Get wheel configuration (public - for checking if enabled)
router.get('/config', async (req: Request, res: Response) => {
  try {
    // Try new campaign system first
    const campaign = await WheelCampaign.findOne({ status: 'live' });
    if (campaign) {
      // Check if campaign is within date range
      const now = new Date();
      if (campaign.startDate && now < campaign.startDate) {
        return res.json({
          success: true,
          data: {
            isEnabled: false
          }
        });
      }
      if (campaign.endDate && now > campaign.endDate) {
        return res.json({
          success: true,
          data: {
            isEnabled: false
          }
        });
      }
      return res.json({
        success: true,
        data: {
          isEnabled: true
        }
      });
    }

    // Fallback to old config system for backward compatibility
    const config = await WheelConfig.findOne();
    
    if (!config) {
      // Create default config if none exists
      const defaultConfig = await WheelConfig.create({});
      return res.json({
        success: true,
        data: {
          isEnabled: defaultConfig.isEnabled,
        }
      });
    }

    return res.json({
      success: true,
      data: {
        isEnabled: config.isEnabled
      }
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

// Get wheel slices (public - for displaying the wheel)
router.get('/slices', async (req: Request, res: Response) => {
  try {
    // Try new campaign system first - check for live or draft campaigns
    // In production, you might want to only show 'live' campaigns
    let campaign = await WheelCampaign.findOne({ status: 'live' });
    if (!campaign) {
      // Fallback to draft for testing/development
      campaign = await WheelCampaign.findOne({ status: 'draft' });
    }
    
    if (campaign) {
      logger.debug('Found campaign for slices:', { campaignId: campaign._id, status: campaign.status });
      // Check if campaign is within date range
      const now = new Date();
      if (campaign.startDate && now < campaign.startDate) {
        return res.json({
          success: true,
          data: []
        });
      }
      if (campaign.endDate && now > campaign.endDate) {
        return res.json({
          success: true,
          data: []
        });
      }

      // Get enabled slices for this campaign
      const slices = await WheelSlice.find({ 
        campaignId: campaign._id, 
        enabled: true 
      }).sort({ order: 1 }).lean();

      logger.debug('Found slices:', { count: slices.length, slices: slices.map((s: any) => ({ label: s.label, type: s.type, enabled: s.enabled })) });

      // Map slices to frontend format
      const mappedSlices = slices.map((slice: any) => {
        // Map slice type to reward type for frontend compatibility
        let rewardType = 'better_luck';
        let color = '#6B7280';
        
        if (slice.type === 'lose') {
          rewardType = 'better_luck';
          color = '#6B7280';
        } else if (slice.type === 'free_spin') {
          rewardType = 'try_again';
          color = '#F59E0B';
        } else if (slice.type === 'cash') {
          const dollarAmount = slice.prizeValue?.replace('$', '').trim();
          if (dollarAmount === '1' || dollarAmount === '1.00') {
            rewardType = 'bonus_1';
            color = '#10B981';
          } else if (dollarAmount === '5' || dollarAmount === '5.00') {
            rewardType = 'bonus_5';
            color = '#3B82F6';
          } else if (dollarAmount === '10' || dollarAmount === '10.00') {
            rewardType = 'bonus_10';
            color = '#8B5CF6';
          } else {
            rewardType = 'bonus_1';
            color = '#10B981';
          }
        } else if (slice.type === 'discount') {
          rewardType = 'bonus_50_percent';
          color = '#EC4899';
        } else {
          rewardType = 'bonus_1';
          color = '#8B5CF6';
        }

        return {
          type: rewardType,
          label: slice.label,
          value: slice.prizeValue,
          color: slice.color || color // Use custom color if provided, otherwise use default
        };
      });

      logger.debug('Returning mapped slices:', { count: mappedSlices.length });
      return res.json({
        success: true,
        data: mappedSlices
      });
    }

    // Fallback: return empty array if no campaign
    logger.debug('No campaign found, returning empty slices');
    return res.json({
      success: true,
      data: []
    });
  } catch (error: any) {
    logger.error('Error fetching wheel slices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch wheel slices',
      error: error.message
    });
  }
});

// Get spin constraints (which segments are allowed based on budget) - authenticated
router.get('/spin-constraints', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = new Types.ObjectId(req.user._id);

    try {
      const constraints = await wheelSpinService.getSpinConstraints(
        userId,
        req.user.email,
        req.user.phone
      );

      return res.json({
        success: true,
        data: constraints
      });
    } catch (error: any) {
      logger.error('Error getting spin constraints:', error);
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to get spin constraints'
      });
    }
  } catch (error: any) {
    logger.error('Error in spin-constraints endpoint:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Spin the wheel (authenticated) - now accepts result from frontend
router.post('/spin', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const userId = new Types.ObjectId(req.user._id);

    // Check if frontend is sending the result (new approach)
    const { sliceOrder, rewardType, rewardLabel } = req.body;

    if (sliceOrder !== undefined && rewardType && rewardLabel) {
      // New approach: Frontend sends the result
      try {
        const result = await wheelSpinService.recordSpinResult(
          userId,
          sliceOrder,
          rewardType,
          rewardLabel,
          req.user.email,
          req.user.phone
        );

        // Spin record was already created in service
        const spin = await WheelSpin.findById(result.spinId);
        
        if (!spin) {
          throw new Error('Spin record not found');
        }

        // Handle bonus rewards - send to chat system
        let messageId: string | undefined;
        if (result.rewardType.startsWith('bonus_')) {
          try {
            const user = await User.findById(userId).select('username email firstName lastName');
            
            if (user) {
              const name = user.firstName && user.lastName
                ? `${user.firstName} ${user.lastName}`.trim()
                : user.username;

              // Create system message for bonus reward
              const systemMessage = await ChatMessage.create({
                userId: user._id,
                senderType: 'system',
                message: `🎰 WHEEL OF FORTUNE REWARD: You won ${result.rewardLabel}!`,
                status: 'unread',
                name: name,
                email: user.email,
                metadata: {
                  type: 'wheel_reward',
                  rewardType: result.rewardType,
                  rewardValue: result.rewardValue,
                  rewardLabel: result.rewardLabel,
                  spinId: spin._id.toString(),
                  source: 'Wheel of Fortune',
                  timestamp: new Date().toISOString()
                }
              });

              messageId = systemMessage._id.toString();
              spin.messageId = systemMessage._id as Types.ObjectId;
              spin.bonusSent = true;
              await spin.save();

              const io = getSocketServerInstance();
              const payload = {
                id: systemMessage._id.toString(),
                userId: systemMessage.userId.toString(),
                senderType: 'system',
                message: systemMessage.message,
                status: systemMessage.status,
                name: systemMessage.name,
                email: systemMessage.email,
                metadata: systemMessage.metadata,
                createdAt: systemMessage.createdAt,
                updatedAt: systemMessage.updatedAt
              };

              io.to('admins').emit('chat:message:new', payload);
              io.to(`user:${userId}`).emit('chat:message:new', payload);
            }
          } catch (chatError: any) {
            logger.error('Failed to send wheel reward chat message:', chatError);
          }
        }

        return res.json({
          success: true,
          message: 'Spin recorded successfully',
          data: {
            spinId: spin._id.toString(),
            sliceOrder: result.sliceOrder,
            rewardType: result.rewardType,
            rewardLabel: result.rewardLabel,
            rewardValue: result.rewardValue,
            rewardColor: result.rewardColor,
            bonusSent: spin.bonusSent,
            messageId: messageId
          }
        });
      } catch (error: any) {
        logger.error('Error recording spin result:', error);
        return res.status(400).json({
          success: false,
          message: error.message || 'Failed to record spin result'
        });
      }
    }

    // Old approach: Backend selects the result (fallback)
    try {
      const result = await wheelSpinService.spinWheel(
        userId,
        req.user.email,
        req.user.phone
      );

      // Spin record was already created in service
      const spin = await WheelSpin.findById(result.spinId);
      
      if (!spin) {
        throw new Error('Spin record not found');
      }

      // Handle bonus rewards - send to chat system
      let messageId: string | undefined;
      if (result.rewardType.startsWith('bonus_')) {
        try {
          const user = await User.findById(userId).select('username email firstName lastName');
          
          if (user) {
            const name = user.firstName && user.lastName
              ? `${user.firstName} ${user.lastName}`.trim()
              : user.username;

            // Create system message for bonus reward
            const systemMessage = await ChatMessage.create({
              userId: user._id,
              senderType: 'system',
              message: `🎰 WHEEL OF FORTUNE REWARD: You won ${result.rewardLabel}!`,
              status: 'unread',
              name: name,
              email: user.email,
              metadata: {
                type: 'wheel_reward',
                rewardType: result.rewardType,
                rewardValue: result.rewardValue,
                rewardLabel: result.rewardLabel,
                spinId: spin._id.toString(),
                source: 'Wheel of Fortune',
                timestamp: new Date().toISOString()
              }
            });

            messageId = systemMessage._id.toString();
            spin.messageId = systemMessage._id as Types.ObjectId;
            spin.bonusSent = true;
            await spin.save();

            const io = getSocketServerInstance();
            const payload = {
              id: systemMessage._id.toString(),
              userId: systemMessage.userId.toString(),
              senderType: 'system',
              message: systemMessage.message,
              status: systemMessage.status,
              name: systemMessage.name,
              email: systemMessage.email,
              metadata: systemMessage.metadata,
              createdAt: systemMessage.createdAt,
              updatedAt: systemMessage.updatedAt
            };

            io.to('admins').emit('chat:message:new', payload);
            io.to(`user:${userId}`).emit('chat:message:new', payload);
          }
        } catch (chatError: any) {
          logger.error('Failed to send wheel reward chat message:', chatError);
        }
      }

      return res.json({
        success: true,
        message: 'Spin completed successfully',
        data: {
          spinId: spin._id.toString(),
          sliceOrder: result.sliceOrder, // Include slice order for frontend alignment
          rewardType: result.rewardType,
          rewardLabel: result.rewardLabel,
          rewardValue: result.rewardValue,
          rewardColor: result.rewardColor,
          bonusSent: spin.bonusSent,
          messageId: messageId
        }
      });
    } catch (newSystemError: any) {
      // If new system fails (no campaign), fall back to old system
      logger.debug('New wheel system not available, falling back to old system:', newSystemError.message);
      
      // Get wheel configuration (old system)
      let config = await WheelConfig.findOne();
      if (!config) {
        config = await WheelConfig.create({});
      }

      // Check if wheel is enabled
      if (!config.isEnabled) {
        return res.status(400).json({
          success: false,
          message: 'Wheel of Fortune is currently disabled'
        });
      }

    // Check spins per user limit
    if (config.spinsPerUser !== -1) {
      const userSpinCount = await WheelSpin.countDocuments({ userId });
      if (userSpinCount >= config.spinsPerUser) {
        return res.status(400).json({
          success: false,
          message: 'You have already used all your spins'
        });
      }
    }

    // Check spins per day limit
    if (config.spinsPerDay !== -1) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todaySpinCount = await WheelSpin.countDocuments({
        userId,
        createdAt: { $gte: today }
      });
      if (todaySpinCount >= config.spinsPerDay) {
        return res.status(400).json({
          success: false,
          message: 'You have reached your daily spin limit'
        });
      }
    }

    // Build reward pool based on config
    const rewardPool: Array<keyof typeof REWARD_TYPES> = [];
    
    // Add rewards based on configured counts
    for (let i = 0; i < config.rewards.betterLuck; i++) {
      rewardPool.push('better_luck');
    }
    for (let i = 0; i < config.rewards.tryAgain; i++) {
      rewardPool.push('try_again');
    }
    for (let i = 0; i < config.rewards.bonus1; i++) {
      rewardPool.push('bonus_1');
    }
    for (let i = 0; i < config.rewards.bonus5; i++) {
      rewardPool.push('bonus_5');
    }
    for (let i = 0; i < config.rewards.bonus10; i++) {
      rewardPool.push('bonus_10');
    }
    for (let i = 0; i < config.rewards.bonus50Percent; i++) {
      rewardPool.push('bonus_50_percent');
    }

    // Randomly select a reward
    const randomIndex = Math.floor(Math.random() * rewardPool.length);
    const selectedReward = rewardPool[randomIndex];
    const rewardInfo = REWARD_TYPES[selectedReward];
    
    // Map reward type to hardcoded segment index for frontend alignment
    // Hardcoded segments order: 1, 5, try again, 1, better luck, 10, better luck, 5, 1, try again, 50%, better luck, 1, 5, better luck
    const hardcodedSegments = [
      'bonus_1', 'bonus_5', 'try_again', 'bonus_1', 'better_luck', 'bonus_10',
      'better_luck', 'bonus_5', 'bonus_1', 'try_again', 'bonus_50_percent',
      'better_luck', 'bonus_1', 'bonus_5', 'better_luck'
    ];
    
    // Find all indices with matching reward type
    const matchingIndices = hardcodedSegments
      .map((type, idx) => type === selectedReward ? idx : -1)
      .filter(idx => idx >= 0);
    
    // Pick a random matching index (or first if only one)
    const sliceOrder = matchingIndices.length > 0 
      ? matchingIndices[Math.floor(Math.random() * matchingIndices.length)]
      : 0;

    // Create spin record
    const spin = await WheelSpin.create({
      userId,
      rewardType: selectedReward,
      rewardValue: rewardInfo.value || undefined,
      bonusSent: false
    });

    // Handle bonus rewards - send to chat system
    let messageId: string | undefined;
    if (selectedReward.startsWith('bonus_')) {
      try {
        const user = await User.findById(userId).select('username email firstName lastName');
        
        if (user) {
          const name = user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.username;

          // Create system message for bonus reward
          const systemMessage = await ChatMessage.create({
            userId: user._id,
            senderType: 'system',
            message: `🎰 WHEEL OF FORTUNE REWARD: You won ${rewardInfo.label}!`,
            status: 'unread',
            name: name,
            email: user.email,
            metadata: {
              type: 'wheel_reward',
              rewardType: selectedReward,
              rewardValue: rewardInfo.value,
              rewardLabel: rewardInfo.label,
              spinId: spin._id.toString(),
              source: 'Wheel of Fortune',
              timestamp: new Date().toISOString()
            }
          });

          messageId = systemMessage._id.toString();

          // Update spin with message ID (ensure type compatibility)
          spin.messageId = systemMessage._id as Types.ObjectId;
          spin.bonusSent = true;
          await spin.save();

          const io = getSocketServerInstance();

          const payload = {
            id: systemMessage._id.toString(),
            userId: systemMessage.userId.toString(),
            senderType: 'system',
            message: systemMessage.message,
            status: systemMessage.status,
            name: systemMessage.name,
            email: systemMessage.email,
            metadata: systemMessage.metadata,
            createdAt: systemMessage.createdAt,
            updatedAt: systemMessage.updatedAt
          };

          io.to('admins').emit('chat:message:new', payload);
          io.to(`user:${userId}`).emit('chat:message:new', payload);

          logger.info('Wheel bonus reward sent to chat:', {
            userId: userId.toString(),
            rewardType: selectedReward,
            messageId: messageId
          });
        }
      } catch (chatError: any) {
        // Don't fail the spin if chat message fails
        logger.error('Failed to send wheel reward chat message:', chatError);
      }
    }

      return res.json({
        success: true,
        message: 'Spin completed successfully',
        data: {
          spinId: spin._id.toString(),
          sliceOrder: sliceOrder, // Include slice order for frontend alignment
          rewardType: selectedReward,
          rewardLabel: rewardInfo.label,
          rewardValue: rewardInfo.value,
          rewardColor: rewardInfo.color,
          bonusSent: spin.bonusSent,
          messageId: messageId
        }
      });
    }
  } catch (error: any) {
    logger.error('Error spinning wheel:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to spin wheel',
      error: error.message
    });
  }
});

// Get user's spin history (authenticated)
router.get('/spins', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    const spins = await WheelSpin.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    const spinsWithDetails = spins.map((spin: any) => {
      const rewardInfo = REWARD_TYPES[spin.rewardType as keyof typeof REWARD_TYPES];
      return {
        id: spin._id.toString(),
        rewardType: spin.rewardType,
        rewardLabel: rewardInfo.label,
        rewardValue: rewardInfo.value,
        rewardColor: rewardInfo.color,
        bonusSent: spin.bonusSent,
        createdAt: spin.createdAt
      };
    });

    return res.json({
      success: true,
      data: spinsWithDetails
    });
  } catch (error: any) {
    logger.error('Error fetching user spins:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch spin history',
      error: error.message
    });
  }
});

export default router;
