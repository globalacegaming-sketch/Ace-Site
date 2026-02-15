// ──────────────────────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH for wheel segment definitions.
// ──────────────────────────────────────────────────────────────────────────────
// Import this everywhere on the backend instead of copy-pasting the array.
// The frontend receives the same data via GET /wheel/config (segments field).
// ──────────────────────────────────────────────────────────────────────────────

export interface WheelSegment {
  type: string;
  label: string;
  wheelLabel?: string; // Optional longer label displayed on the canvas slice
  color: string;
  cost: number;        // Dollar cost to the business when this segment wins
}

/**
 * Fixed segment order rendered on the wheel (18 slices).
 * Layout: $2×3, $5×3, $10×1, Better Luck×6, Free Spin×3, 50% Bonus×2
 *   Better Luck = 33%  → keeps budget safe
 *   50% Bonus costs $5 → treat same as monetary win for budget
 * Segments are arranged so no two adjacent slices share the same colour.
 * Changing this array changes the wheel for everyone — update with care.
 */
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { type: 'bonus_2',          label: '$2',           color: '#10B981', cost: 2  },  //  1
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },  //  2
  { type: 'try_again',        label: 'Free Spin +1', wheelLabel: 'Free Spin +1', color: '#F59E0B', cost: 0 },  //  3
  { type: 'bonus_5',          label: '$5',           color: '#3B82F6', cost: 5  },  //  4
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },  //  5
  { type: 'bonus_50_percent', label: '50%',          color: '#EC4899', cost: 5  },  //  6  ← costs $5
  { type: 'bonus_2',          label: '$2',           color: '#10B981', cost: 2  },  //  7
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },  //  8
  { type: 'try_again',        label: 'Free Spin +1', wheelLabel: 'Free Spin +1', color: '#F59E0B', cost: 0 },  //  9
  { type: 'bonus_10',         label: '$10',          color: '#8B5CF6', cost: 10 },  // 10
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },  // 11
  { type: 'bonus_5',          label: '$5',           color: '#3B82F6', cost: 5  },  // 12
  { type: 'bonus_2',          label: '$2',           color: '#10B981', cost: 2  },  // 13
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },  // 14
  { type: 'try_again',        label: 'Free Spin +1', wheelLabel: 'Free Spin +1', color: '#F59E0B', cost: 0 },  // 15
  { type: 'bonus_5',          label: '$5',           color: '#3B82F6', cost: 5  },  // 16
  { type: 'bonus_50_percent', label: '50%',          color: '#EC4899', cost: 5  },  // 17  ← costs $5
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },  // 18
];

/** Reward-type → display color mapping (used when only the type string is available). */
export const REWARD_COLORS: Record<string, string> = {
  bonus_1: '#10B981',  // kept for legacy spin records that used the old $1 segment
  bonus_2: '#10B981',
  bonus_5: '#3B82F6',
  bonus_10: '#8B5CF6',
  bonus_50_percent: '#EC4899',
  try_again: '#F59E0B',
  better_luck: '#6B7280',
};
