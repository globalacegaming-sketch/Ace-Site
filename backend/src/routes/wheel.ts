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
import { WHEEL_SEGMENTS } from '../config/wheelSegments';

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

// ── Helper: send reward to chat system ──────────────────────────────────────
async function sendRewardToChat(
  userId: Types.ObjectId,
  spin: any,
  rewardLabel: string,
  rewardType: string,
  rewardValue: string | null
): Promise<string | undefined> {
  try {
    const user = await User.findById(userId).select('username email firstName lastName');
    if (!user) return undefined;

    const name = user.firstName && user.lastName
      ? `${user.firstName} ${user.lastName}`.trim()
      : user.username;

    const systemMessage = await ChatMessage.create({
      userId: user._id,
      senderType: 'system',
      message: `🎰 WHEEL OF FORTUNE REWARD: You won ${rewardLabel}!`,
      status: 'unread',
      name,
      email: user.email,
      metadata: {
        type: 'wheel_reward',
        rewardType,
        rewardValue,
        rewardLabel,
        spinId: spin._id.toString(),
        source: 'Wheel of Fortune',
        timestamp: new Date().toISOString()
      }
    });

    const messageId = systemMessage._id.toString();
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

    logger.info('Wheel bonus reward sent to chat:', { userId: userId.toString(), rewardType, messageId });
    return messageId;
  } catch (chatError: any) {
    logger.error('Failed to send wheel reward chat message:', chatError);
    return undefined;
  }
}

