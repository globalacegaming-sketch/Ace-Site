import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, User, MessageCircle, Banknote, Users, Gift, ChevronLeft, ChevronRight, Play, Loader2, Headphones, Info } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBalancePolling } from '../hooks/useBalancePolling';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import WelcomeBonusBanner from '../components/WelcomeBonusBanner';
import PromoCarousel from '../components/PromoCarousel';
import { PageMeta } from '../components/PageMeta';
import { CosmicCard, PageShell, Section } from '../components/cosmic';
import { useMusic } from '../contexts/MusicContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiBaseUrl, getGamesApiUrl } from '../utils/api';
import { trackFeature } from '../services/analyticsTracker';

interface GameItem {
  kindId: number;
  gameName: string;
  gameType: string;
  gameLogo: string;
}

const QUICK_ACTIONS = [
  { to: '/games', icon: Gamepad2, label: 'Games', desc: 'Browse & play your favourite games', grad: 'linear-gradient(135deg, #FFD700, #FFA000)', shadow: 'rgba(255,215,0,0.25)', dark: true },
  { to: '/bonuses', icon: Gift, label: 'Bonuses', desc: 'Claim active offers and rewards', grad: 'linear-gradient(135deg, #00C853, #00A844)', shadow: 'rgba(0,200,83,0.25)', dark: false },
  { to: '/profile', icon: User, label: 'Profile', desc: 'Update your account info', grad: 'linear-gradient(135deg, #6A1B9A, #00B0FF)', shadow: 'rgba(106,27,154,0.25)', dark: false },
  { to: '/referrals', icon: Users, label: 'Referrals', desc: 'Invite friends & earn rewards', grad: 'linear-gradient(135deg, #E040FB, #7C4DFF)', shadow: 'rgba(224,64,251,0.25)', dark: false },
  { to: '/loans', icon: Banknote, label: 'Loans', desc: 'Request short-term zero-interest loans', grad: 'linear-gradient(135deg, #FF6F00, #FF8F00)', shadow: 'rgba(255,111,0,0.25)', dark: true },
  { to: '/chat', icon: MessageCircle, label: 'Chat', desc: 'Live support — message our team', grad: 'linear-gradient(135deg, #00B0FF, #0091EA)', shadow: 'rgba(0,176,255,0.25)', dark: false },
  { to: '/support', icon: Headphones, label: 'Support', desc: 'Help center, tickets & FAQs', grad: 'linear-gradient(135deg, #26A69A, #00897B)', shadow: 'rgba(38,166,154,0.25)', dark: false },
  { to: '/about-us', icon: Info, label: 'About Us', desc: 'Our platform, games & mission', grad: 'linear-gradient(135deg, #5C6BC0, #3949AB)', shadow: 'rgba(92,107,192,0.25)', dark: false },
] as const;

const RECENT_KEY = 'gag-recent-games';

function useGameCarousels() {
  const [allGames, setAllGames] = useState<GameItem[]>([]);
  const [recentGames, setRecentGames] = useState<GameItem[]>([]);
  const [gamesLoading, setGamesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        setGamesLoading(true);
        const url = getGamesApiUrl();
        const res = await axios.get(url);
        if (cancelled) return;
        if (res.data.success) {
          const list = res.data.data?.data || res.data.data;
          if (Array.isArray(list)) setAllGames(list);
        }
      } catch { /* silent */ }
      if (!cancelled) setGamesLoading(false);
    })();
    try {
      const stored: GameItem[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
      if (Array.isArray(stored)) setRecentGames(stored);
    } catch { /* silent */ }
    return () => { cancelled = true; };
  }, []);

  const randomGames = useMemo(() => {
    if (allGames.length === 0) return [];
    const shuffled = [...allGames].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 15);
  }, [allGames]);

  return { recentGames, randomGames, gamesLoading };
}

function GameCarouselSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="flex gap-2 sm:gap-3 overflow-hidden pb-1">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="shrink-0 w-[120px] sm:w-[140px] md:w-[160px] lg:w-[180px] rounded-xl overflow-hidden casino-bg-secondary casino-border animate-pulse">
          <div className="aspect-square bg-gray-300/20" />
          <div className="p-1.5 sm:p-2 space-y-1">
            <div className="h-3 bg-gray-300/20 rounded w-3/4" />
            <div className="h-2 bg-gray-300/20 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

