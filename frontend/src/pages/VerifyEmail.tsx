import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { PageMeta } from '../components/PageMeta';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthFormCard } from '../components/auth/AuthFormCard';
import {
  LoginError,
  fetchMe,
  verifyEmailWithToken,
} from '../services/authApi';

const btnPrimary =
  'btn-casino-primary flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl px-4 py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { setUser } = useAuthStore();

  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid verification link');
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        await verifyEmailWithToken(token);
        if (cancelled) return;
        setIsVerified(true);
        toast.success('Email verified successfully!');

        // Refresh user in the auth store if a session exists.
        const currentToken = useAuthStore.getState().token;
        if (currentToken) {
          try {
            const user = await fetchMe(currentToken);
            if (!cancelled) setUser(user);
          } catch {
            /* user not signed in or token expired — ignore */
          }
        }
      } catch (e) {
        if (cancelled) return;
        const msg =
          e instanceof LoginError
            ? e.message
            : e instanceof Error
              ? e.message
              : 'Failed to verify email';
        setError(msg);
        toast.error(msg);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [token, setUser]);

  return (
    <>
      <PageMeta
        title="Verify Email | Global Ace Gaming"
        description="Confirm your email address to finish setting up your Global Ace Gaming account."
        noIndex
      />
      <AuthScreenShell
        showBack
        title={
          isLoading
            ? 'Verifying email'
            : isVerified
              ? 'Email verified'
              : 'Verification failed'
        }
        subtitle={
          isLoading
            ? 'Hold tight — confirming your email address.'
            : isVerified
              ? 'Your email is confirmed. Jump back into your account.'
              : 'The verification link is invalid or has expired. Request a new code from your profile.'
        }
        backTo="/login"
      >
        <AuthFormCard>
          <div className="flex flex-col items-center gap-5 text-center">
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{
                background: isLoading
                  ? 'linear-gradient(135deg, var(--casino-highlight-gold), #FFA000)'
                  : isVerified
                    ? 'linear-gradient(135deg, #34d399, #059669)'
                    : 'linear-gradient(135deg, #f87171, #b91c1c)',
              }}
            >
              {isLoading ? (
                <Loader2 className="h-8 w-8 animate-spin text-black" />
              ) : isVerified ? (
                <CheckCircle className="h-8 w-8 text-white" />
              ) : (
                <XCircle className="h-8 w-8 text-white" />
              )}
            </div>

            {error && !isVerified ? (
              <p
                className="w-full rounded-xl border px-3 py-3 text-sm leading-snug"
                style={{
                  borderColor: 'rgba(229, 57, 53, 0.3)',
                  backgroundColor: 'rgba(229, 57, 53, 0.1)',
                  color: '#fecaca',
                }}
                role="alert"
              >
                {error}
              </p>
            ) : null}

            {!isLoading ? (
              <div className="flex w-full flex-col gap-3">
                {isVerified ? (
                  <Link to="/dashboard" className={btnPrimary}>
                    Go to dashboard
                  </Link>
                ) : (
                  <Link to="/profile" className={btnPrimary}>
                    Go to profile
                  </Link>
                )}
                <Link
                  to="/login"
                  className="text-center text-sm underline-offset-2 hover:underline"
                  style={{ color: 'var(--casino-text-secondary)' }}
                >
                  Back to sign in
                </Link>
              </div>
            ) : null}
          </div>
        </AuthFormCard>
      </AuthScreenShell>
    </>
  );
};

export default VerifyEmail;
