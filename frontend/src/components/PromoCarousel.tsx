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

  return (
    <div className="mb-6 sm:mb-8">
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
                className="snap-start flex-shrink-0 w-full rounded-xl sm:rounded-2xl p-5 sm:p-8 flex flex-col justify-end min-h-[140px] sm:min-h-[180px] touch-manipulation"
                style={{ background: s.gradient }}
              >
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{s.title}</h3>
                <p className="text-xs sm:text-sm text-white/80 mb-3 max-w-md">{s.subtitle}</p>
                <span className="inline-block bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors self-start">
                  {s.cta}
                </span>
              </a>
            ) : (
              <Link
                key={s.id}
                to={s.href}
                className="snap-start flex-shrink-0 w-full rounded-xl sm:rounded-2xl p-5 sm:p-8 flex flex-col justify-end min-h-[140px] sm:min-h-[180px] touch-manipulation"
                style={{ background: s.gradient }}
              >
                <h3 className="text-lg sm:text-xl font-bold text-white mb-1">{s.title}</h3>
                <p className="text-xs sm:text-sm text-white/80 mb-3 max-w-md">{s.subtitle}</p>
                <span className="inline-block bg-white/20 hover:bg-white/30 backdrop-blur text-white text-xs sm:text-sm font-semibold px-4 py-2 rounded-lg transition-colors self-start">
                  {s.cta}
                </span>
              </Link>
            )
          )}
        </div>

        {/* Desktop arrows */}
        <button
          onClick={() => goTo(current - 1)}
          className="hidden sm:flex absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Previous slide"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <button
          onClick={() => goTo(current + 1)}
          className="hidden sm:flex absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
          aria-label="Next slide"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-3" role="tablist">
        {SLIDES.map((s, i) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={i === current}
            aria-label={`Slide ${i + 1}`}
            onClick={() => goTo(i)}
            className={`h-1.5 rounded-full transition-all duration-300 touch-manipulation ${
              i === current ? 'w-6' : 'w-1.5 opacity-40'
            }`}
            style={{ backgroundColor: 'var(--casino-highlight-gold)' }}
          />
        ))}
      </div>
    </div>
  );
}
