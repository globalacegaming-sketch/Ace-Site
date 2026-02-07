import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import User, { IUser } from '../models/User';
import Referral from '../models/Referral';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import fortunePandaService from '../services/fortunePandaService';
import emailService from '../services/emailService';
import { authLimiter, registerLimiter, passwordResetLimiter } from '../middleware/rateLimiter';
import logger from '../utils/logger';
import { sendSuccess, sendError } from '../utils/response';
import { getClientIP } from '../utils/requestUtils';
import { isIPBanned } from '../utils/ipBanUtils';

const router = Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working!' });
});

// Register new user - apply registration rate limiter
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const { 
      firstName, 
      lastName, 
      username, 
      email, 
      phoneNumber, 
      password, 
      referralCode 
    } = req.body;

    // Get client IP address
    const clientIP = getClientIP(req);

    // Check if IP is globally banned BEFORE any other validation
    const ipIsBanned = await isIPBanned(clientIP);
    if (ipIsBanned) {
      logger.warn(`Banned IP attempted registration: ${clientIP}`);
      return sendError(res, 'Due to suspicous activity you have resulted in permanent account ban . Please play safe and follow rules', 403);
    }

    // Validate required fields
    if (!firstName || !lastName || !username || !email || !password) {
      return sendError(res, 'First name, last name, username, email, and password are required', 400);
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return sendError(res, 'Please enter a valid email address', 400);
    }

    // Validate password strength
    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters long', 400);
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return sendError(res, existingUser.email === email ? 'Email already registered' : 'Username already taken', 409);
    }

    // Handle referral code if provided
    let referredBy = null;
    let referrerUserId: string | null = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        referredBy = (referrer._id as any).toString();
        referrerUserId = referredBy;
      } else {
        return sendError(res, 'Invalid referral code', 400);
      }
    }

    // Generate unique referral code for new user
    const generateReferralCode = () => {
      const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
      let result = '';
      for (let i = 0; i < 8; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    // Generate unique Fortune Panda username using {firstName}_Aces9F format
    // If username already exists, append random suffix to ensure uniqueness
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
        // Append random suffix: _Aces9F + 3 random alphanumeric chars
        const suffix = Math.random().toString(36).substring(2, 5).toUpperCase();
        candidate = `${baseFirstName}_Aces9F${suffix}`;
        attempts++;
      }
      // Fallback: use timestamp if all attempts fail
      return `${baseFirstName}_Aces9F${Date.now().toString().slice(-6)}`;
    };

    const fortunePandaUsername = await generateUniqueFortunePandaUsername(firstName);
    const fortunePandaPassword = fortunePandaService.generateFortunePandaPassword();

    // Generate 6-digit verification code
    const emailVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    // Create new user with retry logic for referral code uniqueness
    // This handles race conditions where multiple users might generate the same code
    let user: any = null;
    let userReferralCode = generateReferralCode();
    const MAX_RETRIES = 10; // Prevent infinite loops
    let retries = 0;

    while (!user && retries < MAX_RETRIES) {
      try {
        const newUser = new User({
          firstName,
          lastName,
          username,
          email,
          phone: phoneNumber,
          password,
          referralCode: userReferralCode,
          referredBy,
          fortunePandaUsername,
          fortunePandaPassword,
          emailVerificationToken: emailVerificationCode,
          emailVerificationExpires,
          isEmailVerified: false,
          lastLoginIP: clientIP // Store the IP address used during registration
        });

        await newUser.save();
        user = newUser;
      } catch (error: any) {
        // Check if it's a duplicate key error for referralCode
        const isDuplicateReferralCode = 
          (error.name === 'MongoError' || error.name === 'MongoServerError') && 
          error.code === 11000 && 
          error.keyPattern?.referralCode;

        if (isDuplicateReferralCode && retries < MAX_RETRIES - 1) {
          // Generate a new referral code and retry
          retries++;
          userReferralCode = generateReferralCode();
          continue;
        } else if (isDuplicateReferralCode) {
          // Max retries reached, return error
          return sendError(res, 'Failed to generate unique referral code. Please try again.', 500);
        } else {
          // Some other error occurred, throw it
          throw error;
        }
      }
    }

    if (!user) {
      return sendError(res, 'Failed to create user account. Please try again.', 500);
    }

    // Create a Referral record if the user signed up with a referral code
    if (referrerUserId && referralCode) {
      Referral.create({
        referredUser: user._id,
        referredBy: referrerUserId,
        referralCode: referralCode.toUpperCase(),
        status: 'pending',
        bonusGranted: false,
      }).catch(err => logger.error('Failed to create referral record:', err));
    }

    // Generate tokens immediately (don't wait for async operations)
    const tokens = generateTokens(user);

    // ── Store user identity in session (same as login) ──
    req.session.user = {
      id: (user._id as any).toString(),
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
    req.session.userAgent = req.headers['user-agent'] || 'Unknown';
    req.session.ip = req.ip || req.socket.remoteAddress || '—';
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    // Send verification email with code (fire and forget - don't block response)
    emailService.sendVerificationCodeEmail(email, emailVerificationCode, firstName).catch((error) => {
      logger.warn('Failed to send verification email:', error);
      // Continue with registration even if email fails
    });

    // Create Fortune Panda account (fire and forget - don't block response)
    // Use setTimeout to make it truly async and non-blocking
    setTimeout(async () => {
      try {
        const fortunePandaResult = await fortunePandaService.createFortunePandaUser(fortunePandaUsername, fortunePandaPassword);
        
        if (!fortunePandaResult.success) {
        logger.warn('Failed to create Fortune Panda account:', fortunePandaResult.message);
        // Continue with registration even if Fortune Panda account creation fails
      }
    } catch (error) {
      logger.warn('Error creating Fortune Panda account:', error);
        // Continue with registration even if Fortune Panda account creation fails
      }
    }, 0);

    // Return response immediately without waiting for Fortune Panda
    return sendSuccess(res, 'User registered successfully', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        referralCode: user.referralCode,
        createdAt: user.createdAt
      },
      fortunePanda: {
        username: fortunePandaUsername,
        password: fortunePandaPassword
      },
      ...tokens
    }, 201);
  } catch (error) {
    logger.error('Registration error:', error);
    return sendError(res, 'Internal server error during registration', 500);
  }
});

