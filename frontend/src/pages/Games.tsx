import { useState, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl, getGamesApiUrl } from '../utils/api';

interface Game {
  kindId: number;
  gameName: string;
  gameType: string;
  gameLogo: string;
}

const Games = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [playingGame, setPlayingGame] = useState<number | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const { isAuthenticated } = useAuthStore();

  useEffect(() => {
    fetchGames();
  }, []);

  const filteredGames = games.filter((game) => {
    if (selectedCategory === 'All') return true;
    const categoryMap: { [key: string]: string[] } = {
      Slots: ['SLOT'],
      Fishing: ['FISH'],
      Live: ['LIVE', 'POKER'],
      Sports: ['SPORT', 'SPORTS'],
    };
    const gameTypes = categoryMap[selectedCategory] || [];
    return gameTypes.includes(game.gameType);
  });

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);
      const GAMES_API_URL = getGamesApiUrl();
      const response = await axios.get(GAMES_API_URL);
      if (response.data.success) {
        setGames(response.data.data || []);
      } else {
        setError(response.data.message || 'Failed to fetch games');
      }
    } catch (err) {
      console.error('Error fetching games:', err);
      setError('Failed to load games. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayGame = async (game: Game) => {
    if (!isAuthenticated) {
      alert('Please log in to play games.');
      return;
    }

    try {
      setPlayingGame(game.kindId);
      
      // Get user's Fortune Panda credentials
      const API_BASE_URL = getApiBaseUrl();
      const response = await axios.get(`${API_BASE_URL}/fortune-panda-user/balance`, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().token}`
        }
      });

      if (response.data.success) {
        // Create game entry request
        const gameResponse = await axios.post(`${API_BASE_URL}/fortune-panda-user/enter-game`, {
          kindId: game.kindId.toString()
        }, {
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().token}`
          }
        });

        if (gameResponse.data.success) {
          // Check for game URL in different possible locations
          const gameUrl = gameResponse.data.data?.webLoginUrl || 
                         gameResponse.data.data?.gameUrl || 
                         gameResponse.data.data?.url || 
                         gameResponse.data.data?.game_url ||
                         gameResponse.data.data?.loginUrl ||
                         gameResponse.data.data?.login_url;
          
          if (gameUrl) {
            // Open game in new window
            const gameWindow = window.open(gameUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
            if (!gameWindow) {
              alert('Popup blocked! Please allow popups for this site and try again.');
            }
          } else {
            alert('Game URL not found in response. Please try again.');
          }
        } else {
          alert('Failed to start game. Please try again.');
        }
      } else {
        alert('Failed to start game. Please try again.');
      }
    } finally {
      setPlayingGame(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0f172a] via-[#1e1b4b] to-[#312e81] relative overflow-hidden">
      {/* Decorative glowing orbs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-30 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 bg-blue-500 rounded-full blur-3xl opacity-25 animate-ping"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-12 py-4 sm:py-8 lg:py-12">
        {/* Welcome Section */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white mb-3 sm:mb-4">
            Welcome to Our Games
          </h1>
          <p className="text-base sm:text-lg text-blue-200 px-4">
            Choose your favorite game and start playing
          </p>
        </div>


        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-2 sm:gap-3 mb-8 sm:mb-12 lg:mb-16 px-2">
          {[
            { name: 'All', icon: '🎮', color: 'from-purple-500 to-pink-500' },
            { name: 'Slots', icon: '🎰', color: 'from-green-500 to-emerald-500' },
            { name: 'Fishing', icon: '🎣', color: 'from-blue-500 to-cyan-500' },
            { name: 'Live', icon: '🎲', color: 'from-red-500 to-orange-500' },
            { name: 'Sports', icon: '⚽', color: 'from-yellow-500 to-amber-500' },
          ].map((category) => (
            <button
              key={category.name}
              className={`px-3 sm:px-6 py-2 sm:py-3 rounded-xl sm:rounded-2xl font-bold transition-all flex items-center gap-2 sm:gap-3 text-xs sm:text-sm md:text-base shadow-lg hover:shadow-xl transform hover:scale-105 ${
                selectedCategory === category.name
                  ? `bg-gradient-to-r ${category.color} text-white shadow-2xl scale-105`
                  : 'bg-gray-800/80 backdrop-blur-lg text-gray-300 hover:bg-gray-700 hover:text-white border border-gray-600/50'
              }`}
              onClick={() => setSelectedCategory(category.name)}
            >
              <span className="text-sm sm:text-lg">{category.icon}</span> 
              <span className="hidden sm:inline">{category.name}</span>
              <span className="sm:hidden">{category.name}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-28">
            <Loader2 className="w-14 h-14 animate-spin text-yellow-400" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="bg-gray-800/80 backdrop-blur-lg rounded-2xl p-10 max-w-md mx-auto border border-red-400/40 shadow-lg">
              <p className="text-red-400 mb-6 text-lg font-semibold">{error}</p>
              <button
                onClick={fetchGames}
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold py-3 px-8 rounded-full hover:from-yellow-500 hover:to-yellow-600 transition-all shadow-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No games available right now 🚫</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 sm:gap-4 lg:gap-6 px-2 sm:px-0">
            {filteredGames.map((game) => (
              <div
                key={game.kindId}
                className="group relative bg-gray-900/80 backdrop-blur-lg rounded-2xl sm:rounded-3xl overflow-hidden border border-gray-600/50 hover:border-blue-400/80 shadow-lg hover:shadow-[0_0_30px_rgba(59,130,246,0.6)] transition-all duration-500 transform hover:scale-105"
              >
                {/* Game Image */}
                <div className="relative aspect-square overflow-hidden">
                  <img
                    src={game.gameLogo}
                    alt={game.gameName}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      e.currentTarget.src =
                        'https://via.placeholder.com/300x300/1F2937/FFFFFF?text=Game';
                    }}
                  />
                  {/* Game Type Badge */}
                  <div className="absolute top-3 right-3">
                    <span className="bg-gradient-to-r from-blue-500 to-purple-600 text-white text-xs px-3 py-1.5 rounded-full font-bold shadow-lg backdrop-blur-sm">
                      {game.gameType}
                    </span>
                  </div>
                  {/* Overlay Play Button */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                    <button
                      onClick={() => handlePlayGame(game)}
                      disabled={playingGame === game.kindId}
                      className="bg-gradient-to-r from-blue-500 to-purple-600 text-white font-bold py-2 sm:py-3 lg:py-4 px-4 sm:px-6 lg:px-8 rounded-xl sm:rounded-2xl hover:scale-110 transition-all duration-300 disabled:opacity-50 shadow-2xl hover:shadow-[0_0_25px_rgba(59,130,246,0.8)] transform hover:-translate-y-1 text-xs sm:text-sm"
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
                <div className="p-3 sm:p-4 lg:p-5">
                  <h3 className="text-sm sm:text-base lg:text-lg font-bold text-white truncate group-hover:text-blue-300 transition-colors duration-300">
                    {game.gameName}
                  </h3>
                  <div className="mt-1 sm:mt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-400 font-medium">
                      {game.gameType}
                    </span>
                    <div className="w-1.5 h-1.5 sm:w-2 sm:h-2 bg-green-400 rounded-full animate-pulse"></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Games;
