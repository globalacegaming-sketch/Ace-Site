import type { ReactNode } from 'react';

type Props = {
  title?: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  className?: string;
  id?: string;
};

export function Section({
  title,
  description,
  children,
  className = '',
  id,
}: Props) {
  return (
    <section id={id} className={`py-8 sm:py-10 lg:py-12 ${className}`}>
      {(title || description) && (
        <div className="mb-6 text-center sm:mb-8">
          {title ? <h2 className="cosmic-h2">{title}</h2> : null}
          {description ? (
            <p className="cosmic-body mx-auto mt-2 max-w-2xl">{description}</p>
          ) : null}
        </div>
      )}
      {children}
    </section>
  );
}
