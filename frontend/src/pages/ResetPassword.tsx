import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { PageMeta } from '../components/PageMeta';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthFormCard } from '../components/auth/AuthFormCard';
import { AuthPasswordField } from '../components/auth/AuthFields';
import { LoginError, resetPasswordWithToken } from '../services/authApi';
import { shouldAuthAutoFocus } from '../utils/authMobile';

const schema = z
  .object({
    password: z.string().min(6, 'Password must be at least 6 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type FormValues = z.infer<typeof schema>;

const btnPrimary =
  'btn-casino-primary flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  // Invalid links land back on the request page rather than rendering a broken form.
  useEffect(() => {
    if (!token) {
      toast.error('Invalid reset link');
      navigate('/forgot-password', { replace: true });
    }
  }, [token, navigate]);

  const onSubmit = handleSubmit(async ({ password }) => {
    if (!token) return;
    setFormError(null);
    try {
      await resetPasswordWithToken({ token, password });
      setIsSuccess(true);
      toast.success('Password reset successfully!');
      setTimeout(() => navigate('/login', { replace: true }), 1500);
    } catch (e) {
      const msg =
        e instanceof LoginError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to reset password';
      setFormError(msg);
      toast.error(msg);
    }
  });

  if (!token) {
    return null;
  }

  return (
    <>
      <PageMeta
        title="Reset Password | Global Ace Gaming"
        description="Choose a new password for your Global Ace Gaming account."
        noIndex
      />
      <AuthScreenShell
        showBack
        title={isSuccess ? 'Password reset' : 'Reset your password'}
        subtitle={
          isSuccess
            ? 'You can now sign in with your new password. Redirecting…'
            : 'Pick a new password (at least 6 characters).'
        }
        backTo="/login"
      >
        <AuthFormCard>
          {!isSuccess ? (
            <form
              onSubmit={onSubmit}
              className="flex flex-col gap-5 sm:gap-4"
              noValidate
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

              <AuthPasswordField
                id="password"
                label="New password"
                registration={register('password')}
                autoComplete="new-password"
                enterKeyHint="next"
                placeholder="At least 6 characters"
                autoFocus={shouldAuthAutoFocus()}
                error={errors.password?.message}
              />

              <AuthPasswordField
                id="confirmPassword"
                label="Confirm password"
                registration={register('confirmPassword')}
                autoComplete="new-password"
                enterKeyHint="done"
                placeholder="Re-enter password"
                error={errors.confirmPassword?.message}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className={btnPrimary}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Resetting…
                  </>
                ) : (
                  'Reset password'
                )}
              </button>
            </form>
          ) : (
            <div
              className="rounded-xl border p-4 text-center text-sm leading-relaxed"
              style={{
                borderColor: 'rgba(0, 200, 83, 0.25)',
                backgroundColor: 'rgba(0, 200, 83, 0.08)',
                color: 'var(--casino-text-secondary)',
              }}
            >
              Your password has been successfully reset. Taking you to sign in…
            </div>
          )}

          <p
            className="mt-6 text-center text-sm"
            style={{ color: 'var(--casino-text-secondary)' }}
          >
            Wrong account?{' '}
            <Link
              to="/login"
              className="font-semibold underline-offset-2 hover:underline"
              style={{ color: 'var(--casino-highlight-gold)' }}
            >
              Back to sign in
            </Link>
          </p>
        </AuthFormCard>
      </AuthScreenShell>
    </>
  );
};

export default ResetPassword;
