import { Types } from 'mongoose';
import WheelCampaign from '../models/WheelCampaign';
import WheelSlice from '../models/WheelSlice';
import WheelBudget from '../models/WheelBudget';
import WheelFairnessRules from '../models/WheelFairnessRules';
import WheelSpin from '../models/WheelSpin';
import User from '../models/User';
import logger from '../utils/logger';
import { WHEEL_SEGMENTS, REWARD_COLORS } from '../config/wheelSegments';

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
    // Check spin cap (resets 12 hours after the user's first spin in the current cycle)
    // Default to 2 if spinsPerDay is missing from an old DB document
    const spinsPerDay = fairnessRules.spinsPerDay ?? 2;
    logger.info('🎯 Eligibility check:', { userId: userId.toString(), spinsPerDay, rawValue: fairnessRules.spinsPerDay });
    if (spinsPerDay !== -1) {
      const now = new Date();
      const msIn12h = 12 * 60 * 60 * 1000;
      const cutoff = new Date(now.getTime() - msIn12h);
      
      // Count spins in the last 12 hours
      const recentSpinCount = await WheelSpin.countDocuments({
        userId,
        campaignId,
        createdAt: { $gte: cutoff }
      });
      logger.info('🎯 Spin count in last 12h:', { recentSpinCount, spinsPerDay, cutoff: cutoff.toISOString() });
      if (recentSpinCount >= spinsPerDay) {
        // Find the oldest spin in the window to compute when 12h expires from it
        const oldestRecentSpin = await WheelSpin.findOne({
          userId,
          campaignId,
          createdAt: { $gte: cutoff }
        }).sort({ createdAt: 1 }).select('createdAt').lean();
        
        const resetAt = oldestRecentSpin
          ? new Date(new Date(oldestRecentSpin.createdAt).getTime() + msIn12h)
          : new Date(now.getTime() + msIn12h);
        const msLeft = Math.max(0, resetAt.getTime() - now.getTime());
        const hours = Math.floor(msLeft / 3600000);
        const minutes = Math.floor((msLeft % 3600000) / 60000);
        return { 
          eligible: false, 
          message: `You've used all your spins! Next reset in ${hours}h ${minutes}m` 
        };
      }
    }

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

    const budgetExhausted = budget.budgetRemaining <= 0;
    
    let budgetConstraintActive = false;
    if (budget.mode === 'auto' && budget.targetSpins) {
      const averageSpendPerSpin = budget.totalBudget / budget.targetSpins;
      if (budget.budgetSpent >= averageSpendPerSpin * budget.targetSpins || 
          budget.budgetSpent + averageSpendPerSpin > budget.totalBudget) {
        budgetConstraintActive = true;
      }
    }

    for (const slice of slices) {
      if (!slice.enabled) continue;

      if (budgetExhausted || budgetConstraintActive) {
        if (slice.costToBusiness > 0) continue;
      } else {
        if (slice.costToBusiness > budget.budgetRemaining) continue;
      }

      if (slice.maxWins !== undefined && slice.maxWins !== null) {
        if (slice.currentWins >= slice.maxWins) continue;
      }

      // Free spin: max 1 per user per 24h
      if (slice.type === 'free_spin') {
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        
        const freeSpinSlices = await WheelSlice.find({
          campaignId,
          type: 'free_spin',
          enabled: true
        }).select('_id').lean();
        
        const freeSpinSliceIds = freeSpinSlices.map(s => s._id);
        
        const userFreeSpinCount24h = await WheelSpin.countDocuments({
          userId,
          campaignId,
          sliceId: { $in: freeSpinSliceIds },
          createdAt: { $gte: twentyFourHoursAgo }
        });
        
        if (userFreeSpinCount24h >= 1) continue;
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

    if (eligibleSlices.length === 1) {
      return eligibleSlices[0];
    }

    // Mode A: Auto - pace prizes across target spins
    if (budget.mode === 'auto' && budget.targetSpins) {
      const averageSpendPerSpin = budget.totalBudget / budget.targetSpins;
      const expectedSpent = totalSpins * averageSpendPerSpin;
      
      if (totalSpins >= budget.targetSpins || budget.budgetSpent >= budget.totalBudget) {
        const freeSlices = eligibleSlices.filter(s => s.costToBusiness === 0);
        if (freeSlices.length > 0) {
          return freeSlices[Math.floor(Math.random() * freeSlices.length)];
        }
      }

      if (budget.budgetSpent < expectedSpent) {
        const expensiveSlices = eligibleSlices.filter(s => s.costToBusiness > averageSpendPerSpin);
        if (expensiveSlices.length > 0 && Math.random() < 0.3) {
          return expensiveSlices[Math.floor(Math.random() * expensiveSlices.length)];
        }
      }

      const cheapSlices = [...eligibleSlices]
        .sort((a, b) => a.costToBusiness - b.costToBusiness)
        .filter(s => s.costToBusiness <= averageSpendPerSpin);
      if (cheapSlices.length > 0) {
        return cheapSlices[Math.floor(Math.random() * cheapSlices.length)];
      }
    }

    // Mode B: Target Expense Rate
    if (budget.mode === 'target_expense') {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (budget.targetExpensePerDay) {
        const todaySpent = await WheelSpin.aggregate([
          { $match: { campaignId: budget.campaignId, createdAt: { $gte: today } } },
          { $group: { _id: null, total: { $sum: '$cost' } } }
        ]);

        const spentToday = todaySpent[0]?.total || 0;
        if (spentToday >= budget.targetExpensePerDay) {
          const freeSlices = eligibleSlices.filter(s => s.costToBusiness === 0);
          if (freeSlices.length > 0) {
            return freeSlices[Math.floor(Math.random() * freeSlices.length)];
          }
        }
      }

      if (budget.targetExpensePerSpins && budget.targetExpenseSpinsInterval) {
        const recentSpins = await WheelSpin.find({ campaignId: budget.campaignId })
          .sort({ createdAt: -1 })
          .limit(budget.targetExpenseSpinsInterval)
          .lean();

        if (recentSpins.length >= budget.targetExpenseSpinsInterval) {
          const recentSpent = recentSpins.reduce((sum, spin) => sum + (spin.cost || 0), 0);
          if (recentSpent >= budget.targetExpensePerSpins) {
            const freeSlices = eligibleSlices.filter(s => s.costToBusiness === 0);
            if (freeSlices.length > 0) {
              return freeSlices[Math.floor(Math.random() * freeSlices.length)];
            }
          }
        }
      }
    }

    // Default: Weighted random selection (favour cheaper prizes)
    const sortedSlices = [...eligibleSlices].sort((a, b) => a.costToBusiness - b.costToBusiness);
    const weights = sortedSlices.map((_, i) => sortedSlices.length - i);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    for (let i = 0; i < sortedSlices.length; i++) {
      random -= weights[i];
      if (random <= 0) return sortedSlices[i];
    }

    return sortedSlices[0];
  }

  /**
   * Get reward color by type (uses shared config)
   */
  getRewardColor(rewardType: string): string {
    return REWARD_COLORS[rewardType] || REWARD_COLORS.bonus_1;
  }

  /**
   * Map DB slice → frontend reward type
   */
  mapSliceToRewardType(slice: any): { rewardType: string; rewardLabel: string; rewardValue: string | null; rewardColor: string } {
    if (slice.type === 'lose') {
      return {
        rewardType: 'better_luck',
        rewardLabel: slice.label || 'Better Luck Next Time',
        rewardValue: null,
        rewardColor: REWARD_COLORS.better_luck
      };
    }

    if (slice.type === 'free_spin') {
      return {
        rewardType: 'try_again',
        rewardLabel: slice.label || 'Free Spin +1',
        rewardValue: null,
        rewardColor: REWARD_COLORS.try_again
      };
    }

    if (slice.type === 'cash') {
      const dollarAmount = slice.prizeValue?.replace('$', '').trim();
      let rewardType = 'bonus_1';
      
      if (dollarAmount === '1' || dollarAmount === '1.00') rewardType = 'bonus_1';
      else if (dollarAmount === '5' || dollarAmount === '5.00') rewardType = 'bonus_5';
      else if (dollarAmount === '10' || dollarAmount === '10.00') rewardType = 'bonus_10';
      else {
        const amount = parseFloat(dollarAmount || '1');
        if (amount <= 1) rewardType = 'bonus_1';
        else if (amount <= 5) rewardType = 'bonus_5';
        else rewardType = 'bonus_10';
      }

      return {
        rewardType,
        rewardLabel: slice.label,
        rewardValue: slice.prizeValue,
        rewardColor: REWARD_COLORS[rewardType] || REWARD_COLORS.bonus_1
      };
    }

    if (slice.type === 'discount') {
      return {
        rewardType: 'bonus_50_percent',
        rewardLabel: slice.label,
        rewardValue: slice.prizeValue,
        rewardColor: REWARD_COLORS.bonus_50_percent
      };
    }

    return {
      rewardType: 'bonus_1',
      rewardLabel: slice.label,
      rewardValue: slice.prizeValue,
      rewardColor: REWARD_COLORS.bonus_1
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // spinWheel — SERVER picks the winning segment. This is the ONLY spin
  // method the POST /wheel/spin route should call.
  // ─────────────────────────────────────────────────────────────────────────
  async spinWheel(
    userId: Types.ObjectId,
    userEmail?: string,
    userPhone?: string
  ): Promise<SpinResult> {
    // Step 1: Validate campaign is live
    const campaign = await this.getActiveCampaign();
    
    // Step 2: Load budget, slices, and fairness rules in parallel
    const [budget, slices, fairnessRules] = await Promise.all([
      WheelBudget.findOne({ campaignId: campaign._id }),
      WheelSlice.find({ campaignId: campaign._id, enabled: true }).sort({ order: 1 }),
      WheelFairnessRules.findOne({ campaignId: campaign._id })
    ]);

    if (!budget) throw new Error('Budget configuration not found');
    if (!fairnessRules) throw new Error('Fairness rules not configured');
    if (slices.length < 2) throw new Error('At least 2 enabled slices are required');

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

    // Step 4: Use shared WHEEL_SEGMENTS for selection (single source of truth)
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
    
    // Step 5: Determine eligible segment indices
    let eligibleSegmentIndices: number[];
    
    if (budgetExhausted || budgetConstraintActive) {
      eligibleSegmentIndices = WHEEL_SEGMENTS
        .map((seg, idx) => seg.cost === 0 ? idx : -1)
        .filter(idx => idx >= 0);
      logger.warn('⚠️ Budget exhausted - only allowing zero-cost segments:', eligibleSegmentIndices);
    } else {
      eligibleSegmentIndices = WHEEL_SEGMENTS
        .map((seg, idx) => seg.cost <= budget.budgetRemaining ? idx : -1)
        .filter(idx => idx >= 0);
      
      if (eligibleSegmentIndices.length === 0) {
        eligibleSegmentIndices = WHEEL_SEGMENTS
          .map((seg, idx) => seg.cost === 0 ? idx : -1)
          .filter(idx => idx >= 0);
        logger.warn('⚠️ No segments fit budget - falling back to zero-cost segments');
      }
      logger.info('✅ Budget available - eligible segment indices:', eligibleSegmentIndices);
    }
    
    if (eligibleSegmentIndices.length === 0) {
      throw new Error('No eligible segments available');
    }
    
    // Step 6: Weighted random selection (favour cheaper prizes)
    const eligibleSegments = eligibleSegmentIndices.map(idx => ({
      index: idx,
      segment: WHEEL_SEGMENTS[idx]
    }));
    eligibleSegments.sort((a, b) => a.segment.cost - b.segment.cost);
    
    const weights = eligibleSegments.map((_, i) => eligibleSegments.length - i);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0);
    let random = Math.random() * totalWeight;
    
    let selectedSegmentIndex = eligibleSegments[0].index;
    for (let i = 0; i < eligibleSegments.length; i++) {
      random -= weights[i];
      if (random <= 0) {
        selectedSegmentIndex = eligibleSegments[i].index;
        break;
      }
    }
    
    const selectedSegment = WHEEL_SEGMENTS[selectedSegmentIndex];
    const actualCost = selectedSegment.cost;
    const rewardInfo = {
      rewardType: selectedSegment.type,
      rewardLabel: selectedSegment.label,
      rewardValue: selectedSegment.type.startsWith('bonus_') ? selectedSegment.label : null,
      rewardColor: this.getRewardColor(selectedSegment.type)
    };
    
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
    
    // Find a matching DB slice for tracking (fallback to first available)
    let selectedSlice: any = slices.find(s => {
      const sRewardInfo = this.mapSliceToRewardType(s);
      return sRewardInfo.rewardType === rewardInfo.rewardType && s.costToBusiness === actualCost;
    });
    if (!selectedSlice) selectedSlice = slices[0];
    if (!selectedSlice) throw new Error('No slice available for tracking');

    // Step 7: Create spin record
    const spin = await WheelSpin.create({
      campaignId: campaign._id,
      sliceId: selectedSlice._id,
      userId,
      rewardType: rewardInfo.rewardType,
      rewardValue: rewardInfo.rewardValue || undefined,
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

    const returnValue = {
      spinId: spin._id as Types.ObjectId,
      sliceId: selectedSlice._id as Types.ObjectId,
      sliceOrder: selectedSegmentIndex,
      rewardType: rewardInfo.rewardType,
      rewardLabel: rewardInfo.rewardLabel,
      rewardValue: rewardInfo.rewardValue,
      rewardColor: rewardInfo.rewardColor,
      cost: actualCost
    };
    
    // Verify consistency
    const verifySegment = WHEEL_SEGMENTS[selectedSegmentIndex];
    if (verifySegment.type !== returnValue.rewardType || verifySegment.label !== returnValue.rewardLabel) {
      logger.error('❌ CRITICAL: Return value mismatch!', {
        selectedIndex: selectedSegmentIndex,
        expectedType: verifySegment.type,
        expectedLabel: verifySegment.label,
        returnedType: returnValue.rewardType,
        returnedLabel: returnValue.rewardLabel
      });
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
