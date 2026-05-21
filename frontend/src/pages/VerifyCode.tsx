import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { trackOnboarding } from '../services/analyticsTracker';
import { PageMeta } from '../components/PageMeta';
import {
  scrollAuthFieldIntoView,
  shouldAuthAutoFocus,
} from '../utils/authMobile';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthFormCard } from '../components/auth/AuthFormCard';
import {
  LoginError,
  fetchMe,
  resendVerificationCode,
  verifyEmailWithCode,
} from '../services/authApi';

const RESEND_COOLDOWN = 60; // seconds

const btnPrimary =
  'btn-casino-primary flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50';

const VerifyCode = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, token } = useAuthStore();

  // Resolve the email we're verifying, with fallback chain:
  // navigation state -> currently signed-in user.
  const email =
    (location.state as { email?: string } | null)?.email ?? user?.email ?? '';

  const [codes, setCodes] = useState(['', '', '', '', '', '']);
  const [formError, setFormError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // First-input autofocus + analytics on mount.
  useEffect(() => {
    if (shouldAuthAutoFocus()) {
      inputRefs.current[0]?.focus();
    }
    trackOnboarding('onboarding_step_viewed', { step: 'email_verification' });
    return () => {
      if (!window.location.pathname.includes('dashboard')) {
        trackOnboarding('onboarding_abandoned', {
          step: 'email_verification',
        });
      }
    };
  }, []);

  // No email -> nothing to verify; bounce back to register.
  useEffect(() => {
    if (!email) {
      toast.error('Email not found. Please register again.');
      navigate('/register');
    }
  }, [email, navigate]);

  // Resend cooldown countdown.
  useEffect(() => {
    if (cooldown <= 0) return;
    const id = window.setInterval(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearInterval(id);
  }, [cooldown]);

  const handleCodeChange = (index: number, value: string) => {
    if (value && !/^\d+$/.test(value)) return;

    const next = [...codes];
    next[index] = value.slice(-1);
    setCodes(next);

    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
    if (next.every((c) => c !== '') && value) {
      void handleVerify(next.join(''));
    }
  };

  const handleKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').slice(0, 6);
    if (!/^\d+$/.test(pasted)) return;

    const next = [...codes];
    const digits = pasted.split('').slice(0, 6);
    for (let i = 0; i < 6; i++) next[i] = digits[i] ?? '';
    setCodes(next);

    const firstEmpty = next.findIndex((c) => !c);
    if (firstEmpty === -1) {
      void handleVerify(next.join(''));
    } else {
      inputRefs.current[firstEmpty]?.focus();
    }
  };

  const handleVerify = async (codeOverride?: string) => {
    const code = codeOverride ?? codes.join('');
    if (code.length !== 6) {
      const msg = 'Please enter the complete 6-digit code';
      setFormError(msg);
      toast.error(msg);
      return;
    }
    setFormError(null);
    setIsLoading(true);
    try {
      await verifyEmailWithCode({ email, code });
      trackOnboarding('onboarding_completed', { step: 'email_verification' });
      toast.success('Email verified successfully!');

      if (token) {
        try {
          const fresh = await fetchMe(token);
          setUser(fresh);
        } catch {
          /* token might have expired — that's okay */
        }
      }
      setTimeout(() => navigate('/dashboard'), 800);
    } catch (e) {
      const msg =
        e instanceof LoginError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Invalid verification code';
      setFormError(msg);
      toast.error(msg);
      setCodes(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setIsResending(true);
    try {
      await resendVerificationCode(
        token ? { token } : { email },
      );
      toast.success('Verification code sent! Check your inbox.');
      setCodes(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
      setCooldown(RESEND_COOLDOWN);
    } catch (e) {
      const msg =
        e instanceof LoginError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to resend code';
      toast.error(msg);
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <>
      <PageMeta
        title="Verify Code | Global Ace Gaming"
        description="Enter the 6-digit verification code we emailed you to activate your Global Ace Gaming account."
        noIndex
      />
      <AuthScreenShell
        showBack
        title="Verify your email"
        subtitle={
          <>
            We sent a 6-digit code to{' '}
            <span
              className="font-semibold"
              style={{ color: 'var(--casino-text-primary)' }}
            >
              {email}
            </span>
            . Enter it below to finish setting up.
          </>
        }
        backTo="/login"
      >
        <AuthFormCard>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleVerify();
            }}
            className="flex flex-col gap-6"
          >
            {formError ? (
              <p
                className="rounded-xl border px-3 py-3 text-sm leading-snug"
                style={{
                  borderColor: 'rgba(229, 57, 53, 0.3)',
                  backgroundColor: 'rgba(229, 57, 53, 0.1)',
                  color: '#fecaca',
                }}
                role="alert"
              >
                {formError}
              </p>
            ) : null}

            <div
              className="flex justify-center gap-2 sm:gap-3"
              onPaste={handlePaste}
            >
              {codes.map((code, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d*"
                  autoComplete={index === 0 ? 'one-time-code' : 'off'}
                  maxLength={1}
                  value={code}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  className="h-14 w-12 rounded-xl border bg-black/35 text-center text-base font-bold outline-none transition focus:ring-2 sm:h-16 sm:w-14 sm:text-2xl"
                  onFocus={(e) => scrollAuthFieldIntoView(e.currentTarget)}
                  style={{
                    borderColor: 'rgba(255, 255, 255, 0.12)',
                    color: 'var(--casino-text-primary)',
                  }}
                  disabled={isLoading}
                  aria-label={`Digit ${index + 1}`}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || codes.some((c) => !c)}
              className={btnPrimary}
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Verifying…
                </>
              ) : (
                'Verify email'
              )}
            </button>
          </form>

          <div className="mt-6 flex flex-col items-center gap-3 text-center">
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending || cooldown > 0}
              className="inline-flex items-center justify-center gap-2 text-sm transition disabled:cursor-not-allowed disabled:opacity-50"
              style={{ color: 'var(--casino-text-secondary)' }}
            >
              <RefreshCw
                className={`h-4 w-4 ${isResending ? 'animate-spin' : ''}`}
              />
              {isResending
                ? 'Sending…'
                : cooldown > 0
                  ? `Resend in ${cooldown}s`
                  : "Didn't receive a code? Resend"}
            </button>
            <button
              type="button"
              onClick={() => navigate('/login')}
              className="text-sm underline-offset-2 hover:underline"
              style={{ color: 'var(--casino-highlight-gold)' }}
            >
              Back to sign in
            </button>
          </div>
        </AuthFormCard>
      </AuthScreenShell>
    </>
  );
};

export default VerifyCode;
