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
    // Campaign status is the single source of truth for visibility.
    // Dates are informational only — the toggle (status field) controls show/hide.
    const campaign = await WheelCampaign.findOne({ status: 'live' });
    if (campaign) {
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

    // ── Helper: award / consume bonus spins after a successful spin ──
    const postSpinBookkeeping = async (rewardType: string, consumedBonusSpin: boolean) => {
      let delta = 0;
      if (rewardType === 'try_again') {
        delta += 1; // Award +1 bonus spin for "Free Spin +1"
        logger.info('🎰 Awarding +1 bonus spin (Free Spin win)', { userId: userId.toString() });
      }
      if (consumedBonusSpin) {
        delta -= 1; // Deduct the bonus spin that was used
        logger.info('🎰 Consuming 1 bonus spin', { userId: userId.toString() });
      }
      if (delta !== 0) {
        await User.updateOne({ _id: userId }, { $inc: { bonusSpins: delta } });
      }
    };

    // ── Helper: build success response with current bonus spin count ──
    const buildResponse = async (spinDoc: any, sliceOrder: number, rewardType: string, rewardLabel: string, rewardValue: string | null, rewardColor: string, messageId?: string) => {
      const updatedUser = await User.findById(userId).select('bonusSpins');
      const bonusSpins = (updatedUser as any)?.bonusSpins || 0;
      return res.json({
        success: true,
        message: 'Spin completed successfully',
        data: {
          spinId: spinDoc._id.toString(),
          sliceOrder,
          rewardType,
          rewardLabel,
          rewardValue,
          rewardColor,
          bonusSent: spinDoc.bonusSent,
          messageId,
          bonusSpins
        }
      });
    };

    // ── Helper: execute spin via old config system (skips limit checks if bypassLimits) ──
    const doOldConfigSpin = async (bypassLimits: boolean) => {
      let config = await WheelConfig.findOne();
      if (!config) config = await WheelConfig.create({});

      if (!config.isEnabled) {
        return res.status(400).json({ success: false, message: 'Wheel of Fortune is currently disabled' });
      }

      if (!bypassLimits) {
        if (config.spinsPerUser !== -1) {
          const userSpinCount = await WheelSpin.countDocuments({ userId });
          if (userSpinCount >= config.spinsPerUser) {
            return null; // signal: limit hit
          }
        }
        if (config.spinsPerDay !== -1) {
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          const todaySpinCount = await WheelSpin.countDocuments({ userId, createdAt: { $gte: today } });
          if (todaySpinCount >= config.spinsPerDay) {
            return null; // signal: limit hit
          }
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

      const selectedReward = rewardPool[Math.floor(Math.random() * rewardPool.length)];
      const rewardInfo = REWARD_TYPES[selectedReward];

      const matchingIndices = WHEEL_SEGMENTS
        .map((seg, idx) => seg.type === selectedReward ? idx : -1)
        .filter(idx => idx >= 0);
      const sliceOrder = matchingIndices.length > 0
        ? matchingIndices[Math.floor(Math.random() * matchingIndices.length)]
        : 0;

      const spin = await WheelSpin.create({
        userId,
        rewardType: selectedReward,
        rewardValue: rewardInfo.value || undefined,
        bonusSent: false
      });

      return { spin, sliceOrder, selectedReward, rewardInfo };
    };

    // ───────────────────────────────────────────────────────────────────────
    // ATTEMPT 1: Try campaign system (it has its own eligibility checks)
    // ───────────────────────────────────────────────────────────────────────
    let campaignLimitHit = false;
    try {
      const result = await wheelSpinService.spinWheel(userId, req.user.email, req.user.phone);
      const spin = await WheelSpin.findById(result.spinId);
      if (!spin) throw new Error('Spin record not found');

      await postSpinBookkeeping(result.rewardType, false);

      let messageId: string | undefined;
      if (result.rewardType.startsWith('bonus_')) {
        messageId = await sendRewardToChat(userId, spin, result.rewardLabel, result.rewardType, result.rewardValue);
      }

      return await buildResponse(spin, result.sliceOrder, result.rewardType, result.rewardLabel, result.rewardValue, result.rewardColor, messageId);
    } catch (campaignError: any) {
      const msg = campaignError.message || '';
      campaignLimitHit = msg.includes('already used') || msg.includes('not eligible');
      if (!campaignLimitHit) {
        logger.debug('Campaign system not available, falling back:', msg);
      }
    }

    // ───────────────────────────────────────────────────────────────────────
    // ATTEMPT 2: Old config system (normal limits)
    // ───────────────────────────────────────────────────────────────────────
    if (!campaignLimitHit) {
      const result = await doOldConfigSpin(false);
      if (result && 'spin' in result) {
        await postSpinBookkeeping(result.selectedReward, false);

        let messageId: string | undefined;
        if (result.selectedReward.startsWith('bonus_')) {
          messageId = await sendRewardToChat(userId, result.spin, result.rewardInfo.label, result.selectedReward, result.rewardInfo.value);
        }

        return await buildResponse(result.spin, result.sliceOrder, result.selectedReward, result.rewardInfo.label, result.rewardInfo.value, result.rewardInfo.color, messageId);
      }
      // result === null means limit hit; fall through to bonus spin check
    }

    // ───────────────────────────────────────────────────────────────────────
    // ATTEMPT 3: Use a bonus spin (user hit normal limits)
    // ───────────────────────────────────────────────────────────────────────
    const userDoc = await User.findById(userId).select('bonusSpins');
    const bonusSpinsAvailable = (userDoc as any)?.bonusSpins || 0;

    if (bonusSpinsAvailable <= 0) {
      return res.status(400).json({
        success: false,
        message: 'You have reached your daily spin limit'
      });
    }

    // Force the spin through, bypassing limits (bonus spin pays for it)
    const result = await doOldConfigSpin(true);
    if (!result || !('spin' in result)) {
      return res.status(400).json({ success: false, message: 'Wheel of Fortune is currently disabled' });
    }

    await postSpinBookkeeping(result.selectedReward, true);

    let messageId: string | undefined;
    if (result.selectedReward.startsWith('bonus_')) {
      messageId = await sendRewardToChat(userId, result.spin, result.rewardInfo.label, result.selectedReward, result.rewardInfo.value);
    }

    return await buildResponse(result.spin, result.sliceOrder, result.selectedReward, result.rewardInfo.label, result.rewardInfo.value, result.rewardInfo.color, messageId);

  } catch (error: any) {
    logger.error('Error spinning wheel:', error);
    return res.status(500).json({ success: false, message: 'Failed to spin wheel', error: error.message });
  }
});

