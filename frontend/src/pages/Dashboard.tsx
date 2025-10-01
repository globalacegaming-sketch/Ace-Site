import { Link } from 'react-router-dom';
import { Gamepad2, Wallet, User, Trophy, ArrowRight } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useBalancePolling } from '../hooks/useBalancePolling';

const Dashboard = () => {
  const { user, lastRechargeStatus } = useAuthStore();
  const { balance } = useBalancePolling(30000); // Poll every 30 seconds

  // const getStatusColor = (status: string | null) => {
  //   switch (status) {
  //     case 'success':
  //       return 'text-green-600 bg-green-100';
  //     case 'failed':
  //       return 'text-red-600 bg-red-100';
  //     case 'processing':
  //       return 'text-blue-600 bg-blue-100';
  //     default:
  //       return 'text-gray-600 bg-gray-100';
  //   }
  // };

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
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Welcome back, {user?.firstName || 'Player'}! 🎮
          </h1>
          <p className="text-gray-300">
            Ready to play? Choose your next adventure from our extensive game library.
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Gamepad2 className="w-6 h-6 text-black" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">
              ${balance || '0.00'}
            </h3>
            <p className="text-gray-300">Fortune Panda Balance</p>
          </div>

          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center">
            <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trophy className="w-6 h-6 text-black" />
            </div>
            <h3 className="text-2xl font-bold text-white mb-1">Active</h3>
            <p className="text-gray-300">Account Status</p>
          </div>
        </div>

        {/* Last Recharge Status */}
        <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 mb-8">
          <h3 className="text-lg font-semibold text-white mb-4">Account Status</h3>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className={`px-3 py-1 rounded-full text-sm font-medium ${
                lastRechargeStatus === 'success' ? 'bg-green-900 text-green-300' :
                lastRechargeStatus === 'failed' ? 'bg-red-900 text-red-300' :
                lastRechargeStatus === 'processing' ? 'bg-blue-900 text-blue-300' :
                'bg-gray-700 text-gray-300'
              }`}>
                {getStatusText(lastRechargeStatus)}
              </div>
            </div>
            <Link
              to="/wallet"
              className="text-yellow-400 hover:text-yellow-300 font-medium text-sm flex items-center"
            >
              View Details
              <ArrowRight className="w-4 h-4 ml-1" />
            </Link>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Link
            to="/games"
            className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center group hover:border-yellow-400 transition-all duration-300"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
              <Gamepad2 className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Play Games</h3>
            <p className="text-gray-300 text-sm">
              Browse and launch your favorite games
            </p>
          </Link>

          <Link
            to="/wallet"
            className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center group hover:border-green-400 transition-all duration-300"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-green-400 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
              <Wallet className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Manage Wallet</h3>
            <p className="text-gray-300 text-sm">
              Deposit, withdraw, and view transactions
            </p>
          </Link>

          <Link
            to="/profile"
            className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center group hover:border-purple-400 transition-all duration-300"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
              <User className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Profile</h3>
            <p className="text-gray-300 text-sm">
              Update your account information
            </p>
          </Link>

          <Link
            to="/support"
            className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-6 border border-gray-700 text-center group hover:border-blue-400 transition-all duration-300"
          >
            <div className="w-16 h-16 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-200">
              <Trophy className="w-8 h-8 text-black" />
            </div>
            <h3 className="text-lg font-semibold text-white mb-2">Support</h3>
            <p className="text-gray-300 text-sm">
              Get help and contact support
            </p>
          </Link>
        </div>

        {/* Recent Activity */}
        <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4">Recent Activity</h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2 border-b border-gray-600">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-green-900 rounded-full flex items-center justify-center">
                  <span className="text-green-400 text-xs">✓</span>
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Account Created</p>
                  <p className="text-xs text-gray-400">Welcome to Global Ace Gaming!</p>
                </div>
              </div>
              <span className="text-xs text-gray-400">Just now</span>
            </div>
            
            <div className="text-center py-4">
              <p className="text-sm text-gray-400">
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
