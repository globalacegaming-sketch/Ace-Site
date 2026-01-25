import { Router, Request, Response, NextFunction } from 'express';
import { validateAdminSession } from '../services/adminSessionService';
import WheelCampaign from '../models/WheelCampaign';
import WheelSlice from '../models/WheelSlice';
import WheelBudget from '../models/WheelBudget';
import WheelFairnessRules from '../models/WheelFairnessRules';
import WheelSpin from '../models/WheelSpin';
import User from '../models/User';
import logger from '../utils/logger';
import jwt from 'jsonwebtoken';

const router = Router();

// Middleware to accept both admin and agent authentication
const requireAdminOrAgentAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      message: 'Access denied. No token provided.'
    });
    return;
  }

  const token = authHeader.substring(7);
  
  // Try admin auth first
  const adminSession = validateAdminSession(token);
  if (adminSession) {
    (req as any).adminSession = adminSession;
    return next();
  }
  
  // Try agent auth
  try {
    const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;
    
    if (decoded.role === 'agent' && decoded.type === 'agent') {
      (req as any).agentSession = {
        username: decoded.username,
        role: decoded.role,
        userId: decoded.userId
      };
      return next();
    }
  } catch (error: any) {
    // Agent auth failed
  }
  
  res.status(401).json({
    success: false,
    message: 'Invalid or expired session. Please login again.'
  });
};

router.use(requireAdminOrAgentAuth);

// Get campaign configuration
router.get('/campaign', async (req: Request, res: Response) => {
  try {
    let campaign = await WheelCampaign.findOne();
    if (!campaign) {
      // Create default campaign
      campaign = await WheelCampaign.create({
        campaignName: 'Default Campaign',
        status: 'draft'
      });
    }
    return res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    logger.error('Error fetching campaign:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch campaign',
      error: error.message
    });
  }
});

// Update campaign
router.put('/campaign', async (req: Request, res: Response) => {
  try {
    let campaign = await WheelCampaign.findOne();
    if (!campaign) {
      campaign = await WheelCampaign.create(req.body);
    } else {
      Object.assign(campaign, req.body);
      await campaign.save();
    }
    return res.json({
      success: true,
      data: campaign
    });
  } catch (error: any) {
    logger.error('Error updating campaign:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update campaign',
      error: error.message
    });
  }
});

// Get slices
router.get('/slices', async (req: Request, res: Response) => {
  try {
    let campaign = await WheelCampaign.findOne();
    if (!campaign) {
      // Create default campaign if none exists
      campaign = await WheelCampaign.create({
        campaignName: 'Default Campaign',
        status: 'draft'
      });
    }
    
    const slices = await WheelSlice.find({ campaignId: campaign._id })
      .sort({ order: 1 })
      .lean();
    
    // Map to frontend format
    const mappedSlices = slices.map((slice: any) => ({
      _id: slice._id.toString(),
      label: slice.label || '',
      type: slice.type || 'lose',
      prizeValue: slice.prizeValue || '',
      costToBusiness: slice.costToBusiness || 0,
      enabled: slice.enabled !== false,
      maxWins: slice.maxWins,
      order: slice.order || 0,
      color: slice.color
    }));
    
    return res.json({
      success: true,
      data: mappedSlices
    });
  } catch (error: any) {
    logger.error('Error fetching slices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch slices',
      error: error.message
    });
  }
});