// ── GET /spins — authenticated, user's spin history ─────────────────────────
// ── GET /spin-status — returns remaining spins & next reset for dashboard CTA ─
router.get('/spin-status', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const userId = req.user._id;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Try new campaign system first
    let spinsPerDay = -1;
    let spinsPerUser = -1;
    try {
      const campaign = await WheelCampaign.findOne({ status: 'live' });
      if (campaign) {
        // Campaign system — use WheelConfig for per-day limits or campaign rules
        const config = await WheelConfig.findOne();
        if (config) {
          spinsPerDay = config.spinsPerDay;
          spinsPerUser = config.spinsPerUser;
        }
      }
    } catch {
      // Fall back to old config system
    }

    if (spinsPerDay === -1 && spinsPerUser === -1) {
      const config = await WheelConfig.findOne();
      if (config) {
        spinsPerDay = config.spinsPerDay;
        spinsPerUser = config.spinsPerUser;
      }
    }

    const [todaySpinCount, totalSpinCount, userDoc] = await Promise.all([
      WheelSpin.countDocuments({ userId, createdAt: { $gte: today } }),
      WheelSpin.countDocuments({ userId }),
      User.findById(userId).select('bonusSpins'),
    ]);
    const bonusSpins = (userDoc as any)?.bonusSpins || 0;

    let spinsRemaining: number;
    if (spinsPerDay !== -1) {
      spinsRemaining = Math.max(0, spinsPerDay - todaySpinCount);
    } else if (spinsPerUser !== -1) {
      spinsRemaining = Math.max(0, spinsPerUser - totalSpinCount);
    } else {
      spinsRemaining = -1; // unlimited
    }

    // Total available = normal remaining + bonus spins
    const totalAvailable = spinsRemaining === -1
      ? -1
      : spinsRemaining + bonusSpins;

    return res.json({
      success: true,
      data: {
        spinsRemaining,
        bonusSpins,
        totalAvailable,
        spinsPerDay,
        spinsPerUser,
        todaySpins: todaySpinCount,
        totalSpins: totalSpinCount,
        nextResetTime: tomorrow.toISOString(),
      }
    });
  } catch (error: any) {
    logger.error('Error fetching spin status:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch spin status' });
  }
});

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
