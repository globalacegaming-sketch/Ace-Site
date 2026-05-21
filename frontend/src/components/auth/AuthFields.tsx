import {
  forwardRef,
  useState,
  type ComponentProps,
  type ReactNode,
} from 'react';
import { scrollAuthFieldIntoView } from '../../utils/authMobile';
import type { UseFormRegisterReturn } from 'react-hook-form';
import {
  IconEnvelope,
  IconEye,
  IconEyeSlash,
  IconLock,
  IconPhone,
  IconTag,
  IconUser,
} from './AuthIcons';

/* ------------------------------------------------------------------------- */
/* Shared input chrome                                                       */
/* ------------------------------------------------------------------------- */

/**
 * `min-h-12` + `text-base` is critical on mobile: anything below 16 px font
 * triggers iOS Safari auto-zoom, which makes the form feel broken when the
 * keyboard opens.
 */
const fieldShellBase =
  'flex w-full min-h-12 items-stretch overflow-visible rounded-2xl border bg-black/35 text-base transition focus-within:ring-1 focus-within:ring-[color:var(--casino-highlight-gold)]/40';

const iconBox =
  'flex w-11 shrink-0 items-center justify-center border-r text-[color:var(--casino-text-secondary)]';

const inputBase =
  'min-w-0 flex-1 bg-transparent px-3 py-3 text-base outline-none placeholder:text-[color:var(--casino-text-secondary)]';

function shellStyle(hasError: boolean): React.CSSProperties {
  return {
    borderColor: hasError
      ? 'rgba(229, 57, 53, 0.5)'
      : 'rgba(255, 255, 255, 0.12)',
    color: 'var(--casino-text-primary)',
  };
}

function iconBoxStyle(hasError: boolean): React.CSSProperties {
  return {
    borderRightColor: hasError
      ? 'rgba(229, 57, 53, 0.35)'
      : 'rgba(255, 255, 255, 0.08)',
  };
}

/* ------------------------------------------------------------------------- */
/* Left-icon catalogue                                                       */
/* ------------------------------------------------------------------------- */

type IconName = 'user' | 'email' | 'phone' | 'tag';

function LeftIcon({ name }: { name: IconName }) {
  const c = 'h-5 w-5';
  if (name === 'user') return <IconUser className={c} />;
  if (name === 'email') return <IconEnvelope className={c} />;
  if (name === 'phone') return <IconPhone className={c} />;
  return <IconTag className={c} />;
}

/* ------------------------------------------------------------------------- */
/* AuthTextField                                                             */
/* ------------------------------------------------------------------------- */

type TextFieldProps = {
  label: ReactNode;
  error?: string;
  leftIcon: IconName;
} & ComponentProps<'input'>;

/**
 * Generic icon-slot text input compatible with `react-hook-form`'s
 * `register()` (forwards refs + spreads `name`, `onChange`, `onBlur`).
 */
export const AuthTextField = forwardRef<HTMLInputElement, TextFieldProps>(
  function AuthTextField(
    { label, error, leftIcon, className, id, onFocus, ...inputProps },
    ref,
  ) {
    const hasError = Boolean(error);

    return (
      <div className="w-full">
        <label
          htmlFor={id}
          className="mb-1.5 block text-left text-xs font-medium leading-snug"
          style={{ color: 'var(--casino-text-secondary)' }}
        >
          {label}
        </label>
        <div
          className={fieldShellBase}
          style={{
            ...shellStyle(hasError),
            // focus ring picks up gold/red depending on error state via CSS variable trickery.
            boxShadow: hasError
              ? '0 0 0 1px rgba(229, 57, 53, 0.15)'
              : undefined,
          }}
        >
          <span className={iconBox} style={iconBoxStyle(hasError)} aria-hidden>
            <LeftIcon name={leftIcon} />
          </span>
          <input
            id={id}
            ref={ref}
            className={`${inputBase} ${className ?? ''}`}
            style={{ color: 'var(--casino-text-primary)' }}
            onFocus={(e) => {
              scrollAuthFieldIntoView(e.currentTarget);
              onFocus?.(e);
            }}
            {...inputProps}
          />
        </div>
        {hasError ? (
          <span
            className="mt-1.5 block text-sm sm:text-xs"
            style={{ color: 'rgba(248, 113, 113, 0.95)' }}
          >
            {error}
          </span>
        ) : null}
      </div>
    );
  },
);

/* ------------------------------------------------------------------------- */
/* AuthPasswordField                                                         */
/* ------------------------------------------------------------------------- */

type PasswordFieldProps = {
  label: ReactNode;
  error?: string;
  registration: UseFormRegisterReturn;
  /** Helper text shown below the field when there is no error (e.g. password rules). */
  hint?: ReactNode;
} & Pick<
  ComponentProps<'input'>,
  'autoComplete' | 'enterKeyHint' | 'placeholder' | 'autoFocus' | 'id'
>;

export function AuthPasswordField({
  label,
  error,
  registration,
  autoComplete,
  enterKeyHint,
  placeholder,
  autoFocus,
  hint,
  id,
}: PasswordFieldProps) {
  const [show, setShow] = useState(false);
  const hasError = Boolean(error);

  return (
    <div className="w-full">
      <label
        htmlFor={id}
        className="mb-1.5 block text-left text-xs font-medium leading-snug"
        style={{ color: 'var(--casino-text-secondary)' }}
      >
        {label}
      </label>
      <div className={fieldShellBase} style={shellStyle(hasError)}>
        <span className={iconBox} style={iconBoxStyle(hasError)} aria-hidden>
          <IconLock className="h-5 w-5" />
        </span>
        <input
          id={id}
          type={show ? 'text' : 'password'}
          className={inputBase}
          style={{ color: 'var(--casino-text-primary)' }}
          autoComplete={autoComplete}
          enterKeyHint={enterKeyHint}
          placeholder={placeholder}
          autoFocus={autoFocus}
          onFocus={(e) => scrollAuthFieldIntoView(e.currentTarget)}
          {...registration}
        />
        <button
          type="button"
          className="flex w-11 shrink-0 touch-manipulation items-center justify-center transition hover:text-[color:var(--casino-highlight-gold)]"
          style={{ color: 'var(--casino-text-secondary)' }}
          onClick={() => setShow((s) => !s)}
          aria-label={show ? 'Hide password' : 'Show password'}
          aria-pressed={show}
        >
          {show ? (
            <IconEyeSlash className="h-5 w-5" />
          ) : (
            <IconEye className="h-5 w-5" />
          )}
        </button>
      </div>
      {hint && !hasError ? (
        <span
          className="mt-1.5 block text-xs leading-snug"
          style={{ color: 'var(--casino-text-secondary)' }}
        >
          {hint}
        </span>
      ) : null}
      {hasError ? (
        <span
          className="mt-1.5 block text-sm sm:text-xs"
          style={{ color: 'rgba(248, 113, 113, 0.95)' }}
        >
          {error}
        </span>
      ) : null}
    </div>
  );
}
