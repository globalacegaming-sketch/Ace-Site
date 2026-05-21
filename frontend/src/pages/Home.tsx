import { useState, useEffect } from 'react';
import { Shield, Zap, Crown, Play } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGamesApiUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { useMusic } from '../contexts/MusicContext';
import { trackFeature } from '../services/analyticsTracker';
import { PageMeta } from '../components/PageMeta';
import { CosmicPageBg } from '../components/cosmic';
import { LazyImage } from '../components/LazyImage';
import { GameCardSkeleton } from '../components/skeletons/GameCardSkeleton';
import { PlayerReviewsSection } from '../components/home/PlayerReviewsSection';
import { HomePlatformsSection } from '../components/home/HomePlatformsSection';
import { HomeSection } from '../components/home/HomeSection';

interface Game {
  kindId: number;
  gameName: string;
  gameType: string;
  gameLogo: string;
}

const WHY_CHOOSE = [
  {
    id: '1',
    title: 'Fast Payouts',
    description: 'Quick deposits and withdrawals with a smooth, hassle-free process.',
    icon: Zap,
  },
  {
    id: '2',
    title: 'Responsive Support',
    description: 'Help with recharges, withdrawals, bonuses, and account questions when we are open.',
    icon: Shield,
  },
  {
    id: '3',
    title: 'Top Platforms',
    description: 'Access recognized gaming platforms through one simple, user-friendly system.',
    icon: Crown,
  },
  {
    id: '4',
    title: 'Trusted Since 2019',
    description: 'Serving players with reliability, fair play, and long-term customer trust.',
    icon: Shield,
  },
] as const;

