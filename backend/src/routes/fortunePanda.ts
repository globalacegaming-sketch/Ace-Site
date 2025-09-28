import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';
import { authenticate, authorize } from '../middleware/auth';

const router = Router();

// Admin-only routes for Fortune Panda operations
router.use(authenticate);
router.use(authorize('admin'));

// Admin login to Fortune Panda
router.post('/admin/login', async (req: Request, res: Response) => {
  try {
    const result = await fortunePandaService.adminLogin();
    
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
    console.error('Admin login error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get game list
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
    console.error('Get game list error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Create Fortune Panda user
router.post('/users', async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required'
      });
    }

    const result = await fortunePandaService.createFortunePandaUser(username, password);
    
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
    console.error('Create Fortune Panda user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Query user info
router.get('/users/:username', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { password } = req.query;
    
    if (!password) {
      return res.status(400).json({
        success: false,
        message: 'Password is required'
      });
    }

    const result = await fortunePandaService.queryUserInfo(username, password as string);
    
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
    console.error('Query user info error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Enter game
router.post('/games/enter', async (req: Request, res: Response) => {
  try {
    const { username, password, kindId } = req.body;
    
    if (!username || !password || !kindId) {
      return res.status(400).json({
        success: false,
        message: 'Username, password, and kindId are required'
      });
    }

    const result = await fortunePandaService.enterGame(username, password, kindId);
    
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

// Recharge user account
router.post('/users/:username/recharge', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const result = await fortunePandaService.rechargeUser(username, amount);
    
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
    console.error('Recharge error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Redeem from user account
router.post('/users/:username/redeem', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { amount } = req.body;
    
    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount is required'
      });
    }

    const result = await fortunePandaService.redeemUser(username, amount);
    
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
    console.error('Redeem error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get admin session status
router.get('/admin/status', async (req: Request, res: Response) => {
  try {
    const status = fortunePandaService.getAdminSessionStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (error) {
    console.error('Get admin status error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Logout admin
router.post('/admin/logout', async (req: Request, res: Response) => {
  try {
    fortunePandaService.logoutAdmin();
    res.json({
      success: true,
      message: 'Admin logged out successfully'
    });
  } catch (error) {
    console.error('Admin logout error:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Change user password
router.post('/users/change-password', async (req: Request, res: Response) => {
  try {
    const { username, oldPassword, newPassword } = req.body;
    
    if (!username || !oldPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Username, old password, and new password are required'
      });
    }

    const result = await fortunePandaService.changeUserPassword(username, oldPassword, newPassword);
    
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
    console.error('Change password error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get trade records
router.get('/users/:username/trade-records', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { fromDate, toDate } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required'
      });
    }

    const result = await fortunePandaService.getTradeRecords(username, fromDate as string, toDate as string);
    
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
    console.error('Get trade records error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get JP records
router.get('/users/:username/jp-records', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;
    const { fromDate, toDate } = req.query;
    
    if (!fromDate || !toDate) {
      return res.status(400).json({
        success: false,
        message: 'fromDate and toDate are required'
      });
    }

    const result = await fortunePandaService.getJPRecords(username, fromDate as string, toDate as string);
    
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
    console.error('Get JP records error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get game records
router.get('/users/:username/game-records', async (req: Request, res: Response) => {
  try {
    const { username } = req.params;

    const result = await fortunePandaService.getGameRecords(username);
    
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
    console.error('Get game records error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

// Get all users with Fortune Panda information
router.get('/users', async (req: Request, res: Response) => {
  try {
    const result = await fortunePandaService.getAllUsersWithFortunePandaInfo();
    
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
    console.error('Get all users error:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export default router;
