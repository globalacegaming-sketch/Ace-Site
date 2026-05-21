import type { ReactNode } from 'react';

/**
 * Glassmorphism card wrapper that frames every auth form.
 *
 * Uses the casino palette tokens but keeps the rounded-2xl + backdrop-blur
 * mobile-first feel from the RSG auth shell.
 */
export function AuthFormCard({ children }: { children: ReactNode }) {
  return (
    <div
      className="rounded-2xl border border-white/15 bg-black/35 p-5 shadow-[0_20px_60px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-3xl sm:p-7"
      style={{ borderColor: 'rgba(255, 255, 255, 0.12)' }}
    >
      {children}
    </div>
  );
}
