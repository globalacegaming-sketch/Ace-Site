import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';
import { authenticate } from '../middleware/auth';
import logger from '../utils/logger';
import User from '../models/User';

const router = Router();

// Games route - visible to all users (no auth required as per demo API spec)
router.get('/games', async (req: Request, res: Response) => {
  try {
    const result = await fortunePandaService.getGameList();
    
    if (result.success) {
      res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error('❌ Get games error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// All other routes require user authentication
router.use(authenticate);

// Test endpoint to check authentication
router.get('/test-auth', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const user = req.user;
    res.json({
      success: true,
      message: 'Authentication working',
      data: {
        userId: user._id,
        username: user.username,
        email: user.email,
        hasFortunePandaPassword: !!user.fortunePandaPassword,
        fortunePandaUsername: user.fortunePandaUsername
      }
    });
  } catch (error) {
    logger.error('Test auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's Fortune Panda account info
router.get('/account', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const user = req.user;
    
    // Use stored FortunePanda username if available, otherwise construct it
    const fortunePandaUsername = user.fortunePandaUsername || `${user.firstName}_Aces9F`;
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword || '');
    
    // Query user info from Fortune Panda
    const result = await fortunePandaService.queryUserInfo(fortunePandaUsername, passwdMd5);
    
    if (result.success) {
      res.json({
        success: true,
        message: 'Account info retrieved successfully',
        data: {
          fortunePandaUsername,
          balance: result.data?.userbalance || '0.00',
          agentBalance: result.data?.agentBalance || '0.00',
          lastLogin: result.data?.lastLogin,
          ...result.data
        }
      });
    } else {
      res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error('Get account info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Enter game
router.post('/games/enter', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const user = req.user;
    const { kindId } = req.body;
    
    if (!kindId) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) is required'
      });
    }

    // Validate kindId format: must be a non-empty string, alphanumeric with hyphens/underscores
    if (typeof kindId !== 'string' || kindId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) must be a non-empty string'
      });
    }

    const trimmedKindId = kindId.trim();
    
    // Validate length (1-50 characters)
    if (trimmedKindId.length < 1 || trimmedKindId.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) must be between 1 and 50 characters'
      });
    }

    // Validate format: alphanumeric, hyphens, underscores only (prevents injection)
    const kindIdRegex = /^[a-zA-Z0-9_-]+$/;
    if (!kindIdRegex.test(trimmedKindId)) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) can only contain letters, numbers, hyphens, and underscores'
      });
    }

    // Use stored FortunePanda username if available, otherwise construct it
    const fortunePandaUsername = user.fortunePandaUsername || `${user.firstName}_Aces9F`;
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword || '');
    const result = await fortunePandaService.enterGame(fortunePandaUsername, passwdMd5, trimmedKindId);
    
    if (result.success) {
      return res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error('Enter game error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user balance
router.get('/balance', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const user = req.user;
    
    // Process balance request
    
    // Check if user has Fortune Panda credentials
    if (!user.fortunePandaPassword) {
      // User missing Fortune Panda password, creating account
      // Check if account was already created by another concurrent request (race condition prevention)
      const currentUser = await User.findById(user._id).select('fortunePandaUsername fortunePandaPassword');
      if (currentUser?.fortunePandaPassword) {
        // Password was set by another request, refresh user and continue
        user.fortunePandaPassword = currentUser.fortunePandaPassword;
        user.fortunePandaUsername = currentUser.fortunePandaUsername || `${user.firstName}_Aces9F`;
      } else {
        // Try to create Fortune Panda account for existing user
        const fortunePandaUsername = `${user.firstName}_Aces9F`;
        const fortunePandaPassword = fortunePandaService.generateFortunePandaPassword();

        try {
          const createResult = await fortunePandaService.createFortunePandaUser(user.firstName, fortunePandaPassword);
      
          if (createResult.success) {
            // Double-check before updating to prevent race condition
            const userBeforeUpdate = await User.findById(user._id).select('fortunePandaPassword');
            if (userBeforeUpdate?.fortunePandaPassword) {
              // Another request already created the account, use existing credentials
              user.fortunePandaPassword = userBeforeUpdate.fortunePandaPassword;
              user.fortunePandaUsername = userBeforeUpdate.fortunePandaUsername || fortunePandaUsername;
            } else {
              // Update user with Fortune Panda credentials
              user.fortunePandaUsername = fortunePandaUsername;
              user.fortunePandaPassword = fortunePandaPassword;
              await user.save();
            }
            
            // Fortune Panda account created successfully
          } else {
            logger.warn('❌ Failed to create Fortune Panda account:', createResult.message);
            return res.status(400).json({
              success: false,
              message: 'Failed to create Fortune Panda account. Please contact support.'
            });
          }
        } catch (error) {
          logger.error('❌ Error creating Fortune Panda account:', error);
          return res.status(400).json({
            success: false,
            message: 'Failed to create Fortune Panda account. Please contact support.'
          });
        }
      }
    }
    
    // Use stored FortunePanda username if available, otherwise construct it
    const fortunePandaUsername = user.fortunePandaUsername || `${user.firstName}_Aces9F`;
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword || '');
    
    // Query user info from Fortune Panda (service will append _GAGame automatically)
    const result = await fortunePandaService.queryUserInfo(fortunePandaUsername, passwdMd5);
    
    if (result.success) {
      return res.json({
        success: true,
        message: 'Balance retrieved successfully',
        data: {
          balance: result.data?.userbalance || '0.00',
          agentBalance: result.data?.agentBalance || '0.00',
          fortunePandaUsername
        }
      });
    } else if (result.message?.includes('account does not exist')) {
      // Account doesn't exist, try to create it
      // Check if account was already created by another concurrent request (race condition prevention)
      const currentUser = await User.findById(user._id).select('fortunePandaUsername fortunePandaPassword');
      if (currentUser?.fortunePandaUsername && currentUser.fortunePandaUsername !== fortunePandaUsername) {
        // Account was created by another request, retry query with the stored username
        const retryResult = await fortunePandaService.queryUserInfo(currentUser.fortunePandaUsername, passwdMd5);
        if (retryResult.success) {
          return res.json({
            success: true,
            message: 'Balance retrieved successfully',
            data: {
              balance: retryResult.data?.userbalance || '0.00',
              agentBalance: retryResult.data?.agentBalance || '0.00',
              fortunePandaUsername: currentUser.fortunePandaUsername
            }
          });
        }
      }
      
      logger.info('🔄 Fortune Panda account does not exist, attempting to create new account...');
      
      try {
        const createResult = await fortunePandaService.createFortunePandaUser(user.firstName, user.fortunePandaPassword || '');
        
        if (createResult.success) {
          // Double-check before updating to prevent race condition
          const userBeforeUpdate = await User.findById(user._id).select('fortunePandaUsername');
          if (userBeforeUpdate?.fortunePandaUsername) {
            // Another request already created the account, use existing username
            const existingUsername = userBeforeUpdate.fortunePandaUsername;
            const retryResult = await fortunePandaService.queryUserInfo(existingUsername, passwdMd5);
            if (retryResult.success) {
              return res.json({
                success: true,
                message: 'Balance retrieved successfully',
                data: {
                  balance: retryResult.data?.userbalance || '0.00',
                  agentBalance: retryResult.data?.agentBalance || '0.00',
                  fortunePandaUsername: existingUsername
                }
              });
            }
          }
          
          // Update user with new Fortune Panda credentials
          user.fortunePandaUsername = fortunePandaUsername;
          await user.save();
          
          logger.info('✅ Fortune Panda account created successfully, retrying balance query...');
          
          // Retry balance query (service will append _GAGame automatically)
          const retryResult = await fortunePandaService.queryUserInfo(fortunePandaUsername, passwdMd5);
          
          if (retryResult.success) {
            logger.info('✅ Balance retrieved successfully after account creation');
            return res.json({
              success: true,
              message: 'Balance retrieved successfully',
              data: {
                balance: retryResult.data?.userbalance || '0.00',
                agentBalance: retryResult.data?.agentBalance || '0.00',
                fortunePandaUsername
              }
            });
          } else {
            logger.warn('❌ Balance retrieval failed after account creation:', retryResult.message);
            return res.status(400).json({
              success: false,
              message: 'Failed to retrieve balance. Please try again or contact support.'
            });
          }
        } else if (createResult.message?.includes('already exists')) {
          // Account exists but password might be wrong, or account was created with different credentials
          logger.error('❌ Account already exists in FortunePanda but query failed. Possible password mismatch.');
          // Don't reveal password mismatch details to user - generic error message
          return res.status(400).json({
            success: false,
            message: 'Unable to access FortunePanda account. Please contact support for assistance.'
          });
        } else {
          logger.warn('❌ Failed to create Fortune Panda account:', createResult.message);
          return res.status(400).json({
            success: false,
            message: 'Failed to create Fortune Panda account. Please contact support.'
          });
        }
      } catch (error) {
        logger.error('❌ Error creating Fortune Panda account:', error);
        return res.status(400).json({
          success: false,
          message: 'Failed to create Fortune Panda account. Please contact support.'
        });
      }
    } else {
      logger.warn('❌ Balance retrieval failed:', result.message);
      return res.status(400).json({
        success: false,
        message: 'Failed to retrieve balance. Please try again or contact support.'
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Get balance error:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage || 'Internal server error. Please try again.'
    });
  }
});