// Update slices (bulk)
router.put('/slices', async (req: Request, res: Response) => {
  try {
    const { slices } = req.body;
    
    if (!Array.isArray(slices)) {
      return res.status(400).json({
        success: false,
        message: 'Slices must be an array'
      });
    }

    let campaign = await WheelCampaign.findOne();
    if (!campaign) {
      // Create default campaign if none exists
      campaign = await WheelCampaign.create({
        campaignName: 'Default Campaign',
        status: 'draft'
      });
    }

    // Delete slices not in the new list (only if there are existing slices with IDs)
    const newSliceIds = slices
      .filter((s: any) => s._id && s._id.trim() !== '')
      .map((s: any) => s._id);
    
    if (newSliceIds.length > 0) {
      await WheelSlice.deleteMany({
        campaignId: campaign._id,
        _id: { $nin: newSliceIds }
      });
    }

    // Update or create slices
    for (let i = 0; i < slices.length; i++) {
      const sliceData = slices[i];
      
      // Validate required fields
      if (!sliceData.label || !sliceData.type) {
        continue; // Skip invalid slices
      }

      // Normalize the data
      const normalizedData = {
        campaignId: campaign._id,
        label: sliceData.label.trim(),
        type: sliceData.type,
        prizeValue: sliceData.prizeValue ? sliceData.prizeValue.trim() : undefined,
        costToBusiness: typeof sliceData.costToBusiness === 'number' ? sliceData.costToBusiness : 0,
        enabled: sliceData.enabled !== false, // Default to true
        maxWins: sliceData.maxWins !== undefined && sliceData.maxWins !== null ? sliceData.maxWins : undefined,
        order: sliceData.order !== undefined ? sliceData.order : i,
        currentWins: 0, // Reset or keep existing
        color: sliceData.color || undefined // Custom color
      };

      if (sliceData._id && sliceData._id.trim() !== '') {
        // Update existing slice
        const existingSlice = await WheelSlice.findById(sliceData._id);
        if (existingSlice) {
          // Preserve currentWins if it exists
          normalizedData.currentWins = existingSlice.currentWins || 0;
          await WheelSlice.findByIdAndUpdate(sliceData._id, normalizedData, { runValidators: true });
        }
      } else {
        // Create new slice
        await WheelSlice.create(normalizedData);
      }
    }

    const updatedSlices = await WheelSlice.find({ campaignId: campaign._id }).sort({ order: 1 });
    return res.json({
      success: true,
      data: updatedSlices
    });
  } catch (error: any) {
    logger.error('Error updating slices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update slices',
      error: error.message
    });
  }
});

// Get budget
router.get('/budget', async (req: Request, res: Response) => {
  try {
    const campaign = await WheelCampaign.findOne();
    if (!campaign) {
      return res.status(400).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    let budget = await WheelBudget.findOne({ campaignId: campaign._id });
    if (!budget) {
      budget = await WheelBudget.create({
        campaignId: campaign._id,
        mode: 'auto',
        totalBudget: 100,
        budgetRemaining: 100,
        budgetSpent: 0,
        targetSpins: 100
      });
    }
    return res.json({
      success: true,
      data: budget
    });
  } catch (error: any) {
    logger.error('Error fetching budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch budget',
      error: error.message
    });
  }
});

// Update budget
router.put('/budget', async (req: Request, res: Response) => {
  try {
    const campaign = await WheelCampaign.findOne();
    if (!campaign) {
      return res.status(400).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    let budget = await WheelBudget.findOne({ campaignId: campaign._id });
    const budgetData = req.body;
    
    // Calculate budget remaining if total budget changed
    if (budgetData.totalBudget && budget) {
      budgetData.budgetRemaining = budgetData.totalBudget - budget.budgetSpent;
    } else if (budgetData.totalBudget && !budget) {
      budgetData.budgetRemaining = budgetData.totalBudget;
      budgetData.budgetSpent = 0;
    }

    if (!budget) {
      budget = await WheelBudget.create({
        campaignId: campaign._id,
        ...budgetData
      });
    } else {
      Object.assign(budget, budgetData);
      await budget.save();
    }
    return res.json({
      success: true,
      data: budget
    });
  } catch (error: any) {
    logger.error('Error updating budget:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update budget',
      error: error.message
    });
  }
});

