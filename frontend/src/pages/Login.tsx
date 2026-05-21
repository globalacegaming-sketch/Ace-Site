import { useEffect, useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useMusic } from '../contexts/MusicContext';
import { PageMeta } from '../components/PageMeta';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { shouldAuthAutoFocus } from '../utils/authMobile';
import { AuthFormCard } from '../components/auth/AuthFormCard';
import {
  AuthPasswordField,
  AuthTextField,
} from '../components/auth/AuthFields';
import { LoginError, loginAccount } from '../services/authApi';

const loginSchema = z.object({
  email: z
    .string()
    .min(1, 'Email is required')
    .email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const REMEMBER_KEY = 'gag_remember_email';

const btnPrimary =
  'btn-casino-primary flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl px-4 py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50';

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/dashboard';
  const { login, setLastRechargeStatus } = useAuthStore();
  const { stopMusic, startMusic } = useMusic();
  const [formError, setFormError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    mode: 'onSubmit',
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    stopMusic();
  }, [stopMusic]);

  // Restore the remembered email so returning users don't have to retype it.
  useEffect(() => {
    try {
      const saved = localStorage.getItem(REMEMBER_KEY);
      if (saved) {
        setValue('email', saved);
        setRememberMe(true);
      }
    } catch {
      /* ignore storage failures */
    }
  }, [setValue]);

  const onSubmit = handleSubmit(async (data) => {
    setFormError(null);
    try {
      const result = await loginAccount({
        email: data.email,
        password: data.password,
        rememberMe,
      });

      login({
        user: result.user,
        token: result.accessToken,
        expires_at: result.expiresAt,
      });
      setLastRechargeStatus('success');

      try {
        if (rememberMe) {
          localStorage.setItem(REMEMBER_KEY, data.email);
        } else {
          localStorage.removeItem(REMEMBER_KEY);
        }
      } catch {
        /* ignore storage failures */
      }

      startMusic();
      toast.success('Welcome back!');
      navigate(redirectTo, { replace: true });
    } catch (e) {
      if (e instanceof LoginError) {
        // Email verification gate — bounce directly to the code form.
        if (e.apiCode === 'EMAIL_NOT_VERIFIED') {
          navigate('/verify-code', { state: { email: data.email } });
          return;
        }
        if (e.httpStatus === 429) {
          const msg =
            'Too many sign-in attempts. Wait a few minutes, or reset your password.';
          setFormError(msg);
          toast.error(msg);
          return;
        }
        if (e.apiCode === 'ACCOUNT_BANNED') {
          setFormError(e.message);
          toast.error(e.message);
          return;
        }
        setFormError(e.message);
        toast.error(e.message);
        return;
      }
      const msg = e instanceof Error ? e.message : 'Login failed';
      setFormError(msg);
      toast.error(msg);
    }
  });

  const rateLimited =
    formError?.toLowerCase().startsWith('too many sign-in attempts') ?? false;

  return (
    <>
      <PageMeta
        title="Sign In | Global Ace Gaming"
        description="Sign in to Global Ace Gaming to play online slots, fish games, and table games. Continue your gaming journey on desktop or mobile."
        noIndex
      />
      <AuthScreenShell
        variant="login"
        title="Welcome back"
        subtitle="Sign in to claim bonuses, chat with support, and pick up where you left off."
      >
        <AuthFormCard>
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-5 sm:gap-4"
            noValidate
          >
            {formError ? (
              <div
                className="rounded-xl border px-3 py-3 text-sm leading-snug"
                style={{
                  borderColor: 'rgba(229, 57, 53, 0.3)',
                  backgroundColor: 'rgba(229, 57, 53, 0.1)',
                  color: '#fecaca',
                }}
                role="alert"
              >
                <p>{formError}</p>
                {rateLimited ? (
                  <p className="mt-2">
                    <Link
                      to="/forgot-password"
                      className="font-semibold underline-offset-2 hover:underline"
                      style={{ color: '#fee2e2' }}
                    >
                      Reset your password
                    </Link>
                  </p>
                ) : null}
              </div>
            ) : null}

            <AuthTextField
              id="email"
              label="Email address"
              leftIcon="email"
              type="email"
              autoComplete="email"
              enterKeyHint="next"
              placeholder="you@example.com"
              autoFocus={shouldAuthAutoFocus()}
              error={errors.email?.message}
              {...register('email')}
            />

            <AuthPasswordField
              id="password"
              label="Password"
              registration={register('password')}
              autoComplete="current-password"
              enterKeyHint="done"
              placeholder="Enter password"
              error={errors.password?.message}
            />

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
              <label
                className="flex cursor-pointer items-center gap-2.5"
                style={{ color: 'var(--casino-text-secondary)' }}
              >
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 shrink-0 rounded border-white/20 bg-black/50 accent-[color:var(--casino-highlight-gold)]"
                />
                <span className="select-none">Remember my email</span>
              </label>
              <Link
                to="/forgot-password"
                className="touch-manipulation font-semibold underline-offset-2 hover:underline"
                style={{ color: 'var(--casino-highlight-gold)' }}
              >
                Forgot password?
              </Link>
            </div>

            <button type="submit" disabled={isSubmitting} className={btnPrimary}>
              {isSubmitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <p
            className="mt-6 text-center text-sm"
            style={{ color: 'var(--casino-text-secondary)' }}
          >
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--casino-highlight-gold)' }}
            >
              Create one
            </Link>
          </p>
        </AuthFormCard>
      </AuthScreenShell>
    </>
  );
};

export default Login;
