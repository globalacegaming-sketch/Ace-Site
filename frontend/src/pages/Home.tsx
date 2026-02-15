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

      {/* Main content wrapper — consistent dark background */}
      <div style={{ background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)' }}>

        {/* Decorative orbs */}
        <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
          <div className="absolute top-[80vh] left-10 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse" style={{ backgroundColor: 'var(--casino-accent-purple)' }} />
          <div className="absolute top-[160vh] right-10 w-72 h-72 rounded-full blur-3xl opacity-15" style={{ backgroundColor: 'var(--casino-accent-blue)' }} />
        </div>

        {/* 1. Popular Games Section */}
        <section className="relative z-10 py-10 sm:py-14 lg:py-16 px-3 sm:px-4 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold casino-text-primary mb-3 sm:mb-4">
                Popular Games
              </h2>
              <p className="text-sm sm:text-base casino-text-secondary">
                Join thousands of players enjoying our most popular titles
              </p>
            </div>

            {loading ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {Array.from({ length: 3 }, (_, i) => (
                  <GameCardSkeleton key={i} />
                ))}
              </div>
            ) : error ? (
              <div className="text-center py-10 sm:py-14">
                <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-6 sm:p-8 max-w-md mx-auto casino-border border" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
                  <p className="mb-4 sm:mb-6 text-sm sm:text-base font-semibold" style={{ color: '#E53935' }}>{error}</p>
                  <button
                    onClick={fetchGames}
                    className="py-2.5 sm:py-3 px-6 sm:px-8 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
                    style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)', color: '#0A0A0F' }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            ) : popularGames.length === 0 ? (
              <div className="text-center py-10 sm:py-14">
                <p className="text-sm sm:text-base casino-text-secondary">No games available right now</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
                {popularGames.map((game) => (
                  <div
                    key={game.kindId}
                    className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border overflow-hidden group transition-all duration-300 hover:border-[#FFD700]/40 hover:scale-[1.03]"
                    style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                  >
                    <div className="relative h-40 sm:h-48 lg:h-52">
                      <LazyImage src={game.gameLogo} alt={game.gameName} />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                        <button
                          onClick={handlePlayGame}
                          className="py-2.5 px-5 rounded-lg font-bold text-sm transition-all duration-200 hover:scale-110 active:scale-95 touch-manipulation flex items-center gap-2"
                          style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)', color: '#0A0A0F', boxShadow: '0 0 15px rgba(255,215,0,0.3)' }}
                        >
                          <Play className="w-4 h-4" />
                          {isAuthenticated ? 'Play Now' : 'Login to Play'}
                        </button>
                      </div>
                    </div>
                    <div className="p-3 sm:p-4 lg:p-5">
                      <h3 className="text-sm sm:text-base font-bold casino-text-primary mb-1">{game.gameName}</h3>
                      <p className="text-xs casino-text-secondary mb-2 sm:mb-3">{game.gameType}</p>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 fill-current" style={{ color: '#FFD700' }} />
                          <span className="font-semibold text-xs casino-text-primary">4.8</span>
                        </div>
                        <div className="flex items-center gap-1 casino-text-secondary">
                          <Users className="w-3.5 h-3.5" />
                          <span className="text-xs">Live</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="text-center mt-6 sm:mt-8">
              <Link
                to="/games"
                className="inline-block py-2.5 sm:py-3 px-6 sm:px-8 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
                style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)', color: '#0A0A0F', boxShadow: '0 0 15px rgba(255,215,0,0.25)' }}
              >
                View All Games
              </Link>
            </div>
          </div>
        </section>

        {/* 2. CTA Section — Ready to Start */}
        <section className="relative z-10 py-10 sm:py-14 lg:py-16 px-3 sm:px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div
              className="rounded-xl sm:rounded-2xl p-6 sm:p-10 text-center"
              style={{
                background: 'linear-gradient(135deg, rgba(255,215,0,0.1) 0%, rgba(139,0,0,0.2) 50%, rgba(255,215,0,0.1) 100%)',
                border: '1px solid rgba(255,215,0,0.2)',
                boxShadow: '0 4px 30px rgba(0,0,0,0.3)',
              }}
            >
              <h2 className="text-xl sm:text-3xl font-bold casino-text-primary mb-3 sm:mb-4">
                Ready to Start Your Gaming Journey?
              </h2>
              <p className="text-sm sm:text-base casino-text-secondary mb-5 sm:mb-8 max-w-2xl mx-auto">
                Join thousands of players and experience the ultimate gaming platform
              </p>
              <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center">
                <button
                  onClick={handleGetStartedClick}
                  className="py-2.5 sm:py-3 px-6 sm:px-8 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation"
                  style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)', color: '#0A0A0F', boxShadow: '0 0 15px rgba(255,215,0,0.25)' }}
                >
                  {isAuthenticated ? 'Go to Dashboard' : 'Get Started Now'}
                </button>
                <button
                  onClick={handleLearnMoreClick}
                  className="py-2.5 sm:py-3 px-6 sm:px-8 rounded-lg font-semibold text-sm sm:text-base transition-all duration-200 hover:scale-105 active:scale-95 touch-manipulation casino-text-primary"
                  style={{ border: '2px solid rgba(255,215,0,0.4)', background: 'rgba(255,255,255,0.04)' }}
                >
                  Learn More
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* 3. Operating Hours Section */}
        <section className="relative z-10 py-10 sm:py-14 lg:py-16 px-3 sm:px-4 lg:px-8">
          <div className="max-w-4xl mx-auto">
            <div className="text-center mb-6 sm:mb-8">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold casino-text-primary mb-3 sm:mb-4">
                Operating Hours
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
              {/* Open */}
              <div
                className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border p-4 sm:p-6 flex items-center gap-3 sm:gap-4"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderColor: 'rgba(34,197,94,0.25)' }}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(34,197,94,0.15)' }}>
                  <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-green-500" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-semibold casino-text-primary">Open Hours</p>
                  <p className="text-xs sm:text-sm casino-text-secondary">6:00 PM – 12:00 PM (CST) next day</p>
                </div>
              </div>

              {/* Closed */}
              <div
                className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border p-4 sm:p-6 flex items-center gap-3 sm:gap-4"
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)', borderColor: 'rgba(239,68,68,0.25)' }}
              >
                <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'rgba(239,68,68,0.15)' }}>
                  <div className="w-3 h-3 sm:w-3.5 sm:h-3.5 rounded-full bg-red-500" />
                </div>
                <div>
                  <p className="text-sm sm:text-base font-semibold casino-text-primary">Closed Hours</p>
                  <p className="text-xs sm:text-sm casino-text-secondary">12:00 PM – 6:00 PM (CST)</p>
                </div>
              </div>
            </div>

            <p className="text-center text-xs sm:text-sm casino-text-secondary italic max-w-xl mx-auto leading-relaxed">
              We sincerely apologize for any inconvenience this may cause and truly appreciate your patience, understanding, and continued support.
            </p>
          </div>
        </section>

        {/* 4. Why Choose — Features Section */}
        <section className="relative z-10 py-10 sm:py-14 lg:py-16 px-3 sm:px-4 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold casino-text-primary mb-3 sm:mb-4">
                Why Choose Global Ace Gaming?
              </h2>
              <p className="text-sm sm:text-base casino-text-secondary max-w-3xl mx-auto">
                Experience gaming excellence with our cutting-edge platform designed for champions
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {features.map((feature) => (
                <div
                  key={feature.id}
                  className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border p-4 sm:p-6 text-center transition-all duration-300 hover:border-[#FFD700]/40"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  <div
                    className="w-11 h-11 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4"
                    style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.15), rgba(255,165,0,0.08))', border: '1px solid rgba(255,215,0,0.2)' }}
                  >
                    <feature.icon className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: '#FFD700' }} />
                  </div>
                  <h3 className="text-sm sm:text-base font-bold casino-text-primary mb-1 sm:mb-2">{feature.title}</h3>
                  <p className="text-[11px] sm:text-xs casino-text-secondary leading-relaxed">{feature.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Game Categories — SEO block (last) */}
        <section className="relative z-10 py-10 sm:py-14 lg:py-16 px-3 sm:px-4 lg:px-8">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-6 sm:mb-10">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold casino-text-primary mb-3 sm:mb-4">
                Play Online Slots, Fish & Table Games in One Place
              </h2>
              <p className="text-sm sm:text-base casino-text-secondary max-w-3xl mx-auto">
                Global Ace Gaming gives you slots, fish-style games, table games, and sports in a single platform. Create an account, pick a category, and start playing.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-6">
              {[
                { title: 'Online Slots', desc: 'Video slot-style games, multiple themes and features.', icon: '🎰' },
                { title: 'Fish Games', desc: 'Arcade-style games similar to Milkyway, Orionstars, Juwa & more.', icon: '🐟' },
                { title: 'Table Games', desc: 'Live and table-style games for classic casino fans.', icon: '🃏' },
                { title: 'Sports', desc: 'Sports-themed options in the same lobby.', icon: '🏆' },
              ].map((cat, i) => (
                <Link
                  key={i}
                  to="/games"
                  className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border p-4 sm:p-5 text-center transition-all duration-300 hover:border-[#FFD700]/40 hover:scale-[1.03] group"
                  style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
                >
                  <div className="text-3xl sm:text-4xl mb-2 sm:mb-3 group-hover:scale-110 transition-transform duration-300">{cat.icon}</div>
                  <h3 className="text-sm sm:text-base font-bold casino-text-primary mb-1">{cat.title}</h3>
                  <p className="text-[11px] sm:text-xs casino-text-secondary leading-relaxed">{cat.desc}</p>
                </Link>
              ))}
            </div>

            <div className="flex justify-center gap-3 mt-6 sm:mt-8 text-xs sm:text-sm casino-text-secondary">
              <span>See <Link to="/games" className="font-semibold hover:underline" style={{ color: '#FFD700' }}>Games</Link></span>
              <span className="opacity-30">|</span>
              <span>Check <Link to="/bonuses" className="font-semibold hover:underline" style={{ color: '#FFD700' }}>Bonuses</Link></span>
              <span className="opacity-30">|</span>
              <span>Need help? <Link to="/support" className="font-semibold hover:underline" style={{ color: '#FFD700' }}>Support</Link></span>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
};

export default Home;
