import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';
import { authenticate } from '../middleware/auth';

const router = Router();

// All routes require user authentication
router.use(authenticate);

// Get user's Fortune Panda account info
router.get('/account', async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    
    // Get Fortune Panda username format
    const fortunePandaUsername = fortunePandaService.generateFortunePandaUsername(user.username);
    
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

    const fortunePandaUsername = fortunePandaService.generateFortunePandaUsername(user.username);
    const result = await fortunePandaService.enterGame(fortunePandaUsername, user.fortunePandaPassword || '', kindId);
    
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
    
    // Check if user has Fortune Panda credentials
    if (!user.fortunePandaPassword) {
      return res.status(400).json({
        success: false,
        message: 'Fortune Panda account not found. Please contact support.'
      });
    }
    
    // Get Fortune Panda username format
    const fortunePandaUsername = fortunePandaService.generateFortunePandaUsername(user.username);
    
    // Query user info from Fortune Panda
    const result = await fortunePandaService.queryUserInfo(fortunePandaUsername, user.fortunePandaPassword || '');
    
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
    } else {
      return res.status(400).json({
        success: false,
        message: result.message
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

    const fortunePandaUsername = fortunePandaService.generateFortunePandaUsername(user.username);
    const result = await fortunePandaService.enterGame(fortunePandaUsername, user.fortunePandaPassword || '', kindId);
    
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

// Get available games (public endpoint, no auth required)
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
    console.error('Get games error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
