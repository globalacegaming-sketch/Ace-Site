import { Router, Request, Response } from 'express';
import fortunePandaService from '../services/fortunePandaService';

const router = Router();

router.get('/test', (req, res) => {
  res.json({ message: 'Games routes working!' });
});

// Public route to get Fortune Panda games (no authentication required)
router.get('/fortune-panda', async (req: Request, res: Response) => {
  try {
    // First ensure admin is logged in to get games
    const adminLoginResult = await fortunePandaService.adminLogin();
    
    if (!adminLoginResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to initialize Fortune Panda connection',
        error: adminLoginResult.message
      });
    }

    // Get the game list
    const gamesResult = await fortunePandaService.getGameList();
    
    if (!gamesResult.success) {
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch games',
        error: gamesResult.message
      });
    }

    return res.json({
      success: true,
      message: 'Games fetched successfully',
      data: gamesResult.data
    });
  } catch (error) {
    console.error('Error fetching Fortune Panda games:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
