import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Star } from 'lucide-react';
import { PLAYER_REVIEWS, PLAYER_REVIEWS_STATS } from '../../data/playerReviews';

const ROTATE_MS = 7000;

export function PlayerReviewsSection() {
  const { recommendPercent, totalReviews, source } = PLAYER_REVIEWS_STATS;
  const [index, setIndex] = useState(0);
  const n = PLAYER_REVIEWS.length;

  const go = useCallback(
    (delta: number) => {
      setIndex((i) => (i + delta + n) % n);
    },
    [n],
  );

  useEffect(() => {
    if (n <= 1) return;
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReduced) return;
    const t = window.setInterval(() => go(1), ROTATE_MS);
    return () => window.clearInterval(t);
  }, [go, n]);

  const current = PLAYER_REVIEWS[index];

  return (
    <section
      id="reviews"
      className="relative z-10 scroll-mt-20 border-t border-white/[0.06] bg-[#0A0A0F] px-3 py-10 sm:px-4 sm:py-14 lg:px-8 lg:py-16"
      aria-labelledby="player-reviews-heading"
    >
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p
            className="mb-3 inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider"
            style={{
              background: 'rgba(255, 215, 0, 0.1)',
              border: '1px solid rgba(255, 215, 0, 0.3)',
              color: '#FFD700',
            }}
          >
            <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
            Trusted Player Reviews
          </p>
          <h2
            id="player-reviews-heading"
            className="text-2xl font-bold casino-text-primary sm:text-3xl md:text-4xl"
          >
            {recommendPercent}% recommend Global Ace Gaming
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm casino-text-secondary sm:text-base">
            Based on {totalReviews}+ reviews from {source}
          </p>
        </div>

        <div className="relative mt-8 sm:mt-10">
          <div
            className="rounded-2xl border border-white/10 p-6 sm:rounded-3xl sm:p-10"
            style={{
              background: 'linear-gradient(180deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              boxShadow: '0 24px 60px rgba(0,0,0,0.35)',
            }}
          >
            <div className="flex justify-center gap-0.5" aria-hidden>
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-4 w-4 fill-current sm:h-5 sm:w-5"
                  style={{ color: '#FFD700' }}
                />
              ))}
            </div>

            <blockquote className="mt-5 min-h-[5rem] text-center sm:min-h-[4.5rem]">
              <p
                key={index}
                className="animate-fadeIn text-sm leading-relaxed casino-text-primary sm:text-base lg:text-lg"
              >
                &ldquo;{current.quote}&rdquo;
              </p>
            </blockquote>

            <p className="mt-5 text-center text-sm font-semibold casino-text-primary">
              — {current.author}
            </p>
            <p className="mt-1 text-center text-xs casino-text-secondary">{current.date}</p>
            <p className="mt-2 text-center text-xs casino-text-secondary">
              Recommends Global Ace Gaming
            </p>
          </div>

          {n > 1 ? (
            <>
              <button
                type="button"
                onClick={() => go(-1)}
                className="absolute left-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur-sm transition hover:border-[#FFD700]/40 sm:-left-2 sm:h-11 sm:w-11"
                aria-label="Previous review"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <button
                type="button"
                onClick={() => go(1)}
                className="absolute right-0 top-1/2 z-10 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full border border-white/15 bg-black/80 text-white shadow-lg backdrop-blur-sm transition hover:border-[#FFD700]/40 sm:-right-2 sm:h-11 sm:w-11"
                aria-label="Next review"
              >
                <ChevronRight className="h-5 w-5" />
              </button>
            </>
          ) : null}
        </div>

        {n > 1 ? (
          <div
            className="mt-6 flex justify-center gap-2"
            role="tablist"
            aria-label="Choose a review"
          >
            {PLAYER_REVIEWS.map((review, i) => (
              <button
                key={review.id}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`Show review ${i + 1} of ${n}`}
                onClick={() => setIndex(i)}
                className={`h-2 rounded-full transition-all duration-300 touch-manipulation ${
                  i === index ? 'w-8' : 'w-2 opacity-40'
                }`}
                style={{ backgroundColor: 'var(--casino-highlight-gold)' }}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
