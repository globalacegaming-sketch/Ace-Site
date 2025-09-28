import { useState, useEffect } from 'react';
import { Gamepad2, Play, Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

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
  const { isAuthenticated, token, user } = useAuthStore();

  useEffect(() => {
    fetchGames();
  }, []);
  

  const fetchGames = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const response = await axios.get('/api/games/fortune-panda');
      
      if (response.data.success && response.data.data.code === 200) {
        setGames(response.data.data.data || []);
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

    if (!token) {
      alert('Authentication token not found. Please log in again.');
      return;
    }

    try {
      setPlayingGame(game.kindId);
      console.log('Attempting to play game:', game.gameName, 'with token:', token ? 'present' : 'missing');
      
      // Get user's Fortune Panda credentials
      const response = await axios.get('/api/fortune-panda-user/balance', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        // Create game entry request
        const gameResponse = await axios.post('/api/fortune-panda-user/enter-game', {
          kindId: game.kindId.toString()
        }, {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });

        if (gameResponse.data.success) {
          console.log('Game entry response:', gameResponse.data);
          
          // Check for game URL in different possible locations
          const gameUrl = gameResponse.data.data?.webLoginUrl || 
                         gameResponse.data.data?.gameUrl || 
                         gameResponse.data.data?.url || 
                         gameResponse.data.data?.game_url ||
                         gameResponse.data.data?.loginUrl ||
                         gameResponse.data.data?.login_url;
          
          console.log('Game URL found:', gameUrl);
          
          if (gameUrl) {
            // Open game in new window
            const gameWindow = window.open(gameUrl, '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
            if (gameWindow) {
              console.log('Game window opened successfully');
            } else {
              alert('Popup blocked! Please allow popups for this site and try again.');
            }
          } else {
            // Show the full response data for debugging
            console.log('No game URL found. Full response:', gameResponse.data);
            
            // Create a simple game interface as fallback
            const gameWindow = window.open('', '_blank', 'width=1200,height=800,scrollbars=yes,resizable=yes');
            if (gameWindow) {
              gameWindow.document.write(`
                <!DOCTYPE html>
                <html>
                <head>
                  <title>${game.gameName} - Global Ace Gaming</title>
                  <style>
                    body { 
                      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                      color: white; 
                      font-family: Arial, sans-serif; 
                      margin: 0; 
                      padding: 20px;
                      text-align: center;
                    }
                    .game-container {
                      max-width: 800px;
                      margin: 0 auto;
                      padding: 40px;
                    }
                    .game-title {
                      font-size: 2.5em;
                      margin-bottom: 20px;
                      text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
                    }
                    .game-info {
                      background: rgba(255,255,255,0.1);
                      padding: 20px;
                      border-radius: 10px;
                      margin: 20px 0;
                    }
                    .status {
                      font-size: 1.2em;
                      margin: 20px 0;
                      padding: 15px;
                      background: rgba(0,255,0,0.2);
                      border-radius: 5px;
                      border: 1px solid #00ff00;
                    }
                    .response-data {
                      background: rgba(0,0,0,0.3);
                      padding: 15px;
                      border-radius: 5px;
                      margin: 20px 0;
                      text-align: left;
                      font-family: monospace;
                      font-size: 0.9em;
                      max-height: 300px;
                      overflow-y: auto;
                    }
                  </style>
                </head>
                <body>
                  <div class="game-container">
                    <h1 class="game-title">🎮 ${game.gameName}</h1>
                    <div class="game-info">
                      <p><strong>Game Type:</strong> ${game.gameType}</p>
                      <p><strong>Game ID:</strong> ${game.kindId}</p>
                    </div>
                    <div class="status">
                      ✅ Game session established successfully!
                    </div>
                    <p>Your game session is ready. The game should be loading...</p>
                    <div class="response-data">
                      <strong>API Response:</strong><br>
                      <pre>${JSON.stringify(gameResponse.data.data, null, 2)}</pre>
                    </div>
                    <p><em>If the game doesn't load automatically, please contact support.</em></p>
                  </div>
                </body>
                </html>
              `);
              gameWindow.document.close();
            } else {
              alert(`Game ${game.gameName} is ready to play!\n\nResponse: ${JSON.stringify(gameResponse.data.data, null, 2)}`);
            }
          }
        } else {
          alert(`Failed to enter game: ${gameResponse.data.message}`);
        }
      } else {
        alert('Failed to get user balance. Please try again.');
      }
    } catch (error: any) {
      console.error('Error playing game:', error);
      if (error.response?.status === 401) {
        alert('Authentication failed. Please log in again.');
      } else if (error.response?.status === 400) {
        alert(`Game entry failed: ${error.response.data?.message || 'Unknown error'}`);
      } else {
        alert('Failed to start game. Please try again.');
      }
    } finally {
      setPlayingGame(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-400 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-32 right-20 w-24 h-24 bg-red-400 rounded-full opacity-30 animate-bounce"></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-green-400 rounded-full opacity-25 animate-pulse"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full mb-6 shadow-2xl">
            <Gamepad2 className="w-10 h-10 text-black" />
          </div>
          <h1 className="text-5xl font-bold text-white mb-4 drop-shadow-lg">
            FORTUNE PANDA
          </h1>
          <p className="text-xl text-yellow-300 mb-8 font-semibold">
            Exclusive Gaming Experience
          </p>
          {isAuthenticated && (
            <div className="bg-green-900 bg-opacity-50 border border-green-500 rounded-lg p-4 max-w-md mx-auto mb-8">
              <p className="text-green-300 text-sm">
                ✅ Logged in as: {user?.email || 'User'} | Token: {token ? 'Present' : 'Missing'}
              </p>
              <button
                onClick={async () => {
                  try {
                    const response = await axios.get('/api/fortune-panda-user/balance', {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    console.log('Balance response:', response.data);
                    alert(`Balance: ${response.data.data?.balance || 'Unknown'}`);
                  } catch (error: any) {
                    console.error('Balance test error:', error);
                    alert(`Error: ${error.response?.data?.message || error.message}`);
                  }
                }}
                className="mt-2 bg-blue-600 text-white px-3 py-1 rounded text-xs hover:bg-blue-700"
              >
                Test Balance API
              </button>
            </div>
          )}
        </div>

        {/* Game Categories Tabs */}
        <div className="flex flex-wrap justify-center gap-2 mb-12">
          {['All', 'FISH', 'SLOT', 'KENO', 'POKER'].map((category) => (
            <button
              key={category}
              className={`px-6 py-3 rounded-full font-semibold transition-all duration-300 ${
                category === 'All'
                  ? 'bg-gray-800 text-white shadow-lg'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600 hover:text-white'
              }`}
            >
              {category}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="text-center">
              <Loader2 className="w-12 h-12 animate-spin text-yellow-400 mx-auto mb-4" />
              <span className="text-xl text-white font-semibold">Loading Games...</span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto border border-gray-700">
              <p className="text-red-400 mb-6 text-lg">{error}</p>
              <button
                onClick={fetchGames}
                className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold py-3 px-8 rounded-full hover:from-yellow-500 hover:to-yellow-600 transition-all duration-300 shadow-lg"
              >
                Try Again
              </button>
            </div>
          </div>
        ) : games.length === 0 ? (
          <div className="text-center py-20">
            <div className="bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-2xl p-8 max-w-md mx-auto border border-gray-700">
              <p className="text-gray-300 text-lg">No games available at the moment.</p>
            </div>
          </div>
        ) : (
               <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
                 {games.map((game) => (
                   <div key={game.kindId} className="group bg-gray-800 bg-opacity-80 backdrop-blur-sm rounded-xl overflow-hidden border border-gray-700 hover:border-yellow-400 transition-all duration-300 hover:scale-105 hover:shadow-2xl hover:shadow-yellow-400/20">
                     {/* Game Image */}
                     <div className="relative aspect-square">
                       <img 
                         src={game.gameLogo} 
                         alt={game.gameName}
                         className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                         onError={(e) => {
                           e.currentTarget.src = 'https://via.placeholder.com/300x300/1F2937/FFFFFF?text=Game';
                         }}
                       />
                       {/* Game Type Badge */}
                       <div className="absolute top-2 right-2">
                         <span className="bg-black bg-opacity-80 text-white text-xs px-2 py-1 rounded-full font-semibold">
                           {game.gameType}
                         </span>
                       </div>
                       {/* Game ID Badge */}
                       <div className="absolute top-2 left-2">
                         <span className="bg-yellow-400 text-black text-xs px-2 py-1 rounded-full font-bold">
                           #{game.kindId}
                         </span>
                       </div>
                       {/* Play Button Overlay */}
                       <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-60 transition-all duration-300 flex items-center justify-center">
                         <button
                           onClick={() => handlePlayGame(game)}
                           disabled={playingGame === game.kindId}
                           className="opacity-0 group-hover:opacity-100 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold py-2 px-4 rounded-full hover:from-yellow-500 hover:to-yellow-600 transition-all duration-300 transform scale-75 group-hover:scale-100 disabled:opacity-50 disabled:cursor-not-allowed"
                         >
                           {playingGame === game.kindId ? (
                             <>
                               <Loader2 className="w-4 h-4 mr-1 inline animate-spin" />
                               LOADING...
                             </>
                           ) : (
                             <>
                               <Play className="w-4 h-4 mr-1 inline" />
                               {isAuthenticated ? 'PLAY' : 'LOGIN TO PLAY'}
                             </>
                           )}
                         </button>
                       </div>
                     </div>

                     {/* Game Info */}
                     <div className="p-3">
                       <h3 className="text-sm font-bold text-white mb-1 line-clamp-2 group-hover:text-yellow-300 transition-colors">
                         {game.gameName}
                       </h3>
                       <p className="text-xs text-gray-400 capitalize">
                         {game.gameType} Game
                       </p>
                     </div>
                   </div>
                 ))}
               </div>
        )}

        {games.length > 0 && (
          <div className="mt-16 text-center">
            <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-2xl p-8 max-w-2xl mx-auto">
              <h2 className="text-2xl font-bold text-black mb-4">Ready to Play?</h2>
              <p className="text-black text-lg mb-6">
                Join thousands of players and start your gaming journey today!
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <a 
                  href="/register" 
                  className="bg-black text-yellow-400 font-bold py-3 px-8 rounded-full hover:bg-gray-800 transition-all duration-300 shadow-lg"
                >
                  Sign Up Now
                </a>
                <a 
                  href="/login" 
                  className="bg-transparent border-2 border-black text-black font-bold py-3 px-8 rounded-full hover:bg-black hover:text-yellow-400 transition-all duration-300"
                >
                  Login
                </a>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Games;