// ── GET /config — public (check if enabled + serve segment data) ────────────
router.get('/config', async (req: Request, res: Response) => {
  try {
    // Try new campaign system first
    const campaign = await WheelCampaign.findOne({ status: 'live' });
    if (campaign) {
      const now = new Date();
      if ((campaign.startDate && now < campaign.startDate) ||
          (campaign.endDate && now > campaign.endDate)) {
        return res.json({ success: true, data: { isEnabled: false } });
      }
      return res.json({
        success: true,
        data: {
          isEnabled: true,
          // Serve authoritative segment list so frontend stays in sync
          segments: WHEEL_SEGMENTS.map(s => ({
            type: s.type,
            label: s.label,
            wheelLabel: s.wheelLabel,
            color: s.color
          }))
        }
      });
    }

    // No live campaign → wheel is disabled
    // (Previously fell back to WheelConfig.isEnabled which defaults to true,
    //  causing the wheel to show even when no campaign is live.)
    return res.json({
      success: true,
      data: {
        isEnabled: false,
        segments: WHEEL_SEGMENTS.map(s => ({
          type: s.type,
          label: s.label,
          wheelLabel: s.wheelLabel,
          color: s.color
        }))
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

// ── GET /slices — public (for displaying the wheel) ─────────────────────────
router.get('/slices', async (req: Request, res: Response) => {
  try {
    let campaign = await WheelCampaign.findOne({ status: 'live' });
    if (!campaign) campaign = await WheelCampaign.findOne({ status: 'draft' });
    
    if (campaign) {
      logger.debug('Found campaign for slices:', { campaignId: campaign._id, status: campaign.status });
      const now = new Date();
      if ((campaign.startDate && now < campaign.startDate) ||
          (campaign.endDate && now > campaign.endDate)) {
        return res.json({ success: true, data: [] });
      }

      const slices = await WheelSlice.find({ campaignId: campaign._id, enabled: true })
        .sort({ order: 1 }).lean();

      const mappedSlices = slices.map((slice: any) => {
        let rewardType = 'better_luck';
        let color = '#6B7280';
        
        if (slice.type === 'lose') { rewardType = 'better_luck'; color = '#6B7280'; }
        else if (slice.type === 'free_spin') { rewardType = 'try_again'; color = '#F59E0B'; }
        else if (slice.type === 'cash') {
          const dollarAmount = slice.prizeValue?.replace('$', '').trim();
          if (dollarAmount === '1' || dollarAmount === '1.00') { rewardType = 'bonus_1'; color = '#10B981'; }
          else if (dollarAmount === '5' || dollarAmount === '5.00') { rewardType = 'bonus_5'; color = '#3B82F6'; }
          else if (dollarAmount === '10' || dollarAmount === '10.00') { rewardType = 'bonus_10'; color = '#8B5CF6'; }
          else { rewardType = 'bonus_1'; color = '#10B981'; }
        } else if (slice.type === 'discount') { rewardType = 'bonus_50_percent'; color = '#EC4899'; }
        else { rewardType = 'bonus_1'; color = '#8B5CF6'; }

        return { type: rewardType, label: slice.label, value: slice.prizeValue, color: slice.color || color };
      });

      return res.json({ success: true, data: mappedSlices });
    }

    return res.json({ success: true, data: [] });
  } catch (error: any) {
    logger.error('Error fetching wheel slices:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch wheel slices', error: error.message });
  }
});

// ── POST /spin — authenticated, SERVER picks the winner ─────────────────────
router.post('/spin', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const userId = new Types.ObjectId(req.user._id);

    // Try campaign-based system first (server picks winner)
    try {
      const result = await wheelSpinService.spinWheel(userId, req.user.email, req.user.phone);

      const spin = await WheelSpin.findById(result.spinId);
      if (!spin) throw new Error('Spin record not found');

      // Send bonus rewards to chat
      let messageId: string | undefined;
      if (result.rewardType.startsWith('bonus_')) {
        messageId = await sendRewardToChat(userId, spin, result.rewardLabel, result.rewardType, result.rewardValue);
      }

      return res.json({
        success: true,
        message: 'Spin completed successfully',
        data: {
          spinId: spin._id.toString(),
          sliceOrder: result.sliceOrder,
          rewardType: result.rewardType,
          rewardLabel: result.rewardLabel,
          rewardValue: result.rewardValue,
          rewardColor: result.rewardColor,
          bonusSent: spin.bonusSent,
          messageId
        }
      });
    } catch (newSystemError: any) {
      // If campaign system fails (no campaign), fall back to old config system
      logger.debug('Campaign system not available, falling back to old system:', newSystemError.message);
      
      let config = await WheelConfig.findOne();
      if (!config) config = await WheelConfig.create({});

      if (!config.isEnabled) {
        return res.status(400).json({ success: false, message: 'Wheel of Fortune is currently disabled' });
      }

      // Check spins per user limit
      if (config.spinsPerUser !== -1) {
        const userSpinCount = await WheelSpin.countDocuments({ userId });
        if (userSpinCount >= config.spinsPerUser) {
          return res.status(400).json({ success: false, message: 'You have already used all your spins' });
        }
      }

      // Check spins per day limit
      if (config.spinsPerDay !== -1) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todaySpinCount = await WheelSpin.countDocuments({ userId, createdAt: { $gte: today } });
        if (todaySpinCount >= config.spinsPerDay) {
          return res.status(400).json({ success: false, message: 'You have reached your daily spin limit' });
        }
      }

      // Build reward pool
      const rewardPool: Array<keyof typeof REWARD_TYPES> = [];
      for (let i = 0; i < config.rewards.betterLuck; i++) rewardPool.push('better_luck');
      for (let i = 0; i < config.rewards.tryAgain; i++) rewardPool.push('try_again');
      for (let i = 0; i < config.rewards.bonus1; i++) rewardPool.push('bonus_1');
      for (let i = 0; i < config.rewards.bonus5; i++) rewardPool.push('bonus_5');
      for (let i = 0; i < config.rewards.bonus10; i++) rewardPool.push('bonus_10');
      for (let i = 0; i < config.rewards.bonus50Percent; i++) rewardPool.push('bonus_50_percent');

      // Server randomly selects a reward
      const randomIndex = Math.floor(Math.random() * rewardPool.length);
      const selectedReward = rewardPool[randomIndex];
      const rewardInfo = REWARD_TYPES[selectedReward];

      // Map to segment index using shared config
      const matchingIndices = WHEEL_SEGMENTS
        .map((seg, idx) => seg.type === selectedReward ? idx : -1)
        .filter(idx => idx >= 0);
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

      // Send bonus rewards to chat
      let messageId: string | undefined;
      if (selectedReward.startsWith('bonus_')) {
        messageId = await sendRewardToChat(userId, spin, rewardInfo.label, selectedReward, rewardInfo.value);
      }

      return res.json({
        success: true,
        message: 'Spin completed successfully',
        data: {
          spinId: spin._id.toString(),
          sliceOrder,
          rewardType: selectedReward,
          rewardLabel: rewardInfo.label,
          rewardValue: rewardInfo.value,
          rewardColor: rewardInfo.color,
          bonusSent: spin.bonusSent,
          messageId
        }
      });
    }
  } catch (error: any) {
    logger.error('Error spinning wheel:', error);
    return res.status(500).json({ success: false, message: 'Failed to spin wheel', error: error.message });
  }
});

// ── GET /spins — authenticated, user's spin history ─────────────────────────
router.get('/spins', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
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

    return res.json({ success: true, data: spinsWithDetails });
  } catch (error: any) {
    logger.error('Error fetching user spins:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch spin history', error: error.message });
  }
});

export default router;
