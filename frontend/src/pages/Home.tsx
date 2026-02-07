import { useState, useEffect } from 'react';
import { Star, Shield, Zap, Users, Crown, Play } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGamesApiUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import { useMusic } from '../contexts/MusicContext';
import { PageMeta } from '../components/PageMeta';
import { LazyImage } from '../components/LazyImage';
import { GameCardSkeleton } from '../components/skeletons/GameCardSkeleton';

interface Game {
  kindId: number;
  gameName: string;
  gameType: string;
  gameLogo: string;
}

const Home = () => {
  const [games, setGames] = useState<Game[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { isAuthenticated } = useAuthStore();
  const navigate = useNavigate();
  const { stopMusic } = useMusic();

  // Stop music on home page if user is not authenticated
  useEffect(() => {
    if (!isAuthenticated) {
      stopMusic();
    }
  }, [isAuthenticated, stopMusic]);

  useEffect(() => {
    fetchGames();
  }, []);

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

  // Get first 3 games as popular games
  const popularGames = Array.isArray(games) ? games.slice(0, 3) : [];

  // Handler functions
  const handleGetStartedClick = () => {
    if (isAuthenticated) {
      navigate('/dashboard');
    } else {
      navigate('/register');
    }
  };

  const handleLearnMoreClick = () => {
    navigate('/about-us');
  };

  const handlePlayGame = () => {
    if (isAuthenticated) {
      // Navigate to game launch or dashboard
      navigate('/dashboard');
    } else {
      // Show login prompt
      const shouldLogin = window.confirm('Please login to play games. Would you like to login now?');
      if (shouldLogin) {
        navigate('/login');
      }
    }
  };

  const features = [
    {
      id: '1',
      title: 'Instant Payouts',
      description: 'Get your winnings instantly with our lightning-fast payment system',
      icon: Zap,
      color: 'text-yellow-500'
    },
    {
      id: '2',
      title: 'Instant Support',
      description: 'Our dedicated team is available round the clock to assist you during our Operating Hours',
      icon: Shield,
      color: 'text-blue-500'
    },
    {
      id: '3',
      title: 'Exclusive Games',
      description: 'Access to premium games not available anywhere else',
      icon: Crown,
      color: 'text-purple-500'
    },
    {
      id: '4',
      title: 'Secure Platform',
      description: 'Bank-grade security to protect your data and transactions',
      icon: Shield,
      color: 'text-green-500'
    }
  ];



  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length);
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, [heroBanners.length]);

  return (
    <div className="min-h-screen">
      <PageMeta
        title="Online Slots, Fish & Table Games | Play in One Place | Global Ace Gaming"
        description="Play online slots, online fish games, and online table games in one platform. Global Ace Gaming offers bonuses and support. Desktop and mobile."
      />
      {/* Hero Header Section */}
      <section className="py-12 sm:py-16 md:py-20 lg:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden min-h-[70vh] flex items-center justify-center" style={{ 
        background: 'linear-gradient(135deg, #3B82F6 0%, #6366F1 50%, #8B5CF6 100%)'
      }}>
        {/* Decorative Circular Elements */}
        <div className="absolute top-4 right-4 w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-full opacity-20" style={{ 
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.3) 0%, transparent 70%)',
          filter: 'blur(20px)'
        }}></div>
        <div className="absolute bottom-4 left-4 w-24 h-24 sm:w-32 sm:h-32 lg:w-40 lg:h-40 rounded-full opacity-20" style={{ 
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.3) 0%, transparent 70%)',
          filter: 'blur(20px)'
        }}></div>
        <div className="absolute top-1/2 right-1/4 w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full opacity-15" style={{ 
          background: 'radial-gradient(circle, rgba(34, 197, 94, 0.2) 0%, transparent 70%)',
          filter: 'blur(15px)'
        }}></div>
        <div className="absolute bottom-1/4 left-1/3 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full opacity-15" style={{ 
          background: 'radial-gradient(circle, rgba(59, 130, 246, 0.2) 0%, transparent 70%)',
          filter: 'blur(15px)'
        }}></div>
        
        {/* Subtle Bubbles */}
        <div className="absolute top-20 left-10 sm:top-24 sm:left-16 lg:top-32 lg:left-20 w-16 h-16 sm:w-20 sm:h-20 lg:w-24 lg:h-24 rounded-full" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.35)',
          filter: 'blur(6px)',
          boxShadow: '0 0 30px rgba(255, 255, 255, 0.25)'
        }}></div>
        <div className="absolute top-32 right-12 sm:top-40 sm:right-20 lg:top-48 lg:right-32 w-12 h-12 sm:w-16 sm:h-16 lg:w-20 lg:h-20 rounded-full" style={{ 
          backgroundColor: 'rgba(147, 197, 253, 0.4)',
          filter: 'blur(6px)',
          boxShadow: '0 0 25px rgba(147, 197, 253, 0.3)'
        }}></div>
        <div className="absolute bottom-24 right-16 sm:bottom-32 sm:right-24 lg:bottom-40 lg:right-40 w-18 h-18 sm:w-22 sm:h-22 lg:w-28 lg:h-28 rounded-full" style={{ 
          backgroundColor: 'rgba(196, 181, 253, 0.35)',
          filter: 'blur(6px)',
          boxShadow: '0 0 30px rgba(196, 181, 253, 0.25)'
        }}></div>
        <div className="absolute bottom-20 left-12 sm:bottom-28 sm:left-20 lg:bottom-36 lg:left-32 w-14 h-14 sm:w-18 sm:h-18 lg:w-22 lg:h-22 rounded-full" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.3)',
          filter: 'blur(6px)',
          boxShadow: '0 0 25px rgba(255, 255, 255, 0.2)'
        }}></div>
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-10 h-10 sm:w-14 sm:h-14 lg:w-16 lg:h-16 rounded-full" style={{ 
          backgroundColor: 'rgba(165, 243, 252, 0.3)',
          filter: 'blur(6px)',
          boxShadow: '0 0 20px rgba(165, 243, 252, 0.2)'
        }}></div>
        
        {/* Logo as Background */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none overflow-hidden">
          <img 
            src="/logo.png" 
            alt="Global Ace Gaming Logo" 
            className="w-64 h-64 sm:w-80 sm:h-80 md:w-96 md:h-96 lg:w-[500px] lg:h-[500px] object-contain"
            style={{
              opacity: 0.2,
              filter: 'blur(3px)',
              maxWidth: '100%',
              maxHeight: '100%',
            }}
            onError={(e) => {
              // Fallback if logo doesn't load
              e.currentTarget.style.display = 'none';
            }}
          />
        </div>
        
        <div className="max-w-7xl mx-auto relative z-10 w-full">
          <div className="text-center">
            {/* Welcome Text with Decorative Line */}
            <div className="flex items-center justify-center mb-4 sm:mb-6">
              <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
              <p className="mx-4 sm:mx-6 text-base sm:text-lg md:text-xl lg:text-2xl font-light tracking-wider uppercase casino-text-primary" style={{ letterSpacing: '0.2em' }}>
              Welcome to
            </p>
              <div className="h-px w-12 sm:w-20 bg-gradient-to-r from-transparent via-yellow-500/50 to-transparent"></div>
            </div>
            
            {/* Main Heading - Global Ace Gaming */}
            <h1 
              className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl xl:text-9xl font-black mb-4 sm:mb-6 md:mb-8 leading-tight"
              style={{ 
                color: '#FFD700',
                fontFamily: 'Inter, system-ui, sans-serif',
                fontWeight: 900,
                letterSpacing: '-0.02em',
                textShadow: '3px 3px 6px rgba(0, 0, 0, 0.8)',
              }}
            >
              <span className="block" style={{ color: '#FFD700' }}>Global Ace</span>
              <span className="block bg-gradient-to-r from-yellow-400 via-yellow-500 to-yellow-600 bg-clip-text" style={{
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                color: 'transparent',
                textShadow: 'none',
                filter: 'drop-shadow(3px 3px 6px rgba(0, 0, 0, 0.8))',
              }}>Gaming</span>
            </h1>
            
            {/* Subtitle with Enhanced Styling */}
            <div className="inline-block px-6 sm:px-8 py-2 sm:py-3 rounded-full border" style={{
              background: 'rgba(255, 215, 0, 0.05)',
              borderColor: 'rgba(255, 215, 0, 0.3)',
              backdropFilter: 'blur(10px)',
            }}>
              <h2 className="text-sm sm:text-base md:text-lg lg:text-xl font-semibold tracking-wider uppercase" style={{ 
                color: '#FFD700',
                letterSpacing: '0.15em',
              }}>
                America's Ace Gaming
              </h2>
            </div>
            
            {/* Decorative Bottom Line */}
            <div className="flex items-center justify-center mt-6 sm:mt-8">
              <div className="h-px w-24 sm:w-32 md:w-40 bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent"></div>
            </div>
          </div>
        </div>
      </section>

      {/* SEO: Play online slots, fish, table games in one place */}
      <section className="py-6 sm:py-8 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(135deg, #0A0A0F 0%, #1B1B2F 100%)' }}>
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-lg sm:text-xl font-bold casino-text-primary mb-3">
            Play online slots, online fish games, and online table games in one place
          </h2>
          <p className="text-sm sm:text-base casino-text-secondary mb-4">
            Global Ace Gaming gives you slots, fish-style games, table games, and sports in a single platform. Create an account, pick a category in the lobby, and start playing. See <Link to="/games" className="text-yellow-400 hover:underline">Games</Link> to explore and <Link to="/bonuses" className="text-yellow-400 hover:underline">Bonuses</Link> for current offers. Need help? <Link to="/support" className="text-yellow-400 hover:underline">Support</Link>.
          </p>
          <ul className="text-left inline-block text-sm casino-text-secondary space-y-1">
            <li><strong className="casino-text-primary">Online slots</strong> — Video slot–style games, multiple themes and features.</li>
            <li><strong className="casino-text-primary">Online fish games</strong> — Fish table and arcade-style games similar to Milkyway, Orionstars, Juwa, Gamevault, and Firekirin.</li>
            <li><strong className="casino-text-primary">Online table games</strong> — Live and table-style games.</li>
            <li><strong className="casino-text-primary">Sports</strong> — Sports-themed options in the same lobby.</li>
          </ul>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 casino-bg-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-10 lg:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 casino-text-primary">
              Why Choose Global Ace Gaming?
            </h2>
            <p className="text-sm sm:text-base lg:text-lg max-w-3xl mx-auto casino-text-secondary">
              Experience gaming excellence with our cutting-edge platform designed for champions
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
            {features.map((feature) => (
              <div key={feature.id} className="text-center group">
                <div className="casino-feature-card p-4 sm:p-6 rounded-xl mb-3 sm:mb-4 transform group-hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <feature.icon className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto" style={{ color: '#FFD700' }} />
                </div>
                <h3 className="text-base sm:text-lg font-bold mb-2 casino-text-primary">{feature.title}</h3>
                <p className="text-xs sm:text-sm casino-text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Games Section */}
      <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8" style={{ background: 'linear-gradient(135deg, #0A0A0F 0%, #1B1B2F 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-6 sm:mb-10 lg:mb-12">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 casino-text-primary">
              Popular Games
            </h2>
            <p className="text-sm sm:text-base lg:text-lg casino-text-secondary">
              Join thousands of players enjoying our most popular titles
            </p>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
              {Array.from({ length: 3 }, (_, i) => (
                <GameCardSkeleton key={i} />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-12 sm:py-16">
              <div className="casino-bg-secondary rounded-xl p-6 sm:p-8 max-w-md mx-auto casino-border" style={{ borderColor: '#E53935' }}>
                <p className="mb-4 sm:mb-6 text-base sm:text-lg font-semibold" style={{ color: '#E53935' }}>{error}</p>
                <button
                  onClick={fetchGames}
                  className="btn-casino-primary py-2 sm:py-3 px-6 sm:px-8 rounded-full text-sm sm:text-base"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : popularGames.length === 0 ? (
            <div className="text-center py-12 sm:py-16">
              <p className="text-base sm:text-lg casino-text-secondary">No games available right now 🚫</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8">
            {popularGames.map((game) => (
                <div key={game.kindId} className="casino-game-card rounded-xl overflow-hidden group hover:transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="relative h-36 sm:h-44 lg:h-48">
                  <LazyImage
                    src={game.gameLogo}
                    alt={game.gameName}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button 
                        onClick={handlePlayGame}
                        className="btn-casino-primary py-2 sm:py-3 px-4 sm:px-6 rounded-full text-xs sm:text-sm transform hover:scale-110 transition-all duration-300"
                      >
                        <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-2 inline" />
                        {isAuthenticated ? 'Play Now' : 'Login to Play'}
                    </button>
                  </div>
                </div>
                  <div className="p-3 sm:p-4 lg:p-6">
                    <h3 className="text-base sm:text-lg font-bold mb-2 casino-text-primary">{game.gameName}</h3>
                    <p className="mb-2 sm:mb-3 text-xs sm:text-sm casino-text-secondary">{game.gameType}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <Star className="w-3 h-3 sm:w-4 sm:h-4 fill-current" style={{ color: '#FFD700' }} />
                        <span className="font-semibold text-xs sm:text-sm casino-text-primary">4.8</span>
                    </div>
                      <div className="flex items-center gap-1 casino-text-secondary">
                        <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs">Live</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          <div className="text-center mt-6 sm:mt-8 lg:mt-10">
            <Link to="/games">
              <button className="btn-casino-primary py-2 sm:py-3 px-5 sm:px-7 rounded-full text-sm sm:text-base transform hover:scale-105 transition-all duration-300 shadow-lg">
                View All Games
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Operating Hours Section */}
      <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 casino-bg-secondary">
        <div className="max-w-4xl mx-auto space-y-4 sm:space-y-6">
          {/* Open Hours */}
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="text-2xl sm:text-3xl">🟢</span>
            <div className="flex-1">
              <p className="text-base sm:text-lg font-semibold casino-text-primary mb-1">
                Open Hours:
              </p>
              <p className="text-sm sm:text-base casino-text-secondary">
                6:00 PM – 12:00 PM (CST) (the following day)
              </p>
            </div>
          </div>

          {/* Closed Hours */}
          <div className="flex items-start gap-3 sm:gap-4">
            <span className="text-2xl sm:text-3xl">🔴</span>
            <div className="flex-1">
              <p className="text-base sm:text-lg font-semibold casino-text-primary mb-1">
                Closed Hours:
              </p>
              <p className="text-sm sm:text-base casino-text-secondary">
                12:00 PM – 6:00 PM (CST)
              </p>
            </div>
          </div>

          {/* Divider */}
          <div className="h-px bg-gradient-to-r from-transparent via-yellow-500/30 to-transparent my-4 sm:my-6"></div>


          {/* Apology Message */}
          <div className="flex items-start gap-3 sm:gap-4 pt-2">
            <span className="text-2xl sm:text-3xl">🙏</span>
            <p className="text-sm sm:text-base casino-text-secondary flex-1 italic">
              We sincerely apologize for any inconvenience this may cause and truly appreciate your patience, understanding, and continued support
            </p>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-8 sm:py-12 lg:py-16 px-4 sm:px-6 lg:px-8 casino-cta-section">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 lg:mb-6 casino-text-primary">
            Ready to Start Your Gaming Journey?
          </h2>
          <p className="text-sm sm:text-base lg:text-lg mb-4 sm:mb-6 lg:mb-8 casino-text-secondary">
            Join thousands of players and experience the ultimate gaming platform
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <button 
              onClick={handleGetStartedClick}
              className="btn-casino-primary py-2 sm:py-3 px-5 sm:px-7 rounded-full text-sm sm:text-base transform hover:scale-105 transition-all duration-300"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Now'}
            </button>
            <button 
              onClick={handleLearnMoreClick}
              className="btn-casino-outline py-2 sm:py-3 px-5 sm:px-7 rounded-full text-sm sm:text-base transform hover:scale-105 transition-all duration-300"
            >
              Learn More
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
