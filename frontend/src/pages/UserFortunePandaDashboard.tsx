import React, { useState, useEffect } from 'react';
import { Gamepad2, DollarSign, RefreshCw, Play, Eye, EyeOff, User, CreditCard } from 'lucide-react';
import fortunePandaApi from '../services/fortunePandaApi';

interface Game {
  kindId: string;
  gameName: string;
  gameType: string;
  gameLogo?: string;
  status: string;
}

interface UserAccount {
  fortunePandaUsername: string;
  balance: string;
  agentBalance: string;
  lastLogin?: string;
}

const UserFortunePandaDashboard: React.FC = () => {
  const [account, setAccount] = useState<UserAccount | null>(null);
  const [games, setGames] = useState<Game[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  useEffect(() => {
    loadUserAccount();
    loadGames();
  }, []);

  const loadUserAccount = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fortunePandaApi.getUserAccount();
      if (result.success) {
        setAccount(result.data);
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to load account information');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGames = async () => {
    try {
      const result = await fortunePandaApi.getUserGames();
      if (result.success) {
        setGames(result.data?.data || []);
      }
    } catch (error) {
      console.error('Failed to load games:', error);
    }
  };

  const handleEnterGame = async (kindId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await fortunePandaApi.enterUserGame(kindId);
      if (result.success) {
        // Open game in new window
        if (result.data?.webLoginUrl) {
          window.open(result.data.webLoginUrl, '_blank');
        }
      } else {
        setError(result.message);
      }
    } catch (error) {
      setError('Failed to enter game');
    } finally {
      setIsLoading(false);
    }
  };

  const refreshAccount = () => {
    loadUserAccount();
  };

  const getGameTypeIcon = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'FISH':
        return '🐟';
      case 'SLOT':
        return '🎰';
      case 'CARD':
        return '🃏';
      case 'LIVE':
        return '🎥';
      case 'ARCADE':
        return '🎮';
      default:
        return '🎯';
    }
  };

  const getGameTypeColor = (type: string) => {
    switch (type?.toUpperCase()) {
      case 'FISH':
        return 'from-blue-500 to-cyan-600';
      case 'SLOT':
        return 'from-purple-500 to-pink-600';
      case 'CARD':
        return 'from-green-500 to-emerald-600';
      case 'LIVE':
        return 'from-red-500 to-orange-600';
      case 'ARCADE':
        return 'from-yellow-500 to-amber-600';
      default:
        return 'from-gray-500 to-slate-600';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Gamepad2 className="w-8 h-8 text-green-600 mr-3" />
              <h1 className="text-2xl font-bold text-gray-900">Fortune Panda Games</h1>
            </div>
            <div className="flex items-center space-x-4">
              {account && (
                <div className="text-right">
                  <p className="text-sm text-gray-500">Balance</p>
                  <p className="text-sm font-medium text-green-600">${parseFloat(account.balance).toFixed(2)}</p>
                </div>
              )}
              <button
                onClick={refreshAccount}
                disabled={isLoading}
                className="text-gray-400 hover:text-gray-600 transition-colors"
                title="Refresh Account"
              >
                <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Account Information */}
        {account && (
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-medium text-gray-900">Account Information</h2>
              <button
                onClick={() => setShowCredentials(!showCredentials)}
                className="flex items-center space-x-2 text-sm text-blue-600 hover:text-blue-800"
              >
                {showCredentials ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                <span>{showCredentials ? 'Hide' : 'Show'} Credentials</span>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
                    <User className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Fortune Panda Username</p>
                    <p className="text-lg font-semibold text-gray-900">
                      {showCredentials ? account.fortunePandaUsername : '••••••••••••'}
                    </p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
                    <DollarSign className="w-5 h-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Your Balance</p>
                    <p className="text-lg font-semibold text-gray-900">${parseFloat(account.balance).toFixed(2)}</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-yellow-100 rounded-full flex items-center justify-center">
                    <CreditCard className="w-5 h-5 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600">Agent Balance</p>
                    <p className="text-lg font-semibold text-gray-900">${parseFloat(account.agentBalance).toFixed(2)}</p>
                  </div>
                </div>
              </div>
            </div>

            {showCredentials && (
              <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <h3 className="text-sm font-medium text-blue-800 mb-2">Fortune Panda Credentials</h3>
                <div className="text-sm text-blue-700 space-y-1">
                  <p><strong>Username:</strong> {account.fortunePandaUsername}</p>
                  <p><strong>Password:</strong> [Auto-generated, stored securely]</p>
                  <p className="text-xs text-blue-600 mt-2">
                    These credentials are automatically managed by the system. You don't need to remember them.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Games Section */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-gray-900">Available Games</h2>
            <button
              onClick={loadGames}
              disabled={isLoading}
              className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh Games</span>
            </button>
          </div>

          {games.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {games.map((game, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-6 border border-gray-200 hover:shadow-md transition-shadow duration-200">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center space-x-3">
                      <div className={`w-12 h-12 bg-gradient-to-br ${getGameTypeColor(game.gameType)} rounded-lg flex items-center justify-center text-2xl text-white`}>
                        {getGameTypeIcon(game.gameType)}
                      </div>
                      <div>
                        <h3 className="font-medium text-gray-900">{game.gameName}</h3>
                        <p className="text-sm text-gray-500">ID: {game.kindId}</p>
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800">
                      {game.status}
                    </span>
                  </div>

                  <div className="mb-4">
                    <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                      {game.gameType}
                    </span>
                  </div>

                  <button
                    onClick={() => handleEnterGame(game.kindId)}
                    disabled={isLoading}
                    className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                  >
                    <Play className="w-4 h-4" />
                    <span>Play Now</span>
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Gamepad2 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500">No games available. Click "Refresh Games" to load them.</p>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mt-6 bg-white rounded-lg shadow-sm border border-red-200 p-6">
            <div className="flex items-center space-x-2">
              <div className="w-5 h-5 bg-red-100 rounded-full flex items-center justify-center">
                <span className="text-red-600 text-xs">✗</span>
              </div>
              <h3 className="text-sm font-medium text-red-800">Error</h3>
            </div>
            <p className="mt-2 text-sm text-red-700">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserFortunePandaDashboard;
