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
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#0A0A0F' }}>
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-10 w-32 h-32 rounded-full opacity-20 animate-pulse" style={{ backgroundColor: '#FFD700' }}></div>
        <div className="absolute top-32 right-20 w-24 h-24 rounded-full opacity-30 animate-bounce" style={{ backgroundColor: '#E53935' }}></div>
        <div className="absolute bottom-20 left-1/4 w-16 h-16 rounded-full opacity-25 animate-pulse" style={{ backgroundColor: '#00C853' }}></div>
        <div className="absolute top-1/2 right-1/3 w-20 h-20 rounded-full opacity-20 animate-pulse" style={{ backgroundColor: '#00B0FF' }}></div>
      </div>

      {/* Full Width Navbar */}
      <header className="fixed top-0 left-0 right-0 z-50 backdrop-blur-sm border-b px-3 sm:px-4 py-2 sm:py-1.5 w-full" 
              style={{ 
                backgroundColor: 'rgba(27, 27, 47, 0.95)', 
                borderBottomColor: '#2C2C3A' 
              }}>
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            {isMobile && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="mr-2 transition-colors duration-300 p-2 rounded-lg hover:bg-opacity-20"
                style={{ color: '#B0B0B0', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
              >
                {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            )}
            <div className="flex items-center">
              <div className="w-8 h-8 sm:w-10 sm:h-10 lg:w-14 lg:h-14 mr-2 flex items-center justify-center">
                <img 
                  src="/logo.png" 
                  alt="Global Ace Gaming" 
                  className="w-full h-full object-contain"
                />
              </div>
              <span className="font-bold text-xs sm:text-sm lg:text-lg xl:text-xl hidden sm:block" style={{ color: '#F5F5F5' }}>GLOBAL ACE GAMING</span>
              <span className="font-bold text-xs sm:hidden" style={{ color: '#F5F5F5' }}>GAG</span>
            </div>
          </div>
          
          <div className="flex items-center space-x-1 sm:space-x-2 lg:space-x-4">
            {/* Search Bar - Hidden on mobile */}
            <div className="hidden lg:flex items-center">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search Games"
                  className="input-casino w-48"
                />
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4" style={{ color: '#B0B0B0' }} />
              </div>
            </div>
            
            {/* Notification Bell - Smaller on mobile */}
            <div className="relative">
              <button className="transition-all duration-300 p-1.5 sm:p-2 rounded-lg hover:bg-opacity-20" 
                      style={{ color: '#B0B0B0', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}>
                <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 text-white text-xs rounded-full w-3 h-3 sm:w-4 sm:h-4 flex items-center justify-center text-xs" 
                    style={{ backgroundColor: '#E53935' }}>0</span>
            </div>
            
            {/* Enhanced Balance Display - Responsive */}
            {isAuthenticated && (
              <div className="flex items-center space-x-1 sm:space-x-2 px-2 sm:px-3 py-1.5 sm:py-2 rounded-full shadow-lg border-2" 
                   style={{ 
                     background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                     color: '#0A0A0F',
                     borderColor: '#FFD700',
                     boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'
                   }}>
                <div className="flex items-center space-x-1">
                  <Coins className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="font-bold text-xs sm:text-sm">
                    ${balance || '0.00'}
                  </span>
                </div>
                <button
                  onClick={() => fetchBalance(true)}
                  disabled={balanceLoading}
                  className={`p-0.5 sm:p-1 rounded-full transition-all duration-200 ${
                    balanceLoading 
                      ? 'opacity-50 cursor-not-allowed' 
                      : 'hover:scale-110 active:scale-95'
                  }`}
                  style={{ backgroundColor: balanceLoading ? 'rgba(0, 0, 0, 0.1)' : 'rgba(0, 0, 0, 0.1)' }}
                  title="Refresh Balance"
                >
                  <RefreshCw className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${balanceLoading ? 'animate-spin' : ''}`} />
                </button>
                <div className="text-xs font-medium hidden sm:block" style={{ color: '#0A0A0F' }}>
                  {user?.firstName ? `${user.firstName}_Aces9F` : 'Player'}
                </div>
              </div>
            )}
            
            {isAuthenticated ? (
              <div className="flex items-center space-x-1 sm:space-x-2 relative" ref={userMenuRef}>
                <button 
                  onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                  className="w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center transition-transform duration-300 hover:scale-110 text-sm sm:text-lg border-2"
                  style={{ 
                    background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                    borderColor: '#FFD700',
                    boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)'
                  }}
                >
                  {user?.avatar ? (
                    (() => {
                      const avatarMap: { [key: string]: string } = {
                        'gorilla': '🦍',
                        'lion': '🦁',
                        'tiger': '🐅',
                        'eagle': '🦅',
                        'shark': '🦈',
                        'wolf': '🐺',
                        'bear': '🐻',
                        'dragon': '🐉'
                      };
                      return avatarMap[user.avatar] || '👤';
                    })()
                  ) : (
                    <span className="font-bold text-xs sm:text-sm" style={{ color: '#0A0A0F' }}>
                      {user?.email?.charAt(0).toUpperCase()}
                    </span>
                  )}
                </button>
                
                {/* Simplified User Dropdown Menu */}
                {isUserMenuOpen && (
                  <div className="absolute right-0 top-8 sm:top-10 w-40 sm:w-48 rounded-md shadow-lg border z-50" 
                       style={{ 
                         backgroundColor: '#1B1B2F', 
                         borderColor: '#2C2C3A',
                         boxShadow: '0 0 20px rgba(0, 0, 0, 0.5)'
                       }}>
                    <div className="py-1">
                      <Link
                        to="/profile"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors duration-200 hover:bg-opacity-20"
                        style={{ color: '#F5F5F5', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                      >
                        <User className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" />
                        My Account
                      </Link>
                      <Link
                        to="/settings"
                        onClick={() => setIsUserMenuOpen(false)}
                        className="flex items-center px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors duration-200 hover:bg-opacity-20"
                        style={{ color: '#F5F5F5', backgroundColor: 'rgba(255, 255, 255, 0.1)' }}
                      >
                        <Settings className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" />
                        Settings
                      </Link>
                      <div className="my-1" style={{ borderTop: '1px solid #2C2C3A' }}></div>
                      <button
                        onClick={handleLogout}
                        className="flex items-center w-full px-3 sm:px-4 py-2 text-xs sm:text-sm transition-colors duration-200 hover:bg-opacity-20"
                        style={{ color: '#E53935', backgroundColor: 'rgba(229, 57, 53, 0.1)' }}
                      >
                        <LogOut className="w-3 h-3 sm:w-4 sm:h-4 mr-2 sm:mr-3" />
                        Logout
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center space-x-1 sm:space-x-2">
                <Link
                  to="/login"
                  className="btn-casino-primary text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="btn-casino-primary text-xs sm:text-sm px-2 sm:px-4 py-1.5 sm:py-2"
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
            className={`fixed top-16 bottom-0 left-0 z-50 backdrop-blur-sm transition-all duration-500 ease-in-out shadow-2xl border-r ${
              sidebarCollapsed ? 'w-16' : 'w-64'
            }`}
            style={{ 
              backgroundColor: '#1B1B2F', 
              borderRightColor: '#2C2C3A' 
            }}
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
                         className={`casino-sidebar-item ${
                           sidebarCollapsed ? 'collapsed' : 'expanded'
                         } ${
                           isActive ? 'active' : ''
                         }`}
                         title={sidebarCollapsed ? item.name : ''}
                       >
                        <item.icon className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ease-in-out ${
                          isActive ? 'scale-105' : 'group-hover:scale-105'
                        }`} />
                        {!sidebarCollapsed && (
                          <span className="sidebar-text">{item.name}</span>
                        )}
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
          <div className={`fixed top-12 bottom-0 left-0 z-50 w-64 backdrop-blur-sm transform transition-transform duration-500 ease-in-out shadow-2xl border-r ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ 
            backgroundColor: '#1B1B2F', 
            borderRightColor: '#2C2C3A' 
          }}>
            {/* Navigation Menu */}
            <nav className="px-4 py-4">
              <ul className="space-y-0.5">
                {sidebarItems.map((item) => {
                  const isActive = item.name === 'Home' 
                    ? (isAuthenticated ? location.pathname === '/dashboard' : location.pathname === '/')
                    : location.pathname === item.href;
                  return (
                    <li key={item.name}>
                       <Link
                         to={item.href}
                         className={`casino-sidebar-item expanded ${
                           isActive ? 'active' : ''
                         }`}
                         onClick={() => setSidebarOpen(false)}
                       >
                        <item.icon className={`w-5 h-5 flex-shrink-0 transition-all duration-300 ease-in-out ${
                          isActive ? 'scale-105' : 'group-hover:scale-105'
                        }`} />
                        <span className="sidebar-text">{item.name}</span>
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>
          </div>
        )}

        {/* Main Content */}
        <div className={`flex-1 flex flex-col min-h-screen transition-all duration-300 ${
          !isMobile && sidebarCollapsed ? 'ml-16' : !isMobile ? 'ml-64' : 'ml-0'
        }`}>
          {/* Main Content Area */}
          <main className="flex-1 pb-16 sm:pb-20 lg:pb-0">
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
