import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gamepad2, Wallet, User, MessageCircle, ArrowRight, Banknote, Users, ChevronLeft, ChevronRight, Play, Loader2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBalancePolling } from '../hooks/useBalancePolling';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import WelcomeBonusBanner from '../components/WelcomeBonusBanner';
import PromoCarousel from '../components/PromoCarousel';
import { useMusic } from '../contexts/MusicContext';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiBaseUrl, getGamesApiUrl } from '../utils/api';

interface GameItem {
  kindId: number;
  gameName: string;
  gameType: string;
  gameLogo: string;
}

const QUICK_ACTIONS = [
  { to: '/games', icon: Gamepad2, label: 'Games', desc: 'Browse & play your favourite games', grad: 'linear-gradient(135deg, #FFD700, #FFA000)', shadow: 'rgba(255,215,0,0.25)', dark: true },
  { to: '/wallet', icon: Wallet, label: 'Wallet', desc: 'Deposit, withdraw & transactions', grad: 'linear-gradient(135deg, #00C853, #00A844)', shadow: 'rgba(0,200,83,0.25)', dark: false },
  { to: '/profile', icon: User, label: 'Profile', desc: 'Update your account info', grad: 'linear-gradient(135deg, #6A1B9A, #00B0FF)', shadow: 'rgba(106,27,154,0.25)', dark: false },
  { to: '/support', icon: MessageCircle, label: 'Support', desc: 'Get help & contact us', grad: 'linear-gradient(135deg, #00B0FF, #0091EA)', shadow: 'rgba(0,176,255,0.25)', dark: false },
  { to: '/loans', icon: Banknote, label: 'Loans', desc: 'Request short-term zero-interest loans', grad: 'linear-gradient(135deg, #FF6F00, #FF8F00)', shadow: 'rgba(255,111,0,0.25)', dark: true },
  { to: '/referrals', icon: Users, label: 'Referrals', desc: 'Invite friends & earn rewards', grad: 'linear-gradient(135deg, #E040FB, #7C4DFF)', shadow: 'rgba(224,64,251,0.25)', dark: false },
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
      try {
        const prev: GameItem[] = JSON.parse(localStorage.getItem(RECENT_KEY) || '[]');
        localStorage.setItem(RECENT_KEY, JSON.stringify([game, ...prev.filter(g => g.kindId !== game.kindId)].slice(0, 10)));
      } catch { /* */ }
      window.location.href = url;
    } catch (e: any) {
      toast.error(e.response?.data?.message || 'Failed to start game');
    } finally {
      setLaunchingId(null);
    }
  };

  if (!loading && games.length === 0) return null;

  return (
    <div className="mb-3 sm:mb-4 md:mb-5 lg:mb-6">
      <div className="flex items-center justify-between mb-2 sm:mb-3">
        <div className="flex items-center gap-1.5 sm:gap-2">
          {icon}
          <h3 className="text-sm sm:text-base md:text-lg font-bold casino-text-primary">{title}</h3>
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
    <div
      className="min-h-screen pb-4 sm:pb-6 lg:pb-10 w-full max-w-full overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)' }}
    >
      <PullToRefreshIndicator isRefreshing={isRefreshing} pullDistance={pullDistance} />

      {/* Decorative orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none" style={{ zIndex: 0 }} aria-hidden>
        <div className="absolute top-20 left-10 w-40 sm:w-56 md:w-64 lg:w-80 h-40 sm:h-56 md:h-64 lg:h-80 rounded-full blur-3xl opacity-20 sm:opacity-25 lg:opacity-30 animate-pulse" style={{ backgroundColor: '#6A1B9A' }} />
        <div className="absolute bottom-20 right-10 w-44 sm:w-60 md:w-72 lg:w-96 h-44 sm:h-60 md:h-72 lg:h-96 rounded-full blur-3xl opacity-15 sm:opacity-20 lg:opacity-25" style={{ backgroundColor: '#00B0FF' }} />
      </div>

      <div className="relative z-10 w-full max-w-7xl mx-auto px-3 sm:px-5 md:px-6 lg:px-8 pt-3 sm:pt-4 md:pt-5 lg:pt-6" style={{ boxSizing: 'border-box' }}>

        {/* ── Welcome ── */}
        <div className="mb-3 sm:mb-4 md:mb-5 lg:mb-6">
          <h1 className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-bold casino-text-primary leading-tight">
            Welcome back, {user?.firstName || 'Player'}!
          </h1>
          <p className="text-[11px] sm:text-xs md:text-sm lg:text-base casino-text-secondary mt-0.5">
            Ready to play? Pick your next game below.
          </p>
        </div>

        {/* ── Balance + Status ── */}
        <div
          className="rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 lg:p-6 xl:p-8 mb-3 sm:mb-4 md:mb-5 lg:mb-6 flex items-center justify-between gap-3 overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(255,215,0,0.15)',
          }}
        >
          <div className="min-w-0 flex-1">
            <p className="text-[10px] sm:text-[11px] md:text-xs uppercase tracking-wider casino-text-secondary mb-0.5">Balance</p>
            <h2 className="text-lg sm:text-xl md:text-2xl lg:text-3xl xl:text-4xl font-extrabold casino-text-primary leading-none truncate">
              ${balance || '0.00'}
            </h2>
          </div>
          <div className="text-right shrink-0">
            <p className="text-[10px] sm:text-[11px] md:text-xs uppercase tracking-wider casino-text-secondary mb-0.5">Last Recharge</p>
            <span
              className="inline-block px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-[11px] md:text-xs font-semibold whitespace-nowrap"
              style={{ backgroundColor: `${rechargeColor}22`, color: rechargeColor }}
            >
              {rechargeLabel}
            </span>
          </div>
        </div>

        {/* ── Promo carousel ── */}
        <div className="mb-3 sm:mb-4 md:mb-5 lg:mb-6">
          <PromoCarousel />
        </div>

        {/* ── Welcome Bonus (new users only) ── */}
        <WelcomeBonusBanner />

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-6 gap-2 sm:gap-2.5 md:gap-3 lg:gap-4 mb-3 sm:mb-4 md:mb-5 lg:mb-6">
          {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc, grad, shadow, dark }) => (
            <Link
              key={to}
              to={to}
              className="relative flex flex-col items-center py-2.5 sm:py-3 md:py-4 lg:py-5 px-1.5 sm:px-2 rounded-xl sm:rounded-2xl casino-bg-secondary casino-border active:scale-95 hover:scale-[1.02] transition-all touch-manipulation group"
            >
              {to === '/loans' && loanBadge && (
                <span className="absolute top-1.5 right-1.5 sm:top-2 sm:right-2 w-2 h-2 sm:w-2.5 sm:h-2.5 bg-red-500 rounded-full animate-pulse" />
              )}
              <div
                className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 lg:w-12 lg:h-12 rounded-full flex items-center justify-center mb-1 sm:mb-1.5 md:mb-2 group-hover:scale-110 transition-transform"
                style={{ background: grad, boxShadow: `0 0 12px ${shadow}` }}
              >
                <Icon className="w-4 h-4 sm:w-5 sm:h-5 md:w-5 md:h-5 lg:w-6 lg:h-6" style={{ color: dark ? '#0A0A0F' : '#F5F5F5' }} />
              </div>
              <span className="text-[10px] sm:text-[11px] md:text-xs lg:text-sm font-semibold casino-text-primary text-center leading-tight">{label}</span>
              <span className="text-[8px] sm:text-[9px] md:text-[10px] lg:text-xs casino-text-secondary mt-0.5 text-center leading-tight hidden md:block">{desc}</span>
            </Link>
          ))}
        </div>

        {/* ── Wallet shortcut bar ── */}
        <Link
          to="/wallet"
          className="flex items-center justify-between rounded-xl sm:rounded-2xl p-2.5 sm:p-3 md:p-4 lg:p-5 casino-bg-secondary casino-border mb-3 sm:mb-4 md:mb-5 lg:mb-6 active:scale-[0.98] hover:border-green-500/30 transition-all touch-manipulation"
        >
          <div className="flex items-center gap-2 sm:gap-2.5 md:gap-3">
            <div
              className="w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #00C853, #00A844)' }}
            >
              <Wallet className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm md:text-base font-semibold casino-text-primary leading-tight">Deposit &amp; Withdraw</p>
              <p className="text-[10px] sm:text-[11px] md:text-xs casino-text-secondary">Manage your funds</p>
            </div>
          </div>
          <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5 casino-text-secondary shrink-0" />
        </Link>

        {/* ── Now Playing (recently played) ── */}
        <GameCarousel
          title="Now Playing"
          games={recentGames}
          icon={<Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-green-400" />}
        />

        {/* ── Games You Might Like (random) ── */}
        <GameCarousel
          title="Games You Might Like"
          games={randomGames}
          loading={gamesLoading}
          icon={<Gamepad2 className="w-4 h-4 sm:w-5 sm:h-5 text-yellow-400" />}
        />

      </div>
    </div>
  );
};

export default Dashboard;
