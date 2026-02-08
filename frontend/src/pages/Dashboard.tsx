import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Wallet, User, MessageCircle, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBalancePolling } from '../hooks/useBalancePolling';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';
import WelcomeBonusBanner from '../components/WelcomeBonusBanner';
import PromoCarousel from '../components/PromoCarousel';
import LoginStreakCalendar from '../components/LoginStreakCalendar';

const QUICK_ACTIONS = [
  { to: '/games', icon: Gamepad2, label: 'Games', desc: 'Browse & play your favourite games', grad: 'linear-gradient(135deg, #FFD700, #FFA000)', shadow: 'rgba(255,215,0,0.25)', dark: true },
  { to: '/wallet', icon: Wallet, label: 'Wallet', desc: 'Deposit, withdraw & transactions', grad: 'linear-gradient(135deg, #00C853, #00A844)', shadow: 'rgba(0,200,83,0.25)', dark: false },
  { to: '/profile', icon: User, label: 'Profile', desc: 'Update your account info', grad: 'linear-gradient(135deg, #6A1B9A, #00B0FF)', shadow: 'rgba(106,27,154,0.25)', dark: false },
  { to: '/support', icon: MessageCircle, label: 'Support', desc: 'Get help & contact us', grad: 'linear-gradient(135deg, #00B0FF, #0091EA)', shadow: 'rgba(0,176,255,0.25)', dark: false },
] as const;

const Dashboard = () => {
  const { user, lastRechargeStatus } = useAuthStore();
  const { balance, fetchBalance } = useBalancePolling(30000);

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
      className="min-h-screen pt-16 sm:pt-18 md:pt-20 pb-4 sm:pb-6 md:pb-8 lg:pb-10 overflow-x-hidden"
      style={{ background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)' }}
    >
      <PullToRefreshIndicator isRefreshing={isRefreshing} pullDistance={pullDistance} />

      {/* Decorative orbs */}
      <div className="absolute inset-0 overflow-hidden -z-10 pointer-events-none" aria-hidden>
        <div className="absolute top-20 left-10 w-40 sm:w-56 md:w-64 lg:w-80 h-40 sm:h-56 md:h-64 lg:h-80 rounded-full blur-3xl opacity-20 sm:opacity-25 lg:opacity-30 animate-pulse" style={{ backgroundColor: '#6A1B9A' }} />
        <div className="absolute bottom-20 right-10 w-44 sm:w-60 md:w-72 lg:w-96 h-44 sm:h-60 md:h-72 lg:h-96 rounded-full blur-3xl opacity-15 sm:opacity-20 lg:opacity-25" style={{ backgroundColor: '#00B0FF' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-5 md:px-6 lg:px-8 w-full box-border">

        {/* ── Welcome ── */}
        <div className="mb-4 sm:mb-5 md:mb-6 lg:mb-8">
          <h1 className="text-lg sm:text-xl md:text-2xl lg:text-3xl font-bold casino-text-primary">
            Welcome back, {user?.firstName || 'Player'}!
          </h1>
          <p className="text-xs sm:text-sm md:text-base casino-text-secondary mt-0.5 sm:mt-1">
            Ready to play? Pick your next game below.
          </p>
        </div>

        {/* ── Balance + Status ── */}
        <div
          className="rounded-xl sm:rounded-2xl p-4 sm:p-5 md:p-6 lg:p-8 mb-4 sm:mb-5 md:mb-6 lg:mb-8 flex items-center justify-between overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, rgba(255,215,0,0.08) 0%, rgba(139,92,246,0.08) 100%)',
            border: '1px solid rgba(255,215,0,0.15)',
          }}
        >
          <div className="min-w-0">
            <p className="text-[11px] sm:text-xs md:text-sm uppercase tracking-wider casino-text-secondary mb-0.5 sm:mb-1">Balance</p>
            <h2 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-extrabold casino-text-primary leading-none truncate">
              ${balance || '0.00'}
            </h2>
          </div>
          <div className="text-right shrink-0 ml-3 sm:ml-4">
            <p className="text-[11px] sm:text-xs md:text-sm uppercase tracking-wider casino-text-secondary mb-0.5 sm:mb-1">Last Recharge</p>
            <span
              className="inline-block px-2 sm:px-2.5 md:px-3 py-0.5 sm:py-1 rounded-full text-[11px] sm:text-xs md:text-sm font-semibold whitespace-nowrap"
              style={{ backgroundColor: `${rechargeColor}22`, color: rechargeColor }}
            >
              {rechargeLabel}
            </span>
          </div>
        </div>

        {/* ── Desktop two-column layout: Carousel + Streak side-by-side ── */}
        <div className="lg:grid lg:grid-cols-5 lg:gap-6 xl:gap-8">
          {/* Left: Carousel (wider) */}
          <div className="lg:col-span-3">
            <PromoCarousel />
          </div>
          {/* Right: Streak Calendar */}
          <div className="lg:col-span-2">
            <LoginStreakCalendar />
          </div>
        </div>

        {/* ── Welcome Bonus (new users only) ── */}
        <WelcomeBonusBanner />

        {/* ── Quick Actions ── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 sm:gap-3 md:gap-4 lg:gap-5 mb-4 sm:mb-5 md:mb-6 lg:mb-8">
          {QUICK_ACTIONS.map(({ to, icon: Icon, label, desc, grad, shadow, dark }) => (
            <Link
              key={to}
              to={to}
              className="flex flex-col items-center py-3 sm:py-4 md:py-5 lg:py-6 px-2 rounded-xl sm:rounded-2xl casino-bg-secondary casino-border active:scale-95 hover:scale-[1.02] transition-all touch-manipulation group"
            >
              <div
                className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 lg:w-14 lg:h-14 rounded-full flex items-center justify-center mb-1.5 sm:mb-2 md:mb-2.5 group-hover:scale-110 transition-transform"
                style={{ background: grad, boxShadow: `0 0 16px ${shadow}` }}
              >
                <Icon className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 lg:w-7 lg:h-7" style={{ color: dark ? '#0A0A0F' : '#F5F5F5' }} />
              </div>
              <span className="text-[11px] sm:text-xs md:text-sm lg:text-base font-semibold casino-text-primary">{label}</span>
              <span className="text-[9px] sm:text-[10px] md:text-xs casino-text-secondary mt-0.5 text-center leading-tight hidden sm:block">{desc}</span>
            </Link>
          ))}
        </div>

        {/* ── Wallet shortcut bar ── */}
        <Link
          to="/wallet"
          className="flex items-center justify-between rounded-xl sm:rounded-2xl p-3 sm:p-4 md:p-5 casino-bg-secondary casino-border mb-4 sm:mb-5 md:mb-6 active:scale-[0.98] hover:border-green-500/30 transition-all touch-manipulation"
        >
          <div className="flex items-center gap-2.5 sm:gap-3 md:gap-4">
            <div
              className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 rounded-full flex items-center justify-center shrink-0"
              style={{ background: 'linear-gradient(135deg, #00C853, #00A844)' }}
            >
              <Wallet className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="text-sm sm:text-base md:text-lg font-semibold casino-text-primary leading-tight">Deposit &amp; Withdraw</p>
              <p className="text-[11px] sm:text-xs md:text-sm casino-text-secondary">Manage your funds</p>
            </div>
          </div>
          <ArrowRight className="w-4 h-4 sm:w-5 sm:h-5 casino-text-secondary shrink-0" />
        </Link>

      </div>
    </div>
  );
};

export default Dashboard;
