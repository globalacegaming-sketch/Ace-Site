import { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Slide {
  id: string;
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  /** Set to true for external links (opens in new tab) */
  external?: boolean;
  gradient: string;
}

const SLIDES: Slide[] = [
  {
    id: 'refer',
    title: 'Refer a Friend',
    subtitle: 'Invite your friends and earn bonus credits when they sign up and play.',
    cta: 'Start Referring',
    href: '/bonuses',
    gradient: 'linear-gradient(135deg, #FF6F00 0%, #FFD700 100%)',
  },
  {
    id: 'games',
    title: 'Check the Latest Games',
    subtitle: 'New slots, fish games, and table games added every week.',
    cta: 'Browse Games',
    href: '/games',
    gradient: 'linear-gradient(135deg, #6A1B9A 0%, #AB47BC 100%)',
  },
  {
    id: 'bonus',
    title: 'New Bonuses Available',
    subtitle: 'Exclusive deposit matches, free spins, and cashback offers waiting for you.',
    cta: 'View Bonuses',
    href: '/bonuses',
    gradient: 'linear-gradient(135deg, #00B0FF 0%, #0091EA 100%)',
  },
  {
    id: 'telegram',
    title: 'Contact Us on Telegram',
    subtitle: 'Get instant support, updates, and exclusive offers from our team.',
    cta: 'Message',
    href: 'https://t.me/teamglobalace',
    external: true,
    gradient: 'linear-gradient(135deg, #0088cc 0%, #00C853 100%)',
  },
];

const AUTO_INTERVAL = 5000;

export default function PromoCarousel() {
  const [current, setCurrent] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const goTo = useCallback((idx: number) => {
    const clamped = ((idx % SLIDES.length) + SLIDES.length) % SLIDES.length;
    setCurrent(clamped);
    scrollRef.current?.children[clamped]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'start',
    });
  }, []);

  // Auto-rotate
  useEffect(() => {
    timerRef.current = setInterval(() => goTo(current + 1), AUTO_INTERVAL);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [current, goTo]);

  // Snap-scroll detection
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const w = el.offsetWidth;
        if (w > 0) {
          const idx = Math.round(el.scrollLeft / w);
          setCurrent(idx);
        }
        ticking = false;
      });
    };
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, []);

  /* Shared slide classes */
  const slideClasses =
    'snap-start shrink-0 rounded-xl sm:rounded-2xl p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col justify-end min-h-[120px] sm:min-h-[150px] md:min-h-[180px] lg:min-h-[220px] touch-manipulation';

  return (
    <div className="mb-4 sm:mb-5 md:mb-6 lg:mb-0 overflow-hidden">
      {/* Scrollable track */}
      <div className="relative group">
        <div
          ref={scrollRef}
          className="flex overflow-x-auto snap-x snap-mandatory scrollbar-hide rounded-xl sm:rounded-2xl"
          style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
        >
          {SLIDES.map((s) =>
            s.external ? (
              <a
                key={s.id}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className={slideClasses}
                style={{ background: s.gradient, width: '100%', minWidth: '100%' }}
              >
                <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white mb-0.5 sm:mb-1">{s.title}</h3>
                <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-white/80 mb-2 sm:mb-3 max-w-lg leading-snug">{s.subtitle}</p>
                <span className="inline-block bg-white/20 hover:bg-white/30 backdrop-blur text-white text-[11px] sm:text-xs md:text-sm font-semibold px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 rounded-lg transition-colors self-start">
                  {s.cta}
                </span>
              </a>
            ) : (
              <Link
                key={s.id}
                to={s.href}
                className={slideClasses}
                style={{ background: s.gradient, width: '100%', minWidth: '100%' }}
              >
                <h3 className="text-base sm:text-lg md:text-xl lg:text-2xl font-bold text-white mb-0.5 sm:mb-1">{s.title}</h3>
                <p className="text-[11px] sm:text-xs md:text-sm lg:text-base text-white/80 mb-2 sm:mb-3 max-w-lg leading-snug">{s.subtitle}</p>
                <span className="inline-block bg-white/20 hover:bg-white/30 backdrop-blur text-white text-[11px] sm:text-xs md:text-sm font-semibold px-3 sm:px-4 md:px-5 py-1.5 sm:py-2 rounded-lg transition-colors self-start">
                  {s.cta}
                </span>
              </Link>
            )
          )}
        </div>

        {/* Nav arrows — visible on md+ */}
        <button
          onClick={() => goTo(current - 1)}
          className="hidden md:flex absolute left-2 lg:left-3 top-1/2 -translate-y-1/2 w-8 h-8 lg:w-10 lg:h-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4 lg:w-5 lg:h-5" />
        </button>
        <button
          onClick={() => goTo(current + 1)}
          className="hidden md:flex absolute right-2 lg:right-3 top-1/2 -translate-y-1/2 w-8 h-8 lg:w-10 lg:h-10 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Next slide"
        >
          <ChevronRight className="w-4 h-4 lg:w-5 lg:h-5" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-2.5 sm:mt-3" role="tablist">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === current}
            aria-label={`Slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-1.5 sm:h-2 rounded-full transition-all duration-300 touch-manipulation ${
              i === current ? 'w-5 sm:w-6' : 'w-1.5 sm:w-2 opacity-40'
            }`}
            style={{ backgroundColor: 'var(--casino-highlight-gold)' }}
          />
        ))}
      </div>
    </div>
  );
}
