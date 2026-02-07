import { useMemo } from 'react';

interface Props {
  password: string;
}

/** Lightweight password-strength scoring (no external lib). */
function scorePassword(pw: string): number {
  if (!pw) return 0;
  let score = 0;
  if (pw.length >= 6) score++;
  if (pw.length >= 10) score++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^a-zA-Z0-9]/.test(pw)) score++;
  return Math.min(score, 4); // 0-4
}

const LEVELS = [
  { label: 'Too short', color: '#E53935', width: '0%' },
  { label: 'Weak',      color: '#E53935', width: '25%' },
  { label: 'Fair',      color: '#F59E0B', width: '50%' },
  { label: 'Good',      color: '#22c55e', width: '75%' },
  { label: 'Strong',    color: '#16a34a', width: '100%' },
] as const;

/**
 * Live password strength indicator rendered below a password field.
 * Uses pure heuristics — no heavy zxcvbn dependency.
 */
export function PasswordStrengthMeter({ password }: Props) {
  const score = useMemo(() => scorePassword(password), [password]);
  const level = LEVELS[score];

  if (!password) return null;

  return (
    <div className="mt-1.5 space-y-1" role="status" aria-live="polite">
      {/* Bar */}
      <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: '#2C2C3A' }}>
        <div
          className="h-full rounded-full transition-all duration-300 ease-out"
          style={{ width: level.width, backgroundColor: level.color }}
        />
      </div>
      {/* Label */}
      <p className="text-[11px] font-medium" style={{ color: level.color }}>
        {level.label}
      </p>
    </div>
  );
}