const Home = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { stopMusic } = useMusic();

  useEffect(() => {
    if (!isAuthenticated) {
      stopMusic();
    }
  }, [isAuthenticated, stopMusic]);

  useEffect(() => {
    fetchGames();
  }, []);

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await axios.get(getGamesApiUrl());
      if (response.data.success) {
        const gamesData = response.data.data?.data || response.data.data;
        setGames(Array.isArray(gamesData) ? gamesData : []);
      } else {
        setError(response.data.message || 'Failed to fetch games');
      }
    } catch {
      setError('Failed to load games. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const popularGames = Array.isArray(games) ? games.slice(0, 3) : [];

  const handleGetStartedClick = () => {
    navigate(isAuthenticated ? '/dashboard' : '/register');
  };

  const handlePlayGame = () => {
    trackFeature('game_launch', 'feature_opened');
    if (isAuthenticated) {
      navigate('/dashboard');
      return;
    }
    if (window.confirm('Please login to play games. Would you like to login now?')) {
      navigate('/login');
    }
  };

  return (
    <>
      <PageMeta
        title="Online Slots, Fish & Table Games | Play in One Place | Global Ace Gaming"
        description="Play online slots, fish, and table games on trusted platforms. Global Ace Gaming — trusted since 2019."
      />
      <div className="w-full min-w-0 bg-[#0A0A0F]">
        {/* 1 — Full-viewport hero (RSG-style) */}
        <section className="relative min-h-[min(88dvh,820px)] w-full overflow-hidden sm:min-h-[min(92dvh,880px)]">
          <CosmicPageBg variant="hero" />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center overflow-hidden">
            <img
              src="/logo.png"
              alt=""
              aria-hidden="true"
              width={500}
              height={500}
              decoding="async"
              fetchPriority="high"
              className="h-64 w-64 max-h-full max-w-full object-contain sm:h-80 sm:w-80 md:h-96 md:w-96 lg:h-[500px] lg:w-[500px]"
              style={{ opacity: 0.2, filter: 'blur(3px)' }}
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          </div>

          <div className="relative z-10 mx-auto flex min-h-[min(88dvh,820px)] w-full max-w-6xl flex-col items-center justify-center px-4 pb-24 pt-16 text-center text-white sm:min-h-[min(92dvh,880px)] sm:px-6 sm:pb-28 sm:pt-20">
            <div className="mb-4 flex items-center justify-center sm:mb-6">
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent sm:w-20" />
              <p className="mx-4 text-base font-light uppercase tracking-[0.2em] text-white/90 sm:mx-6 sm:text-lg md:text-xl lg:text-2xl">
                Welcome to
              </p>
              <div className="h-px w-12 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent sm:w-20" />
            </div>

            <h1
              className="max-w-4xl text-[clamp(2.5rem,8vw,5.5rem)] font-black leading-[1.05] text-[#FFD700]"
              style={{
                letterSpacing: '-0.02em',
                textShadow: '0 2px 8px rgba(0, 0, 0, 0.85), 0 0 40px rgba(255, 215, 0, 0.15)',
              }}
            >
              <span className="block">Global Ace</span>
              <span className="block text-[#FFC107]">Gaming</span>
            </h1>

            <div
              className="mt-5 inline-block rounded-full border px-6 py-2 sm:mt-6 sm:px-8 sm:py-3"
              style={{
                background: 'rgba(255, 215, 0, 0.05)',
                borderColor: 'rgba(255, 215, 0, 0.3)',
                backdropFilter: 'blur(10px)',
              }}
            >
              <p
                className="text-sm font-semibold uppercase tracking-[0.15em] sm:text-base md:text-lg"
                style={{ color: '#FFD700' }}
              >
                America&apos;s Ace Gaming
              </p>
            </div>

            <div className="mt-8 flex w-full max-w-md flex-col items-stretch gap-3 sm:mt-10 sm:max-w-none sm:flex-row sm:items-center sm:justify-center sm:gap-4">
              <button
                type="button"
                onClick={handleGetStartedClick}
                className="min-h-[48px] rounded-full px-8 py-3.5 text-sm font-bold uppercase tracking-wide transition active:scale-95 sm:text-base"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                  color: '#0A0A0F',
                  boxShadow: '0 0 15px rgba(255,215,0,0.25)',
                }}
              >
                Get Started
              </button>
              <a
                href="#platforms"
                className="inline-flex min-h-[48px] items-center justify-center rounded-full border-2 border-[#FFD700]/40 bg-white/5 px-8 py-3.5 text-sm font-semibold uppercase tracking-wide text-white transition hover:bg-white/10 active:scale-95 sm:text-base"
              >
                See Platforms
              </a>
            </div>

            <a
              href="#reviews"
              className="absolute bottom-6 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1 text-white/50 transition hover:text-white/80 sm:bottom-8"
              aria-label="Scroll to reviews"
            >
              <span className="text-[10px] uppercase tracking-widest">Scroll</span>
              <span className="inline-block animate-bounce text-lg leading-none" aria-hidden>
                ↓
              </span>
            </a>
          </div>

          <div
            className="pointer-events-none absolute inset-x-0 bottom-0 z-[1] h-12 bg-gradient-to-t from-[#0A0A0F] to-transparent sm:h-16"
            aria-hidden
          />
        </section>
        {/* 2 — Player reviews (RSG-style carousel) */}
        <PlayerReviewsSection />

        {/* 3 — Operating hours */}
        <HomeSection
          id="hours"
          title="Operating Hours"
          subtitle="Live support and play availability (CST)"
        >
          <div className="mx-auto grid max-w-3xl grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
            <div
              className="flex items-center gap-3 rounded-xl border p-4 sm:gap-4 sm:rounded-2xl sm:p-6"
              style={{ borderColor: 'rgba(34,197,94,0.25)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12"
                style={{ background: 'rgba(34,197,94,0.15)' }}
              >
                <div className="h-3 w-3 rounded-full bg-green-500 sm:h-3.5 sm:w-3.5" />
              </div>
              <div>
                <p className="text-sm font-semibold casino-text-primary sm:text-base">Open</p>
                <p className="text-xs casino-text-secondary sm:text-sm">
                  6:00 PM – 12:00 PM (CST) next day
                </p>
              </div>
            </div>
            <div
              className="flex items-center gap-3 rounded-xl border p-4 sm:gap-4 sm:rounded-2xl sm:p-6"
              style={{ borderColor: 'rgba(239,68,68,0.25)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
            >
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-12 sm:w-12"
                style={{ background: 'rgba(239,68,68,0.15)' }}
              >
                <div className="h-3 w-3 rounded-full bg-red-500 sm:h-3.5 sm:w-3.5" />
              </div>
              <div>
                <p className="text-sm font-semibold casino-text-primary sm:text-base">Closed</p>
                <p className="text-xs casino-text-secondary sm:text-sm">12:00 PM – 6:00 PM (CST)</p>
              </div>
            </div>
          </div>
          <p className="mx-auto mt-5 max-w-xl text-center text-xs italic leading-relaxed casino-text-secondary sm:text-sm">
            Chat and support are available during open hours. We appreciate your patience during
            closed hours.
          </p>
        </HomeSection>

        {/* 4 — Platforms */}
        <HomePlatformsSection />

        {/* 5 — Popular games */}
        <HomeSection
          title="Popular Games"
          subtitle="Try our most played titles—sign up to play for real"
        >
          {loading ? (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {Array.from({ length: 3 }, (_, i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="py-10 text-center">
              <p className="mb-4 text-sm font-semibold sm:text-base" style={{ color: '#E53935' }}>
                {error}
              </p>
              <button
                type="button"
                onClick={fetchGames}
                className="rounded-lg px-6 py-2.5 text-sm font-bold"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                  color: '#0A0A0F',
                }}
              >
                Try Again
              </button>
            </div>
          ) : popularGames.length === 0 ? (
            <p className="text-center text-sm casino-text-secondary">No games available right now.</p>
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-6 lg:grid-cols-3">
              {popularGames.map((game) => (
                <div
                  key={game.kindId}
                  className="group overflow-hidden rounded-xl border casino-border transition hover:border-[#FFD700]/40 sm:rounded-2xl"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  <div className="relative aspect-[4/3] overflow-hidden sm:h-48">
                    <LazyImage src={game.gameLogo} alt={game.gameName} />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/0 transition group-hover:bg-black/40">
                      <button
                        type="button"
                        onClick={handlePlayGame}
                        className="flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-bold opacity-0 transition group-hover:opacity-100"
                        style={{
                          background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                          color: '#0A0A0F',
                        }}
                      >
                        <Play className="h-4 w-4" />
                        {isAuthenticated ? 'Play' : 'Login to Play'}
                      </button>
                    </div>
                  </div>
                  <div className="p-3 sm:p-4">
                    <h3 className="text-sm font-bold casino-text-primary sm:text-base">{game.gameName}</h3>
                    <p className="text-xs casino-text-secondary">{game.gameType}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="mt-6 text-center sm:mt-8">
            <Link
              to="/games"
              className="inline-block rounded-lg px-6 py-2.5 text-sm font-bold transition active:scale-95 sm:py-3 sm:text-base"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                color: '#0A0A0F',
                boxShadow: '0 0 15px rgba(255,215,0,0.25)',
              }}
            >
              View All Games
            </Link>
          </div>
        </HomeSection>

        {/* 6 — Why choose us */}
        <HomeSection
          title="Why Choose Global Ace Gaming?"
          subtitle="Fast, secure, and built around our player community"
        >
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4 lg:gap-6">
            {WHY_CHOOSE.map((feature) => {
              const Icon = feature.icon;
              return (
                <div
                  key={feature.id}
                  className="rounded-xl border casino-border p-4 text-center sm:rounded-2xl sm:p-6"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  <div
                    className="mx-auto mb-3 flex h-11 w-11 items-center justify-center rounded-full sm:mb-4 sm:h-14 sm:w-14"
                    style={{
                      background:
                        'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.08))',
                      border: '1px solid rgba(255,215,0,0.2)',
                    }}
                  >
                    <Icon className="h-5 w-5 sm:h-7 sm:w-7" style={{ color: '#FFD700' }} />
                  </div>
                  <h3 className="mb-1 text-sm font-bold casino-text-primary sm:mb-2 sm:text-base">
                    {feature.title}
                  </h3>
                  <p className="text-[11px] leading-relaxed casino-text-secondary sm:text-xs">
                    {feature.description}
                  </p>
                </div>
              );
            })}
          </div>
        </HomeSection>

        {/* 7 — Final CTA */}
        <section className="relative z-10 border-t border-white/[0.06] px-3 py-12 sm:px-4 sm:py-16 lg:px-8 lg:py-20">
          <div className="mx-auto max-w-4xl">
            <div
              className="rounded-2xl p-6 text-center sm:rounded-3xl sm:p-10"
              style={{
                background:
                  'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(139,0,0,0.2) 50%, rgba(255,215,0,0.1) 100%)',
                border: '1px solid rgba(255,215,0,0.2)',
                boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
              }}
            >
              <h2 className="text-xl font-bold casino-text-primary sm:text-3xl">
                Ready to Start Your Gaming Journey?
              </h2>
              <p className="mx-auto mt-3 max-w-xl text-sm casino-text-secondary sm:mt-4 sm:text-base">
                Create your free account, pick a platform, and join players who trust Global Ace
                Gaming since 2019.
              </p>
              <div className="mt-6 flex flex-col justify-center gap-3 sm:mt-8 sm:flex-row">
                <button
                  type="button"
                  onClick={handleGetStartedClick}
                  className="min-h-[48px] rounded-lg px-8 py-3 text-sm font-bold transition active:scale-95 sm:text-base"
                  style={{
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                    color: '#0A0A0F',
                    boxShadow: '0 0 15px rgba(255,215,0,0.25)',
                  }}
                >
                  Get Started Now
                </button>
                <Link
                  to="/about-us"
                  className="inline-flex min-h-[48px] items-center justify-center rounded-lg border-2 px-8 py-3 text-sm font-semibold casino-text-primary transition active:scale-95 sm:text-base"
                  style={{ borderColor: 'rgba(255,215,0,0.4)', background: 'rgba(255,255,255,0.04)' }}
                >
                  About Us
                </Link>
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
};

export default Home;