// Get fairness rules
router.get('/fairness-rules', async (req: Request, res: Response) => {
  try {
    const campaign = await WheelCampaign.findOne();
    if (!campaign) {
      return res.status(400).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    let rules = await WheelFairnessRules.findOne({ campaignId: campaign._id });
    if (!rules) {
      rules = await WheelFairnessRules.create({
        campaignId: campaign._id
      });
    }
    return res.json({
      success: true,
      data: rules
    });
  } catch (error: any) {
    logger.error('Error fetching fairness rules:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch fairness rules',
      error: error.message
    });
  }
});

// Update fairness rules
router.put('/fairness-rules', async (req: Request, res: Response) => {
  try {
    const campaign = await WheelCampaign.findOne();
    if (!campaign) {
      return res.status(400).json({
        success: false,
        message: 'Campaign not found'
      });
    }
    let rules = await WheelFairnessRules.findOne({ campaignId: campaign._id });
    if (!rules) {
      rules = await WheelFairnessRules.create({
        campaignId: campaign._id,
        ...req.body
      });
    } else {
      Object.assign(rules, req.body);
      await rules.save();
    }
    return res.json({
      success: true,
      data: rules
    });
  } catch (error: any) {
    logger.error('Error updating fairness rules:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update fairness rules',
      error: error.message
    });
  }
});

// Get results/spins
router.get('/results', async (req: Request, res: Response) => {
  try {
    const campaign = await WheelCampaign.findOne();
    if (!campaign) {
      return res.json({
        success: true,
        data: []
      });
    }
    const spins = await WheelSpin.find({ campaignId: campaign._id })
      .populate('userId', 'username email firstName lastName')
      .populate('sliceId', 'label type prizeValue')
      .sort({ createdAt: -1 })
      .limit(1000);

    const results = spins.map((spin: any) => ({
      id: spin._id.toString(),
      userId: spin.userId._id.toString(),
      username: spin.userId.username,
      email: spin.userId.email,
      prize: spin.sliceId?.label || spin.rewardValue || 'Unknown',
      cost: spin.cost,
      timestamp: spin.createdAt,
      redeemed: spin.redeemed,
      redeemedAt: spin.redeemedAt
    }));

    return res.json({
      success: true,
      data: results
    });
  } catch (error: any) {
    logger.error('Error fetching results:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch results',
      error: error.message
    });
  }
});

// Mark prize as redeemed
router.put('/results/:spinId/redeem', async (req: Request, res: Response) => {
  try {
    const spin = await WheelSpin.findById(req.params.spinId);
    if (!spin) {
      return res.status(404).json({
        success: false,
        message: 'Spin not found'
      });
    }
    spin.redeemed = true;
    spin.redeemedAt = new Date();
    if ((req as any).agentSession?.userId) {
      spin.redeemedBy = (req as any).agentSession.userId;
    }
    await spin.save();
    return res.json({
      success: true,
      data: spin
    });
  } catch (error: any) {
    logger.error('Error marking prize as redeemed:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark prize as redeemed',
      error: error.message
    });
  }
});

// Get statistics
router.get('/stats', async (req: Request, res: Response) => {
  try {
    const campaign = await WheelCampaign.findOne();
    if (!campaign) {
      return res.json({
        success: true,
        data: {
          totalSpins: 0,
          uniqueUsers: 0,
          budgetSpent: 0,
          budgetRemaining: 0,
          averagePayout: 0
        }
      });
    }

    const [budget, totalSpins, uniqueUsers] = await Promise.all([
      WheelBudget.findOne({ campaignId: campaign._id }),
      WheelSpin.countDocuments({ campaignId: campaign._id }),
      WheelSpin.distinct('userId', { campaignId: campaign._id })
    ]);

    return res.json({
      success: true,
      data: {
        totalSpins,
        uniqueUsers: uniqueUsers.length,
        budgetSpent: budget?.budgetSpent || 0,
        budgetRemaining: budget?.budgetRemaining || 0,
        totalBudget: budget?.totalBudget || 0,
        averagePayout: budget?.averagePayoutPerSpin || 0
      }
    });
  } catch (error: any) {
    logger.error('Error fetching stats:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch stats',
      error: error.message
    });
  }
});

export default router;

