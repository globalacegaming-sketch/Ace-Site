import mongoose, { Types } from 'mongoose';
import WheelCampaign from '../models/WheelCampaign';
import WheelSlice from '../models/WheelSlice';
import WheelBudget from '../models/WheelBudget';
import WheelFairnessRules from '../models/WheelFairnessRules';
import WheelSpin from '../models/WheelSpin';
import User from '../models/User';
import logger from '../utils/logger';
import { WHEEL_SEGMENTS, REWARD_COLORS } from '../config/wheelSegments';

/** Per-user lock to prevent concurrent spins (double-spin race). */
const userSpinLocks = new Map<string, Promise<void>>();

async function withUserSpinLock<T>(userId: Types.ObjectId, fn: () => Promise<T>): Promise<T> {
  const key = userId.toString();
  const prev = userSpinLocks.get(key) ?? Promise.resolve();
  let resolveLock: () => void;
  const lock = new Promise<void>((r) => { resolveLock = r; });
  const chain = prev.then(() => lock);
  userSpinLocks.set(key, chain);
  await prev;
  try {
    return await fn();
  } finally {
    resolveLock!();
    // Clean up: if our chain is still the latest for this key, remove it to prevent memory leak
    if (userSpinLocks.get(key) === chain) {
      userSpinLocks.delete(key);
    }
  }
}

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
    // Default to 1 if spinsPerDay is missing from an old DB document
    const spinsPerDay = fairnessRules.spinsPerDay ?? 1;
    logger.info('🎯 Eligibility check:', { userId: userId.toString(), spinsPerDay, rawValue: fairnessRules.spinsPerDay });
    if (spinsPerDay !== -1) {
      const now = new Date();
      const msIn12h = 12 * 60 * 60 * 1000;
      const cutoff = new Date(now.getTime() - msIn12h);
      
      // Count spins in the last 12 hours (exclude spins that used a bonus/free spin)
      const recentSpinCount = await WheelSpin.countDocuments({
        userId,
        campaignId,
        createdAt: { $gte: cutoff },
        $or: [{ usedBonusSpin: { $ne: true } }, { usedBonusSpin: { $exists: false } }]
      });
      logger.info('🎯 Spin count in last 12h:', { recentSpinCount, spinsPerDay, cutoff: cutoff.toISOString() });
      if (recentSpinCount >= spinsPerDay) {
        // Find the oldest spin that counts toward limit (same filter as count) for 12h reset
        const oldestRecentSpin = await WheelSpin.findOne({
          userId,
          campaignId,
          createdAt: { $gte: cutoff },
          $or: [{ usedBonusSpin: { $ne: true } }, { usedBonusSpin: { $exists: false } }]
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
   * Get reward color by type (uses shared config)
   */
  getRewardColor(rewardType: string): string {
    return REWARD_COLORS[rewardType] || REWARD_COLORS.bonus_2;
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
      let rewardType = 'bonus_2';
      
      if (dollarAmount === '1' || dollarAmount === '1.00') rewardType = 'bonus_1';
      else if (dollarAmount === '2' || dollarAmount === '2.00') rewardType = 'bonus_2';
      else if (dollarAmount === '5' || dollarAmount === '5.00') rewardType = 'bonus_5';
      else if (dollarAmount === '10' || dollarAmount === '10.00') rewardType = 'bonus_10';
      else {
        const amount = parseFloat(dollarAmount || '2');
        if (amount <= 1) rewardType = 'bonus_1';
        else if (amount <= 2) rewardType = 'bonus_2';
        else if (amount <= 5) rewardType = 'bonus_5';
        else rewardType = 'bonus_10';
      }

      return {
        rewardType,
        rewardLabel: slice.label,
        rewardValue: slice.prizeValue,
        rewardColor: REWARD_COLORS[rewardType] || REWARD_COLORS.bonus_2
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
      rewardType: 'bonus_2',
      rewardLabel: slice.label,
      rewardValue: slice.prizeValue,
      rewardColor: REWARD_COLORS.bonus_2
    };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // spinWheel — SERVER picks the winning segment. This is the ONLY spin
  // method the POST /wheel/spin route should call.
  // Wrapped in a per-user lock to prevent double-spin race (concurrent requests).
  // ─────────────────────────────────────────────────────────────────────────
  async spinWheel(
    userId: Types.ObjectId,
    userEmail?: string,
    userPhone?: string
  ): Promise<SpinResult> {
    return withUserSpinLock(userId, () => this.executeSpin(userId, userEmail, userPhone));
  }

  private async executeSpin(
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

    // Step 2b: Check if user has a bonus (free) spin to use — if so, this spin won't count toward limit and cannot land on Free Spin +1
    const userDoc = await User.findById(userId).select('bonusSpins').lean();
    let userBonusSpins = (userDoc as any)?.bonusSpins ?? 0;

    // Cap bonus spins at 1 — prevents unbounded accumulation from older code
    if (userBonusSpins > 1) {
      await User.findByIdAndUpdate(userId, { $set: { bonusSpins: 1 } });
      logger.warn('🛡️ Capped excess bonus spins', { userId: userId.toString(), was: userBonusSpins, now: 1 });
      userBonusSpins = 1;
    }

    const consumingBonusSpin = userBonusSpins > 0;

    // Step 3: Validate user eligibility (skip daily limit if using a bonus spin)
    if (!consumingBonusSpin) {
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
    }

    // ── Step 4: Budget-paced segment selection ──────────────────────────────
    // Computes a "paceRatio" = actual spend rate / ideal spend rate.
    //   paceRatio < 1  → under-budget   → allow more expensive wins
    //   paceRatio ~ 1  → on track       → balanced distribution
    //   paceRatio > 1  → over-budget    → suppress expensive wins
    //   paceRatio >= 2 → hard stop      → zero-cost only
    // Segments that exceed budgetRemaining are always excluded.
    // ───────────────────────────────────────────────────────────────────────

    const budgetExhausted = budget.budgetRemaining <= 0;

    // Ideal spend per spin (only meaningful in auto mode with targetSpins)
    const idealSpendPerSpin = (budget.mode === 'auto' && budget.targetSpins > 0)
      ? budget.totalBudget / budget.targetSpins
      : 0;

    // How far ahead/behind schedule are we?  0 = underspending, 1 = on pace, 2 = 2x overspend
    let paceRatio = 0;
    if (budget.mode === 'auto' && idealSpendPerSpin > 0 && budget.totalSpins > 0) {
      // Auto mode: compare actual spend vs expected spend for this many spins
      const expectedSpent = budget.totalSpins * idealSpendPerSpin;
      paceRatio = expectedSpent > 0 ? budget.budgetSpent / expectedSpent : 0;
    } else if (budget.totalBudget > 0 && budget.totalSpins > 0) {
      // Non-auto modes: use overall budget utilization as a pacing signal
      paceRatio = budget.budgetSpent / budget.totalBudget;
    }
    // Note: paceRatio = 0 on first spin (no data yet) → dampening = 0 → fair random start

    // Hard budget constraint (no money left or past target-spin count AND near total budget)
    let budgetConstraintActive = false;
    if (budget.mode === 'auto' && budget.targetSpins > 0) {
      const budgetThreshold = budget.totalBudget * 0.95;
      if (
        (budget.totalSpins >= budget.targetSpins && budget.budgetSpent >= budgetThreshold) ||
        budget.budgetSpent + idealSpendPerSpin > budget.totalBudget
      ) {
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
      paceRatio: paceRatio.toFixed(3),
      budgetExhausted,
      budgetConstraintActive,
      budgetPercentage: ((budget.budgetSpent / budget.totalBudget) * 100).toFixed(2) + '%'
    });

    // ── Step 5: Filter eligible segments ──
    let eligibleSegmentIndices: number[];

    if (budgetExhausted || budgetConstraintActive) {
      // Only zero-cost segments
      eligibleSegmentIndices = WHEEL_SEGMENTS
        .map((seg, idx) => seg.cost === 0 ? idx : -1)
        .filter(idx => idx >= 0);
      logger.warn('⚠️ Budget exhausted/constraint — only zero-cost segments:', eligibleSegmentIndices);
    } else {
      // All segments that fit remaining budget
      eligibleSegmentIndices = WHEEL_SEGMENTS
        .map((seg, idx) => seg.cost <= budget.budgetRemaining ? idx : -1)
        .filter(idx => idx >= 0);

      if (eligibleSegmentIndices.length === 0) {
        eligibleSegmentIndices = WHEEL_SEGMENTS
          .map((seg, idx) => seg.cost === 0 ? idx : -1)
          .filter(idx => idx >= 0);
        logger.warn('⚠️ No segments fit budget — falling back to zero-cost');
      }
    }

    // When using a free spin, exclude Free Spin +1 so the outcome cannot chain into another
    // (only when the fairness rule is enabled — admin can toggle this off)
    if (consumingBonusSpin && fairnessRules.freeSpinCannotTriggerFreeSpin !== false) {
      eligibleSegmentIndices = eligibleSegmentIndices.filter(
        (idx) => WHEEL_SEGMENTS[idx].type !== 'try_again'
      );
      logger.info('🎁 Free spin used — try_again excluded', { eligibleSegmentIndices });
    }

    // ── Per-user caps (24h rolling window) ──
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    // Free Spin +1 cap: max 1 free-spin WIN per user per 24h
    // Without this, users accumulate unlimited bonus spins and bypass the daily limit.
    const freeSpinWins24h = await WheelSpin.countDocuments({
      userId,
      campaignId: campaign._id,
      rewardType: 'try_again',
      createdAt: { $gte: twentyFourHoursAgo }
    });
    if (freeSpinWins24h >= 1) {
      eligibleSegmentIndices = eligibleSegmentIndices.filter(
        (idx) => WHEEL_SEGMENTS[idx].type !== 'try_again'
      );
      logger.info('🛡️ User already won Free Spin in last 24h — excluding try_again segments');
    }

    // Per-user expensive-win cap: limit $5+ wins to 2 per 24h and $10+ wins to 1 per 24h
    const recentUserWins = await WheelSpin.find({
      userId,
      campaignId: campaign._id,
      createdAt: { $gte: twentyFourHoursAgo },
      cost: { $gt: 0 }
    }).select('rewardType cost').lean();

    const user5PlusCount = recentUserWins.filter(w => (w as any).cost >= 5).length;
    const user10PlusCount = recentUserWins.filter(w => (w as any).cost >= 10).length;

    if (user10PlusCount >= 1) {
      // Already won a $10+ prize in last 24h — exclude $10+ segments
      eligibleSegmentIndices = eligibleSegmentIndices.filter(
        (idx) => WHEEL_SEGMENTS[idx].cost < 10
      );
      logger.info('🛡️ User hit $10 win cap (1/24h) — excluding $10+ segments');
    }
    if (user5PlusCount >= 2) {
      // Already won two $5+ prizes in last 24h — exclude $5+ segments
      eligibleSegmentIndices = eligibleSegmentIndices.filter(
        (idx) => WHEEL_SEGMENTS[idx].cost < 5
      );
      logger.info('🛡️ User hit $5+ win cap (2/24h) — excluding $5+ segments');
    }

    if (eligibleSegmentIndices.length === 0) {
      throw new Error('No eligible segments available');
    }

    // ── Step 6: Budget-paced weighted selection ──
    // Weight formula:  w(seg) = baseWeight * e^(-cost * dampening)
    // dampening increases with paceRatio (the more overspent, the stronger we suppress expensive prizes)
    const eligibleSegments = eligibleSegmentIndices.map(idx => ({
      index: idx,
      segment: WHEEL_SEGMENTS[idx]
    }));

    // Dampening factor: 0 when underspending, ramps up past paceRatio 1.0
    const dampening = Math.max(0, (paceRatio - 0.7) * 0.6);

    const weights = eligibleSegments.map(({ segment }) => {
      // Base weight: every segment starts equal at 1.0
      let w = 1.0;
      // Apply exponential cost dampening — expensive segments get much lower weight when overspending
      w *= Math.exp(-segment.cost * dampening);
      // Zero-cost segments get a small boost so "Better Luck" / "Free Spin" always have reasonable chance
      if (segment.cost === 0) w = Math.max(w, 0.3);
      return w;
    });

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

    logger.info('🎯 Budget-paced selection:', {
      paceRatio: paceRatio.toFixed(3),
      dampening: dampening.toFixed(3),
      segmentWeights: eligibleSegments.map((e, i) => `${e.segment.label}:${weights[i].toFixed(3)}`),
    });
    
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

    // Step 6b & 7 & 8: Atomic claim of spin slot (transaction) so double-click or multi-instance cannot grant two spins
    const countFilter = {
      userId,
      campaignId: campaign._id,
      createdAt: { $gte: new Date(Date.now() - 12 * 60 * 60 * 1000) },
      $or: [{ usedBonusSpin: { $ne: true } }, { usedBonusSpin: { $exists: false } }]
    };

    let spin: any;
    // Compute bonus spin delta: -1 if consuming, +1 if winning Free Spin +1, 0 otherwise
    // Cap at 1: if user already has 1+ bonus spins, don't grant another
    let bonusSpinDelta = 0;
    if (consumingBonusSpin) bonusSpinDelta -= 1;
    if (rewardInfo.rewardType === 'try_again') {
      // Only grant +1 if user will end up at ≤ 1 bonus spin
      const projectedBonusSpins = userBonusSpins + bonusSpinDelta + 1;
      if (projectedBonusSpins <= 1) {
        bonusSpinDelta += 1;
      } else {
        logger.info('🛡️ Bonus spin grant skipped — user would exceed cap of 1', { userId: userId.toString(), current: userBonusSpins });
      }
    }

    try {
      const session = await mongoose.startSession();
      try {
        await session.withTransaction(async () => {
          if (consumingBonusSpin) {
            const again = await User.findById(userId).select('bonusSpins').session(session).lean();
            if (((again as any)?.bonusSpins ?? 0) < 1) {
              throw new Error('No bonus spin available. Please try again later.');
            }
          } else {
            const count = await WheelSpin.countDocuments(countFilter).session(session);
            const spinsPerDay = fairnessRules.spinsPerDay ?? 1;
            if (count >= spinsPerDay) {
              throw new Error("You've used all your spins! Check back later.");
            }
          }

          const [created] = await WheelSpin.create([{
            campaignId: campaign._id,
            sliceId: selectedSlice._id,
            userId,
            rewardType: rewardInfo.rewardType,
            rewardValue: rewardInfo.rewardValue || undefined,
            cost: actualCost,
            usedBonusSpin: consumingBonusSpin,
            bonusSent: false
          }], { session });
          spin = created;

          budget.budgetRemaining -= actualCost;
          budget.budgetSpent += actualCost;
          budget.totalSpins += 1;
          budget.averagePayoutPerSpin = budget.budgetSpent / budget.totalSpins;
          await budget.save({ session });

          selectedSlice.currentWins += 1;
          await selectedSlice.save({ session });

          // Adjust bonus spins inside the transaction so it's atomic with the spin creation
          if (bonusSpinDelta !== 0) {
            await User.findByIdAndUpdate(userId, { $inc: { bonusSpins: bonusSpinDelta } }, { session });
          }
        });
      } finally {
        await session.endSession();
      }
    } catch (txErr: any) {
      // MongoDB standalone does not support transactions; fall back to non-atomic path
      if (txErr.message?.includes('replica set') || txErr.message?.includes('transaction') || txErr.code === 251) {
        logger.warn('Wheel: transactions not supported, using fallback (multi-instance double-spin possible)', txErr.message);
        if (consumingBonusSpin) {
          const again = await User.findById(userId).select('bonusSpins').lean();
          if (((again as any)?.bonusSpins ?? 0) < 1) throw new Error('No bonus spin available. Please try again later.');
        } else {
          const reEligibility = await this.validateUserEligibility(userId, campaign._id as Types.ObjectId, fairnessRules, userEmail, userPhone);
          if (!reEligibility.eligible) throw new Error(reEligibility.message || 'User not eligible to spin');
        }
        spin = await WheelSpin.create({
          campaignId: campaign._id,
          sliceId: selectedSlice._id,
          userId,
          rewardType: rewardInfo.rewardType,
          rewardValue: rewardInfo.rewardValue || undefined,
          cost: actualCost,
          usedBonusSpin: consumingBonusSpin,
          bonusSent: false
        });
        budget.budgetRemaining -= actualCost;
        budget.budgetSpent += actualCost;
        budget.totalSpins += 1;
        budget.averagePayoutPerSpin = budget.budgetSpent / budget.totalSpins;
        await budget.save();
        selectedSlice.currentWins += 1;
        await selectedSlice.save();
        // Adjust bonus spins (non-atomic fallback)
        if (bonusSpinDelta !== 0) {
          await User.findByIdAndUpdate(userId, { $inc: { bonusSpins: bonusSpinDelta } });
        }
      } else {
        throw txErr;
      }
    }

    if (bonusSpinDelta < 0) {
      logger.info('🎁 Consumed 1 bonus spin', { userId: userId.toString() });
    }
    if (rewardInfo.rewardType === 'try_again') {
      logger.info('🎁 Granted 1 bonus spin (Free Spin +1)', { userId: userId.toString() });
    }

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
