import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import QRCode from 'qrcode';
import mongoose from 'mongoose';
import User from '../models/User';
import Referral from '../models/Referral';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import { sendSuccess, sendError } from '../utils/response';

// ── Lightweight TOTP helpers (no heavy otplib dependency) ──
function generateBase32Secret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let out = '';
  let bits = 0;
  let value = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += alphabet[(value >> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += alphabet[(value << (5 - bits)) & 0x1f];
  return out;
}

function base32Decode(str: string): Buffer {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of str.toUpperCase().replace(/=+$/, '')) {
    const idx = alphabet.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateTOTP(secret: string, time?: number): string {
  const t = Math.floor((time ?? Date.now() / 1000) / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(t, 4);
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

function verifyTOTP(token: string, secret: string, window = 1): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (let i = -window; i <= window; i++) {
    if (generateTOTP(secret, now + i * 30) === token) return true;
  }
  return false;
}

function buildOtpauthURI(email: string, secret: string): string {
  const issuer = encodeURIComponent('Global Ace Gaming');
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

const router = Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'User routes working!' });
});

// Get user profile (protected route)
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    return sendSuccess(res, 'Profile retrieved successfully', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        dateOfBirth: user.dateOfBirth,
        country: user.country,
        currency: user.currency,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        twoFactorEnabled: (user as any).twoFactorEnabled || false,
        lastLogin: user.lastLogin,
        loginStreak: (user as any).loginStreak || 0,
        lastLoginDate: (user as any).lastLoginDate,
        loginStreakRewardsClaimed: (user as any).loginStreakRewardsClaimed || [],
        achievements: (user as any).achievements || [],
        referralCode: (user as any).referralCode,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Update user profile (protected route)
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { firstName, lastName, username, phone, dateOfBirth, country, currency } = req.body;

    const updateData: any = {};
    
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (username !== undefined) {
      // Check if username is already taken by another user
      const existingUser = await User.findOne({ username, _id: { $ne: userId } });
      if (existingUser) {
        return sendError(res, 'Username already taken', 409);
      }
      updateData.username = username;
    }
    if (phone !== undefined) updateData.phone = phone;
    if (dateOfBirth !== undefined) updateData.dateOfBirth = dateOfBirth ? new Date(dateOfBirth) : undefined;
    if (country !== undefined) updateData.country = country;
    if (currency !== undefined) updateData.currency = currency;

    const user = await User.findByIdAndUpdate(
      userId,
      updateData,
      { new: true, runValidators: true }
    );

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, 'Profile updated successfully', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        dateOfBirth: user.dateOfBirth,
        country: user.country,
        currency: user.currency,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        isPhoneVerified: user.isPhoneVerified,
        lastLogin: user.lastLogin,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Update profile error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Update user avatar (protected route)
router.put('/avatar', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { avatar } = req.body;

    if (!avatar) {
      return sendError(res, 'Avatar is required', 400);
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { avatar },
      { new: true, runValidators: true }
    );

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    return sendSuccess(res, 'Avatar updated successfully', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        avatar: user.avatar,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  } catch (error) {
    logger.error('Update avatar error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Change password (protected route)
router.put('/password', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 'Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      return sendError(res, 'New password must be at least 6 characters long', 400);
    }

    // Get user with password
    const user = await User.findById(userId).select('+password');

    if (!user) {
      return sendError(res, 'User not found', 404);
    }

    // Verify current password
    const isCurrentPasswordValid = await user.comparePassword(currentPassword);

    if (!isCurrentPasswordValid) {
      return sendError(res, 'Current password is incorrect', 401);
    }

    // Update password
    user.password = newPassword;
    await user.save();

    return sendSuccess(res, 'Password changed successfully');
  } catch (error) {
    logger.error('Change password error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Two-Factor Authentication
// ──────────────────────────────────────────────────────────────────────────────

// POST /user/2fa/setup — Generate TOTP secret and QR code
router.post('/2fa/setup', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;

    // Generate a new TOTP secret
    const secret = generateBase32Secret();

    // Build the otpauth:// URI for authenticator apps
    const otpauthUrl = buildOtpauthURI(req.user!.email, secret);

    // Generate QR code as data URL
    const qrDataUrl = await QRCode.toDataURL(otpauthUrl);

    // Generate 8 backup codes
    const backupCodes = Array.from({ length: 8 }, () =>
      crypto.randomBytes(4).toString('hex').toUpperCase()
    );

    // Store the secret and backup codes (not yet enabled — user must verify first)
    await User.findByIdAndUpdate(userId, {
      twoFactorSecret: secret,
      twoFactorBackupCodes: backupCodes,
    });

    return sendSuccess(res, '2FA setup initiated', {
      qrDataUrl,
      secret,
      backupCodes,
    });
  } catch (error) {
    logger.error('2FA setup error:', error);
    return sendError(res, 'Failed to set up 2FA', 500);
  }
});

// POST /user/2fa/verify — Verify TOTP token and enable 2FA
router.post('/2fa/verify', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;
    const { token } = req.body;

    if (!token || typeof token !== 'string' || token.length !== 6) {
      return sendError(res, 'A 6-digit verification code is required', 400);
    }

    // Fetch the secret
    const user = await User.findById(userId).select('+twoFactorSecret +twoFactorBackupCodes');
    if (!user || !user.twoFactorSecret) {
      return sendError(res, 'Please start 2FA setup first', 400);
    }

    // Verify the TOTP token
    const isValid = verifyTOTP(token, user.twoFactorSecret);
    if (!isValid) {
      return sendError(res, 'Invalid verification code. Please try again.', 400);
    }

    // Enable 2FA
    user.twoFactorEnabled = true;
    await user.save();

    return sendSuccess(res, 'Two-factor authentication enabled', {
      backupCodes: user.twoFactorBackupCodes,
    });
  } catch (error) {
    logger.error('2FA verify error:', error);
    return sendError(res, 'Failed to verify 2FA', 500);
  }
});

// POST /user/2fa/disable — Disable 2FA
router.post('/2fa/disable', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id;

    await User.findByIdAndUpdate(userId, {
      twoFactorEnabled: false,
      $unset: { twoFactorSecret: 1, twoFactorBackupCodes: 1 },
    });

    return sendSuccess(res, 'Two-factor authentication disabled');
  } catch (error) {
    logger.error('2FA disable error:', error);
    return sendError(res, 'Failed to disable 2FA', 500);
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Active Sessions
// ──────────────────────────────────────────────────────────────────────────────

// GET /user/sessions — List active sessions for the current user
router.get('/sessions', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const db = mongoose.connection.db;
    if (!db) {
      return sendError(res, 'Database not available', 500);
    }

    const sessionsCol = db.collection('sessions');

    // The current session ID from the cookie (without the 's:' prefix that
    // express-session strips when signing). connect-mongo stores the raw ID as _id.
    const currentSid = req.sessionID;

    // Find all sessions where session JSON contains this user's id
    const rawSessions = await sessionsCol
      .find({ session: { $regex: userId } })
      .sort({ _id: -1 })
      .limit(20)
      .toArray();

    const sessions = rawSessions
      .map((doc) => {
        try {
          const parsed = typeof doc.session === 'string' ? JSON.parse(doc.session) : doc.session;
          // Only include sessions that belong to this user
          if (parsed?.user?.id !== userId) return null;

          // Try to extract UA from the cookie data or fall back
          const ua = parsed?.userAgent || req.headers['user-agent'] || 'Unknown';
          const ip = parsed?.ip || '—';
          // express-session stores originalMaxAge (ms) in every session document.
          // connect-mongo sets doc.expires = last_touch_time + TTL, so subtracting
          // the maxAge back-derives the approximate last-active timestamp.
          const maxAge = parsed?.cookie?.originalMaxAge || 7 * 24 * 60 * 60 * 1000;
          const lastActive = doc.expires
            ? new Date(doc.expires.getTime() - maxAge).toISOString()
            : new Date().toISOString();

          return {
            _id: doc._id,
            userAgent: ua,
            ip,
            lastActive,
            isCurrent: String(doc._id) === currentSid,
          };
        } catch {
          return null;
        }
      })
      .filter(Boolean);

    return sendSuccess(res, 'Sessions retrieved', sessions);
  } catch (error) {
    logger.error('Get sessions error:', error);
    return sendError(res, 'Failed to retrieve sessions', 500);
  }
});

