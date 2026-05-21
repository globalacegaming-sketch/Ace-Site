import type { ReactNode } from 'react';

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function PageHeader({ title, subtitle, actions, className = '' }: Props) {
  return (
    <header
      className={`mb-6 flex flex-col gap-3 sm:mb-8 sm:flex-row sm:items-end sm:justify-between ${className}`}
    >
      <div className="min-w-0 flex-1">
        <h1 className="cosmic-h1">{title}</h1>
        {subtitle ? <p className="cosmic-body mt-2 max-w-2xl">{subtitle}</p> : null}
      </div>
      {actions ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
      ) : null}
    </header>
  );
}