// Enter game
router.post('/enter-game', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const user = req.user;
    const { kindId } = req.body;
    
    logger.debug('🎮 Game entry request:', {
      userId: user._id,
      username: user.username,
      firstName: user.firstName,
      hasFortunePandaPassword: !!user.fortunePandaPassword,
      kindId: kindId
    });
    
    // Check if user has Fortune Panda credentials
    if (!user.fortunePandaPassword) {
      logger.error('❌ Fortune Panda password not found for user:', user._id);
      return res.status(400).json({
        success: false,
        message: 'Fortune Panda account not found. Please contact support.'
      });
    }
    
    if (!kindId) {
      logger.error('❌ kindId missing in request');
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) is required'
      });
    }

    // Validate kindId format: must be a non-empty string, alphanumeric with hyphens/underscores
    if (typeof kindId !== 'string' || kindId.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) must be a non-empty string'
      });
    }

    const trimmedKindId = kindId.trim();
    
    // Validate length (1-50 characters)
    if (trimmedKindId.length < 1 || trimmedKindId.length > 50) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) must be between 1 and 50 characters'
      });
    }

    // Validate format: alphanumeric, hyphens, underscores only (prevents injection)
    const kindIdRegex = /^[a-zA-Z0-9_-]+$/;
    if (!kindIdRegex.test(trimmedKindId)) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) can only contain letters, numbers, hyphens, and underscores'
      });
    }

    // Use stored FortunePanda username if available, otherwise construct it
    const fortunePandaUsername = user.fortunePandaUsername || `${user.firstName}_Aces9F`;
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword || '');
    
    logger.debug('🎮 Calling Fortune Panda enterGame API:', {
      dbUsername: user.fortunePandaUsername,
      constructedUsername: `${user.firstName}_Aces9F`,
      usingUsername: fortunePandaUsername,
      kindId: trimmedKindId
    });
    
    // Service will append _GAGame automatically
    const result = await fortunePandaService.enterGame(fortunePandaUsername, passwdMd5, trimmedKindId);
    
    logger.debug('🎮 Fortune Panda enterGame result:', {
      success: result.success,
      message: result.message,
      hasData: !!result.data,
      hasWebLoginUrl: !!result.data?.webLoginUrl
    });
    
    if (result.success) {
      if (!result.data?.webLoginUrl) {
        logger.warn('⚠️ Game entry successful but no webLoginUrl in response');
      }
      return res.json({
        success: true,
        message: result.message,
        data: result.data
      });
    } else {
      logger.error('❌ Fortune Panda enterGame failed:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message || 'Failed to enter game. Please try again.'
      });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Internal server error';
    logger.error('❌ Enter game error:', errorMessage);
    return res.status(500).json({
      success: false,
      message: errorMessage || 'Internal server error. Please try again or contact support.'
    });
  }
});


export default router;
