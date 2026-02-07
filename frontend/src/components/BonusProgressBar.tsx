interface Props {
  /** Amount wagered so far */
  wagered: number;
  /** Required wager amount to unlock */
  required: number;
}

/**
 * Visual progress bar for bonus wagering requirements.
 * Shows percentage + remaining amount.
 */
export default function BonusProgressBar({ wagered, required }: Props) {
  if (required <= 0) return null;

  const pct = Math.min(Math.round((wagered / required) * 100), 100);
  const remaining = Math.max(required - wagered, 0);

  return (
    <div className="mt-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-medium text-gray-600">{pct}% complete</span>
        {remaining > 0 && (
          <span className="text-xs text-gray-500">Play ${remaining.toFixed(2)} more to unlock</span>
        )}
      </div>
      <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500 ease-out"
          style={{
            width: `${pct}%`,
            background:
              pct >= 100
                ? 'linear-gradient(90deg, #00C853, #00E676)'
                : 'linear-gradient(90deg, #FFD700, #FFA000)',
          }}
        />
      </div>
    </div>
  );
}
