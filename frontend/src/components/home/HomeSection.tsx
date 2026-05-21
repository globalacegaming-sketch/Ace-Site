import type { ReactNode } from 'react';

type Props = {
  id?: string;
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
  borderTop?: boolean;
};

export function HomeSection({
  id,
  title,
  subtitle,
  children,
  className = '',
  borderTop = true,
}: Props) {
  return (
    <section
      id={id}
      className={`relative z-10 px-3 py-10 sm:px-4 sm:py-14 lg:px-8 lg:py-16 ${
        borderTop ? 'border-t border-white/[0.06]' : ''
      } ${className}`}
    >
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 text-center sm:mb-10">
          <h2 className="text-2xl font-bold casino-text-primary sm:text-3xl md:text-4xl">{title}</h2>
          {subtitle ? (
            <p className="mx-auto mt-2 max-w-2xl text-sm casino-text-secondary sm:text-base">
              {subtitle}
            </p>
          ) : null}
        </div>
        {children}
      </div>
    </section>
  );
}
