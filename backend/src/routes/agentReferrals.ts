import { Router, Request, Response } from 'express';
import Referral from '../models/Referral';
import User from '../models/User';
import ChatMessage from '../models/ChatMessage';
import { getSocketServerInstance } from '../utils/socketManager';
import logger from '../utils/logger';
import { requireAdminOrAgentAuth } from '../middleware/adminOrAgentAuth';

const router = Router();

router.use(requireAdminOrAgentAuth({ jwtRoles: ['agent'], permission: 'referrals' }));

// ── GET / — List all referrals with populated user data ──
router.get('/', async (req: Request, res: Response) => {
  try {
    const { status: filterStatus, page = '1', limit = '50' } = req.query;

    const query: Record<string, any> = {};
    if (filterStatus && (filterStatus === 'pending' || filterStatus === 'verified')) {
      query.status = filterStatus;
    }

    const pageNum = Math.max(1, parseInt(page as string, 10) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit as string, 10) || 50));
    const skip = (pageNum - 1) * limitNum;

    const [referrals, total] = await Promise.all([
      Referral.find(query)
        .populate('referredUser', 'username email firstName lastName createdAt')
        .populate('referredBy', 'username email firstName lastName referralCode')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      Referral.countDocuments(query),
    ]);

    const data = referrals.map((ref: any) => ({
      _id: ref._id.toString(),
      referredUser: ref.referredUser
        ? {
            _id: ref.referredUser._id.toString(),
            username: ref.referredUser.username,
            email: ref.referredUser.email,
            firstName: ref.referredUser.firstName,
            lastName: ref.referredUser.lastName,
            createdAt: ref.referredUser.createdAt,
          }
        : null,
      referredBy: ref.referredBy
        ? {
            _id: ref.referredBy._id.toString(),
            username: ref.referredBy.username,
            email: ref.referredBy.email,
            firstName: ref.referredBy.firstName,
            lastName: ref.referredBy.lastName,
            referralCode: ref.referredBy.referralCode,
          }
        : null,
      referralCode: ref.referralCode,
      status: ref.status,
      bonusGranted: ref.bonusGranted,
      bonusAmount: ref.bonusAmount,
      verifiedAt: ref.verifiedAt,
      verifiedBy: ref.verifiedBy,
      createdAt: ref.createdAt,
    }));

    return res.json({
      success: true,
      data,
      pagination: { page: pageNum, limit: limitNum, total, pages: Math.ceil(total / limitNum) },
    });
  } catch (error: any) {
    logger.error('Agent referrals fetch error:', error);
    return res.status(500).json({ success: false, message: 'Failed to fetch referrals' });
  }
});

// ── POST /:id/verify — Verify a referral, send bonus message ──
router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const agentUsername =
      (req as any).agentSession?.username ||
      (req as any).adminSession?.username ||
      'agent';

    const referral = await Referral.findById(id);
    if (!referral) {
      return res.status(404).json({ success: false, message: 'Referral not found' });
    }
    if (referral.status === 'verified') {
      return res.status(400).json({ success: false, message: 'Referral already verified' });
    }

    // Update referral status
    referral.status = 'verified';
    referral.bonusGranted = true;
    referral.verifiedAt = new Date();
    referral.verifiedBy = agentUsername;
    await referral.save();

    // ── Send system message to the REFERRED USER (the new user) — no bonus for them ──
    const bonusMessage = await ChatMessage.create({
      userId: referral.referredUser,
      senderType: 'system',
      message: `✅ Your referral has been verified! Welcome to Global Ace Gaming.`,
      status: 'sent',
      metadata: {
        type: 'referral_verified',
        referralId: referral._id.toString(),
      },
    });

    // ── Send system message to the REFERRER (the user who invited) — they get the bonus ──
    const referrerMessage = await ChatMessage.create({
      userId: referral.referredBy,
      senderType: 'system',
      message: `🎉 Your friend's referral has been verified! You earned a $${referral.bonusAmount} referral bonus.`,
      status: 'sent',
      metadata: {
        type: 'referral_bonus',
        referralId: referral._id.toString(),
        bonusAmount: referral.bonusAmount,
      },
    });

    // ── Push real-time socket events ──
    try {
      const io = getSocketServerInstance();

      // Notify referred user
      io.to(`user_${referral.referredUser.toString()}`).emit('chat:newMessage', {
        _id: bonusMessage._id.toString(),
        message: bonusMessage.message,
        senderType: 'system',
        createdAt: bonusMessage.createdAt,
      });

      // Notify referrer
      io.to(`user_${referral.referredBy.toString()}`).emit('chat:newMessage', {
        _id: referrerMessage._id.toString(),
        message: referrerMessage.message,
        senderType: 'system',
        createdAt: referrerMessage.createdAt,
      });
    } catch (socketErr) {
      logger.warn('Socket emit failed for referral verification:', socketErr);
    }

    return res.json({
      success: true,
      message: 'Referral verified and bonuses sent',
      data: {
        referralId: referral._id.toString(),
        status: referral.status,
        bonusGranted: referral.bonusGranted,
      },
    });
  } catch (error: any) {
    logger.error('Agent referral verify error:', error);
    return res.status(500).json({ success: false, message: 'Failed to verify referral' });
  }
});

export default router;
