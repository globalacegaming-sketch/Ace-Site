import { Types } from 'mongoose';
import WheelCampaign from '../models/WheelCampaign';
import WheelSlice from '../models/WheelSlice';
import WheelBudget from '../models/WheelBudget';
import WheelFairnessRules from '../models/WheelFairnessRules';
import WheelSpin from '../models/WheelSpin';
import User from '../models/User';
import logger from '../utils/logger';

interface SpinResult {
  spinId: Types.ObjectId;
  sliceId: Types.ObjectId;
  sliceOrder: number; // Order/index of the winning slice for frontend alignment
  rewardType: string;
  rewardLabel: string;
  rewardValue: string | null;
  rewardColor: string;
  cost: number;
}

class WheelSpinService {
  /**
   * Get active campaign
   */
  async getActiveCampaign() {
    const campaign = await WheelCampaign.findOne({ status: 'live' });
    if (!campaign) {
      throw new Error('No active campaign found');
    }
    return campaign;
  }

  /**
   * Validate user eligibility based on fairness rules
   */
  async validateUserEligibility(
    userId: Types.ObjectId,
    campaignId: Types.ObjectId,
    fairnessRules: any,
    userEmail?: string,
    userPhone?: string
  ): Promise<{ eligible: boolean; message?: string }> {
    // Check spins per user
    if (fairnessRules.spinsPerUser !== -1) {
      const userSpinCount = await WheelSpin.countDocuments({ 
        userId, 
        campaignId 
      });
      if (userSpinCount >= fairnessRules.spinsPerUser) {
        return { eligible: false, message: 'You have already used all your spins' };
      }
    }

    // Spins per day and per week removed - no longer checking

    return { eligible: true };
  }

  /**
   * Filter eligible slices based on budget, max wins, and fairness rules
   */
  async filterEligibleSlices(
    slices: any[],
    budget: any,
    userId: Types.ObjectId,
    campaignId: Types.ObjectId,
    fairnessRules: any
  ): Promise<any[]> {
    const eligibleSlices = [];

    // Check if budget is exhausted - if so, only allow $0 cost slices (try again / better luck)
    const budgetExhausted = budget.budgetRemaining <= 0;
    
    // Check budget mode constraints
    let budgetConstraintActive = false;
    if (budget.mode === 'auto' && budget.targetSpins) {
      // Calculate if we've reached target spins or would exceed average spend
      const averageSpendPerSpin = budget.totalBudget / budget.targetSpins;
      const expectedSpent = budget.totalSpins * averageSpendPerSpin;
      if (budget.budgetSpent >= averageSpendPerSpin * budget.targetSpins || 
          budget.budgetSpent + averageSpendPerSpin > budget.totalBudget) {
        budgetConstraintActive = true;
      }
    } else if (budget.mode === 'target_expense') {
      // Check daily/spin limits
      if (budget.targetExpensePerDay) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        // This will be checked in selectSliceWithBudgetEngine
      }
    }

    for (const slice of slices) {
      // Must be enabled
      if (!slice.enabled) continue;

      // If budget is exhausted or constraint is active, only allow $0 cost slices
      if (budgetExhausted || budgetConstraintActive) {
        if (slice.costToBusiness > 0) {
          continue; // Skip any slice that costs money
        }
      } else {
        // Normal budget check - must be within budget
        if (slice.costToBusiness > budget.budgetRemaining) {
          continue;
        }
      }

      // Check max wins
      if (slice.maxWins !== undefined && slice.maxWins !== null) {
        if (slice.currentWins >= slice.maxWins) continue;
      }

      // Big prize protection removed - no longer checking

      // Check free spin rules - hardcoded: max 1 free spin per user per 24 hours
      if (slice.type === 'free_spin') {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        
        // Find all free_spin slices for this campaign
        const freeSpinSlices = await WheelSlice.find({
          campaignId,
          type: 'free_spin',
          enabled: true
        }).select('_id').lean();
        
        const freeSpinSliceIds = freeSpinSlices.map(s => s._id);
        
        // Check if user has won any free spin in the last 24 hours
        const userFreeSpinCount24h = await WheelSpin.countDocuments({
          userId,
          campaignId,
          sliceId: { $in: freeSpinSliceIds },
          createdAt: { $gte: twentyFourHoursAgo }
        });
        
        if (userFreeSpinCount24h >= 1) {
          continue; // Skip - user has already used their free spin in the last 24 hours
        }
      }

      eligibleSlices.push(slice);
    }

