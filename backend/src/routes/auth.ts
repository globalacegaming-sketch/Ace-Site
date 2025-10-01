import { Router, Request, Response } from 'express';
import User, { IUser } from '../models/User';
import { generateTokens, verifyRefreshToken } from '../utils/jwt';
import { authenticate } from '../middleware/auth';
import fortunePandaService from '../services/fortunePandaService';

const router = Router();

// Test endpoint
router.get('/test', (req, res) => {
  res.json({ message: 'Auth routes working!' });
});

// Register new user
router.post('/register', async (req: Request, res: Response) => {
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

    // Validate required fields
    if (!firstName || !lastName || !username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, username, email, and password are required'
      });
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: 'Please enter a valid email address'
      });
    }

    // Validate password strength
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({
      $or: [{ email }, { username }]
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: existingUser.email === email ? 'Email already registered' : 'Username already taken'
      });
    }

    // Handle referral code if provided
    let referredBy = null;
    if (referralCode) {
      const referrer = await User.findOne({ referralCode: referralCode.toUpperCase() });
      if (referrer) {
        referredBy = (referrer._id as any).toString();
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid referral code'
        });
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

    let userReferralCode = generateReferralCode();
    // Ensure referral code is unique
    while (await User.findOne({ referralCode: userReferralCode })) {
      userReferralCode = generateReferralCode();
    }

    // Generate Fortune Panda credentials using {firstName}_Aces9F format
    const fortunePandaUsername = `${firstName}_Aces9F`;
    const fortunePandaPassword = fortunePandaService.generateFortunePandaPassword();

    // Create new user
    const user = new User({
      firstName,
      lastName,
      username,
      email,
      phone: phoneNumber,
      password,
      referralCode: userReferralCode,
      referredBy,
      fortunePandaUsername,
      fortunePandaPassword
    });

    await user.save();

    // Create Fortune Panda account
    try {
      const fortunePandaResult = await fortunePandaService.createFortunePandaUser(fortunePandaUsername, fortunePandaPassword);
      
      if (!fortunePandaResult.success) {
        console.warn('Failed to create Fortune Panda account:', fortunePandaResult.message);
        // Continue with registration even if Fortune Panda account creation fails
      }
    } catch (error) {
      console.warn('Error creating Fortune Panda account:', error);
      // Continue with registration even if Fortune Panda account creation fails
    }

    // Generate tokens
    const tokens = generateTokens(user);

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
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
      }
    });
  } catch (error) {
    console.error('Registration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during registration'
    });
  }
});

// Login user
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Validate required fields
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email and password are required'
      });
    }

    // Find user by email and include password for comparison
    const user = await User.findOne({ email }).select('+password');

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Compare password
    const isPasswordValid = await user.comparePassword(password);

    if (!isPasswordValid) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    await (user as any).updateLastLogin();

    // Generate tokens
    const tokens = generateTokens(user);

    return res.json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          username: user.username,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin
        },
        ...tokens
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
});

// Refresh token
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Verify refresh token
    const decoded = verifyRefreshToken(refreshToken);

    // Get user
    const user = await User.findById(decoded.userId);

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Invalid refresh token'
      });
    }

    // Generate new tokens
    const tokens = generateTokens(user);

    return res.json({
      success: true,
      message: 'Tokens refreshed successfully',
      data: tokens
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired refresh token'
    });
  }
});

// Get current user profile
router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const user = req.user!;

    res.json({
      success: true,
      data: {
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
      }
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout (client-side token removal, but we can add token blacklisting here if needed)
router.post('/logout', authenticate, async (req: Request, res: Response) => {
  try {
    // In a more sophisticated setup, you might want to blacklist the token
    // For now, we'll just return success and let the client handle token removal
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
