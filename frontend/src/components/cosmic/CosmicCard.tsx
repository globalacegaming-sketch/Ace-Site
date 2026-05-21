import type { ReactNode, HTMLAttributes } from 'react';

type Variant = 'glass' | 'solid';

type Props = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode;
  variant?: Variant;
  glow?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
};

const paddingClass = {
  none: '',
  sm: 'p-4',
  md: 'p-5 sm:p-6',
  lg: 'p-6 sm:p-8',
};

export function CosmicCard({
  children,
  variant = 'solid',
  glow = false,
  padding = 'md',
  className = '',
  ...rest
}: Props) {
  const base =
    variant === 'glass' ? 'cosmic-card' : 'cosmic-card-solid';
  const glowClass = glow ? 'cosmic-glow-border' : '';

  return (
    <div
      className={`${base} ${paddingClass[padding]} ${glowClass} ${className}`.trim()}
      {...rest}
    >
      {children}
    </div>
  );
}