// DELETE /user/sessions/:id — Revoke a specific session
router.delete('/sessions/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const sessionId = req.params.id;
    const userId = req.user!._id.toString();
    const db = mongoose.connection.db;
    if (!db) {
      return sendError(res, 'Database not available', 500);
    }

    const sessionsCol = db.collection('sessions');

    // Find the session first and verify it belongs to this user
    const doc = await sessionsCol.findOne({ _id: sessionId as any });
    if (!doc) {
      return sendError(res, 'Session not found', 404);
    }

    try {
      const parsed = typeof doc.session === 'string' ? JSON.parse(doc.session) : doc.session;
      if (parsed?.user?.id !== userId) {
        return sendError(res, 'Session does not belong to you', 403);
      }
    } catch {
      // If we can't parse it, still allow deletion if the regex matched
    }

    // Don't allow revoking the current session
    if (sessionId === req.sessionID) {
      return sendError(res, 'Cannot revoke your current session. Use logout instead.', 400);
    }

    await sessionsCol.deleteOne({ _id: sessionId as any });

    return sendSuccess(res, 'Session revoked');
  } catch (error) {
    logger.error('Revoke session error:', error);
    return sendError(res, 'Failed to revoke session', 500);
  }
});

// ── Streak rewards definition ──
// `spins` field indicates how many bonus wheel spins to award when claimed.
const STREAK_REWARDS: Record<number, { label: string; description: string; spins?: number }> = {
  1: { label: '1 Free Spin', description: 'You earned 1 free spin!', spins: 1 },
  2: { label: '2 Free Spins', description: 'You earned 2 free spins!', spins: 2 },
  3: { label: '30% Deposit Bonus', description: '30% bonus on your next deposit!' },
  4: { label: '40% Deposit Bonus', description: '40% bonus on your next deposit!' },
  5: { label: '50% Bonus', description: '50% bonus on your next deposit!' },
  6: { label: '50% + 1 Spin', description: '50% bonus plus 1 free spin!', spins: 1 },
  7: { label: '$5 Freeplay', description: '$5 freeplay credit added!' },
};

