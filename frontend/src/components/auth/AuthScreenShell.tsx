import type { ReactNode } from 'react';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Gift, Headphones } from 'lucide-react';
import { AuthHeroBg } from './AuthHeroBg';
import { IconArrowLeft } from './AuthIcons';

type Props = {
  title: ReactNode;
  subtitle: ReactNode;
  /** Tunes desktop aside footer links for login vs register. */
  variant?: 'login' | 'register';
  /** Show the top-left back control (recovery / verify flows). Off for login & register. */
  showBack?: boolean;
  /** Fallback destination when there is no history to go back to. Defaults to `/`. */
  backTo?: string;
  children: ReactNode;
};

const DESKTOP_PERKS = [
  { icon: Gamepad2, text: 'Slots, fish games, and table games in one lobby' },
  { icon: Gift, text: 'Welcome bonuses, referrals, and daily rewards' },
  { icon: Headphones, text: 'Live support chat when you need help' },
] as const;

/**
 * Auth layout: mobile-first single column; desktop adds a branding panel beside the form.
 */
export function AuthScreenShell({
  title,
  subtitle,
  variant,
  showBack = false,
  backTo = '/',
  children,
}: Props) {
  const navigate = useNavigate();
  const [keyboardPadding, setKeyboardPadding] = useState(0);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;

    const onResize = () => {
      const gap = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      setKeyboardPadding(gap > 80 ? gap : 0);
    };

    vv.addEventListener('resize', onResize);
    vv.addEventListener('scroll', onResize);
    onResize();
    return () => {
      vv.removeEventListener('resize', onResize);
      vv.removeEventListener('scroll', onResize);
    };
  }, []);

  const goBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate(backTo);
    }
  };

  return (
    <section className="relative isolate flex min-h-[calc(100dvh-env(safe-area-inset-top,0px))] w-full flex-col overflow-x-clip lg:justify-center">
      <AuthHeroBg />

      <div
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-col px-4 pb-8 pt-6 sm:px-6 sm:pb-10 sm:pt-8 lg:flex-row lg:items-center lg:gap-14 lg:px-10 lg:py-12"
        style={{ paddingBottom: keyboardPadding > 0 ? keyboardPadding + 32 : undefined }}
      >
        {/* Desktop branding — hidden on mobile where the compact layout already works well */}
        <aside className="mb-2 hidden flex-1 flex-col lg:flex lg:max-w-md">
          <Link to="/" className="mb-8 inline-flex items-center gap-3" aria-label="Global Ace Gaming home">
            <img src="/logo.png" alt="" className="h-14 w-14 object-contain" width={56} height={56} />
            <div>
              <p
                className="text-xl font-extrabold tracking-tight"
                style={{ color: 'var(--casino-highlight-gold)' }}
              >
                Global Ace Gaming
              </p>
              <p className="text-sm" style={{ color: 'var(--casino-text-secondary)' }}>
                America&apos;s Ace Gaming
              </p>
            </div>
          </Link>

          <p
            className="mb-6 text-2xl font-bold leading-snug xl:text-3xl"
            style={{ color: 'var(--casino-text-primary)' }}
          >
            Play smarter.{' '}
            <span style={{ color: 'var(--casino-highlight-gold)' }}>Win bigger.</span>
          </p>

          <ul className="space-y-4">
            {DESKTOP_PERKS.map(({ icon: Icon, text }) => (
              <li key={text} className="flex items-start gap-3">
                <span
                  className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border"
                  style={{
                    borderColor: 'rgba(255, 215, 0, 0.25)',
                    backgroundColor: 'rgba(255, 215, 0, 0.08)',
                    color: 'var(--casino-highlight-gold)',
                  }}
                >
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
                <span className="text-sm leading-relaxed" style={{ color: 'var(--casino-text-secondary)' }}>
                  {text}
                </span>
              </li>
            ))}
          </ul>

          <p className="mt-8 text-xs" style={{ color: 'var(--casino-text-secondary)' }}>
            {variant === 'register' ? (
              <>
                Already have an account?{' '}
                <Link
                  to="/login"
                  className="font-semibold underline-offset-2 hover:underline"
                  style={{ color: 'var(--casino-highlight-gold)' }}
                >
                  Sign in
                </Link>
              </>
            ) : variant === 'login' ? (
              <>
                New here?{' '}
                <Link
                  to="/register"
                  className="font-semibold underline-offset-2 hover:underline"
                  style={{ color: 'var(--casino-highlight-gold)' }}
                >
                  Create a free account
                </Link>
              </>
            ) : null}
            {variant ? (
              <>
                {' · '}
                <Link
                  to="/games"
                  className="font-semibold underline-offset-2 hover:underline"
                  style={{ color: 'var(--casino-highlight-gold)' }}
                >
                  Browse games
                </Link>
              </>
            ) : null}
          </p>
        </aside>

        {/* Form column */}
        <div className="flex w-full flex-1 flex-col lg:max-w-md">
          {showBack ? (
            <div className="mb-3 flex shrink-0 items-center lg:mb-4">
              <button
                type="button"
                onClick={goBack}
                aria-label="Go back"
                className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border bg-black/30 shadow-lg shadow-black/20 backdrop-blur-md transition active:scale-95"
                style={{
                  borderColor: 'rgba(255, 255, 255, 0.18)',
                  color: 'var(--casino-text-primary)',
                }}
              >
                <IconArrowLeft className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <div className="mb-4 flex justify-center lg:hidden">
              <Link to="/" aria-label="Global Ace Gaming home">
                <img src="/logo.png" alt="" className="h-12 w-12 object-contain opacity-90" width={48} height={48} />
              </Link>
            </div>
          )}

          <h1
            className="text-center text-3xl font-bold leading-tight tracking-tight sm:text-4xl lg:text-left"
            style={{ color: 'var(--casino-text-primary)' }}
          >
            {title}
          </h1>
          <p
            className="mt-2 text-center text-sm leading-relaxed sm:text-[0.95rem] lg:text-left"
            style={{ color: 'rgba(245, 245, 245, 0.75)' }}
          >
            {subtitle}
          </p>

          <div className="mt-6 min-h-0 w-full sm:mt-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
