import { useState, useEffect } from 'react';
import { Play, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl, getGamesApiUrl } from '../utils/api';
import { useMusic } from '../contexts/MusicContext';
import { PageMeta } from '../components/PageMeta';

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
      const response = await axios.get(GAMES_API_URL);
      
      if (response.data.success) {
        // Handle the nested data structure: response.data.data.data
        const gamesData = response.data.data?.data || response.data.data;
        setGames(Array.isArray(gamesData) ? gamesData : []);
      } else {
        setError(response.data.message || 'Failed to fetch games');
      }
    } catch (err) {
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
      
      const API_BASE_URL = getApiBaseUrl();
      
      // Step 1: Verify user has Fortune Panda account (balance check - optional, non-blocking)
      // Try to get balance, but don't block game launch if it fails
      try {
        await axios.get(`${API_BASE_URL}/fortune-panda-user/balance`, {
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().token}`
          }
        });
      } catch (error: any) {
        // Continue with game launch even if balance check fails
      }

      // Step 2: Create game entry request
      try {
        const gameResponse = await axios.post(`${API_BASE_URL}/fortune-panda-user/enter-game`, {
          kindId: game.kindId.toString()
        }, {
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().token}`
          }
        });

        if (!gameResponse.data.success) {
          const errorMsg = gameResponse.data.message || 'Failed to start game. Please try again.';
          toast.error(errorMsg);
          return;
        }

        // Step 3: Extract game URL from response
        const gameUrl = gameResponse.data.data?.webLoginUrl || 
                       gameResponse.data.data?.gameUrl || 
                       gameResponse.data.data?.url || 
                       gameResponse.data.data?.game_url ||
                       gameResponse.data.data?.loginUrl ||
                       gameResponse.data.data?.login_url;
        
        if (!gameUrl) {
          toast.error('Game URL not found. Please contact support or try again.');
          return;
        }

        // Step 4: Directly navigate to game URL (works on mobile and desktop)
        // This avoids iframe issues and popup blockers
        // User can use browser back button to return
        window.location.href = gameUrl;
        
        toast.success('Game launching...', { duration: 2000 });
      } catch (error: any) {
        const errorMsg = error.response?.data?.message || error.message || 'Failed to start game. Please try again.';
        toast.error(errorMsg);
        return;
      }
    } catch (error: any) {
      toast.error(error.message || 'An unexpected error occurred. Please try again or contact support.');
    } finally {
      setPlayingGame(null);
    }
  };

  const faqItems: { q: string; a: string }[] = [
    { q: 'What types of games does Global Ace Gaming offer?', a: 'We offer online slots, online fish games, online table games, and sports-style games. You can browse and filter them in the main games lobby.' },
    { q: 'How do I start playing?', a: 'Create an account, open the games section, and pick a category (slots, fish, table, or sports). Choose a game and follow the on-screen instructions. For more detail, see the how to play section on this page.' },
    { q: 'Are these the same as Milkyway, Orionstars, Juwa, Gamevault, or Firekirin?', a: 'We offer similar styles of games—online slots, fish/redemption, online table games, and sports—in one platform. We don\'t run those brands; we provide a place to discover and play these kinds of experiences.' },
    { q: 'Is it safe to play?', a: 'We use secure sign-in and take care with your data. For specific security or legal questions, check our Support page and site policies. We focus on clear information and support.' },
    { q: 'How can I get help?', a: 'Visit our Support page for FAQs, contact options, and responsible gaming resources.' },
    { q: 'Where can I see bonuses?', a: 'Check the Bonuses page for current offers and how to use them across our games.' },
  ];
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: faqItems.map(({ q, a }) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })),
  };

  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.text = JSON.stringify(faqSchema);
    document.head.appendChild(script);
    return () => { document.head.removeChild(script); };
  }, []);

  return (
    <div className="min-h-screen pt-16" style={{ 
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
    }}>
      <PageMeta
        title="Online Slots, Fish, Table & Sports Games | Global Ace Gaming"
        description="Play online slots, online fish games, online table games, and sports in one platform. Bonuses, how to play, and support. Get started in minutes."
      />
      {/* Decorative glowing orbs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-40 animate-pulse" style={{ backgroundColor: '#6A1B9A' }}></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-35 animate-ping" style={{ backgroundColor: '#00B0FF' }}></div>
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-30 animate-pulse" style={{ backgroundColor: '#FFD700' }}></div>
        <div className="absolute top-1/3 right-1/3 w-32 h-32 rounded-full blur-3xl opacity-25 animate-bounce" style={{ backgroundColor: '#00C853' }}></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-6 py-4 sm:py-6 lg:py-8">
        {/* H1 + short intro — keep top minimal */}
        <div className="text-center mb-4 sm:mb-5">
          <h1 className="text-xl sm:text-2xl md:text-3xl lg:text-4xl font-bold casino-text-primary mb-1.5 sm:mb-2">
            Online Slots, Fish, Table & Sports Games in One Place
          </h1>
          <p className="text-sm casino-text-secondary px-2 max-w-2xl mx-auto">
            Play <strong className="casino-text-primary">online slots</strong>, <strong className="casino-text-primary">online fish games</strong>, and <strong className="casino-text-primary">online table games</strong> from one platform. Pick a category below to start.
          </p>
        </div>

        {/* Categories — right under header */}
        <div className="flex flex-wrap justify-center gap-1.5 sm:gap-2 lg:gap-3 mb-4 sm:mb-6 lg:mb-8 px-1 sm:px-2">
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

        {/* ——— About & how to play (below the fold, SEO content) ——— */}
        <div className="border-t border-white/10 pt-8 sm:pt-10 mt-8 sm:mt-10">
          {/* Game types (H2 + H3s) — moved from top for clearer layout */}
          <section id="game-types" className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold casino-text-primary mb-2">What Kinds of Games Can You Play?</h2>
            <p className="text-sm casino-text-secondary mb-3">We offer sweepstakes games across several types. Online slots, online fish games, online table games, and sports are all here.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3 text-sm">
              <div className="casino-bg-secondary/40 rounded-lg p-3"><h3 className="font-semibold casino-text-primary mb-0.5">Online Slots</h3><p className="casino-text-secondary text-xs sm:text-sm">Video slot–style games. Filter by category, try different themes, play on desktop or mobile.</p></div>
              <div className="casino-bg-secondary/40 rounded-lg p-3"><h3 className="font-semibold casino-text-primary mb-0.5">Online Fish Games</h3><p className="casino-text-secondary text-xs sm:text-sm">Fish table and redemption-style play—similar to Milkyway, Orionstars, Juwa, Gamevault, Firekirin. Skill-based, community jackpots.</p></div>
              <div className="casino-bg-secondary/40 rounded-lg p-3"><h3 className="font-semibold casino-text-primary mb-0.5">Online Table Games</h3><p className="casino-text-secondary text-xs sm:text-sm">Live and table-style play for a social, live feel without visiting multiple sites.</p></div>
              <div className="casino-bg-secondary/40 rounded-lg p-3"><h3 className="font-semibold casino-text-primary mb-0.5">Sports-Style Games</h3><p className="casino-text-secondary text-xs sm:text-sm">Sports-themed options in the same lobby. Switch between slots, fish, table, and sports in one place.</p></div>
            </div>
          </section>

          {/* How to Get Started */}
          <section id="how-to-play" className="mb-6 sm:mb-8 casino-bg-secondary/40 rounded-xl p-3 sm:p-4 casino-border">
            <h2 className="text-base sm:text-lg font-bold casino-text-primary mb-2">How to Get Started</h2>
            <p className="text-sm casino-text-secondary mb-2">Getting started is straightforward. You don’t need to be an expert to play online slots, online fish games, or online table games here.</p>
            <ol className="list-decimal list-inside space-y-1 text-sm casino-text-secondary">
              <li><strong className="casino-text-primary">Create an account</strong> — Register with your email and a few details. Quick and secure.</li>
              <li><strong className="casino-text-primary">Explore the game lobby</strong> — Open the games section. Everything is grouped by type: slots, fish, table, and sports.</li>
              <li><strong className="casino-text-primary">Choose a game and start</strong> — Click a game to see how it works, then start playing. For tips and FAQs, see <Link to="/support" className="text-yellow-400 hover:underline">Support</Link>.</li>
            </ol>
          </section>

          {/* Bonuses */}
          <section className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold casino-text-primary mb-2">Bonuses and Promotions</h2>
            <p className="text-sm casino-text-secondary">We run bonuses and promotions that can be used across our game types. To see what’s currently available, check our <Link to="/bonuses" className="text-yellow-400 hover:underline">Bonuses</Link> page. Offers may change; terms are described clearly for each offer.</p>
          </section>

          {/* Why Choose */}
          <section className="mb-6 sm:mb-8 casino-bg-secondary/40 rounded-xl p-3 sm:p-4 casino-border">
            <h2 className="text-base sm:text-lg font-bold casino-text-primary mb-2">Why Choose a Platform Like Global Ace Gaming?</h2>
            <p className="text-sm casino-text-secondary mb-2">We aim to make it simpler: one place for online slots, online fish games, online table games, and sports, with clear rules and support.</p>
            <ul className="space-y-1 text-sm casino-text-secondary">
              <li><strong className="casino-text-primary">One place for multiple game types</strong> — Try online slots, fish, table, and sports here. One account, one lobby.</li>
              <li><strong className="casino-text-primary">Play on desktop or mobile</strong> — Games work in the browser. No extra software unless we say so.</li>
              <li><strong className="casino-text-primary">Support when you need it</strong> — Our <Link to="/support" className="text-yellow-400 hover:underline">Support</Link> team can help. We also share responsible gaming information and tips.</li>
            </ul>
          </section>

          {/* FAQ */}
          <section className="mb-6 sm:mb-8">
            <h2 className="text-base sm:text-lg font-bold casino-text-primary mb-2">Frequently Asked Questions</h2>
            <dl className="space-y-2 text-sm">
              {faqItems.map(({ q, a }) => (
                <div key={q}>
                  <dt className="font-semibold casino-text-primary">{q}</dt>
                  <dd className="casino-text-secondary mt-0.5 pl-0">{a}</dd>
                </div>
              ))}
            </dl>
          </section>

          {/* CTA */}
          <section className="text-center">
            <h2 className="text-base sm:text-lg font-bold casino-text-primary mb-2">Ready to Explore Our Games?</h2>
            <p className="text-sm casino-text-secondary">You can <Link to="/games" className="text-yellow-400 hover:underline">browse our games</Link>, <Link to="/bonuses" className="text-yellow-400 hover:underline">see our bonuses</Link>, or <Link to="/support" className="text-yellow-400 hover:underline">contact support</Link> if you have questions.</p>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Games;
