import { useState, useEffect, useMemo, useCallback } from 'react';
import { Play, Loader2, ChevronDown } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl, getGamesApiUrl } from '../utils/api';
import { useMusic } from '../contexts/MusicContext';
import { PageMeta } from '../components/PageMeta';
import { GameCardSkeleton } from '../components/skeletons/GameCardSkeleton';
import { LazyImage } from '../components/LazyImage';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import { triggerHaptic } from '../utils/haptic';

/* ── Game-type card data (visible above the fold) ── */
const GAME_TYPE_CARDS = [
  { icon: '🎰', title: 'Online Slots', desc: 'Video slot-style games with multiple themes. Play on desktop or mobile.' },
  { icon: '🎣', title: 'Online Fish Games', desc: 'Fish table and arcade-style play. Skill-based with community jackpots.' },
  { icon: '🎲', title: 'Online Table Games', desc: 'Live and table-style games for a social, real-time experience.' },
  { icon: '⚽', title: 'Sports-Style Games', desc: 'Sports-themed games in the same lobby. One account, one place.' },
] as const;

interface Game {
  kindId: number;
  gameName: string;
  gameType: string;
  gameLogo: string;
}

const CATEGORY_MAP: Record<string, string[]> = {
  Slots: ['SLOT'],
  Fishing: ['FISH'],
  Live: ['LIVE', 'POKER'],
  Sports: ['SPORT', 'SPORTS'],
};

const CATEGORIES = [
  { name: 'All', icon: '🎮', color: '#6A1B9A' },
  { name: 'Slots', icon: '🎰', color: '#00C853' },
  { name: 'Fishing', icon: '🎣', color: '#00B0FF' },
  { name: 'Live', icon: '🎲', color: '#E53935' },
  { name: 'Sports', icon: '⚽', color: '#FFD700' },
] as const;

