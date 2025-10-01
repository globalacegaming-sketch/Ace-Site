import { Router, Request, Response } from 'express';
import axios from 'axios';

const router = Router();

// Proxy route for Fortune Panda API to handle CORS
router.all('/', async (req: Request, res: Response) => {
  try {
    const { action, ...params } = req.query;
    
    console.log('🔍 Proxy request:', { action, params });
    
    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action parameter is required'
      });
    }

    // Build the Fortune Panda API URL
    const baseUrl = process.env.FORTUNE_API_URL || 'http://demo.fortunepanda.vip:8033/ws/service.ashx';
    const url = `${baseUrl}?action=${action}&${new URLSearchParams(params as Record<string, string>).toString()}`;
    
    console.log('🔍 Proxy URL:', url);
    
    // Make the request to Fortune Panda API
    const response = await axios.post(url, null, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      timeout: 30000,
    });
    
    console.log('🔍 Proxy response:', response.data);
    
    // Return the response from Fortune Panda API
    return res.json(response.data);
  } catch (error) {
    console.error('Proxy error:', error);
    return res.status(500).json({
      success: false,
      message: 'Proxy request failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

export default router;
