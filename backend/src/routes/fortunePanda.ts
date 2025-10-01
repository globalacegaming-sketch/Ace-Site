import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Admin-only routes for Fortune Panda operations
router.use(authenticate);
router.use(authorize('admin'));

// Get game list (admin route - same as public but with admin auth)
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

// Create Fortune Panda user (admin route)
router.post('/users', async (req: Request, res: Response) => {
  try {
    const { firstName, password } = req.body;
    
    if (!firstName || !password) {
      return res.status(400).json({
        success: false,
        message: 'firstName and password are required'
      });
    }

    const result = await fortunePandaService.createFortunePandaUser(firstName, password);
    
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
    console.error('Create Fortune Panda user error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Query user info (admin route)
router.get('/users/:account/balance', async (req: Request, res: Response) => {
  try {
    const { account } = req.params;
    const { passwdMd5 } = req.query;
    
    if (!account || !passwdMd5) {
      return res.status(400).json({
        success: false,
        message: 'account and passwdMd5 are required'
      });
    }

    const result = await fortunePandaService.queryUserInfo(account as string, passwdMd5 as string);
    
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
    console.error('Query user info error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Enter game (admin route)
router.post('/games/enter', async (req: Request, res: Response) => {
  try {
    const { account, passwdMd5, kindId } = req.body;
    
    if (!account || !passwdMd5 || !kindId) {
      return res.status(400).json({
        success: false,
        message: 'account, passwdMd5, and kindId are required'
      });
    }

    const result = await fortunePandaService.enterGame(account, passwdMd5, kindId);
    
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
    console.error('Enter game error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;