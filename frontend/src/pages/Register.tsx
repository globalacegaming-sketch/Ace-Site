import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { useMusic } from '../contexts/MusicContext';
import { trackOnboarding } from '../services/analyticsTracker';
import { PageMeta } from '../components/PageMeta';
import { PasswordStrengthMeter } from '../components/PasswordStrengthMeter';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthFormCard } from '../components/auth/AuthFormCard';
import {
  AuthPasswordField,
  AuthTextField,
} from '../components/auth/AuthFields';
import { LoginError, registerAccount } from '../services/authApi';
import { shouldAuthAutoFocus } from '../utils/authMobile';

const registerSchema = z
  .object({
    firstName: z.string().min(2, 'First name must be at least 2 characters'),
    lastName: z.string().min(2, 'Last name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    phoneNumber: z
      .string()
      .min(1, 'Phone number is required')
      .min(10, 'Phone must be at least 10 characters'),
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
    referralCode: z.string().optional(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type RegisterFormData = z.infer<typeof registerSchema>;

const btnPrimary =
  'btn-casino-primary flex min-h-12 w-full touch-manipulation items-center justify-center rounded-2xl px-4 py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50';

const Register = () => {
  const navigate = useNavigate();
  const { login } = useAuthStore();
  const { stopMusic, startMusic } = useMusic();
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
      password: '',
      confirmPassword: '',
      referralCode: '',
    },
  });

  const passwordValue = watch('password') ?? '';

  useEffect(() => {
    stopMusic();
    trackOnboarding('onboarding_started', { step: 'registration' });
    return () => {
      if (!window.location.pathname.includes('verify-code')) {
        trackOnboarding('onboarding_abandoned', { step: 'registration' });
      }
    };
  }, [stopMusic]);

  const onSubmit = handleSubmit(async (values) => {
    setFormError(null);
    try {
      const result = await registerAccount({
        firstName: values.firstName,
        lastName: values.lastName,
        email: values.email,
        phoneNumber: values.phoneNumber.trim(),
        password: values.password,
        ...(values.referralCode ? { referralCode: values.referralCode } : {}),
      });

      login({
        user: result.user,
        token: result.accessToken,
        expires_at: result.expiresAt,
      });
      startMusic();

      toast.success(
        'Account created! Check your email for the verification code.',
      );

      if (result.fortunePanda) {
        toast.success(
          `Fortune Panda Account Created!\nUsername: ${result.fortunePanda.username}\nPassword: ${result.fortunePanda.password}`,
          { duration: 10000 },
        );
      }

      trackOnboarding('onboarding_step_completed', { step: 'registration' });
      navigate('/verify-code', { state: { email: result.user.email } });
    } catch (e) {
      const msg =
        e instanceof LoginError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Registration failed';
      setFormError(msg);
      toast.error(msg);
    }
  });

  return (
    <>
      <PageMeta
        title="Sign Up | Create Your Account | Global Ace Gaming"
        description="Create your free Global Ace Gaming account. Play online slots, fish games, and table games on desktop and mobile. Use a referral code to earn extra bonuses."
        noIndex
      />
      <AuthScreenShell
        variant="register"
        title="Create your account"
        subtitle="Join the table in under a minute — claim bonuses, sync your wallet, and play across every partner."
      >
        <AuthFormCard>
          <form
            onSubmit={onSubmit}
            className="flex flex-col gap-3 sm:gap-4"
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
                {formError}
              </div>
            ) : null}

            <div className="flex flex-col gap-3 sm:grid sm:grid-cols-2 sm:gap-4">
              <AuthTextField
                id="firstName"
                label="First name"
                leftIcon="user"
                autoComplete="given-name"
                enterKeyHint="next"
                autoFocus={shouldAuthAutoFocus()}
                placeholder="John"
                error={errors.firstName?.message}
                {...register('firstName')}
              />
              <AuthTextField
                id="lastName"
                label="Last name"
                leftIcon="user"
                autoComplete="family-name"
                enterKeyHint="next"
                placeholder="Doe"
                error={errors.lastName?.message}
                {...register('lastName')}
              />
            </div>

            <AuthTextField
              id="email"
              label="Email address"
              leftIcon="email"
              type="email"
              autoComplete="email"
              enterKeyHint="next"
              placeholder="you@example.com"
              error={errors.email?.message}
              {...register('email')}
            />

            <AuthTextField
              id="phoneNumber"
              label="Phone number"
              leftIcon="phone"
              type="tel"
              autoComplete="tel"
              inputMode="tel"
              enterKeyHint="next"
              placeholder="+1 (555) 000-0000"
              error={errors.phoneNumber?.message}
              {...register('phoneNumber')}
            />

            <div>
              <AuthPasswordField
                id="password"
                label="Password"
                registration={register('password')}
                autoComplete="new-password"
                enterKeyHint="next"
                placeholder="At least 6 characters"
                error={errors.password?.message}
              />
              <PasswordStrengthMeter password={passwordValue} />
            </div>

            <AuthPasswordField
              id="confirmPassword"
              label="Confirm password"
              registration={register('confirmPassword')}
              autoComplete="new-password"
              enterKeyHint="next"
              placeholder="Re-enter password"
              error={errors.confirmPassword?.message}
            />

            <AuthTextField
              id="referralCode"
              label={
                <>
                  Referral code{' '}
                  <span
                    className="font-normal normal-case"
                    style={{ color: 'var(--casino-text-secondary)' }}
                  >
                    (optional)
                  </span>
                </>
              }
              leftIcon="tag"
              autoComplete="off"
              autoCapitalize="characters"
              enterKeyHint="done"
              placeholder="Friend's code"
              {...register('referralCode')}
            />

            <p
              className="text-center text-xs leading-relaxed"
              style={{ color: 'var(--casino-text-secondary)' }}
            >
              By signing up you agree to our{' '}
              <Link
                to="/terms"
                className="font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--casino-highlight-gold)' }}
              >
                Terms
              </Link>
              ,{' '}
              <Link
                to="/privacy"
                className="font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--casino-highlight-gold)' }}
              >
                Privacy Policy
              </Link>{' '}
              and{' '}
              <Link
                to="/cookies"
                className="font-medium underline-offset-2 hover:underline"
                style={{ color: 'var(--casino-highlight-gold)' }}
              >
                Cookie Policy
              </Link>
              .
            </p>

            <button type="submit" disabled={isSubmitting} className={btnPrimary}>
              {isSubmitting ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <p
            className="mt-6 text-center text-sm"
            style={{ color: 'var(--casino-text-secondary)' }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--casino-highlight-gold)' }}
            >
              Sign in here
            </Link>
          </p>
        </AuthFormCard>
      </AuthScreenShell>
    </>
  );
};

export default Register;
