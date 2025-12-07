import { Router, Request, Response } from 'express';
import User from '../models/User';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import { sendSuccess, sendError } from '../utils/response';

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
        lastLogin: user.lastLogin,
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

export default router;
