import { Link } from 'react-router-dom';
import { LogIn, MessageCircle } from 'lucide-react';

type Props = {
  /** Compact layout for the floating desktop widget */
  compact?: boolean;
  /** Light panel (desktop widget); default is dark cosmic page */
  variant?: 'dark' | 'light';
};

/**
 * Shown when guests open chat — directs to sign-in, not sign-up.
 */
export function ChatSignInPrompt({
  compact = false,
  variant = 'dark',
}: Props) {
  const light = variant === 'light';

  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${
        compact ? 'px-5 py-8' : 'px-4 py-10'
      }`}
    >
      <MessageCircle
        className={`mx-auto mb-4 opacity-80 ${
          compact ? 'h-12 w-12' : 'h-16 w-16'
        } ${light ? 'text-indigo-500' : 'casino-text-secondary'}`}
        aria-hidden
      />
      <h2
        className={`font-bold mb-2 ${
          compact ? 'text-lg' : 'text-2xl'
        } ${light ? 'text-gray-900' : 'casino-text-primary'}`}
      >
        Sign in to use chat
      </h2>
      <p
        className={`leading-relaxed max-w-sm ${
          compact ? 'text-sm mb-5' : 'text-base mb-6'
        } ${light ? 'text-gray-600' : 'casino-text-secondary'}`}
      >
        Log in to message our support team, send attachments, and get help with
        your account.
      </p>
      <Link
        to="/login"
        state={{ from: '/chat' }}
        className={
          light
            ? `inline-flex touch-manipulation items-center justify-center gap-2 rounded-xl bg-indigo-600 font-semibold text-white transition hover:bg-indigo-700 active:scale-[0.98] ${
                compact ? 'min-h-11 px-6 py-2.5 text-sm' : 'min-h-12 px-8 py-3.5 text-base'
              }`
            : `btn-casino-primary inline-flex touch-manipulation items-center justify-center gap-2 rounded-2xl font-bold transition active:scale-[0.98] ${
                compact ? 'min-h-11 px-6 py-2.5 text-sm' : 'min-h-12 px-8 py-3.5 text-base'
              }`
        }
      >
        <LogIn className="h-5 w-5" aria-hidden />
        Sign in
      </Link>
    </div>
  );
}
