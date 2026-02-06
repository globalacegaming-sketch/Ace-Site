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
 * Fixed segment order rendered on the wheel (15 slices).
 * Changing this array changes the wheel for everyone — update with care.
 */
export const WHEEL_SEGMENTS: WheelSegment[] = [
  { type: 'bonus_1',          label: '$1',           color: '#10B981', cost: 1  },
  { type: 'bonus_5',          label: '$5',           color: '#3B82F6', cost: 5  },
  { type: 'try_again',        label: 'Free Spin +1', wheelLabel: 'Free Spin +1', color: '#F59E0B', cost: 0 },
  { type: 'bonus_1',          label: '$1',           color: '#10B981', cost: 1  },
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },
  { type: 'bonus_10',         label: '$10',          color: '#8B5CF6', cost: 10 },
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },
  { type: 'bonus_5',          label: '$5',           color: '#3B82F6', cost: 5  },
  { type: 'bonus_1',          label: '$1',           color: '#10B981', cost: 1  },
  { type: 'try_again',        label: 'Free Spin +1', wheelLabel: 'Free Spin +1', color: '#F59E0B', cost: 0 },
  { type: 'bonus_50_percent', label: '50%',          color: '#EC4899', cost: 0  },
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },
  { type: 'bonus_1',          label: '$1',           color: '#10B981', cost: 1  },
  { type: 'bonus_5',          label: '$5',           color: '#3B82F6', cost: 5  },
  { type: 'better_luck',      label: 'Better Luck',  color: '#6B7280', cost: 0  },
];

/** Reward-type → display color mapping (used when only the type string is available). */
export const REWARD_COLORS: Record<string, string> = {
  bonus_1: '#10B981',
  bonus_5: '#3B82F6',
  bonus_10: '#8B5CF6',
  bonus_50_percent: '#EC4899',
  try_again: '#F59E0B',
  better_luck: '#6B7280',
};
