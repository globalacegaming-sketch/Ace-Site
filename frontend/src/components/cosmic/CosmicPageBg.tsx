/**
 * Shared cosmic atmosphere for auth, marketing heroes, and page backgrounds.
 * Uses only circular/radial elements (no rotating conic gradient).
 */

export type CosmicPageBgVariant = 'auth' | 'hero' | 'page' | 'subtle';

type Props = {
  variant?: CosmicPageBgVariant;
  className?: string;
};

export function CosmicPageBg({ variant = 'page', className = '' }: Props) {
  const isAuth = variant === 'auth';
  const isHero = variant === 'hero';
  const isSubtle = variant === 'subtle';

  const baseGradient = isAuth
    ? 'linear-gradient(135deg, #0A0A0F 0%, #14082A 45%, #1B0B3A 100%)'
    : isHero
      ? 'linear-gradient(135deg, #14082A 0%, #1f0a3a 50%, #2E0854 100%)'
      : 'linear-gradient(135deg, #0A0A0F 0%, #14082A 35%, #1B1B2F 100%)';

  const pulseOpacity = isSubtle ? 0.12 : isHero ? 0.2 : 0.16;
  const showDust = !isSubtle;
  const showBlurOrbs = !isSubtle || isHero;

  return (
    <div
      className={`pointer-events-none absolute inset-0 isolate overflow-hidden ${className}`}
      aria-hidden
    >
      <div className="absolute inset-0" style={{ background: baseGradient }} />

      {isAuth && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background:
                'linear-gradient(to top, rgba(10, 10, 15, 0.92), rgba(20, 8, 42, 0.08) 50%, rgba(13, 10, 36, 0.4))',
            }}
          />
          <div
            className="absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse 90% 70% at 50% 38%, rgba(139, 0, 139, 0.16) 0%, rgba(46, 8, 84, 0.1) 48%, transparent 74%)',
            }}
          />
        </>
      )}

      {!isAuth && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse 90% 70% at 50% 38%, rgba(139, 0, 139, 0.22) 0%, rgba(46, 8, 84, 0.12) 48%, transparent 74%)',
          }}
        />
      )}

      <div
        className={`animate-hero-cosmic-pulse absolute left-1/2 rounded-full mix-blend-screen ${
          isAuth
            ? 'top-[36%] h-[min(100vmin,520px)] w-[min(100vmin,520px)] -translate-x-1/2 -translate-y-1/2 sm:top-[40%]'
            : 'top-1/2 h-[min(120vmin,560px)] w-[min(120vmin,560px)]'
        }`}
        style={{
          transform: isAuth ? undefined : 'translate(-50%, -50%)',
          background: `radial-gradient(circle, rgba(236, 72, 153, ${pulseOpacity}) 0%, rgba(124, 58, 237, ${pulseOpacity}) 38%, transparent 68%)`,
        }}
      />

      {showBlurOrbs && (
        <div
          className={`absolute inset-0 ${isSubtle ? 'opacity-40' : 'opacity-[0.5] sm:opacity-[0.58]'}`}
        >
          <div
            className="absolute -left-10 top-[10%] h-[min(45vw,280px)] w-[min(45vw,280px)] rounded-full"
            style={{
              background: 'rgba(106, 27, 154, 0.28)',
              filter: 'blur(64px)',
            }}
          />
          <div
            className="absolute -right-8 bottom-[15%] h-[min(40vw,240px)] w-[min(40vw,240px)] rounded-full"
            style={{
              background: 'rgba(0, 176, 255, 0.22)',
              filter: 'blur(72px)',
            }}
          />
          <div
            className="absolute bottom-[8%] left-[18%] hidden h-[min(32vw,200px)] w-[min(32vw,200px)] rounded-full sm:block"
            style={{
              background: 'rgba(255, 215, 0, 0.14)',
              filter: 'blur(56px)',
            }}
          />
        </div>
      )}

      {showDust && (
        <div className="absolute inset-0">
          <div
            className="animate-hero-dust absolute left-[18%] top-[28%] h-1 w-1 rounded-full"
            style={{
              background: 'rgba(255, 215, 0, 0.5)',
              boxShadow: '0 0 8px rgba(255, 215, 0, 0.4)',
              filter: 'blur(1.5px)',
            }}
          />
          <div
            className="animate-hero-dust-delayed absolute right-[18%] top-[34%] h-1 w-1 rounded-full"
            style={{
              background: 'rgba(255, 224, 130, 0.5)',
              filter: 'blur(1.5px)',
            }}
          />
          <div
            className="animate-hero-dust-slow absolute left-[58%] top-[20%] hidden h-1 w-1 rounded-full sm:block"
            style={{
              background: 'rgba(255, 215, 0, 0.45)',
              filter: 'blur(1.5px)',
            }}
          />
        </div>
      )}

      {isAuth && (
        <div
          className="absolute inset-x-0 bottom-0 h-2/3"
          style={{
            background:
              'linear-gradient(to top, rgba(10, 10, 15, 0.55), rgba(10, 4, 24, 0.04), transparent)',
          }}
        />
      )}
    </div>
  );
}