const Games = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingGame, setPlayingGame] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const { isAuthenticated } = useAuthStore();
  const { stopMusic } = useMusic();
  const navigate = useNavigate();

  const fetchGames = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const GAMES_API_URL = getGamesApiUrl();
      const response = await axios.get(GAMES_API_URL);

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
  }, []);

  useEffect(() => {
    fetchGames();
  }, [fetchGames]);

  // Pull-to-refresh wired up
  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: fetchGames,
    disabled: loading,
  });

  // Memoised filtered list — avoids re-filtering on every render
  const filteredGames = useMemo(() => {
    if (!Array.isArray(games)) return [];
    if (selectedCategory === 'All') return games;
    const types = CATEGORY_MAP[selectedCategory] || [];
    return games.filter((g) => types.includes(g.gameType));
  }, [games, selectedCategory]);

  const handlePlayGame = useCallback(
    async (game: Game) => {
      if (!isAuthenticated) {
        const shouldLogin = window.confirm(
          'Please login to play games. Would you like to login now?',
        );
        if (shouldLogin) navigate('/login');
        return;
      }

      try {
        triggerHaptic('medium');
        stopMusic();
        setPlayingGame(game.kindId);

        const API_BASE_URL = getApiBaseUrl();

        // Non-blocking balance check
        try {
          await axios.get(`${API_BASE_URL}/fortune-panda-user/balance`, {
            headers: { Authorization: `Bearer ${useAuthStore.getState().token}` },
          });
        } catch {
          // Continue
        }

        try {
          const gameResponse = await axios.post(
            `${API_BASE_URL}/fortune-panda-user/enter-game`,
            { kindId: game.kindId.toString() },
            { headers: { Authorization: `Bearer ${useAuthStore.getState().token}` } },
          );

          if (!gameResponse.data.success) {
            toast.error(gameResponse.data.message || 'Failed to start game. Please try again.');
            triggerHaptic('error');
            return;
          }

          const gameUrl =
            gameResponse.data.data?.webLoginUrl ||
            gameResponse.data.data?.gameUrl ||
            gameResponse.data.data?.url ||
            gameResponse.data.data?.game_url ||
            gameResponse.data.data?.loginUrl ||
            gameResponse.data.data?.login_url;

          if (!gameUrl) {
            toast.error('Game URL not found. Please contact support or try again.');
            triggerHaptic('error');
            return;
          }

          triggerHaptic('success');
          try {
            const MAX_RECENT = 10;
            const key = 'gag-recent-games';
            const prev: Game[] = JSON.parse(localStorage.getItem(key) || '[]');
            const next = [game, ...prev.filter(g => g.kindId !== game.kindId)].slice(0, MAX_RECENT);
            localStorage.setItem(key, JSON.stringify(next));
          } catch { /* non-critical */ }
          window.location.href = gameUrl;
          toast.success('Game launching...', { duration: 2000 });
        } catch (error: any) {
          toast.error(
            error.response?.data?.message || error.message || 'Failed to start game.',
          );
          triggerHaptic('error');
        }
      } catch (error: any) {
        toast.error(error.message || 'An unexpected error occurred.');
        triggerHaptic('error');
      } finally {
        setPlayingGame(null);
      }
    },
    [isAuthenticated, navigate, stopMusic],
  );

  const handleCategoryChange = useCallback((name: string) => {
    triggerHaptic('light');
    setSelectedCategory(name);
  }, []);

  // ——— SEO FAQ schema ———
  const faqItems: { q: string; a: string }[] = [
    { q: 'What types of games does Global Ace Gaming offer?', a: 'We offer online slots, online fish games, online table games, and sports-style games. You can browse and filter them in the main games lobby.' },
    { q: 'How do I start playing?', a: 'Create an account, open the games section, and pick a category (slots, fish, table, or sports). Choose a game and follow the on-screen instructions. For more detail, see the how to play section on this page.' },
    { q: 'Are these the same as Milkyway, Orionstars, Juwa, Gamevault, or Firekirin?', a: 'We offer similar styles of games—online slots, fish/redemption, online table games, and sports—in one platform. We don\'t run those brands; we provide a place to discover and play these kinds of experiences.' },
    { q: 'Is it safe to play?', a: 'We use secure sign-in and take care with your data. For specific security or legal questions, check our Support page and site policies. We focus on clear information and support.' },
    { q: 'How can I get help?', a: 'Visit our Support page for FAQs, contact options, and responsible gaming resources.' },
    { q: 'Where can I see bonuses?', a: 'Check the Bonuses page for current offers and how to use them across our games.' },
  ];

  const faqSchema = useMemo(
    () => ({
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map(({ q, a }) => ({
        '@type': 'Question',
        name: q,
        acceptedAnswer: { '@type': 'Answer', text: a },
      })),
    }),
    [],
  );

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(faqSchema);
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [faqSchema]);

  return (
    <div
      className="min-h-screen pt-16"
      style={{
        background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)',
      }}
    >
      <PageMeta
        title="Online Slots, Fish, Table & Sports Games | Global Ace Gaming"
        description="Play online slots, online fish games, online table games, and sports in one platform. Bonuses, how to play, and support. Get started in minutes."
      />

      {/* Pull-to-refresh visual indicator */}
      <PullToRefreshIndicator isRefreshing={isRefreshing} pullDistance={pullDistance} />

      {/* Decorative glowing orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-40 animate-pulse" style={{ backgroundColor: '#6A1B9A' }} />
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-35" style={{ backgroundColor: '#00B0FF' }} />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-30 animate-pulse" style={{ backgroundColor: '#FFD700' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* H1 + intro */}
        <div className="text-center mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold casino-text-primary mb-1.5 sm:mb-2">
            Online Slots, Fish, Table & Sports Games in One Place
          </h1>
          <p className="text-sm casino-text-secondary px-2 max-w-2xl mx-auto">
            Play <strong className="casino-text-primary">online slots</strong>,{' '}
            <strong className="casino-text-primary">online fish games</strong>, and{' '}
            <strong className="casino-text-primary">online table games</strong> from one
            platform. Pick a category below to start.
          </p>
        </div>

        {/* Category filter — touch-optimised with active:scale */}
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 lg:gap-3 mb-4 sm:mb-6 lg:mb-8 px-1 sm:px-2">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.name}
              className={`px-3 sm:px-4 lg:px-6 py-2 sm:py-2.5 lg:py-3 rounded-lg sm:rounded-xl lg:rounded-2xl font-bold transition-all flex items-center gap-1.5 sm:gap-2 lg:gap-3 text-xs sm:text-sm lg:text-base shadow-lg active:scale-95 touch-manipulation ${
                selectedCategory === cat.name
                  ? 'text-white shadow-2xl scale-105'
                  : 'casino-bg-secondary backdrop-blur-lg casino-text-secondary hover:casino-text-primary casino-border'
              }`}
              style={
                selectedCategory === cat.name
                  ? {
                      background: `linear-gradient(135deg, ${cat.color} 0%, ${cat.color}80 100%)`,
                      borderColor: cat.color,
                      boxShadow: `0 0 20px ${cat.color}40`,
                    }
                  : undefined
              }
              onClick={() => handleCategoryChange(cat.name)}
            >
              <span className="text-sm sm:text-base lg:text-lg">{cat.icon}</span>
              <span>{cat.name}</span>
            </button>
          ))}
        </div>

        {/* ——— Content ——— */}
        {loading ? (
          /* Skeleton grid — perceived as 2× faster than a single spinner */
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 xl:gap-6 px-1 sm:px-2">
            {Array.from({ length: 10 }, (_, i) => (
              <GameCardSkeleton key={i} />
            ))}
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="casino-bg-secondary backdrop-blur-lg rounded-2xl p-10 max-w-md mx-auto casino-border shadow-lg">
              <p className="casino-text-primary mb-6 text-lg font-semibold" style={{ color: '#E53935' }}>
                {error}
              </p>
              <button
                onClick={fetchGames}
                className="btn-casino-primary py-3 px-8 rounded-full font-bold transition-all shadow-lg active:scale-95 touch-manipulation"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20">
            <p className="casino-text-secondary text-lg">No games available right now</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 xl:gap-6 px-1 sm:px-2">
            {filteredGames.map((game) => (
              <div
                key={game.kindId}
                className="group relative casino-bg-secondary backdrop-blur-lg rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden casino-border hover:border-yellow-400/80 shadow-lg hover:shadow-[0_0_30px_rgba(255,215,0,0.6)] transition-all duration-500 transform hover:scale-105"
              >
                {/* Game Image — lazy loaded with Cloudinary optimisation */}
                <div className="relative aspect-square overflow-hidden">
                  <LazyImage
                    src={game.gameLogo}
                    alt={game.gameName}
                    className="group-hover:scale-110 transition-transform duration-500"
                  />
                  {/* Game Type Badge */}
                  <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
                    <span
                      className="text-white text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-bold shadow-lg backdrop-blur-sm"
                      style={{
                        background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
                        border: '1px solid #2C2C3A',
                      }}
                    >
                      {game.gameType}
                    </span>
                  </div>
                  {/* Overlay Play Button */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                    <button
                      onClick={() => handlePlayGame(game)}
                      disabled={playingGame === game.kindId}
                      className="btn-casino-primary py-1.5 sm:py-2 lg:py-3 xl:py-4 px-3 sm:px-4 lg:px-6 xl:px-8 rounded-lg sm:rounded-xl lg:rounded-2xl hover:scale-110 transition-all duration-300 disabled:opacity-50 shadow-2xl hover:shadow-[0_0_25px_rgba(255,215,0,0.8)] transform hover:-translate-y-1 text-xs sm:text-sm active:scale-95 touch-manipulation"
                    >
                      {playingGame === game.kindId ? (
                        <>
                          <Loader2 className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 mr-1 sm:mr-2 inline animate-spin" />
                          <span className="hidden sm:inline">Loading...</span>
                          <span className="sm:hidden">...</span>
                        </>
                      ) : (
                        <>
                          <Play className="w-3 h-3 sm:w-4 sm:h-4 lg:w-5 lg:h-5 mr-1 sm:mr-2 inline" />
                          <span className="hidden sm:inline">
                            {isAuthenticated ? 'PLAY NOW' : 'LOGIN TO PLAY'}
                          </span>
                          <span className="sm:hidden">
                            {isAuthenticated ? 'PLAY' : 'LOGIN'}
                          </span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Game Info */}
                <div className="p-2 sm:p-3 lg:p-4 xl:p-5">
                  <h3 className="text-xs sm:text-sm lg:text-base xl:text-lg font-bold casino-text-primary truncate group-hover:text-yellow-400 transition-colors duration-300">
                    {game.gameName}
                  </h3>
                  <div className="mt-1 sm:mt-2 flex items-center justify-between">
                    <span className="text-xs casino-text-secondary font-medium">
                      {game.gameType}
                    </span>
                    <div
                      className="w-1 h-1 sm:w-1.5 sm:h-1.5 lg:w-2 lg:h-2 rounded-full animate-pulse"
                      style={{ backgroundColor: '#00C853' }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════
            SEO CONTENT — restructured for clean mobile UX:
            1. Visible intro + compact game-type cards (always shown)
            2. Expandable "Read more" via <details> (content in DOM for crawlers)
            3. Full semantic structure (section > article, h2 > h3)
           ═══════════════════════════════════════════════════════════ */}
        <div className="border-t border-white/10 pt-6 sm:pt-8 mt-6 sm:mt-8">

          {/* ── 1. Visible: Game-type cards ── */}
          <section id="game-types" className="mb-6 sm:mb-8" aria-label="Game categories">
            <h2 className="text-base sm:text-lg font-bold casino-text-primary mb-3 sm:mb-4">
              What Kinds of Games Can You Play?
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {GAME_TYPE_CARDS.map((card) => (
                <article
                  key={card.title}
                  className="rounded-xl p-3 sm:p-4 border transition-colors duration-200"
                  style={{
                    backgroundColor: 'rgba(27, 27, 47, 0.6)',
                    borderColor: '#2C2C3A',
                  }}
                >
                  <span className="text-xl sm:text-2xl block mb-1.5" aria-hidden="true">{card.icon}</span>
                  <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1 leading-tight">
                    {card.title}
                  </h3>
                  <p className="text-[11px] sm:text-xs casino-text-secondary leading-snug">
                    {card.desc}
                  </p>
                </article>
              ))}
            </div>
          </section>

          {/* ── 2. Expandable: How to play, bonuses & more ── */}
          <details className="group seo-details mb-3 sm:mb-4">
            <summary
              className="flex items-center justify-between gap-2 cursor-pointer select-none list-none rounded-xl px-4 py-3 text-sm sm:text-base font-semibold casino-text-primary transition-colors duration-200 touch-manipulation active:scale-[0.98]"
              style={{ backgroundColor: 'rgba(27, 27, 47, 0.6)', border: '1px solid #2C2C3A' }}
            >
              <span>How to play, bonuses & more</span>
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 casino-text-secondary transition-transform duration-300 group-open:rotate-180 flex-shrink-0" />
            </summary>

            <div className="pt-4 sm:pt-5 space-y-5 sm:space-y-6">
              {/* How to Get Started */}
              <section id="how-to-play" className="rounded-xl p-3 sm:p-4" style={{ backgroundColor: 'rgba(27, 27, 47, 0.5)', border: '1px solid #2C2C3A' }}>
                <h2 className="text-sm sm:text-base font-bold casino-text-primary mb-2">How to Get Started</h2>
                <p className="text-xs sm:text-sm casino-text-secondary mb-2">You don't need to be an expert to play online slots, online fish games, or online table games here.</p>
                <ol className="list-decimal list-inside space-y-1.5 text-xs sm:text-sm casino-text-secondary">
                  <li><strong className="casino-text-primary">Create an account</strong> — Register with your email. Quick and secure.</li>
                  <li><strong className="casino-text-primary">Explore the lobby</strong> — Games are grouped by type: slots, fish, table, and sports.</li>
                  <li><strong className="casino-text-primary">Pick a game and play</strong> — For tips and FAQs, see <Link to="/support" className="text-yellow-400 hover:underline">Support</Link>.</li>
                </ol>
              </section>

              {/* Bonuses */}
              <section>
                <h2 className="text-sm sm:text-base font-bold casino-text-primary mb-1.5">Bonuses and Promotions</h2>
                <p className="text-xs sm:text-sm casino-text-secondary">
                  We run bonuses across all game types. See what's available on our{' '}
                  <Link to="/bonuses" className="text-yellow-400 hover:underline">Bonuses</Link> page. Terms are described clearly for each offer.
                </p>
              </section>

              {/* Why Choose */}
              <section className="rounded-xl p-3 sm:p-4" style={{ backgroundColor: 'rgba(27, 27, 47, 0.5)', border: '1px solid #2C2C3A' }}>
                <h2 className="text-sm sm:text-base font-bold casino-text-primary mb-2">Why Choose Global Ace Gaming?</h2>
                <ul className="space-y-1.5 text-xs sm:text-sm casino-text-secondary">
                  <li><strong className="casino-text-primary">One place for all game types</strong> — Online slots, fish, table, and sports. One account, one lobby.</li>
                  <li><strong className="casino-text-primary">Desktop & mobile</strong> — Games run in the browser. No extra software.</li>
                  <li><strong className="casino-text-primary">Support when you need it</strong> — <Link to="/support" className="text-yellow-400 hover:underline">Contact our team</Link> or check responsible gaming resources.</li>
                </ul>
              </section>

            </div>
          </details>

          {/* ── 3. Expandable: FAQ (separate section) ── */}
          <details className="group seo-details mb-6 sm:mb-8">
            <summary
              className="flex items-center justify-between gap-2 cursor-pointer select-none list-none rounded-xl px-4 py-3 text-sm sm:text-base font-semibold casino-text-primary transition-colors duration-200 touch-manipulation active:scale-[0.98]"
              style={{ backgroundColor: 'rgba(27, 27, 47, 0.6)', border: '1px solid #2C2C3A' }}
            >
              <span>Frequently Asked Questions</span>
              <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 casino-text-secondary transition-transform duration-300 group-open:rotate-180 flex-shrink-0" />
            </summary>

            <div className="pt-4 sm:pt-5">
              <dl className="space-y-2">
                {faqItems.map(({ q, a }) => (
                  <details
                    key={q}
                    className="group/faq rounded-lg overflow-hidden"
                    style={{ backgroundColor: 'rgba(27, 27, 47, 0.4)', border: '1px solid #2C2C3A' }}
                  >
                    <summary className="flex items-center justify-between gap-2 cursor-pointer select-none list-none px-3 py-2.5 text-xs sm:text-sm font-medium casino-text-primary touch-manipulation active:scale-[0.99]">
                      <dt className="pr-2">{q}</dt>
                      <ChevronDown className="w-3.5 h-3.5 casino-text-secondary transition-transform duration-200 group-open/faq:rotate-180 flex-shrink-0" />
                    </summary>
                    <dd className="px-3 pb-3 pt-0 text-xs sm:text-sm casino-text-secondary leading-relaxed">
                      {a}
                    </dd>
                  </details>
                ))}
              </dl>
            </div>
          </details>

          {/* ── CTA — always visible at the very bottom ── */}
          <section className="text-center py-4 sm:py-6">
            <h2 className="text-sm sm:text-base font-bold casino-text-primary mb-1.5">Ready to Explore?</h2>
            <p className="text-xs sm:text-sm casino-text-secondary">
              <Link to="/games" className="text-yellow-400 hover:underline">Browse games</Link>{' · '}
              <Link to="/bonuses" className="text-yellow-400 hover:underline">See bonuses</Link>{' · '}
              <Link to="/support" className="text-yellow-400 hover:underline">Get support</Link>
            </p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Games;