function GameCarousel({ title, games, icon, loading = false }: { title: string; games: GameItem[]; icon: React.ReactNode; loading?: boolean }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { isAuthenticated, token } = useAuthStore();
  const { stopMusic } = useMusic();
  const navigate = useNavigate();
  const [launchingId, setLaunchingId] = useState<number | null>(null);

  const scroll = (dir: 'left' | 'right') => {
    if (!scrollRef.current) return;
    const w = scrollRef.current.offsetWidth * 0.7;
    scrollRef.current.scrollBy({ left: dir === 'left' ? -w : w, behavior: 'smooth' });
  };

  const handlePlay = async (game: GameItem) => {
    if (!isAuthenticated) {
      if (window.confirm('Please login to play. Go to login?')) navigate('/login');
      return;
    }
    trackFeature('game_launch', 'feature_opened', { gameId: game.kindId, gameName: game.gameName });
    try {
      setLaunchingId(game.kindId);
      stopMusic();
      const res = await axios.post(
        `${getApiBaseUrl()}/fortune-panda-user/enter-game`,
        { kindId: game.kindId.toString() },
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!res.data.success) { toast.error(res.data.message || 'Failed to start game'); return; }
      const url = res.data.data?.webLoginUrl || res.data.data?.gameUrl || res.data.data?.url || res.data.data?.game_url;
      if (!url) { toast.error('Game URL not found'); return; }
      trackFeature('game_launch', 'feature_used', { gameId: game.kindId, gameName: game.gameName });
      try {
        const prev: GameItem[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        localStorage.setItem(RECENT_KEY, JSON.stringify([game, ...prev.filter(g => g.kindId !== game.kindId)].slice(0, 10)));
      } catch { /* */ }
      window.location.href = url;
    } catch (e: any) {
      trackFeature('game_launch', 'feature_failed', { gameId: game.kindId, error: e.response?.data?.message || e.message });
      toast.error(e.response?.data?.message || 'Failed to start game');
    } finally {
      setLaunchingId(null);
    }
  };

  if (!loading && games.length === 0) return null;

  return (
    <div>
      <div className="mb-2 sm:mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {icon}
          <h3 className="cosmic-h3">{title}</h3>
        </div>
        <Link to="/games" className="text-[10px] sm:text-xs md:text-sm font-medium text-yellow-400 hover:text-yellow-300 transition-colors">
          View All
        </Link>
      </div>
      {loading ? (
        <GameCarouselSkeleton />
      ) : (
        <div className="relative group">
          <div
            ref={scrollRef}
            className="flex gap-2 sm:gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1"
            style={{ scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch' }}
          >
            {games.map((game) => (
              <button
                key={game.kindId}
                onClick={() => handlePlay(game)}
                disabled={launchingId === game.kindId}
                className="snap-start shrink-0 w-[120px] sm:w-[140px] md:w-[160px] lg:w-[180px] rounded-xl overflow-hidden casino-bg-secondary casino-border hover:border-yellow-400/60 transition-all active:scale-95 touch-manipulation text-left group/card"
              >
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={game.gameLogo}
                    alt={game.gameName}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover/card:bg-black/40 transition-colors flex items-center justify-center">
                    {launchingId === game.kindId ? (
                      <Loader2 className="w-8 h-8 text-white animate-spin" />
                    ) : (
                      <Play className="w-8 h-8 text-white opacity-0 group-hover/card:opacity-100 transition-opacity drop-shadow-lg" />
                    )}
                  </div>
                </div>
                <div className="p-1.5 sm:p-2">
                  <p className="text-[10px] sm:text-[11px] md:text-xs font-semibold casino-text-primary truncate">{game.gameName}</p>
                  <p className="text-[8px] sm:text-[9px] md:text-[10px] casino-text-secondary truncate">{game.gameType}</p>
                </div>
              </button>
            ))}
          </div>
          <button
            onClick={() => scroll('left')}
            className="hidden md:flex absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1/2 w-8 h-8 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Scroll left"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="hidden md:flex absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-8 h-8 items-center justify-center rounded-full bg-black/60 hover:bg-black/80 text-white opacity-0 group-hover:opacity-100 transition-opacity z-10"
            aria-label="Scroll right"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}

const Dashboard = () => {
  const { user, lastRechargeStatus, token } = useAuthStore();
  const { balance, fetchBalance } = useBalancePolling(30000);
  const [loanBadge, setLoanBadge] = useState(false);
  const { recentGames, randomGames, gamesLoading } = useGameCarousels();

  useEffect(() => {
    if (!token) return;
    const check = async () => {
      try {
        const { data } = await axios.get(`${getApiBaseUrl()}/notifications?limit=10`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (data.success && data.data?.notifications) {
          const hasUnread = data.data.notifications.some(
            (n: any) => !n.isRead && n.link === '/loans'
          );
          setLoanBadge(hasUnread);
        }
      } catch { /* silent */ }
    };
    check();
  }, [token]);

  const handleRefresh = useCallback(async () => {
    await fetchBalance(true);
  }, [fetchBalance]);

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const rechargeColor =
    lastRechargeStatus === 'success' ? '#00C853' :
    lastRechargeStatus === 'failed' ? '#FF5252' :
    lastRechargeStatus === 'processing' ? '#FFB300' : '#888';

  const rechargeLabel =
    lastRechargeStatus === 'success' ? 'Success' :
    lastRechargeStatus === 'failed' ? 'Failed' :
    lastRechargeStatus === 'processing' ? 'Processing' : 'None';

  return (
    <>
      <PageMeta
        title="Dashboard | Global Ace Gaming"
        description="Your Global Ace Gaming dashboard: balance, recent games, bonuses, referrals and quick actions."
        noIndex
      />
      <PullToRefreshIndicator isRefreshing={isRefreshing} pullDistance={pullDistance} />
      <PageShell
        width="7xl"
        background="subtle"
        title={`Welcome back, ${user?.firstName || 'Player'}`}
        subtitle="Ready to play? Pick a game below or use quick actions."
        contentClassName="space-y-4 sm:space-y-5"
      >
        <CosmicCard
          variant="glass"
          padding="md"
          glow
          className="flex items-center justify-between gap-3 overflow-hidden"
        >
          <div className="min-w-0 flex-1">
            <p className="cosmic-label mb-0.5">Balance</p>
            <p className="text-xl font-extrabold leading-none casino-text-primary truncate sm:text-2xl lg:text-3xl">
              ${balance || '0.00'}
            </p>
          </div>
          <div className="shrink-0 text-right">
            <p className="cosmic-label mb-0.5">Last recharge</p>
            <span
              className="inline-block rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap sm:px-3 sm:py-1"
              style={{ backgroundColor: `${rechargeColor}22`, color: rechargeColor }}
            >
              {rechargeLabel}
            </span>
          </div>
        </CosmicCard>

        <PromoCarousel />
        <WelcomeBonusBanner />

        <Section className="py-0">
          <h2 className="cosmic-h3 mb-3">Quick actions</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 sm:gap-3">
            {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc, grad, shadow, dark }) => (
              <Link
                key={to}
                to={to}
                className="group relative block touch-manipulation active:scale-[0.98]"
              >
                <CosmicCard
                  variant="solid"
                  padding="sm"
                  className="flex h-full flex-col items-center text-center transition-all hover:border-[#FFD700]/35"
                >
                  {to === '/loans' && loanBadge && (
                    <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-red-500 animate-pulse sm:h-2.5 sm:w-2.5" />
                  )}
                  <div
                    className="mb-1.5 flex h-9 w-9 items-center justify-center rounded-full transition-transform group-hover:scale-110 sm:mb-2 sm:h-10 sm:w-10"
                    style={{ background: grad, boxShadow: `0 0 12px ${shadow}` }}
                  >
                    <Icon className="h-4 w-4 sm:h-5 sm:w-5" style={{ color: dark ? '#0A0A0F' : '#F5F5F5' }} />
                  </div>
                  <span className="text-[10px] font-semibold leading-tight casino-text-primary sm:text-xs">{label}</span>
                  <span className="mt-0.5 hidden text-[9px] leading-tight casino-text-secondary md:block sm:text-[10px]">{desc}</span>
                </CosmicCard>
              </Link>
            ))}
          </div>
        </Section>

        <Link
          to="/referrals"
          aria-label="Invite friends and earn $10 per referral"
          className="block touch-manipulation active:scale-[0.98]"
        >
          <CosmicCard
            variant="glass"
            padding="md"
            glow
            className="flex items-center justify-between gap-3 transition-all hover:border-[#E040FB]/40"
          >
            <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
              <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full sm:h-11 sm:w-11"
                style={{ background: 'linear-gradient(135deg, #E040FB, #7C4DFF)', boxShadow: '0 0 12px rgba(224,64,251,0.35)' }}
              >
                <Users className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold leading-tight casino-text-primary sm:text-base">
                  Invite friends · Earn $10 each
                </p>
                <p className="cosmic-body truncate text-xs sm:text-sm">
                  Share your code — you both get rewarded
                </p>
              </div>
            </div>
            <span
              className="shrink-0 rounded-lg px-3 py-1.5 text-[11px] font-bold sm:text-xs"
              style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)', color: '#0A0A0F' }}
            >
              Referrals
            </span>
          </CosmicCard>
        </Link>

        <Section className="py-0 space-y-4 sm:space-y-5">
          <GameCarousel
            title="Now Playing"
            games={recentGames}
            icon={<Gamepad2 className="h-4 w-4 text-green-400 sm:h-5 sm:w-5" />}
          />
          <GameCarousel
            title="Games you might like"
            games={randomGames}
            loading={gamesLoading}
            icon={<Gamepad2 className="h-4 w-4 text-yellow-400 sm:h-5 sm:w-5" />}
          />
        </Section>
      </PageShell>
    </>
  );
};

export default Dashboard;
