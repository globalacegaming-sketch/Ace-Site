import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';
import { authenticate } from '../middleware/auth';

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
    console.error('❌ Get games error:', error);
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
    const user = req.user!;
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
    console.error('Test auth error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user's Fortune Panda account info
router.get('/account', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    // Get Fortune Panda username format
        const fortunePandaUsername = `${user.firstName}_Aces9F`;
    
    // Query user info from Fortune Panda
    const result = await fortunePandaService.queryUserInfo(fortunePandaUsername, user.fortunePandaPassword || '');
    
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
    console.error('Get account info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Enter game
router.post('/games/enter', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { kindId } = req.body;
    
    if (!kindId) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) is required'
      });
    }

        const fortunePandaUsername = `${user.firstName}_Aces9F`;
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword || '');
    const result = await fortunePandaService.enterGame(fortunePandaUsername, passwdMd5, kindId);
    
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
    console.error('Enter game error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get user balance
router.get('/balance', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    // Process balance request
    
    // Check if user has Fortune Panda credentials
    if (!user.fortunePandaPassword) {
      // User missing Fortune Panda password, creating account
      
      // Try to create Fortune Panda account for existing user
          const fortunePandaUsername = `${user.firstName}_Aces9F`;
          const fortunePandaPassword = fortunePandaService.generateFortunePandaPassword();

          try {
            const createResult = await fortunePandaService.createFortunePandaUser(user.firstName, fortunePandaPassword);
        
        if (createResult.success) {
          // Update user with Fortune Panda credentials
          user.fortunePandaUsername = fortunePandaUsername;
          user.fortunePandaPassword = fortunePandaPassword;
          await user.save();
          
          // Fortune Panda account created successfully
        } else {
          console.log('❌ Failed to create Fortune Panda account:', createResult.message);
          return res.status(400).json({
            success: false,
            message: 'Failed to create Fortune Panda account. Please contact support.'
          });
        }
      } catch (error) {
        console.error('❌ Error creating Fortune Panda account:', error);
        return res.status(400).json({
          success: false,
          message: 'Failed to create Fortune Panda account. Please contact support.'
        });
      }
    }
    
    // Get Fortune Panda username format: {firstname}_Aces9F
    const fortunePandaUsername = `${user.firstName}_Aces9F`;
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword || '');
    
    // Query user info from Fortune Panda
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
      // Account doesn't exist, create it
      console.log('🔄 Fortune Panda account does not exist, creating new account...');
      
      try {
        const createResult = await fortunePandaService.createFortunePandaUser(user.firstName, user.fortunePandaPassword || '');
        
        if (createResult.success) {
          // Update user with new Fortune Panda credentials
          user.fortunePandaUsername = fortunePandaUsername;
          await user.save();
          
          console.log('✅ Fortune Panda account created successfully, retrying balance query...');
          
          // Retry balance query
          const retryResult = await fortunePandaService.queryUserInfo(fortunePandaUsername, passwdMd5);
          
          if (retryResult.success) {
            console.log('✅ Balance retrieved successfully after account creation:', retryResult.data);
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
            console.log('❌ Balance retrieval failed after account creation:', retryResult.message);
            return res.status(400).json({
              success: false,
              message: retryResult.message,
              debug: {
                fortunePandaUsername,
                accountCreated: true
              }
            });
          }
        } else {
          console.log('❌ Failed to create Fortune Panda account:', createResult.message);
          return res.status(400).json({
            success: false,
            message: 'Failed to create Fortune Panda account: ' + createResult.message,
            debug: {
              fortunePandaUsername,
              createError: createResult.message
            }
          });
        }
      } catch (error) {
        console.error('❌ Error creating Fortune Panda account:', error);
        return res.status(400).json({
          success: false,
          message: 'Failed to create Fortune Panda account',
          debug: {
            fortunePandaUsername,
            error: error instanceof Error ? error.message : 'Unknown error'
          }
        });
      }
    } else {
      console.log('❌ Balance retrieval failed:', result.message);
      return res.status(400).json({
        success: false,
        message: result.message,
        debug: {
          fortunePandaUsername,
          hasPassword: !!user.fortunePandaPassword
        }
      });
    }
  } catch (error) {
    console.error('Get balance error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Enter game
router.post('/enter-game', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    const { kindId } = req.body;
    
    console.log('🎮 Game entry request:', {
      userId: user._id,
      username: user.username,
      firstName: user.firstName,
      hasFortunePandaPassword: !!user.fortunePandaPassword,
      kindId: kindId
    });
    
    // Check if user has Fortune Panda credentials
    if (!user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'Fortune Panda account not found. Please contact support.'
      });
    }
    
    if (!kindId) {
      return res.status(400).json({
        success: false,
        message: 'Game ID (kindId) is required'
      });
    }

        const fortunePandaUsername = `${user.firstName}_Aces9F`;
    const passwdMd5 = fortunePandaService.generateMD5(user.fortunePandaPassword || '');
    const result = await fortunePandaService.enterGame(fortunePandaUsername, passwdMd5, kindId);
    
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
    console.error('Enter game error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});


export default router;
