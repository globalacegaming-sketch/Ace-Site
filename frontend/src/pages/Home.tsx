// import { useEffect } from 'react';
import { Star, Trophy, Shield, Zap, Users, Gamepad2, Crown, Globe, LogIn } from 'lucide-react';
// import { useContentStore } from '../stores/contentStore';

const Home = () => {
  // const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  // Mock data for now - will be replaced with real API data
  // const heroBanners = [
  //   {
  //     id: '1',
  //     title: 'Welcome to Global Ace Gaming',
  //     subtitle: 'Where Champions Rise & Fortunes Await',
  //     description: 'Experience the ultimate gaming platform with exclusive games, instant payouts, and 24/7 support.',
  //     image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
  //     cta: 'Start Playing Now',
  //     link: '/games'
  //   },
  //   {
  //     id: '2',
  //     title: 'Exclusive VIP Experience',
  //     subtitle: 'Unlock Premium Benefits',
  //     description: 'Join our VIP program and enjoy exclusive bonuses, faster withdrawals, and dedicated support.',
  //     image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?ixlib=rb-4.0.3&auto=format&fit=crop&w=2071&q=80',
  //     cta: 'Become VIP',
  //     link: '/vip'
  //   }
  // ];

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

  const popularGames = [
    {
      id: '1',
      name: 'Fortune Dragon',
      platform: 'Pragmatic Play',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
      rating: 4.8,
      players: 1250
    },
    {
      id: '2',
      name: 'Mystic Fortune',
      platform: 'NetEnt',
      image: 'https://images.unsplash.com/photo-1511512578047-dfb367046420?ixlib=rb-4.0.3&auto=format&fit=crop&w=2071&q=80',
      rating: 4.9,
      players: 980
    },
    {
      id: '3',
      name: 'Golden Empire',
      platform: 'Microgaming',
      image: 'https://images.unsplash.com/photo-1542751371-adc38448a05e?ixlib=rb-4.0.3&auto=format&fit=crop&w=2070&q=80',
      rating: 4.7,
      players: 1560
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
    <div className="min-h-screen">
      {/* Promotional Banner Section */}
      <section className="relative py-16 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="bg-gradient-to-r from-purple-600 via-blue-600 to-indigo-600 rounded-3xl p-8 md:p-12 relative overflow-hidden">
            {/* Background decorative elements */}
            <div className="absolute inset-0 overflow-hidden">
              <div className="absolute top-4 right-4 w-32 h-32 bg-yellow-400 rounded-full opacity-20 animate-pulse"></div>
              <div className="absolute bottom-4 left-4 w-24 h-24 bg-red-400 rounded-full opacity-30 animate-bounce"></div>
              <div className="absolute top-1/2 right-1/4 w-16 h-16 bg-green-400 rounded-full opacity-25 animate-pulse"></div>
            </div>

            <div className="relative z-10 flex flex-col lg:flex-row items-center justify-between">
              {/* Left Content */}
              <div className="text-center lg:text-left mb-8 lg:mb-0 lg:flex-1">
                <div className="text-white text-sm font-semibold mb-2">Exclusive Bonus Offer</div>
                <div className="text-4xl md:text-6xl font-bold text-yellow-400 mb-4">
                  125% up to $100
                </div>
                <div className="text-white text-lg mb-6">
                  + 180 Free Spins (25 on Sign up)
                </div>
                <button className="bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold py-4 px-8 rounded-full text-lg hover:from-yellow-500 hover:to-yellow-600 transition-all duration-300 shadow-lg">
                  <LogIn className="w-5 h-5 mr-2 inline" />
                  Login
                </button>
              </div>

              {/* Right Graphics - Crab Character */}
              <div className="lg:flex-1 flex justify-center lg:justify-end">
                <div className="relative">
                  {/* Crab Character Placeholder */}
                  <div className="w-48 h-48 bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center relative">
                    <div className="w-32 h-32 bg-red-500 rounded-full flex items-center justify-center">
                      <div className="w-24 h-24 bg-red-600 rounded-full flex items-center justify-center">
                        <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center">
                          <span className="text-2xl">🦀</span>
                        </div>
                      </div>
                    </div>
                    {/* Gold coin */}
                    <div className="absolute top-4 right-4 w-8 h-8 bg-yellow-400 rounded-full flex items-center justify-center shadow-lg">
                      <span className="text-lg">💰</span>
                    </div>
                    {/* Gems */}
                    <div className="absolute bottom-4 left-4 flex space-x-1">
                      <div className="w-4 h-4 bg-red-500 rounded"></div>
                      <div className="w-4 h-4 bg-green-500 rounded"></div>
                      <div className="w-4 h-4 bg-blue-500 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Why Choose Global Ace Gaming?
            </h2>
            <p className="text-xl text-gray-300 max-w-3xl mx-auto">
              Experience gaming excellence with our cutting-edge platform designed for champions
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
            {features.map((feature) => (
              <div key={feature.id} className="text-center group">
                <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-2xl mb-6 transform group-hover:scale-110 transition-all duration-300">
                  <feature.icon className={`w-12 h-12 ${feature.color} mx-auto`} />
                </div>
                <h3 className="text-xl font-bold text-white mb-3">{feature.title}</h3>
                <p className="text-gray-300">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Popular Games Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-gray-800 to-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Popular Games
            </h2>
            <p className="text-xl text-gray-300">
              Join thousands of players enjoying our most popular titles
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {popularGames.map((game) => (
              <div key={game.id} className="bg-gray-800 rounded-2xl overflow-hidden group hover:transform hover:scale-105 transition-all duration-300">
                <div className="relative">
                  <img 
                    src={game.image} 
                    alt={game.name}
                    className="w-full h-48 object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-center justify-center">
                    <button className="bg-yellow-500 hover:bg-yellow-600 text-white font-bold py-3 px-6 rounded-full transform hover:scale-110 transition-all duration-300">
                      Play Now
                    </button>
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-white mb-2">{game.name}</h3>
                  <p className="text-gray-400 mb-4">{game.platform}</p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Star className="w-5 h-5 text-yellow-500 fill-current" />
                      <span className="text-white font-semibold">{game.rating}</span>
                    </div>
                    <div className="flex items-center gap-1 text-gray-400">
                      <Users className="w-4 h-4" />
                      <span>{game.players}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="text-center mt-12">
            <button className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-bold py-4 px-8 rounded-full text-lg transform hover:scale-105 transition-all duration-300">
              View All Games
            </button>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-20 px-4 bg-gray-900">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center">
                <div className="bg-gradient-to-br from-purple-600 to-blue-600 p-6 rounded-2xl mb-4">
                  <stat.icon className="w-12 h-12 text-white mx-auto" />
                </div>
                <div className="text-3xl md:text-4xl font-bold text-white mb-2">{stat.value}</div>
                <div className="text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-purple-900 to-blue-900">
        <div className="max-w-4xl mx-auto text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to Start Your Gaming Journey?
          </h2>
          <p className="text-xl text-gray-200 mb-8">
            Join thousands of players and experience the ultimate gaming platform
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button className="bg-gradient-to-r from-yellow-500 to-orange-500 hover:from-yellow-600 hover:to-orange-600 text-white font-bold py-4 px-8 rounded-full text-lg transform hover:scale-105 transition-all duration-300">
              Get Started Now
            </button>
            <button className="border-2 border-white text-white hover:bg-white hover:text-purple-900 font-bold py-4 px-8 rounded-full text-lg transform hover:scale-105 transition-all duration-300">
              Learn More
            </button>
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;