    return eligibleSlices;
  }

  /**
   * Apply budget engine logic to select slice
   */
  async selectSliceWithBudgetEngine(
    eligibleSlices: any[],
    budget: any,
    totalSpins: number
  ): Promise<any> {
    if (eligibleSlices.length === 0) {
      throw new Error('No eligible slices available');
    }

    // If only one eligible slice, return it
    if (eligibleSlices.length === 1) {
      return eligibleSlices[0];
    }

    // Mode A: Auto - pace prizes across target spins
    if (budget.mode === 'auto' && budget.targetSpins) {
      const averageSpendPerSpin = budget.totalBudget / budget.targetSpins;
      const expectedSpent = totalSpins * averageSpendPerSpin;
      const remainingBudget = budget.totalBudget - expectedSpent;
      
      // If we've reached target spins or would exceed budget, only allow $0 cost slices
      if (totalSpins >= budget.targetSpins || budget.budgetSpent >= budget.totalBudget) {
        const freeSlices = eligibleSlices.filter(s => s.costToBusiness === 0);
        if (freeSlices.length > 0) {
          return freeSlices[Math.floor(Math.random() * freeSlices.length)];
        }
      }

      // Favor cheaper prizes early, expensive prizes later
      const sortedSlices = [...eligibleSlices].sort((a, b) => a.costToBusiness - b.costToBusiness);
      
      // If we're ahead of pace, allow more expensive prizes
      if (budget.budgetSpent < expectedSpent) {
        // Ahead of pace - can afford more expensive prizes
        const expensiveSlices = sortedSlices.filter(s => s.costToBusiness > averageSpendPerSpin);
        if (expensiveSlices.length > 0 && Math.random() < 0.3) {
          return expensiveSlices[Math.floor(Math.random() * expensiveSlices.length)];
        }
      }

      // Otherwise favor cheaper prizes
      const cheapSlices = sortedSlices.filter(s => s.costToBusiness <= averageSpendPerSpin);
      if (cheapSlices.length > 0) {
        return cheapSlices[Math.floor(Math.random() * cheapSlices.length)];
      }
    }

    // Mode B: Target Expense Rate
    if (budget.mode === 'target_expense') {
      // Check if we're exceeding target expense rate
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (budget.targetExpensePerDay) {
        const todaySpent = await WheelSpin.aggregate([
          {
            $match: {
              campaignId: budget.campaignId,
              createdAt: { $gte: today }
            }
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$cost' }
            }
          }
        ]);

        const spentToday = todaySpent[0]?.total || 0;
        if (spentToday >= budget.targetExpensePerDay) {
          // Over daily limit - only allow $0 cost slices
          const freeSlices = eligibleSlices.filter(s => s.costToBusiness === 0);
          if (freeSlices.length > 0) {
            return freeSlices[Math.floor(Math.random() * freeSlices.length)];
          }
        }
      }

      if (budget.targetExpensePerSpins && budget.targetExpenseSpinsInterval) {
        // Check expense per N spins
        const recentSpins = await WheelSpin.find({
          campaignId: budget.campaignId
        })
        .sort({ createdAt: -1 })
        .limit(budget.targetExpenseSpinsInterval)
        .lean();

        if (recentSpins.length >= budget.targetExpenseSpinsInterval) {
          const recentSpent = recentSpins.reduce((sum, spin) => sum + (spin.cost || 0), 0);
          if (recentSpent >= budget.targetExpensePerSpins) {
            // Over rate limit - only allow $0 cost slices
            const freeSlices = eligibleSlices.filter(s => s.costToBusiness === 0);
            if (freeSlices.length > 0) {
              return freeSlices[Math.floor(Math.random() * freeSlices.length)];
            }
          }
        }
      }
    }

    // Default: Weighted random selection (favor cheaper prizes)
    const sortedSlices = [...eligibleSlices].sort((a, b) => a.costToBusiness - b.costToBusiness);
    const weights = sortedSlices.map((slice, index) => {
      // Cheaper slices get higher weight
      return sortedSlices.length - index;
    });
    
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < sortedSlices.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        return sortedSlices[i];
      }
    }

    // Fallback to first slice
    return sortedSlices[0];
  }

  /**
   * Get reward color by type
   */
  getRewardColor(rewardType: string): string {
    const colors: { [key: string]: string } = {
      'bonus_1': '#10B981',
      'bonus_5': '#3B82F6',
      'bonus_10': '#8B5CF6',
      'bonus_50_percent': '#EC4899',
      'try_again': '#F59E0B',
      'better_luck': '#6B7280'
    };
    return colors[rewardType] || colors.bonus_1;
  }

  /**
   * Map slice to reward type for frontend compatibility
   * Frontend expects: bonus_1, bonus_5, bonus_10, bonus_50_percent, try_again, better_luck
   */
  mapSliceToRewardType(slice: any): { rewardType: string; rewardLabel: string; rewardValue: string | null; rewardColor: string } {
    // Default colors matching frontend
    const colors = {
      'bonus_1': '#10B981',
      'bonus_5': '#3B82F6',
      'bonus_10': '#8B5CF6',
      'bonus_50_percent': '#EC4899',
      'try_again': '#F59E0B',
      'better_luck': '#6B7280'
    };

    // Handle different slice types
    if (slice.type === 'lose') {
      return {
        rewardType: 'better_luck',
        rewardLabel: slice.label || 'Better Luck Next Time',
        rewardValue: null,
        rewardColor: colors.better_luck
      };
    }

    if (slice.type === 'free_spin') {
      return {
        rewardType: 'try_again',
        rewardLabel: slice.label || 'Free Spin +1',
        rewardValue: null,
        rewardColor: colors.try_again
      };
    }

    if (slice.type === 'cash') {
      // Extract dollar amount from prizeValue
      const dollarAmount = slice.prizeValue?.replace('$', '').trim();
      let rewardType = 'bonus_1'; // Default
      
      if (dollarAmount === '1' || dollarAmount === '1.00') {
        rewardType = 'bonus_1';
      } else if (dollarAmount === '5' || dollarAmount === '5.00') {
        rewardType = 'bonus_5';
      } else if (dollarAmount === '10' || dollarAmount === '10.00') {
        rewardType = 'bonus_10';
      } else {
        // For other cash amounts, map to closest standard type
        const amount = parseFloat(dollarAmount || '1');
        if (amount <= 1) rewardType = 'bonus_1';
        else if (amount <= 5) rewardType = 'bonus_5';
        else rewardType = 'bonus_10';
      }

      return {
        rewardType,
        rewardLabel: slice.label,
        rewardValue: slice.prizeValue,
        rewardColor: colors[rewardType as keyof typeof colors] || colors.bonus_1
      };
    }

    if (slice.type === 'discount') {
      return {
        rewardType: 'bonus_50_percent',
        rewardLabel: slice.label,
        rewardValue: slice.prizeValue,
        rewardColor: colors.bonus_50_percent
      };
    }

    // Custom type - default to bonus_1
    return {
      rewardType: 'bonus_1',
      rewardLabel: slice.label,
      rewardValue: slice.prizeValue,
      rewardColor: colors.bonus_1
    };
  }

  /**
   * Get spin constraints - returns which segment indices are allowed based on budget
   */
  async getSpinConstraints(
    userId: Types.ObjectId,
    userEmail?: string,
    userPhone?: string
  ): Promise<{ allowedSegmentIndices: number[]; budgetRemaining: number; budgetSpent: number; totalBudget: number }> {
    // Step 1: Validate campaign is live
    const campaign = await this.getActiveCampaign();
    
    // Step 2: Load budget, slices, and fairness rules
    const [budget, slices, fairnessRules] = await Promise.all([
      WheelBudget.findOne({ campaignId: campaign._id }),
      WheelSlice.find({ campaignId: campaign._id, enabled: true }).sort({ order: 1 }),
      WheelFairnessRules.findOne({ campaignId: campaign._id })
    ]);

    if (!budget) {
      throw new Error('Budget configuration not found');
    }
    if (!fairnessRules) {
      throw new Error('Fairness rules not configured');
    }

    // Step 3: Validate user eligibility
    const eligibility = await this.validateUserEligibility(
      userId,
      campaign._id as Types.ObjectId,
      fairnessRules,
      userEmail,
      userPhone
    );
    if (!eligibility.eligible) {
      throw new Error(eligibility.message || 'User not eligible to spin');
    }

    // Step 4: Use frontend hardcoded segments to determine allowed indices
    const hardcodedSegments = [
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'try_again', label: 'Free Spin +1', cost: 0 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_10', label: '$10', cost: 10 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'try_again', label: 'Free Spin +1', cost: 0 },
      { type: 'bonus_50_percent', label: '50%', cost: 0 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 }
    ];
    
    // Check if budget is exhausted or constraint is active
    const budgetExhausted = budget.budgetRemaining <= 0;
    let budgetConstraintActive = false;
    if (budget.mode === 'auto' && budget.targetSpins) {
      const averageSpendPerSpin = budget.totalBudget / budget.targetSpins;
      const budgetThreshold = budget.totalBudget * 0.95; // 95% of budget
      if ((budget.totalSpins >= budget.targetSpins && budget.budgetSpent >= budgetThreshold) || 
          (budget.budgetSpent + averageSpendPerSpin) > budget.totalBudget) {
        budgetConstraintActive = true;
      }
    }
    
    // Determine allowed segment indices
    let allowedSegmentIndices: number[] = [];
    
    if (budgetExhausted || budgetConstraintActive) {
      // Budget exhausted - only allow $0 cost segments
      allowedSegmentIndices = hardcodedSegments
        .map((seg, idx) => seg.cost === 0 ? idx : -1)
        .filter(idx => idx >= 0);
    } else {
      // Budget available - allow all segments that fit within budget
      allowedSegmentIndices = hardcodedSegments
        .map((seg, idx) => seg.cost <= budget.budgetRemaining ? idx : -1)
        .filter(idx => idx >= 0);
      
      // If no segments fit budget, fall back to $0 cost segments
      if (allowedSegmentIndices.length === 0) {
        allowedSegmentIndices = hardcodedSegments
          .map((seg, idx) => seg.cost === 0 ? idx : -1)
          .filter(idx => idx >= 0);
      }
    }

    return {
      allowedSegmentIndices,
      budgetRemaining: budget.budgetRemaining,
      budgetSpent: budget.budgetSpent,
      totalBudget: budget.totalBudget
    };
  }

  /**
   * Record spin result from frontend - validates and records the result
   */
  async recordSpinResult(
    userId: Types.ObjectId,
    sliceOrder: number,
    rewardType: string,
    rewardLabel: string,
    userEmail?: string,
    userPhone?: string
  ): Promise<SpinResult> {
    // Step 1: Validate campaign is live
    const campaign = await this.getActiveCampaign();
    
    // Step 2: Load budget, slices, and fairness rules
    const [budget, slices, fairnessRules] = await Promise.all([
      WheelBudget.findOne({ campaignId: campaign._id }),
      WheelSlice.find({ campaignId: campaign._id, enabled: true }).sort({ order: 1 }),
      WheelFairnessRules.findOne({ campaignId: campaign._id })
    ]);

    if (!budget) {
      throw new Error('Budget configuration not found');
    }
    if (!fairnessRules) {
      throw new Error('Fairness rules not configured');
    }

    // Step 3: Validate user eligibility
    const eligibility = await this.validateUserEligibility(
      userId,
      campaign._id as Types.ObjectId,
      fairnessRules,
      userEmail,
      userPhone
    );
    if (!eligibility.eligible) {
      throw new Error(eligibility.message || 'User not eligible to spin');
    }

    // Step 4: Validate the frontend result against hardcoded segments
    const hardcodedSegments = [
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'try_again', label: 'Free Spin +1', cost: 0 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_10', label: '$10', cost: 10 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'try_again', label: 'Free Spin +1', cost: 0 },
      { type: 'bonus_50_percent', label: '50%', cost: 0 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 }
    ];

    // Validate sliceOrder is within bounds
    if (sliceOrder < 0 || sliceOrder >= hardcodedSegments.length) {
      throw new Error('Invalid slice order');
    }

    const selectedSegment = hardcodedSegments[sliceOrder];
    
    // Validate that frontend result matches the segment at sliceOrder
    if (selectedSegment.type !== rewardType || selectedSegment.label !== rewardLabel) {
      logger.warn('Frontend result mismatch:', {
        sliceOrder,
        frontendType: rewardType,
        frontendLabel: rewardLabel,
        expectedType: selectedSegment.type,
        expectedLabel: selectedSegment.label
      });
      // Override with correct values from segment
      rewardType = selectedSegment.type;
      rewardLabel = selectedSegment.label;
    }

    const actualCost = selectedSegment.cost;

    // Step 5: Check if this result is allowed based on budget
    const budgetExhausted = budget.budgetRemaining <= 0;
    let budgetConstraintActive = false;
    if (budget.mode === 'auto' && budget.targetSpins) {
      const averageSpendPerSpin = budget.totalBudget / budget.targetSpins;
      const budgetThreshold = budget.totalBudget * 0.95;
      if ((budget.totalSpins >= budget.targetSpins && budget.budgetSpent >= budgetThreshold) || 
          (budget.budgetSpent + averageSpendPerSpin) > budget.totalBudget) {
        budgetConstraintActive = true;
      }
    }

    // If budget is exhausted/constrained, only allow $0 cost segments
    if ((budgetExhausted || budgetConstraintActive) && actualCost > 0) {
      throw new Error('Budget exhausted - only zero-cost segments allowed');
    }

    // If segment cost exceeds remaining budget, reject
    if (actualCost > budget.budgetRemaining) {
      throw new Error('Insufficient budget for this segment');
    }

    // Step 6: Find matching database slice for tracking
    let selectedSlice: any = slices.find(s => {
      const sRewardInfo = this.mapSliceToRewardType(s);
      return sRewardInfo.rewardType === rewardType && s.costToBusiness === actualCost;
    });
    
    if (!selectedSlice) {
      selectedSlice = slices[0];
    }
    
    if (!selectedSlice) {
      throw new Error('No slice available for tracking');
    }

    // Step 7: Create spin record
    const spin = await WheelSpin.create({
      campaignId: campaign._id,
      sliceId: selectedSlice._id,
      userId,
      rewardType: rewardType,
      rewardValue: rewardType.startsWith('bonus_') ? rewardLabel : undefined,
      cost: actualCost,
      bonusSent: false
    });

    // Step 8: Update budget
    budget.budgetRemaining -= actualCost;
    budget.budgetSpent += actualCost;
    budget.totalSpins += 1;
    budget.averagePayoutPerSpin = budget.budgetSpent / budget.totalSpins;
    await budget.save();

    // Update slice wins for tracking
    selectedSlice.currentWins += 1;
    await selectedSlice.save();

    return {
      spinId: spin._id as Types.ObjectId,
      sliceId: selectedSlice._id as Types.ObjectId,
      sliceOrder: sliceOrder,
      rewardType: rewardType,
      rewardLabel: rewardLabel,
      rewardValue: rewardType.startsWith('bonus_') ? rewardLabel : null,
      rewardColor: this.getRewardColor(rewardType),
      cost: actualCost
    };
  }

  /**
   * Main spin function - implements PRD logic (DEPRECATED - use recordSpinResult instead)
   */
  async spinWheel(
    userId: Types.ObjectId,
    userEmail?: string,
    userPhone?: string
  ): Promise<SpinResult> {
    // Step 1: Validate campaign is live
    const campaign = await this.getActiveCampaign();
    
    // Step 2: Load budget, slices, and fairness rules
    const [budget, slices, fairnessRules] = await Promise.all([
      WheelBudget.findOne({ campaignId: campaign._id }),
      WheelSlice.find({ campaignId: campaign._id, enabled: true }).sort({ order: 1 }),
      WheelFairnessRules.findOne({ campaignId: campaign._id })
    ]);

    if (!budget) {
      throw new Error('Budget configuration not found');
    }
    if (!fairnessRules) {
      throw new Error('Fairness rules not configured');
    }
    if (slices.length < 2) {
      throw new Error('At least 2 enabled slices are required');
    }

    // Step 3: Validate user eligibility
    const eligibility = await this.validateUserEligibility(
      userId,
      campaign._id as Types.ObjectId,
      fairnessRules,
      userEmail,
      userPhone
    );
    if (!eligibility.eligible) {
      throw new Error(eligibility.message || 'User not eligible to spin');
    }

    // Step 4: Use frontend hardcoded segments directly for selection
    // Hardcoded segments order: 1, 5, try again, 1, better luck, 10, better luck, 5, 1, try again, 50%, better luck, 1, 5, better luck
    const hardcodedSegments = [
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'try_again', label: 'Free Spin +1', cost: 0 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_10', label: '$10', cost: 10 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'try_again', label: 'Free Spin +1', cost: 0 },
      { type: 'bonus_50_percent', label: '50%', cost: 0 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 },
      { type: 'bonus_1', label: '$1', cost: 1 },
      { type: 'bonus_5', label: '$5', cost: 5 },
      { type: 'better_luck', label: 'Better Luck', cost: 0 }
    ];
    
    // Check if budget is exhausted or constraint is active
    const budgetExhausted = budget.budgetRemaining <= 0;
    let budgetConstraintActive = false;
    if (budget.mode === 'auto' && budget.targetSpins) {
      const averageSpendPerSpin = budget.totalBudget / budget.targetSpins;
      // Only activate constraint if:
      // 1. We've reached or exceeded target spins AND budget is nearly exhausted
      // 2. OR if adding average spend would exceed total budget
      // But allow some flexibility - don't activate too early
      const budgetThreshold = budget.totalBudget * 0.95; // 95% of budget
      if ((budget.totalSpins >= budget.targetSpins && budget.budgetSpent >= budgetThreshold) || 
          (budget.budgetSpent + averageSpendPerSpin) > budget.totalBudget) {
        budgetConstraintActive = true;
      }
    }
    
    // Debug logging
    logger.info('🎰 Wheel spin budget check:', {
      budgetRemaining: budget.budgetRemaining,
      budgetSpent: budget.budgetSpent,
      totalBudget: budget.totalBudget,
      totalSpins: budget.totalSpins,
      targetSpins: budget.targetSpins,
      mode: budget.mode,
      budgetExhausted,
      budgetConstraintActive,
      budgetPercentage: ((budget.budgetSpent / budget.totalBudget) * 100).toFixed(2) + '%'
    });
    
    // Step 5: Select directly from hardcoded segments based on budget
    let eligibleSegmentIndices: number[] = [];
    
    if (budgetExhausted || budgetConstraintActive) {
      // Budget exhausted - only allow $0 cost segments (try_again or better_luck)
      eligibleSegmentIndices = hardcodedSegments
        .map((seg, idx) => seg.cost === 0 ? idx : -1)
        .filter(idx => idx >= 0);
      logger.warn('⚠️ Budget exhausted - only allowing zero-cost segments:', eligibleSegmentIndices);
    } else {
      // Budget available - allow all segments that fit within budget
      eligibleSegmentIndices = hardcodedSegments
        .map((seg, idx) => seg.cost <= budget.budgetRemaining ? idx : -1)
        .filter(idx => idx >= 0);
      
      // If no segments fit budget, fall back to $0 cost segments
      if (eligibleSegmentIndices.length === 0) {
        eligibleSegmentIndices = hardcodedSegments
          .map((seg, idx) => seg.cost === 0 ? idx : -1)
          .filter(idx => idx >= 0);
        logger.warn('⚠️ No segments fit budget - falling back to zero-cost segments');
      }
      logger.info('✅ Budget available - eligible segment indices:', eligibleSegmentIndices);
    }
    
    if (eligibleSegmentIndices.length === 0) {
      throw new Error('No eligible segments available');
    }
    
    // Weighted random selection - favor cheaper prizes when budget is tight
    const eligibleSegments = eligibleSegmentIndices.map(idx => ({
      index: idx,
      segment: hardcodedSegments[idx]
    }));
    
    // Sort by cost (cheaper first)
    eligibleSegments.sort((a, b) => a.segment.cost - b.segment.cost);
    
    // Create weights (cheaper segments get higher weight)
    const weights = eligibleSegments.map((_, index) => eligibleSegments.length - index);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    let selectedSegmentIndex = eligibleSegments[0].index; // Default to first
    for (let i = 0; i < eligibleSegments.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedSegmentIndex = eligibleSegments[i].index;
        break;
      }
    }
    
    // Get the selected hardcoded segment
    const selectedSegment = hardcodedSegments[selectedSegmentIndex];
    const actualCost = selectedSegment.cost;
    const rewardInfo = {
      rewardType: selectedSegment.type,
      rewardLabel: selectedSegment.label,
      rewardValue: selectedSegment.type.startsWith('bonus_') ? selectedSegment.label : null,
      rewardColor: this.getRewardColor(selectedSegment.type)
    };
    
    // Debug logging
    logger.info('🎯 Selected segment:', {
      index: selectedSegmentIndex,
      type: selectedSegment.type,
      label: selectedSegment.label,
      cost: actualCost,
      budgetRemaining: budget.budgetRemaining,
      budgetSpent: budget.budgetSpent,
      eligibleIndicesCount: eligibleSegmentIndices.length,
      eligibleIndices: eligibleSegmentIndices
    });
    
    // Find a matching database slice for tracking (or use first available as fallback)
    let selectedSlice: any = slices.find(s => {
      const sRewardInfo = this.mapSliceToRewardType(s);
      return sRewardInfo.rewardType === rewardInfo.rewardType && s.costToBusiness === actualCost;
    });
    
    // If no matching slice found, use first available slice as fallback (we know slices.length >= 2 from earlier check)
    if (!selectedSlice) {
      selectedSlice = slices[0];
    }
    
    // Ensure selectedSlice is defined (TypeScript guard)
    if (!selectedSlice) {
      throw new Error('No slice available for tracking');
    }

    // Step 6: Create spin record (atomic transaction)
    const spin = await WheelSpin.create({
      campaignId: campaign._id,
      sliceId: selectedSlice._id,
      userId,
      rewardType: rewardInfo.rewardType,
      rewardValue: rewardInfo.rewardValue || undefined,
      cost: actualCost, // Use actual cost from hardcoded segment
      bonusSent: false
    });

    // Step 7: Update budget
    budget.budgetRemaining -= actualCost;
    budget.budgetSpent += actualCost;
    budget.totalSpins += 1;
    budget.averagePayoutPerSpin = budget.budgetSpent / budget.totalSpins;
    await budget.save();

    // Update slice wins for tracking
    selectedSlice.currentWins += 1;
    await selectedSlice.save();

    // Final validation - ensure return values match selected segment
    const returnValue = {
      spinId: spin._id as Types.ObjectId,
      sliceId: selectedSlice._id as Types.ObjectId,
      sliceOrder: selectedSegmentIndex, // Return the hardcoded segment index for frontend alignment
      rewardType: rewardInfo.rewardType,
      rewardLabel: rewardInfo.rewardLabel,
      rewardValue: rewardInfo.rewardValue,
      rewardColor: rewardInfo.rewardColor,
      cost: actualCost
    };
    
    // Verify consistency
    const verifySegment = hardcodedSegments[selectedSegmentIndex];
    if (verifySegment.type !== returnValue.rewardType || verifySegment.label !== returnValue.rewardLabel) {
      logger.error('❌ CRITICAL: Return value mismatch!', {
        selectedIndex: selectedSegmentIndex,
        expectedType: verifySegment.type,
        expectedLabel: verifySegment.label,
        returnedType: returnValue.rewardType,
        returnedLabel: returnValue.rewardLabel
      });
      // Override with correct values
      returnValue.rewardType = verifySegment.type;
      returnValue.rewardLabel = verifySegment.label;
      returnValue.rewardValue = verifySegment.type.startsWith('bonus_') ? verifySegment.label : null;
      returnValue.rewardColor = this.getRewardColor(verifySegment.type);
    }
    
    logger.info('🎉 Returning spin result:', {
      sliceOrder: returnValue.sliceOrder,
      rewardType: returnValue.rewardType,
      rewardLabel: returnValue.rewardLabel,
      cost: returnValue.cost
    });
    
    return returnValue;
  }
}

export default new WheelSpinService();

