import type { ReactNode } from 'react';
import { CosmicPageBg, type CosmicPageBgVariant } from './CosmicPageBg';
import { PageHeader } from './PageHeader';

export type PageShellWidth = '7xl' | '6xl' | '4xl' | '3xl' | 'full';

const widthClass: Record<PageShellWidth, string> = {
  '7xl': 'max-w-7xl',
  '6xl': 'max-w-6xl',
  '4xl': 'max-w-4xl',
  '3xl': 'max-w-3xl',
  full: 'max-w-full',
};

type Props = {
  children: ReactNode;
  title?: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  /** Full-width block above padded content (e.g. home hero) */
  banner?: ReactNode;
  /** Show cosmic atmosphere layer */
  background?: CosmicPageBgVariant | false;
  /** Use canonical page gradient under content */
  pageGradient?: boolean;
  width?: PageShellWidth;
  /** Skip default top padding (e.g. Home hero sets its own offset under the nav) */
  noTopPadding?: boolean;
  /** Remove horizontal padding from the content column */
  flush?: boolean;
  className?: string;
  contentClassName?: string;
};

export function PageShell({
  children,
  title,
  subtitle,
  actions,
  banner,
  background = 'subtle',
  pageGradient = true,
  width = '7xl',
  noTopPadding = false,
  flush = false,
  className = '',
  contentClassName = '',
}: Props) {
  const horizontalPad = flush ? '' : 'px-4 sm:px-6 lg:px-8';

  return (
    <div
      className={`relative w-full ${pageGradient ? 'cosmic-page-bg' : ''} ${className}`}
    >
      {background !== false ? (
        <div
          className="pointer-events-none absolute inset-x-0 top-0 -z-10 min-h-full"
          aria-hidden
        >
          <CosmicPageBg variant={background} className="min-h-full" />
        </div>
      ) : null}

      {banner ? <div className="relative z-10 w-full">{banner}</div> : null}

      <div
        className={`relative z-10 mx-auto w-full ${horizontalPad} ${widthClass[width]} ${
          noTopPadding ? 'pb-8 pt-4 sm:pb-10' : 'cosmic-page-pt pb-8 sm:pb-10 lg:pb-12'
        } ${contentClassName}`}
      >
        {(title || subtitle || actions) && (
          <PageHeader title={title!} subtitle={subtitle} actions={actions} />
        )}
        {children}
      </div>
    </div>
  );
}