// ── GET /streak — return current streak info ──
router.get('/streak', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'Not authenticated', 401);

    const user = await User.findById(req.user._id).select(
      'loginStreak lastLoginDate loginStreakRewardsClaimed achievements'
    );
    if (!user) return sendError(res, 'User not found', 404);

    const streakDay = user.loginStreak > 7
      ? ((user.loginStreak - 1) % 7) + 1
      : user.loginStreak;

    const rewards = Object.entries(STREAK_REWARDS).map(([day, reward]) => ({
      day: Number(day),
      ...reward,
      claimed: (user.loginStreakRewardsClaimed || []).includes(Number(day)),
      current: Number(day) === streakDay,
      unlocked: Number(day) <= streakDay,
    }));

    return sendSuccess(res, 'Streak info', {
      loginStreak: user.loginStreak,
      streakDay,
      lastLoginDate: user.lastLoginDate,
      rewards,
      achievements: user.achievements || [],
    });
  } catch (error) {
    logger.error('Streak fetch error:', error);
    return sendError(res, 'Failed to fetch streak', 500);
  }
});

// ── POST /streak/claim — claim a streak day reward ──
router.post('/streak/claim', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'Not authenticated', 401);

    const { day } = req.body;
    if (!day || !STREAK_REWARDS[day]) {
      return sendError(res, 'Invalid streak day', 400);
    }

    const user = await User.findById(req.user._id).select(
      'loginStreak lastLoginDate loginStreakRewardsClaimed'
    );
    if (!user) return sendError(res, 'User not found', 404);

    const streakDay = user.loginStreak > 7
      ? ((user.loginStreak - 1) % 7) + 1
      : user.loginStreak;

    if (day > streakDay) {
      return sendError(res, 'You have not reached this streak day yet', 400);
    }
    if ((user.loginStreakRewardsClaimed || []).includes(day)) {
      return sendError(res, 'Reward already claimed for this day', 400);
    }

    const updateOps: Record<string, any> = {
      $addToSet: { loginStreakRewardsClaimed: day },
    };

    // Award bonus wheel spins if the reward includes them
    const reward = STREAK_REWARDS[day];
    if (reward.spins && reward.spins > 0) {
      updateOps.$inc = { bonusSpins: reward.spins };
      logger.info('🎰 Awarding streak bonus spins', {
        userId: user._id.toString(),
        day,
        spins: reward.spins,
      });
    }

    await User.updateOne({ _id: user._id }, updateOps);

    // Return updated bonusSpins count so the frontend can reflect it immediately
    const updatedUser = await User.findById(user._id).select('bonusSpins');
    const bonusSpins = (updatedUser as any)?.bonusSpins || 0;

    return sendSuccess(res, `Claimed: ${reward.label}`, { day, reward, bonusSpins });
  } catch (error) {
    logger.error('Streak claim error:', error);
    return sendError(res, 'Failed to claim reward', 500);
  }
});

// ── GET /achievements — return user achievements/badges ──
router.get('/achievements', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'Not authenticated', 401);

    const user = await User.findById(req.user._id).select('achievements loginStreak');
    if (!user) return sendError(res, 'User not found', 404);

    return sendSuccess(res, 'Achievements', {
      achievements: user.achievements || [],
      loginStreak: user.loginStreak || 0,
    });
  } catch (error) {
    logger.error('Achievements fetch error:', error);
    return sendError(res, 'Failed to fetch achievements', 500);
  }
});

// ── GET /referrals — return referral stats (only verified referrals shown as "Friends Invited") ──
router.get('/referrals', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) return sendError(res, 'Not authenticated', 401);

    const user = await User.findById(req.user._id).select('referralCode');
    if (!user) return sendError(res, 'User not found', 404);

    const referralCode = user.referralCode;

    // Query the Referral model for VERIFIED referrals where this user is the referrer
    const verifiedReferrals = await Referral.find({
      referredBy: user._id,
      status: 'verified',
    })
      .populate('referredUser', 'username createdAt')
      .sort({ verifiedAt: -1 })
      .limit(50)
      .lean();

    // Also count pending ones so user knows referrals exist
    const pendingCount = await Referral.countDocuments({
      referredBy: user._id,
      status: 'pending',
    });

    const referralCount = verifiedReferrals.length;
    const referredUsers = verifiedReferrals.map((ref: any) => ({
      username: ref.referredUser
        ? ref.referredUser.username.charAt(0) + '***' + ref.referredUser.username.slice(-1)
        : '???',
      joinedAt: ref.referredUser?.createdAt || ref.createdAt,
      verified: true,
    }));

    return sendSuccess(res, 'Referral stats', {
      referralCode: referralCode || null,
      referralCount,
      pendingCount,
      referredUsers,
    });
  } catch (error) {
    logger.error('Referrals fetch error:', error);
    return sendError(res, 'Failed to fetch referrals', 500);
  }
});

export default router;