// Login user - apply authentication rate limiter
router.post('/login', authLimiter, async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return sendError(res, 'Email and password are required', 400);
    }

    // Get client IP address
    const clientIP = getClientIP(req);

    // Check if IP is globally banned BEFORE checking user credentials
    const ipIsBanned = await isIPBanned(clientIP);
    if (ipIsBanned) {
      logger.warn(`Globally banned IP attempted login: ${clientIP}`);
      return sendError(res, 'Due to suspicous activity you have resulted in permanent account ban . Please play safe and follow rules', 403);
    }

    // Find user by email and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // Check if user is banned (this blocks the user regardless of IP)
    if (user.isBanned) {
      logger.warn(`Banned user attempted login: ${email} from IP: ${clientIP}`);
      return sendError(res, 'Due to suspicous activity you have resulted in permanent account ban . Please play safe and follow rules', 403);
    }

    // Check if IP is banned for this user
    if (user.bannedIPs && user.bannedIPs.length > 0 && user.bannedIPs.includes(clientIP)) {
      logger.warn(`Banned IP attempted login: ${clientIP} for user: ${email}`);
      return sendError(res, 'Due to suspicous activity you have resulted in permanent account ban . Please play safe and follow rules', 403);
    }

    // Check if account is active
    if (!user.isActive) {
      return sendError(res, 'Account is deactivated. Please contact support.', 401);
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return sendError(res, 'Invalid email or password', 401);
    }

    // ── Update login streak ──
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const lastLoginDate = user.lastLoginDate ? new Date(user.lastLoginDate) : null;
    const lastLoginDay = lastLoginDate ? new Date(lastLoginDate) : null;
    if (lastLoginDay) lastLoginDay.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    let newStreak = user.loginStreak || 0;
    let streakUpdated = false;

    if (!lastLoginDay) {
      // First login ever
      newStreak = 1;
      streakUpdated = true;
    } else if (lastLoginDay.getTime() === todayStart.getTime()) {
      // Already logged in today — no change
      streakUpdated = false;
    } else if (lastLoginDay.getTime() === yesterdayStart.getTime()) {
      // Consecutive day login — increment streak
      newStreak = (user.loginStreak || 0) + 1;
      streakUpdated = true;
    } else {
      // Streak broken — reset to 1
      newStreak = 1;
      streakUpdated = true;
    }

    // Cap streak display at 7, then cycle
    const streakDay = newStreak > 7 ? ((newStreak - 1) % 7) + 1 : newStreak;

    // Check if a new achievement badge should be awarded
    const newAchievements: Array<{ id: string; name: string; description: string; icon: string; earnedAt: Date }> = [];
    if (streakUpdated && newStreak === 7) {
      const has7DayBadge = (user.achievements || []).some((a: any) => a.id === '7_day_streak');
      if (!has7DayBadge) {
        newAchievements.push({
          id: '7_day_streak',
          name: '7-Day Streak',
          description: 'Logged in 7 consecutive days!',
          icon: 'flame',
          earnedAt: now,
        });
      }
    }

    const updateFields: Record<string, any> = {
      lastLogin: now,
      lastLoginIP: clientIP,
    };
    if (streakUpdated) {
      updateFields.loginStreak = newStreak;
      updateFields.lastLoginDate = now;
    }
    const pushFields: Record<string, any> = {};
    if (newAchievements.length > 0) {
      pushFields.achievements = { $each: newAchievements };
    }

    const updateQuery: Record<string, any> = { $set: updateFields };
    if (Object.keys(pushFields).length > 0) updateQuery.$push = pushFields;

    User.updateOne({ _id: user._id }, updateQuery)
      .catch(err => logger.error('Failed to update lastLogin/streak:', err));

    // Generate tokens (kept for backward compatibility with existing clients)
    const tokens = generateTokens(user);

    // ── Store user identity in the server-side session ──
    // This creates a MongoDB-backed session document and sets an httpOnly
    // cookie on the response. Subsequent requests (including Socket.io
    // handshakes) automatically include this cookie, so the server can
    // identify the user without requiring a Bearer token.
    req.session.user = {
      id: (user._id as any).toString(),
      username: user.username,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
    };
    // Store device info for the Active Sessions UI
    req.session.userAgent = req.headers['user-agent'] || 'Unknown';
    req.session.ip = req.ip || req.socket.remoteAddress || '—';

    // Force the session to save before responding, so the cookie is set
    // and the session document exists in MongoDB immediately.
    await new Promise<void>((resolve, reject) => {
      req.session.save((err) => (err ? reject(err) : resolve()));
    });

    return sendSuccess(res, 'Login successful', {
      user: {
        id: user._id,
        username: user.username,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isEmailVerified: user.isEmailVerified,
        lastLogin: user.lastLogin,
        loginStreak: streakUpdated ? newStreak : (user.loginStreak || 0),
        streakDay,
        achievements: user.achievements || [],
        referralCode: user.referralCode,
        createdAt: user.createdAt,
      },
      newAchievements,
      ...tokens
    });
  } catch (error) {
    logger.error('Login error:', error);
    return sendError(res, 'Internal server error during login', 500);
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 'Refresh token is required', 400);
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return sendError(res, 'Invalid refresh token', 401);
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    return sendSuccess(res, 'Tokens refreshed successfully', tokens);
  } catch (error) {
    logger.error('Token refresh error:', error);
    return sendError(res, 'Invalid or expired refresh token', 401);
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }
    const user = req.user;

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

