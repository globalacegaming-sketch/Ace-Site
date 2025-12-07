import { Router, Request, Response } from 'express';
import agentLoginService from '../services/agentLoginService';
import logger from '../utils/logger';

const router = Router();

// Get Fortune Panda games using agent login service
router.get('/fortune-panda', async (req: Request, res: Response) => {
  try {
    logger.debug('🎮 Fetching Fortune Panda games...');
    
    const gamesResult = await agentLoginService.getGameList();
    
    if (!gamesResult.success) {
      logger.error('❌ Failed to fetch games:', gamesResult.message);
      return res.status(500).json({
        success: false,
        message: 'Failed to fetch games',
        error: gamesResult.message
      });
    }

    logger.info('✅ Games fetched successfully');
    return res.json({
      success: true,
      message: 'Games fetched successfully',
      data: gamesResult.data
    });
  } catch (error) {
    console.error('❌ Error fetching Fortune Panda games:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Get agent session status (for monitoring)
router.get('/agent-status', async (req: Request, res: Response) => {
  try {
    const status = agentLoginService.getSessionStatus();
    const config = agentLoginService.getConfig();
    
    return res.json({
      success: true,
      message: 'Agent status retrieved',
      data: {
        session: status,
        config: {
          agentName: config.agentName,
          apiUrl: config.apiUrl
        }
      }
    });
  } catch (error) {
    console.error('Error getting agent status:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Force agent re-login (for maintenance)
router.post('/agent-relogin', async (req: Request, res: Response) => {
  try {
    const result = await agentLoginService.forceReLogin();
    
    return res.json({
      success: result.success,
      message: result.message,
      data: result.data
    });
  } catch (error) {
    console.error('Error forcing agent re-login:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
