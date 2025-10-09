import { useState, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl, getGamesApiUrl } from '../utils/api';
import { useMusic } from '../contexts/MusicContext';

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
  const { stopMusic } = useMusic();
  const navigate = useNavigate();

  useEffect(() => {
    fetchGames();
  }, []);
  
  const filteredGames = Array.isArray(games) ? games.filter((game) => {
    if (selectedCategory === 'All') return true;
    const categoryMap: { [key: string]: string[] } = {
      Slots: ['SLOT'],
      Fishing: ['FISH'],
      Live: ['LIVE', 'POKER'],
      Sports: ['SPORT', 'SPORTS'],
    };
    const gameTypes = categoryMap[selectedCategory] || [];
    return gameTypes.includes(game.gameType);
  }) : [];

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);
      const GAMES_API_URL = getGamesApiUrl();
      console.log('Fetching games from:', GAMES_API_URL);
      const response = await axios.get(GAMES_API_URL);
      console.log('Games API response:', response.data);
      if (response.data.success) {
        const gamesData = response.data.data.data; // Access the nested data array
        console.log('Games data:', gamesData);
        setGames(Array.isArray(gamesData) ? gamesData : []);
      } else {
        console.error('Games API error:', response.data.message);
        setError(response.data.message || 'Failed to fetch games');
      }
    } catch (err) {
      console.error('Games fetch error:', err);
      setError('Failed to load games. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const handlePlayGame = async (game: Game) => {
    if (!isAuthenticated) {
      const shouldLogin = window.confirm('Please login to play games. Would you like to login now?');
      if (shouldLogin) {
        navigate('/login');
    }
      return;
    }

    try {
      // Stop the background music when game is clicked
      stopMusic();
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
    <div className="min-h-screen pt-16" style={{ 
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
    }}>
      {/* Decorative glowing orbs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-40 animate-pulse" style={{ backgroundColor: '#6A1B9A' }}></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-35 animate-ping" style={{ backgroundColor: '#00B0FF' }}></div>
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-30 animate-pulse" style={{ backgroundColor: '#FFD700' }}></div>
        <div className="absolute top-1/3 right-1/3 w-32 h-32 rounded-full blur-3xl opacity-25 animate-bounce" style={{ backgroundColor: '#00C853' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* Welcome Section */}
        <div className="text-center mb-6 sm:mb-8 lg:mb-12">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold casino-text-primary mb-2 sm:mb-3 lg:mb-4">
            🎮 Welcome to Our Games
          </h1>
          <p className="text-sm sm:text-base lg:text-lg casino-text-secondary px-2 sm:px-4">
            Choose your favorite game and start playing
          </p>
          
          {/* Debug button for testing API */}
          <button 
            onClick={fetchGames}
            className="mt-4 px-4 py-2 bg-yellow-400 text-black rounded-lg hover:bg-yellow-500 transition-colors"
          >
            🔄 Refresh Games
          </button>
        </div>

        {/* Categories */}
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 lg:gap-3 mb-6 sm:mb-8 lg:mb-12 px-1 sm:px-2">
          {[
            { name: 'All', icon: '🎮', color: '#6A1B9A' },
            { name: 'Slots', icon: '🎰', color: '#00C853' },
            { name: 'Fishing', icon: '🎣', color: '#00B0FF' },
            { name: 'Live', icon: '🎲', color: '#E53935' },
            { name: 'Sports', icon: '⚽', color: '#FFD700' },
          ].map((category) => (
            <button
              key={category.name}
              className={`px-2 sm:px-3 lg:px-6 py-1.5 sm:py-2 lg:py-3 rounded-lg sm:rounded-xl lg:rounded-2xl font-bold transition-all flex items-center gap-1 sm:gap-2 lg:gap-3 text-xs sm:text-sm lg:text-base shadow-lg hover:shadow-xl transform hover:scale-105 ${
                selectedCategory === category.name
                  ? 'text-white shadow-2xl scale-105'
                  : 'casino-bg-secondary backdrop-blur-lg casino-text-secondary hover:casino-text-primary casino-border'
              }`}
              style={selectedCategory === category.name ? {
                background: `linear-gradient(135deg, ${category.color} 0%, ${category.color}80 100%)`,
                borderColor: category.color,
                boxShadow: `0 0 20px ${category.color}40`
              } : {}}
              onClick={() => setSelectedCategory(category.name)}
            >
              <span className="text-xs sm:text-sm lg:text-lg">{category.icon}</span> 
              <span className="hidden sm:inline">{category.name}</span>
              <span className="sm:hidden">{category.name}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex justify-center items-center py-28">
            <Loader2 className="w-14 h-14 animate-spin" style={{ color: '#FFD700' }} />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="casino-bg-secondary backdrop-blur-lg rounded-2xl p-10 max-w-md mx-auto casino-border shadow-lg">
              <p className="casino-text-primary mb-6 text-lg font-semibold" style={{ color: '#E53935' }}>{error}</p>
              <button
                onClick={fetchGames}
                className="btn-casino-primary py-3 px-8 rounded-full font-bold transition-all shadow-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : filteredGames.length === 0 ? (
          <div className="text-center py-20">
            <p className="casino-text-secondary text-lg">No games available right now 🚫</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3 lg:gap-4 xl:gap-6 px-1 sm:px-2">
            {filteredGames.map((game) => (
               <div
                 key={game.kindId}
                 className="group relative casino-bg-secondary backdrop-blur-lg rounded-xl sm:rounded-2xl lg:rounded-3xl overflow-hidden casino-border hover:border-yellow-400/80 shadow-lg hover:shadow-[0_0_30px_rgba(255,215,0,0.6)] transition-all duration-500 transform hover:scale-105 game"
                 data-game={game.kindId}
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
                  <div className="absolute top-2 sm:top-3 right-2 sm:right-3">
                    <span className="text-white text-xs px-2 sm:px-3 py-1 sm:py-1.5 rounded-full font-bold shadow-lg backdrop-blur-sm" style={{ 
                      background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
                      border: '1px solid #2C2C3A'
                    }}>
                           {game.gameType}
                         </span>
                       </div>
                  {/* Overlay Play Button */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-all duration-500 flex items-center justify-center">
                         <button
                           onClick={() => handlePlayGame(game)}
                           disabled={playingGame === game.kindId}
                      className="btn-casino-primary py-1.5 sm:py-2 lg:py-3 xl:py-4 px-3 sm:px-4 lg:px-6 xl:px-8 rounded-lg sm:rounded-xl lg:rounded-2xl hover:scale-110 transition-all duration-300 disabled:opacity-50 shadow-2xl hover:shadow-[0_0_25px_rgba(255,215,0,0.8)] transform hover:-translate-y-1 text-xs sm:text-sm"
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
                    <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 lg:w-2 lg:h-2 rounded-full animate-pulse" style={{ backgroundColor: '#00C853' }}></div>
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
