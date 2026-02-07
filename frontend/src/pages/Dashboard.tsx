import { useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Gamepad2, Wallet, User, Trophy, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBalancePolling } from '../hooks/useBalancePolling';
import { usePullToRefresh } from '../hooks/usePullToRefresh';
import { PullToRefreshIndicator } from '../components/PullToRefreshIndicator';

const Dashboard = () => {
  const { user, lastRechargeStatus } = useAuthStore();
  const { balance, fetchBalance } = useBalancePolling(30000);

  // Pull-to-refresh — re-fetches balance
  const handleRefresh = useCallback(async () => {
    await fetchBalance(true);
  }, [fetchBalance]);

  const { isRefreshing, pullDistance } = usePullToRefresh({
    onRefresh: handleRefresh,
  });

  const getStatusText = (status: string | null) => {
    switch (status) {
      case 'success':
        return 'Last Recharge: Success';
      case 'failed':
        return 'Last Recharge: Failed';
      case 'processing':
        return 'Last Recharge: Processing';
      default:
        return 'No Recharge History';
    }
  };

  return (
    <div className="min-h-screen pt-20 pb-4 sm:pb-6 lg:pb-8" style={{ 
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
    }}>
      {/* Pull-to-refresh */}
      <PullToRefreshIndicator isRefreshing={isRefreshing} pullDistance={pullDistance} />

      {/* Decorative glowing orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-30 animate-pulse" style={{ backgroundColor: '#6A1B9A' }} />
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-25" style={{ backgroundColor: '#00B0FF' }} />
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-20 animate-pulse" style={{ backgroundColor: '#FFD700' }} />
      </div>
      
      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Welcome Section */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold casino-text-primary mb-2">
            Welcome back, {user?.firstName || 'Player'}!
          </h1>
          <p className="text-sm sm:text-base casino-text-secondary">
            Ready to play? Choose your next adventure from our extensive game library.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <div className="casino-bg-secondary backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4" style={{ 
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'
            }}>
              <Gamepad2 className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0A0A0F' }} />
            </div>
            <h3 className="text-lg sm:text-2xl font-bold casino-text-primary mb-1">
              ${balance || '0.00'}
            </h3>
            <p className="text-xs sm:text-base casino-text-secondary">Fortune Panda Balance</p>
          </div>

          <div className="casino-bg-secondary backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border text-center">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4" style={{ 
              background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
              boxShadow: '0 0 20px rgba(106, 27, 154, 0.3)'
            }}>
              <Trophy className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#F5F5F5' }} />
            </div>
            <h3 className="text-lg sm:text-2xl font-bold casino-text-primary mb-1">Active</h3>
            <p className="text-xs sm:text-base casino-text-secondary">Account Status</p>
          </div>
        </div>

        {/* Last Recharge Status */}
        <div className="casino-bg-secondary backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border mb-6 sm:mb-8">
          <h3 className="text-base sm:text-lg font-semibold casino-text-primary mb-3 sm:mb-4">Account Status</h3>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-0">
            <div className="flex items-center space-x-3">
              <div className={`px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${
                lastRechargeStatus === 'success' ? 'status-success-casino' :
                lastRechargeStatus === 'failed' ? 'status-error-casino' :
                lastRechargeStatus === 'processing' ? 'status-warning-casino' :
                'status-badge-casino'
              }`}>
                {getStatusText(lastRechargeStatus)}
              </div>
            </div>
            <Link
              to="/wallet"
              className="casino-text-primary hover:text-yellow-400 font-medium text-xs sm:text-sm flex items-center transition-colors duration-300"
              style={{ color: '#FFD700' }}
            >
              View Details
              <ArrowRight className="w-3 h-3 sm:w-4 sm:h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Quick Actions — 2-col on mobile for better thumb reach */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-6 mb-6 sm:mb-8">
          <Link
            to="/games"
            className="casino-bg-secondary backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border text-center group hover:border-yellow-400 transition-all duration-300 active:scale-95 touch-manipulation"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-200" style={{ 
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
              boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'
            }}>
              <Gamepad2 className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" style={{ color: '#0A0A0F' }} />
            </div>
            <h3 className="text-sm sm:text-lg font-semibold casino-text-primary mb-1 sm:mb-2">Play Games</h3>
            <p className="casino-text-secondary text-xs sm:text-sm hidden sm:block">
              Browse and launch your favorite games
            </p>
          </Link>

          <Link
            to="/wallet"
            className="casino-bg-secondary backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border text-center group hover:border-green-400 transition-all duration-300 active:scale-95 touch-manipulation"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-200" style={{ 
              background: 'linear-gradient(135deg, #00C853 0%, #00A844 100%)',
              boxShadow: '0 0 20px rgba(0, 200, 83, 0.3)'
            }}>
              <Wallet className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" style={{ color: '#F5F5F5' }} />
            </div>
            <h3 className="text-sm sm:text-lg font-semibold casino-text-primary mb-1 sm:mb-2">Wallet</h3>
            <p className="casino-text-secondary text-xs sm:text-sm hidden sm:block">
              Deposit, withdraw, and view transactions
            </p>
          </Link>

          <Link
            to="/profile"
            className="casino-bg-secondary backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border text-center group hover:border-purple-400 transition-all duration-300 active:scale-95 touch-manipulation"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-200" style={{ 
              background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
              boxShadow: '0 0 20px rgba(106, 27, 154, 0.3)'
            }}>
              <User className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" style={{ color: '#F5F5F5' }} />
            </div>
            <h3 className="text-sm sm:text-lg font-semibold casino-text-primary mb-1 sm:mb-2">Profile</h3>
            <p className="casino-text-secondary text-xs sm:text-sm hidden sm:block">
              Update your account information
            </p>
          </Link>

          <Link
            to="/support"
            className="casino-bg-secondary backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border text-center group hover:border-blue-400 transition-all duration-300 active:scale-95 touch-manipulation"
          >
            <div className="w-12 h-12 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-200" style={{ 
              background: 'linear-gradient(135deg, #00B0FF 0%, #0091EA 100%)',
              boxShadow: '0 0 20px rgba(0, 176, 255, 0.3)'
            }}>
              <Trophy className="w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8" style={{ color: '#F5F5F5' }} />
            </div>
            <h3 className="text-sm sm:text-lg font-semibold casino-text-primary mb-1 sm:mb-2">Support</h3>
            <p className="casino-text-secondary text-xs sm:text-sm hidden sm:block">
              Get help and contact support
            </p>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="casino-bg-secondary backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border">
          <h3 className="text-base sm:text-lg font-semibold casino-text-primary mb-3 sm:mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b casino-border">
              <div className="flex items-center space-x-3">
                <div className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center" style={{ backgroundColor: '#00C853' }}>
                  <span className="text-white text-xs">✓</span>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium casino-text-primary">Account Created</p>
                  <p className="text-xs casino-text-secondary">Welcome to Global Ace Gaming!</p>
                </div>
              </div>
              <span className="text-xs casino-text-secondary">Just now</span>
            </div>
            
            <div className="text-center py-3 sm:py-4">
              <p className="text-xs sm:text-sm casino-text-secondary">
                Start playing games to see your activity here!
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