// Logout – destroys the server-side session and clears the cookie.
// The authenticate middleware is kept so existing Bearer-token clients
// still hit this route, but we also handle cookie-only sessions.
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    // ── Destroy the MongoDB session document ──
    // This removes the session from the store and invalidates the cookie.
    await new Promise<void>((resolve, reject) => {
      req.session.destroy((err) => (err ? reject(err) : resolve()));
    });

    // ── Clear the session cookie on the client ──
    // Use the same cookie name ('gag.sid') configured in config/session.ts.
    res.clearCookie('gag.sid', {
      path: '/',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
    });

    return sendSuccess(res, 'Logged out successfully');
  } catch (error) {
    logger.error('Logout error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Forgot password - Request password reset - apply password reset rate limiter
router.post('/forgot-password', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email });

    // Don't reveal if email exists or not (security best practice)
    if (!user) {
      return sendSuccess(res, 'If an account with that email exists, a password reset link has been sent.');
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    user.passwordResetToken = resetToken;
    user.passwordResetExpires = resetExpires;
    await user.save({ validateBeforeSave: false });

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);
      return sendSuccess(res, 'If an account with that email exists, a password reset link has been sent.');
    } catch (error) {
      // Clear reset token if email fails
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save({ validateBeforeSave: false });

      return sendError(res, 'Failed to send reset email. Please try again later.', 500);
    }
  } catch (error) {
    logger.error('Forgot password error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Reset password - apply password reset rate limiter
router.post('/reset-password', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return sendError(res, 'Token and password are required', 400);
    }

    if (password.length < 6) {
      return sendError(res, 'Password must be at least 6 characters long', 400);
    }

    // Find user with valid reset token
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return sendError(res, 'Invalid or expired reset token', 400);
    }

    // Update password and clear reset token
    user.password = password;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    return sendSuccess(res, 'Password reset successfully. You can now login with your new password.');
  } catch (error) {
    logger.error('Reset password error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Verify email with code
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { code, email } = req.body;

    if (!code || !email) {
      return sendError(res, 'Verification code and email are required', 400);
    }

    // Find user with valid verification code
    const user = await User.findOne({
      email: email.toLowerCase(),
      emailVerificationToken: code,
      emailVerificationExpires: { $gt: new Date() }
    }).select('+emailVerificationToken +emailVerificationExpires');

    if (!user) {
      return sendError(res, 'Invalid or expired verification code', 400);
    }

    // Verify email and clear token
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    return sendSuccess(res, 'Email verified successfully');
  } catch (error) {
    logger.error('Verify email error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Resend verification code
router.post('/resend-verification', authenticate, async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'User not authenticated', 401);
    }
    const user = req.user;

    // For authenticated users, we can reveal their own verification status
    if (user.isEmailVerified) {
      return sendSuccess(res, 'Your email is already verified.', { isEmailVerified: true });
    }

    // Generate new 6-digit verification code
    const emailVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
    const emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.emailVerificationToken = emailVerificationCode;
    user.emailVerificationExpires = emailVerificationExpires;
    await user.save({ validateBeforeSave: false });

    // Send verification code email
    try {
      await emailService.sendVerificationCodeEmail(user.email, emailVerificationCode, user.firstName);
      return sendSuccess(res, 'Verification code sent successfully', { isEmailVerified: false });
    } catch (error) {
      return sendError(res, 'Failed to send verification code. Please try again later.', 500);
    }
  } catch (error) {
    logger.error('Resend verification error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

// Resend verification code by email (for unauthenticated users) - apply password reset rate limiter
router.post('/resend-verification-code', passwordResetLimiter, async (req: Request, res: Response) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email is required'
      });
    }

    const user = await User.findOne({ email: email.toLowerCase() });

    if (!user) {
      // Don't reveal if email exists
      return sendSuccess(res, 'If an account with that email exists, a verification code has been sent.');
    }

    // Don't reveal if email is already verified - return generic success message
    // Only send code if email exists and is not verified
    if (!user.isEmailVerified) {
      // Generate new 6-digit verification code
      const emailVerificationCode = Math.floor(100000 + Math.random() * 900000).toString();
      const emailVerificationExpires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      user.emailVerificationToken = emailVerificationCode;
      user.emailVerificationExpires = emailVerificationExpires;
      await user.save({ validateBeforeSave: false });

      // Send verification code email
      try {
        await emailService.sendVerificationCodeEmail(user.email, emailVerificationCode, user.firstName);
      } catch (error) {
        // Don't reveal email sending failure - return generic success
        return sendSuccess(res, 'If an account with that email exists and is not verified, a verification code has been sent.');
      }
    }

    // Return generic success message regardless of verification status
    // This prevents revealing whether email exists or is verified
    return sendSuccess(res, 'If an account with that email exists and is not verified, a verification code has been sent.');
  } catch (error) {
    logger.error('Resend verification code error:', error);
    return sendError(res, 'Internal server error', 500);
  }
});

export default router;
