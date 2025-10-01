import { type ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  Gamepad2, 
  Menu, 
  Search, 
  Home, 
  Settings, 
  Headphones, 
  Star, 
  Bell, 
  User,
  X,
  LogOut,
  Wallet,
  Coins,
  RefreshCw
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useBalancePolling } from '../../hooks/useBalancePolling';

interface LayoutProps {
  children: ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const { isAuthenticated, user, logout } = useAuthStore();
  const { balance, isLoading: balanceLoading, fetchBalance } = useBalancePolling(30000);
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) {
        setSidebarCollapsed(false);
      } else {
        setSidebarCollapsed(true);
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Close user menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
    };

    if (isUserMenuOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isUserMenuOpen]);

  const handleLogout = () => {
    if (window.confirm('Are you sure you want to logout?')) {
      logout();
      setIsUserMenuOpen(false);
      // Navigate to home page after logout
      window.location.href = '/';
    }
  };

  const sidebarItems = [
    { name: 'Home', href: isAuthenticated ? '/dashboard' : '/', icon: Home },
    { name: 'Games', href: '/games', icon: Gamepad2 },
    { name: 'Platforms', href: '/platforms', icon: Settings },
    { name: 'Bonuses', href: '/bonuses', icon: Star },
    { name: 'About Us', href: '/about-us', icon: User },
    { name: 'Support', href: '/support', icon: Headphones },
  ];

  const mobileNavItems = [
    { name: 'Home', href: isAuthenticated ? '/dashboard' : '/', icon: Home },
    { name: 'Games', href: '/games', icon: Gamepad2 },
    { name: 'Platforms', href: '/platforms', icon: Settings },
    { name: 'Bonuses', href: '/bonuses', icon: Star },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-32 h-32 bg-yellow-400 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute top-32 right-20 w-24 h-24 bg-red-400 rounded-full opacity-30 animate-bounce"></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 bg-green-400 rounded-full opacity-25 animate-pulse"></div>
        <div className="absolute top-1/2 right-1/3 w-20 h-20 bg-blue-400 rounded-full opacity-20 animate-pulse"></div>
      </div>

      {/* Full Width Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-gray-900 bg-opacity-95 backdrop-blur-sm border-b border-gray-700 px-2 sm:px-4 py-1 sm:py-1.5 w-full">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-400 hover:text-white mr-2 sm:mr-4 transition-colors duration-300 p-1.5 sm:p-2 rounded-lg hover:bg-gray-800"
              >
                <Menu className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            )}
            <div className="flex items-center">
              <img 
                src="/logo.png" 
                alt="Global Ace Gaming" 
                className="w-10 h-10 sm:w-14 sm:h-14 mr-2 sm:mr-3 object-contain"
              />
              <span className="text-white font-bold text-sm sm:text-lg lg:text-xl">GLOBAL ACE GAMING</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
            {/* Search Bar */}
            <div className="hidden lg:flex items-center">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Games"
                  className="bg-gray-800 text-white placeholder-gray-400 px-4 py-2 rounded-lg border border-gray-600 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent w-48"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              </div>
            </div>
            
            {/* Notification Bell */}
            <div className="relative">
              <button className="text-gray-400 hover:text-white transition-all duration-300 p-1.5 sm:p-2 rounded-lg hover:bg-gray-800">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center text-xs">0</span>
            </div>
            
            {/* Balance Display */}
            {isAuthenticated && (
              <div className="flex items-center space-x-1 sm:space-x-2 bg-gradient-to-r from-yellow-400 to-yellow-500 text-black px-2 sm:px-3 lg:px-4 py-1.5 sm:py-2 rounded-full shadow-lg">
                <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="font-bold text-xs sm:text-sm">
                  ${balance || '0.00'}
                </span>
                <button
                  onClick={() => fetchBalance(true)}
                  disabled={balanceLoading}
                  className={`p-0.5 sm:p-1 rounded-full transition ${
                    balanceLoading ? 'opacity-50 cursor-not-allowed' : 'hover:bg-yellow-600/20'
                  }`}
                >
                  <RefreshCw className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${balanceLoading ? 'animate-spin' : ''}`} />
                </button>
              </div>
            )}
            
            {isAuthenticated ? (
              <div className="flex items-center space-x-2 sm:space-x-3 relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-6 h-6 sm:w-8 sm:h-8 bg-yellow-400 rounded-full flex items-center justify-center transition-transform duration-300 hover:scale-110"
                >
                  <span className="text-black font-bold text-xs sm:text-sm">
                    {user?.email?.charAt(0).toUpperCase()}
                  </span>
                </button>
                
                {/* User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-10 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-50">
                    <div className="py-1">
                      <Link
                        to="/dashboard"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors duration-200"
                      >
                        <Gamepad2 className="w-4 h-4 mr-3" />
                        Dashboard
                      </Link>
                      <Link
                        to="/wallet"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors duration-200"
                      >
                        <Wallet className="w-4 h-4 mr-3" />
                        Wallet
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors duration-200"
                      >
                        <User className="w-4 h-4 mr-3" />
                        Profile
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-4 py-2 text-sm text-gray-700 hover:bg-primary-50 hover:text-primary-600 transition-colors duration-200"
                      >
                        <Settings className="w-4 h-4 mr-3" />
                        Settings
                      </Link>
                      <div className="border-t border-gray-200 my-1"></div>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors duration-200"
                      >
                        <LogOut className="w-4 h-4 mr-3" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-3">
                <Link
                  to="/login"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="bg-gradient-to-r from-purple-500 to-pink-500 text-white font-bold px-4 py-2 rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-300 hover:scale-105 shadow-lg"
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="relative z-10 flex">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div 
            className={`fixed top-16 bottom-0 left-0 z-50 bg-gray-900 bg-opacity-95 backdrop-blur-sm transition-all duration-500 ease-in-out shadow-2xl ${
              sidebarCollapsed ? 'w-16' : 'w-64'
            }`}
            onMouseEnter={() => setSidebarCollapsed(false)}
            onMouseLeave={() => setSidebarCollapsed(true)}
          >
            {/* Sidebar Navigation */}
            <nav className="px-4 py-4">
              <ul className="space-y-1">
                {sidebarItems.map((item) => {
                  const isActive = item.name === 'Home' 
                    ? (isAuthenticated ? location.pathname === '/dashboard' : location.pathname === '/')
                    : location.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={`flex items-center px-3 py-2.5 rounded-lg transition-all duration-300 ease-in-out group relative ${
                          isActive
                            ? 'bg-gray-700 text-white font-medium shadow-md'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white hover:shadow-sm'
                        }`}
                        title={sidebarCollapsed ? item.name : ''}
                      >
                        <item.icon className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ease-in-out ${
                          isActive ? 'scale-105 text-white' : 'group-hover:scale-105 group-hover:text-white'
                        }`} />
                        <div className={`overflow-hidden transition-all duration-300 ml-3 ${
                          sidebarCollapsed ? 'w-0 opacity-0' : 'w-auto opacity-100'
                        }`}>
                          <span className="whitespace-nowrap font-medium">{item.name}</span>
                        </div>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        )}

        {/* Mobile Sidebar Overlay */}
        {isMobile && sidebarOpen && (
          <div
            className="fixed inset-0 z-40 bg-black bg-opacity-50"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile Sidebar */}
        {isMobile && (
          <div className={`fixed top-14 sm:top-16 bottom-0 left-0 z-50 w-64 bg-gray-900 bg-opacity-95 backdrop-blur-sm transform transition-transform duration-500 ease-in-out shadow-2xl ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}>
            <div className="flex items-center justify-end h-14 sm:h-16 px-4 border-b border-gray-700">
              <button
                onClick={() => setSidebarOpen(false)}
                className="text-gray-400 hover:text-white transition-colors duration-300 p-2 rounded-lg hover:bg-gray-800"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>
            
            <nav className="px-4 py-4">
              <ul className="space-y-1">
                {sidebarItems.map((item) => {
                  const isActive = item.name === 'Home' 
                    ? (isAuthenticated ? location.pathname === '/dashboard' : location.pathname === '/')
                    : location.pathname === item.href;
                  return (
                    <li key={item.name}>
                      <Link
                        to={item.href}
                        className={`flex items-center px-3 py-3 rounded-lg transition-all duration-300 ease-in-out group relative ${
                          isActive
                            ? 'bg-gray-700 text-white font-medium shadow-md'
                            : 'text-gray-300 hover:bg-gray-800 hover:text-white hover:shadow-sm'
                        }`}
                        onClick={() => setSidebarOpen(false)}
                      >
                        <item.icon className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ease-in-out ${
                          isActive ? 'scale-105 text-white' : 'group-hover:scale-105 group-hover:text-white'
                        }`} />
                        <span className="ml-3 whitespace-nowrap font-medium">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        )}

        {/* Main Content */}
        <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 pt-14 sm:pt-16 ${
          !isMobile && sidebarCollapsed ? 'ml-16' : !isMobile ? 'ml-64' : 'ml-0'
        }`}>
          {/* Main Content Area */}
          <main className="flex-1 pb-16 sm:pb-20 lg:pb-0 -mt-2 sm:mt-0">
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-gray-900 bg-opacity-95 backdrop-blur-sm border-t border-gray-700 shadow-2xl">
          <div className="flex items-center justify-around py-1.5 sm:py-2">
            {mobileNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex flex-col items-center py-1.5 sm:py-2 px-2 sm:px-3 rounded-xl transition-all duration-300 group ${
                    isActive
                      ? 'text-yellow-400 bg-yellow-400 bg-opacity-10'
                      : 'text-gray-400 hover:text-white hover:bg-gray-800'
                  }`}
                >
                  <item.icon className={`w-5 h-5 sm:w-6 sm:h-6 mb-0.5 sm:mb-1 transition-transform duration-300 ${
                    isActive ? 'scale-110' : 'group-hover:scale-110'
                  }`} />
                  <span className={`text-xs font-medium transition-all duration-300 ${
                    isActive ? 'font-semibold' : 'group-hover:font-medium'
                  }`}>{item.name}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default Layout;
