import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import toast from 'react-hot-toast';
import { Loader2 } from 'lucide-react';
import { PageMeta } from '../components/PageMeta';
import { AuthScreenShell } from '../components/auth/AuthScreenShell';
import { AuthFormCard } from '../components/auth/AuthFormCard';
import { AuthTextField } from '../components/auth/AuthFields';
import { LoginError, requestPasswordReset } from '../services/authApi';
import { shouldAuthAutoFocus } from '../utils/authMobile';

const schema = z.object({
  email: z.string().trim().min(1, 'Email is required').email('Enter a valid email'),
});

type FormValues = z.infer<typeof schema>;

const btnPrimary =
  'btn-casino-primary flex min-h-12 w-full touch-manipulation items-center justify-center gap-2 rounded-2xl px-4 py-3.5 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50';

const ForgotPassword = () => {
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    getValues,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  });

  const onSubmit = handleSubmit(async ({ email }) => {
    setFormError(null);
    try {
      await requestPasswordReset(email);
      setSentTo(email);
      toast.success('Reset email sent (if the account exists).');
    } catch (e) {
      const msg =
        e instanceof LoginError
          ? e.message
          : e instanceof Error
            ? e.message
            : 'Failed to send reset email';
      setFormError(msg);
      toast.error(msg);
    }
  });

  return (
    <>
      <PageMeta
        title="Forgot Password | Global Ace Gaming"
        description="Reset your Global Ace Gaming account password. We'll email you a secure reset link."
        noIndex
      />
      <AuthScreenShell
        showBack
        title="Forgot password"
        subtitle={
          sentTo
            ? `If an account exists for ${sentTo}, a reset link is on its way.`
            : 'Enter the email on your account — we will send a secure reset link.'
        }
        backTo="/login"
      >
        <AuthFormCard>
          {!sentTo ? (
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

              <AuthTextField
                id="email"
                label="Email address"
                leftIcon="email"
                type="email"
                autoComplete="email"
                enterKeyHint="done"
                placeholder="you@example.com"
                autoFocus={shouldAuthAutoFocus()}
                error={errors.email?.message}
                {...register('email')}
              />

              <button
                type="submit"
                disabled={isSubmitting}
                className={btnPrimary}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Sending…
                  </>
                ) : (
                  'Send reset link'
                )}
              </button>
            </form>
          ) : (
            <div className="flex flex-col gap-4 text-center">
              <div
                className="rounded-xl border p-4 text-sm leading-relaxed"
                style={{
                  borderColor: 'rgba(0, 200, 83, 0.25)',
                  backgroundColor: 'rgba(0, 200, 83, 0.08)',
                  color: 'var(--casino-text-secondary)',
                }}
              >
                We sent a reset link to{' '}
                <strong style={{ color: 'var(--casino-text-primary)' }}>
                  {sentTo}
                </strong>
                . The link will expire in 1 hour.
              </div>
              <button
                type="button"
                onClick={() => {
                  setSentTo(null);
                  reset({ email: getValues('email') });
                }}
                className="text-sm underline-offset-2 hover:underline"
                style={{ color: 'var(--casino-text-secondary)' }}
              >
                Send to a different email
              </button>
            </div>
          )}

          <p
            className="mt-6 text-center text-sm"
            style={{ color: 'var(--casino-text-secondary)' }}
          >
            Remembered it?{' '}
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

export default ForgotPassword;
