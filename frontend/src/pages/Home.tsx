import { useState, useEffect } from 'react';
import { Star, Trophy, Shield, Zap, Users, Gamepad2, Crown, Globe, LogIn, Play, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { getGamesApiUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

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
        const gamesData = response.data.data;
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
  const handleLoginClick = () => {
    navigate('/login');
  };

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
      title: '24/7 Support',
      description: 'Our dedicated team is available round the clock to assist you',
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


  const stats = [
    { label: 'Active Players', value: '50K+', icon: Users },
    { label: 'Games Available', value: '500+', icon: Gamepad2 },
    { label: 'Total Payouts', value: '$10M+', icon: Trophy },
    { label: 'Countries', value: '25+', icon: Globe }
  ];

  // useEffect(() => {
  //   const interval = setInterval(() => {
  //     setCurrentBannerIndex((prev) => (prev + 1) % heroBanners.length);
  //   }, 5000);
  //   return () => clearInterval(interval);
  // }, [heroBanners.length]);

  return (
    <div className="min-h-screen pt-16">
      {/* Promotional Banner Section - Fixed to Screen */}
      <section style={{ backgroundColor: '#0A0A0F' }}>
        <div className="max-w-7xl mx-auto">
          <div className="casino-promo-banner p-6 sm:p-8 md:p-12 relative overflow-hidden shadow-2xl">
            {/* Enhanced Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-4 right-4 w-16 sm:w-24 lg:w-32 h-16 sm:h-24 lg:h-32 rounded-full opacity-20 animate-pulse" style={{ backgroundColor: '#FFD700' }}></div>
              <div className="absolute bottom-4 left-4 w-12 sm:w-16 lg:w-24 h-12 sm:h-16 lg:h-24 rounded-full opacity-30 animate-bounce" style={{ backgroundColor: '#E53935' }}></div>
              <div className="absolute top-1/2 right-1/4 w-8 sm:w-12 lg:w-16 h-8 sm:h-12 lg:h-16 rounded-full opacity-25 animate-pulse" style={{ backgroundColor: '#00C853' }}></div>
              <div className="absolute top-1/3 left-1/3 w-6 sm:w-8 lg:w-12 h-6 sm:h-8 lg:h-12 rounded-full opacity-15 animate-ping" style={{ backgroundColor: '#00B0FF' }}></div>
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between">
              {/* Enhanced Left Content */}
              <div className="text-center lg:text-left mb-6 lg:mb-0 lg:flex-1">
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs sm:text-sm font-semibold mb-3" style={{ backgroundColor: 'rgba(255, 215, 0, 0.1)', color: '#FFD700', border: '1px solid #FFD700' }}>
                  🎉 Welcome Bonus Offer
                </div>
                <div className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-bold mb-3 sm:mb-4" style={{ 
                  color: '#FFD700',
                  textShadow: '0 0 20px rgba(255, 215, 0, 0.5)',
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent'
                }}>
                  100% up to $100
                </div>
                <div className="casino-text-primary text-sm sm:text-base lg:text-lg mb-4 sm:mb-6 leading-relaxed">
                  + Referral Bonus, VIP Rewards and much more (25 on Sign up)
                </div>
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                  <button 
                    onClick={handleLoginClick}
                    className="btn-casino-primary py-3 sm:py-4 px-6 sm:px-8 rounded-full text-sm sm:text-base lg:text-lg transform hover:scale-105 transition-all duration-300 shadow-lg"
                  >
                    <LogIn className="w-4 h-4 sm:w-5 sm:h-5 mr-2 inline" />
                    Login Now
                  </button>
                  <button 
                    onClick={handleGetStartedClick}
                    className="btn-casino-outline py-3 sm:py-4 px-6 sm:px-8 rounded-full text-sm sm:text-base lg:text-lg transform hover:scale-105 transition-all duration-300"
                  >
                    Get Started
                </button>
                </div>
              </div>

              {/* Enhanced Right Graphics */}
              <div className="lg:flex-1 flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Enhanced Casino Slot Machine */}
                  <div className="w-32 h-32 sm:w-40 sm:h-40 lg:w-48 lg:h-48 rounded-2xl flex items-center justify-center relative shadow-2xl" style={{ 
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)'
                  }}>
                    <div className="text-7xl sm:text-8xl lg:text-9xl animate-pulse">🎰</div>
                    
                    {/* Enhanced Floating Elements */}
                    <div className="absolute -top-3 -right-3 w-10 h-10 rounded-full flex items-center justify-center shadow-xl animate-bounce" style={{ backgroundColor: '#FFD700' }}>
                      <span className="text-xl">💰</span>
                        </div>
                    <div className="absolute -bottom-3 -left-3 w-8 h-8 rounded-full flex items-center justify-center shadow-xl animate-pulse" style={{ backgroundColor: '#E53935' }}>
                      <span className="text-sm">💎</span>
                    </div>
                    <div className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center shadow-lg animate-ping" style={{ backgroundColor: '#00C853' }}>
                      <span className="text-xs">⭐</span>
                    </div>
                    <div className="absolute bottom-2 left-2 w-5 h-5 rounded-full flex items-center justify-center shadow-lg animate-bounce" style={{ backgroundColor: '#00B0FF' }}>
                      <span className="text-xs">🎯</span>
                    </div>
                  </div>
                  
                  {/* Additional Decorative Elements */}
                  <div className="absolute -top-6 -left-6 w-4 h-4 rounded-full animate-ping" style={{ backgroundColor: '#6A1B9A' }}></div>
                  <div className="absolute -bottom-6 -right-6 w-3 h-3 rounded-full animate-pulse" style={{ backgroundColor: '#FFD700' }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 casino-bg-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 casino-text-primary">
              Why Choose Global Ace Gaming?
            </h2>
            <p className="text-base sm:text-lg lg:text-xl max-w-3xl mx-auto casino-text-secondary">
              Experience gaming excellence with our cutting-edge platform designed for champions
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {features.map((feature) => (
              <div key={feature.id} className="text-center group">
                <div className="casino-feature-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-4 sm:mb-6 transform group-hover:scale-110 transition-all duration-300 shadow-lg hover:shadow-xl">
                  <feature.icon className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto" style={{ color: '#FFD700' }} />
                </div>
                <h3 className="text-lg sm:text-xl font-bold mb-2 sm:mb-3 casino-text-primary">{feature.title}</h3>
                <p className="text-sm sm:text-base casino-text-secondary">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Games Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4" style={{ background: 'linear-gradient(135deg, #0A0A0F 0%, #1B1B2F 100%)' }}>
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-8 sm:mb-12 lg:mb-16">
            <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-3 sm:mb-4 casino-text-primary">
              Popular Games
            </h2>
            <p className="text-base sm:text-lg lg:text-xl casino-text-secondary">
              Join thousands of players enjoying our most popular titles
            </p>
          </div>

          {loading ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="w-12 h-12 animate-spin" style={{ color: '#FFD700' }} />
            </div>
          ) : error ? (
            <div className="text-center py-20">
              <div className="casino-bg-secondary rounded-xl p-8 max-w-md mx-auto casino-border" style={{ borderColor: '#E53935' }}>
                <p className="mb-6 text-lg font-semibold" style={{ color: '#E53935' }}>{error}</p>
                <button
                  onClick={fetchGames}
                  className="btn-casino-primary py-3 px-8 rounded-full"
                >
                  Try Again
                </button>
              </div>
            </div>
          ) : popularGames.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-lg casino-text-secondary">No games available right now 🚫</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {popularGames.map((game) => (
                <div key={game.kindId} className="casino-game-card rounded-xl sm:rounded-2xl overflow-hidden group hover:transform hover:scale-105 transition-all duration-300 shadow-lg hover:shadow-xl">
                <div className="relative">
                  <img 
                      src={game.gameLogo}
                      alt={game.gameName}
                      className="w-full h-40 sm:h-48 object-cover"
                      onError={(e) => {
                        e.currentTarget.src = 'https://via.placeholder.com/300x300/1B1B2F/FFD700?text=Game';
                      }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                      <button 
                        onClick={handlePlayGame}
                        className="btn-casino-primary py-2 sm:py-3 px-4 sm:px-6 rounded-full text-sm sm:text-base transform hover:scale-110 transition-all duration-300"
                      >
                        <Play className="w-4 h-4 mr-2 inline" />
                        {isAuthenticated ? 'Play Now' : 'Login to Play'}
                    </button>
                  </div>
                </div>
                  <div className="p-4 sm:p-6">
                    <h3 className="text-lg sm:text-xl font-bold mb-2 casino-text-primary">{game.gameName}</h3>
                    <p className="mb-3 sm:mb-4 text-sm sm:text-base casino-text-secondary">{game.gameType}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                        <Star className="w-4 h-4 sm:w-5 sm:h-5 fill-current" style={{ color: '#FFD700' }} />
                        <span className="font-semibold text-sm sm:text-base casino-text-primary">4.8</span>
                    </div>
                      <div className="flex items-center gap-1 casino-text-secondary">
                        <Users className="w-3 h-3 sm:w-4 sm:h-4" />
                        <span className="text-xs sm:text-sm">Live</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          )}

          <div className="text-center mt-8 sm:mt-12">
            <Link to="/games">
              <button className="btn-casino-primary py-3 sm:py-4 px-6 sm:px-8 rounded-full text-sm sm:text-base lg:text-lg transform hover:scale-105 transition-all duration-300 shadow-lg">
                View All Games
              </button>
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 casino-bg-secondary">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 sm:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="casino-stats-card p-4 sm:p-6 rounded-xl sm:rounded-2xl mb-3 sm:mb-4 shadow-lg">
                  <stat.icon className="w-8 h-8 sm:w-10 sm:h-10 lg:w-12 lg:h-12 mx-auto" style={{ color: '#FFD700' }} />
                </div>
                <div className="text-2xl sm:text-3xl lg:text-4xl font-bold mb-1 sm:mb-2 casino-text-primary">{stat.value}</div>
                <div className="text-sm sm:text-base casino-text-secondary">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 lg:py-20 px-4 casino-cta-section">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold mb-4 sm:mb-6 casino-text-primary">
            Ready to Start Your Gaming Journey?
          </h2>
          <p className="text-base sm:text-lg lg:text-xl mb-6 sm:mb-8 casino-text-secondary">
            Join thousands of players and experience the ultimate gaming platform
          </p>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
            <button 
              onClick={handleGetStartedClick}
              className="btn-casino-primary py-3 sm:py-4 px-6 sm:px-8 rounded-full text-sm sm:text-base lg:text-lg transform hover:scale-105 transition-all duration-300"
            >
              {isAuthenticated ? 'Go to Dashboard' : 'Get Started Now'}
            </button>
            <button 
              onClick={handleLearnMoreClick}
              className="btn-casino-outline py-3 sm:py-4 px-6 sm:px-8 rounded-full text-sm sm:text-base lg:text-lg transform hover:scale-105 transition-all duration-300"
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
