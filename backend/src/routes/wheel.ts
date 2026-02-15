import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { authenticate } from '../middleware/auth';
import { wheelSpinLimiter } from '../middleware/rateLimiter';
import WheelSpin from '../models/WheelSpin';
import WheelCampaign from '../models/WheelCampaign';
import User from '../models/User';
import WheelFairnessRules from '../models/WheelFairnessRules';
import WheelSlice from '../models/WheelSlice';
import ChatMessage from '../models/ChatMessage';
import { getSocketServerInstance } from '../utils/socketManager';
import wheelSpinService from '../services/wheelSpinService';
import logger from '../utils/logger';
import { WHEEL_SEGMENTS } from '../config/wheelSegments';

const router = Router();

// Reward types — display values derived from WHEEL_SEGMENTS (single source of truth)
const REWARD_TYPES: Record<string, { label: string; value: string | null; color: string }> = {
  better_luck: { label: 'Better Luck Next Time', value: null, color: '#6B7280' },
  try_again: { label: 'Free Spin +1', value: null, color: '#F59E0B' },
  bonus_1: { label: '$1 Bonus', value: '$1', color: '#10B981' },
  bonus_2: { label: '$2 Bonus', value: '$2', color: '#10B981' },
  bonus_5: { label: '$5 Bonus', value: '$5', color: '#3B82F6' },
  bonus_10: { label: '$10 Bonus', value: '$10', color: '#8B5CF6' },
  bonus_50_percent: { label: '50% Bonus', value: '50%', color: '#EC4899' }
};

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
          else if (dollarAmount === '2' || dollarAmount === '2.00') { rewardType = 'bonus_2'; color = '#10B981'; }
          else if (dollarAmount === '5' || dollarAmount === '5.00') { rewardType = 'bonus_5'; color = '#3B82F6'; }
          else if (dollarAmount === '10' || dollarAmount === '10.00') { rewardType = 'bonus_10'; color = '#8B5CF6'; }
          else { rewardType = 'bonus_2'; color = '#10B981'; }
        } else if (slice.type === 'discount') { rewardType = 'bonus_50_percent'; color = '#EC4899'; }
        else { rewardType = 'bonus_2'; color = '#10B981'; }

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

// ── POST /spin — authenticated, rate-limited, SERVER picks the winner ───────
// Campaign system is the ONLY path. No campaign = wheel is off.
router.post('/spin', authenticate, wheelSpinLimiter, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    // Reject client-supplied outcome (server is the only source of truth)
    const body = req.body as Record<string, unknown>;
    if (body && (typeof body.sliceOrder === 'number' || body.rewardType || body.rewardLabel)) {
      logger.warn('Wheel spin rejected: client sent outcome fields', { userId: (req.user as any)._id });
      return res.status(400).json({ success: false, message: 'Invalid request' });
    }

    const userId = new Types.ObjectId(req.user._id);

    // ── Run the spin through the campaign system ──
    try {
      const result = await wheelSpinService.spinWheel(userId, req.user.email, req.user.phone);
      const spin = await WheelSpin.findById(result.spinId);
      if (!spin) throw new Error('Spin record not found');

      // Send bonus reward to chat if it's a monetary win
      let messageId: string | undefined;
      if (result.rewardType.startsWith('bonus_')) {
        messageId = await sendRewardToChat(userId, spin, result.rewardLabel, result.rewardType, result.rewardValue);
      }

      const updatedUser = await User.findById(req.user._id).select('bonusSpins').lean();
      const bonusSpins = (updatedUser as any)?.bonusSpins ?? 0;

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
          messageId,
          bonusSpins
        }
      });
    } catch (campaignError: any) {
      const msg = campaignError.message || '';

      // User hit their spin limit, not eligible, or no bonus spin — pass the specific message
      if (
        msg.includes('used all') ||
        msg.includes('not eligible') ||
        msg.includes('Check back') ||
        msg.includes('No bonus spin') ||
        msg.includes('Next reset') ||
        msg.includes('No eligible segments')
      ) {
        return res.status(400).json({
          success: false,
          message: msg
        });
      }

      // Campaign system is not set up — wheel should be off
      logger.warn('Wheel spin rejected — no active campaign:', msg);
      return res.status(400).json({
        success: false,
        message: 'Wheel of Fortune is currently disabled'
      });
    }

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
    const now = new Date();
    const msIn12h = 12 * 60 * 60 * 1000;
    const cutoff = new Date(now.getTime() - msIn12h);

    // Campaign system is the only source of truth
    const campaign = await WheelCampaign.findOne({ status: 'live' });
    if (!campaign) {
      return res.json({
        success: true,
        data: {
          spinsRemaining: 0,
          bonusSpins: 0,
          totalAvailable: 0,
          spinsPerDay: 0,
          windowSpins: 0,
          nextResetTime: new Date(now.getTime() + msIn12h).toISOString(),
          wheelEnabled: false
        }
      });
    }

    const campaignId = campaign._id as Types.ObjectId;
    const fairnessRules = await WheelFairnessRules.findOne({ campaignId });

    // Default to 1 if spinsPerDay is missing from an old DB document
    const spinsPerDay = fairnessRules?.spinsPerDay ?? 1;

    // Count spins in the last 12 hours that count toward the limit (exclude spins that used a bonus/free spin)
    const recentSpinCount = await WheelSpin.countDocuments({
      userId,
      campaignId,
      createdAt: { $gte: cutoff },
      $or: [{ usedBonusSpin: { $ne: true } }, { usedBonusSpin: { $exists: false } }]
    });

    const userDoc = await User.findById(userId).select('bonusSpins').lean();
    const bonusSpins = (userDoc as any)?.bonusSpins ?? 0;

    const spinsRemaining = spinsPerDay !== -1
      ? Math.max(0, spinsPerDay - recentSpinCount)
      : -1; // unlimited

    // Calculate next reset: 12h after the oldest spin that counts toward the limit (same filter as count)
    let nextResetTime: string;
    if (spinsRemaining === 0 && spinsPerDay !== -1) {
      const oldestRecentSpin = await WheelSpin.findOne({
        userId,
        campaignId,
        createdAt: { $gte: cutoff },
        $or: [{ usedBonusSpin: { $ne: true } }, { usedBonusSpin: { $exists: false } }]
      }).sort({ createdAt: 1 }).select('createdAt').lean();

      nextResetTime = oldestRecentSpin
        ? new Date(new Date(oldestRecentSpin.createdAt).getTime() + msIn12h).toISOString()
        : new Date(now.getTime() + msIn12h).toISOString();
    } else {
      nextResetTime = new Date(now.getTime() + msIn12h).toISOString();
    }

    logger.info('📊 spin-status:', {
      userId: userId.toString(),
      campaignId: campaignId.toString(),
      spinsPerDay,
      recentSpinCount,
      spinsRemaining,
      nextReset: nextResetTime,
    });

    // -1 means unlimited; don't add bonusSpins to -1
    const totalAvailable = spinsRemaining === -1 ? -1 : spinsRemaining + bonusSpins;

    return res.json({
      success: true,
      data: {
        spinsRemaining,
        bonusSpins,
        totalAvailable,
        spinsPerDay,
        windowSpins: recentSpinCount,
        nextResetTime,
        wheelEnabled: true
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
      const rewardInfo = REWARD_TYPES[spin.rewardType as keyof typeof REWARD_TYPES]
        ?? { label: spin.rewardType || 'Unknown', value: null, color: '#6B7280' };
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
