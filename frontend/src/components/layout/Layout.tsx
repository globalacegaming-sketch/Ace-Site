import { type ReactNode, useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Gamepad2,
  Menu,
  Search,
  Home,
  Settings,
  Headphones,
  Bell,
  User,
  X,
  LogOut,
  Coins,
  RefreshCw,
  MessageCircle,
  Gift,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  Info
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useWalletBalance } from '../../hooks/useWalletBalance';
import axios from 'axios';
import { getApiBaseUrl, getWsBaseUrl } from '../../utils/api';
import { io, Socket } from 'socket.io-client';

interface LayoutProps {
  children: ReactNode;
}

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isRead: boolean;
  createdAt: string;
}

const Layout = ({ children }: LayoutProps) => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const { isAuthenticated, user, logout, token } = useAuthStore();
  const { display: balance, isLoading: balanceLoading, fetchBalance } = useWalletBalance(30000);
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

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

  // Initialize notification sound
  useEffect(() => {
    notificationSoundRef.current = new Audio('/sounds/notification.mp3');
    notificationSoundRef.current.volume = 0.5;
    
    // Fallback: create a simple beep sound if file doesn't exist
    if (!notificationSoundRef.current) {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);
      
      oscillator.frequency.value = 800;
      oscillator.type = 'sine';
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
    }
  }, []);

  // Load notifications
  const loadNotifications = async () => {
    if (!isAuthenticated || !token) return;
    
    try {
      setLoadingNotifications(true);
      const API_BASE_URL = getApiBaseUrl();
      const [notificationsRes, countRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/notifications?limit=20`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        axios.get(`${API_BASE_URL}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      if (notificationsRes.data.success) {
        setNotifications(notificationsRes.data.data || []);
      }
      if (countRes.data.success) {
        setUnreadCount(countRes.data.count || 0);
      }
    } catch (error) {
      console.error('Failed to load notifications:', error);
    } finally {
      setLoadingNotifications(false);
    }
  };

  // Mark notification as read
  const markAsRead = async (notificationId: string) => {
    if (!isAuthenticated || !token) return;
    
    try {
      const API_BASE_URL = getApiBaseUrl();
      await axios.put(`${API_BASE_URL}/notifications/${notificationId}/read`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prev => 
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Failed to mark notification as read:', error);
    }
  };

  // Mark all as read
  const markAllAsRead = async () => {
    if (!isAuthenticated || !token) return;
    
    try {
      const API_BASE_URL = getApiBaseUrl();
      await axios.put(`${API_BASE_URL}/notifications/read-all`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all as read:', error);
    }
  };

  // Load notifications on mount and when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      loadNotifications();
    }
  }, [isAuthenticated, token]);

  // Setup Socket.IO for real-time notifications
  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const WS_BASE_URL = getWsBaseUrl();
    const socket = io(WS_BASE_URL, {
      auth: { token },
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      // Connected to notification socket
    });

    socket.on('notification:new', (data: any) => {
      const newNotification: Notification = {
        _id: data._id || `temp-${Date.now()}`,
        title: data.title,
        message: data.message,
        type: data.type || 'info',
        isRead: false,
        createdAt: data.createdAt || new Date().toISOString()
      };

      setNotifications(prev => [newNotification, ...prev]);
      setUnreadCount(prev => prev + 1);

      // Play notification sound
      if (notificationSoundRef.current) {
        notificationSoundRef.current.play().catch(() => {
          // Fallback beep
          const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
          const oscillator = audioContext.createOscillator();
          const gainNode = audioContext.createGain();
          
          oscillator.connect(gainNode);
          gainNode.connect(audioContext.destination);
          
          oscillator.frequency.value = 800;
          oscillator.type = 'sine';
          
          gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
          gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
          
          oscillator.start(audioContext.currentTime);
          oscillator.stop(audioContext.currentTime + 0.1);
        });
      }
    });

    socket.on('disconnect', () => {
      // Disconnected from notification socket
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, token]);

  // Close menus when clicking outside (supports both mouse and touch)
  useEffect(() => {
    if (!isNotificationOpen && !isUserMenuOpen) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;
      
      // Don't close if clicking on the notification button itself
      const notificationButton = notificationRef.current?.querySelector('button');
      if (notificationButton && (notificationButton === target || notificationButton.contains(target))) {
        return;
      }
      
      // Don't close if clicking on the notification dropdown (it's rendered outside notificationRef)
      const notificationDropdown = document.querySelector('[data-notification-dropdown]');
      if (notificationDropdown && (notificationDropdown === target || notificationDropdown.contains(target))) {
        return;
      }
      
      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (notificationRef.current && !notificationRef.current.contains(target)) {
        setIsNotificationOpen(false);
      }
    };

    // Use a small delay to prevent immediate closing when opening
    const timeoutId = setTimeout(() => {
      // Support both mouse and touch events for better mobile compatibility
      document.addEventListener('mousedown', handleClickOutside, { passive: true });
      document.addEventListener('touchstart', handleClickOutside, { passive: true });
    }, 200);

    return () => {
      clearTimeout(timeoutId);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isUserMenuOpen, isNotificationOpen]);

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
    { name: 'Bonuses', href: '/bonuses', icon: Gift },
    { name: 'About Us', href: '/about-us', icon: User },
    { name: 'Support', href: '/support', icon: Headphones },
  ];

  const mobileNavItems = [
    { name: 'Home', href: isAuthenticated ? '/dashboard' : '/', icon: Home },
    { name: 'Games', href: '/games', icon: Gamepad2 },
    { name: 'Platforms', href: '/platforms', icon: Settings },
    { name: 'Chat', href: '/chat', icon: MessageCircle },
  ];

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#0A0A0F' }}>
      {/* Full Width Navbar */}
      <header className="fixed top-0 left-0 right-0 z-[100] backdrop-blur-sm border-b px-3 sm:px-4 pb-2 sm:pb-1.5 w-full" 
              style={{ 
                backgroundColor: 'rgba(27, 27, 47, 0.95)', 
                borderBottomColor: '#2C2C3A',
                paddingTop: 'calc(0.5rem + env(safe-area-inset-top, 0px))'
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
            
            {/* Notification Bell - Optimized for mobile */}
            {isAuthenticated && (
              <div className="relative" ref={notificationRef} style={{ zIndex: 100, position: 'relative' }}>
                <button 
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newState = !isNotificationOpen;
                    setIsNotificationOpen(newState);
                    if (newState) {
                      loadNotifications();
                    }
                  }}
                  onTouchStart={(e) => {
                    e.stopPropagation();
                  }}
                  onTouchEnd={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const newState = !isNotificationOpen;
                    setIsNotificationOpen(newState);
                    if (newState) {
                      loadNotifications();
                    }
                  }}
                  className="transition-all duration-300 p-1.5 sm:p-2 rounded-lg hover:bg-opacity-20 active:scale-95 touch-manipulation relative" 
                  style={{ 
                    color: '#B0B0B0', 
                    backgroundColor: 'rgba(255, 255, 255, 0.1)',
                    WebkitTapHighlightColor: 'transparent',
                    touchAction: 'manipulation',
                    cursor: 'pointer',
                    userSelect: 'none',
                    WebkitUserSelect: 'none',
                    zIndex: 100,
                    position: 'relative',
                    minWidth: '44px',
                    minHeight: '44px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    border: 'none',
                    outline: 'none'
                  }}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                  type="button"
                >
                  <Bell className="w-4 h-4 sm:w-5 sm:h-5 pointer-events-none" />
                  {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 text-white text-[10px] sm:text-xs rounded-full min-w-[16px] sm:min-w-[20px] h-4 sm:h-5 px-1 sm:px-1.5 flex items-center justify-center font-semibold animate-pulse pointer-events-none" 
                          style={{ backgroundColor: '#E53935' }}>
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
                
              </div>
            )}
            
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
                    ${balance}
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
              <div className="flex items-center space-x-1 sm:space-x-2 relative" ref={userMenuRef} style={{ zIndex: 100, position: 'relative' }}>
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
                  <div className="absolute right-0 top-8 sm:top-10 w-40 sm:w-48 rounded-md shadow-lg border z-[100]" 
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

      {/* Notification Dropdown - Rendered outside header to avoid clipping */}
      {isNotificationOpen && (
        <>
          {/* Mobile Overlay */}
          {isMobile && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50"
              onClick={() => {
                setIsNotificationOpen(false);
              }}
              style={{ 
                top: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
                zIndex: 9998
              }}
            />
          )}
          <div 
            data-notification-dropdown
            className={`${
              isMobile 
                ? 'fixed left-0 right-0 w-full max-w-none rounded-t-2xl rounded-b-none' 
                : 'fixed right-4 w-80 sm:w-96 max-h-[calc(100vh-100px)] rounded-lg'
            } overflow-hidden shadow-2xl border flex flex-col`}
            onClick={(e) => e.stopPropagation()}
            style={{ 
              backgroundColor: '#1B1B2F', 
              borderColor: '#2C2C3A',
              boxShadow: isMobile ? '0 -4px 20px rgba(0, 0, 0, 0.5)' : '0 10px 40px rgba(0, 0, 0, 0.5)',
              zIndex: 9999,
              top: isMobile ? 'calc(3.5rem + env(safe-area-inset-top, 0px))' : 'calc(4rem + env(safe-area-inset-top, 0px))',
              ...(isMobile ? {
                height: '60vh',
                maxHeight: '500px',
                minHeight: '300px'
              } : {})
            }}
          >
            {/* Header - Sticky on mobile */}
            <div className={`sticky top-0 px-3 sm:px-4 py-2.5 sm:py-3 border-b flex items-center justify-between flex-shrink-0 ${
              isMobile ? 'bg-opacity-95 backdrop-blur-sm' : ''
            }`}
               style={{ borderColor: '#2C2C3A', backgroundColor: '#1B1B2F' }}>
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <h3 className="font-semibold text-sm sm:text-base truncate" style={{ color: '#F5F5F5' }}>
                  {isMobile ? 'Notifications' : `Notifications${unreadCount > 0 ? ` (${unreadCount})` : ''}`}
                </h3>
                {isMobile && unreadCount > 0 && (
                  <span className="text-xs px-2 py-0.5 rounded-full font-semibold flex-shrink-0" 
                        style={{ backgroundColor: '#E53935', color: '#FFFFFF' }}>
                    {unreadCount}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {unreadCount > 0 && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      markAllAsRead();
                    }}
                    className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-1.5 text-blue-400 hover:text-blue-300 active:scale-95 transition-all touch-manipulation rounded"
                    style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    {isMobile ? 'Mark all' : 'Mark all read'}
                  </button>
                )}
                {isMobile && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setIsNotificationOpen(false);
                    }}
                    className="p-1.5 rounded-lg hover:bg-opacity-20 active:scale-95 transition-all touch-manipulation"
                    style={{ 
                      color: '#B0B0B0', 
                      backgroundColor: 'rgba(255, 255, 255, 0.1)',
                      WebkitTapHighlightColor: 'transparent',
                      touchAction: 'manipulation',
                      cursor: 'pointer'
                    }}
                    aria-label="Close notifications"
                    type="button"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
            
            {/* Notifications List - Scrollable */}
            <div className={`flex-1 overflow-y-auto overscroll-contain ${
              isMobile ? 'pb-4' : 'max-h-80'
            }`}
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollbarWidth: 'thin',
              scrollbarColor: '#2C2C3A #1B1B2F'
            }}>
              {loadingNotifications ? (
                <div className="p-6 sm:p-8 text-center" style={{ color: '#B0B0B0' }}>
                  <RefreshCw className="w-6 h-6 sm:w-8 sm:h-8 animate-spin mx-auto mb-2 sm:mb-3" />
                  <p className="text-xs sm:text-sm">Loading notifications...</p>
                </div>
              ) : notifications.length === 0 ? (
                <div className="p-6 sm:p-8 text-center" style={{ color: '#B0B0B0' }}>
                  <Bell className="w-8 h-8 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 opacity-50" />
                  <p className="text-xs sm:text-sm">No notifications</p>
                  <p className="text-[10px] sm:text-xs mt-1 opacity-70">You're all caught up!</p>
                </div>
              ) : (
                <div className="divide-y" style={{ borderColor: '#2C2C3A' }}>
                  {notifications.map((notification) => {
                    const getIcon = () => {
                      switch (notification.type) {
                        case 'info': return <Info className="w-4 h-4 sm:w-5 sm:h-5" />;
                        case 'warning': return <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5" />;
                        case 'success': return <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />;
                        case 'error': return <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5" />;
                        default: return <Info className="w-4 h-4 sm:w-5 sm:h-5" />;
                      }
                    };
                    
                    const getColor = () => {
                      switch (notification.type) {
                        case 'info': return '#3B82F6';
                        case 'warning': return '#F59E0B';
                        case 'success': return '#10B981';
                        case 'error': return '#EF4444';
                        default: return '#3B82F6';
                      }
                    };

                    return (
                      <div
                        key={notification._id}
                        onClick={() => {
                          if (!notification.isRead) {
                            markAsRead(notification._id);
                          }
                        }}
                        className={`p-3 sm:p-4 cursor-pointer transition-colors active:bg-opacity-20 touch-manipulation ${
                          !notification.isRead ? 'bg-opacity-10' : 'hover:bg-opacity-5'
                        }`}
                        style={{
                          backgroundColor: !notification.isRead 
                            ? 'rgba(59, 130, 246, 0.1)' 
                            : 'transparent'
                        }}
                      >
                        <div className="flex items-start gap-2 sm:gap-3">
                          <div className="flex-shrink-0 mt-0.5 sm:mt-1" style={{ color: getColor() }}>
                            {getIcon()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <h4 className="font-semibold text-xs sm:text-sm md:text-base break-words" style={{ color: '#F5F5F5' }}>
                                {notification.title}
                              </h4>
                              {!notification.isRead && (
                                <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full flex-shrink-0 mt-1 sm:mt-1.5" style={{ backgroundColor: getColor() }} />
                              )}
                            </div>
                            <p className="text-[11px] sm:text-xs md:text-sm mt-1 sm:mt-1.5 break-words leading-relaxed" style={{ color: '#B0B0B0' }}>
                              {notification.message}
                            </p>
                            <p className="text-[10px] sm:text-xs mt-1.5 sm:mt-2 opacity-70" style={{ color: '#B0B0B0' }}>
                              {new Date(notification.createdAt).toLocaleString(undefined, {
                                month: 'short',
                                day: 'numeric',
                                hour: 'numeric',
                                minute: '2-digit',
                                ...(isMobile ? {} : { year: 'numeric' })
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="relative z-10 flex">
        {/* Desktop Sidebar */}
        {!isMobile && (
          <div 
            className={`fixed bottom-0 left-0 z-50 backdrop-blur-sm transition-all duration-500 ease-in-out shadow-2xl border-r ${
              sidebarCollapsed ? 'w-16' : 'w-64'
            }`}
            style={{ 
              backgroundColor: '#1B1B2F', 
              borderRightColor: '#2C2C3A',
              top: 'calc(4rem + env(safe-area-inset-top, 0px))'
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
          <div className={`fixed bottom-0 left-0 z-50 w-64 backdrop-blur-sm transform transition-transform duration-500 ease-in-out shadow-2xl border-r ${
            sidebarOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
          style={{ 
            backgroundColor: '#1B1B2F', 
            borderRightColor: '#2C2C3A',
            top: 'calc(3rem + env(safe-area-inset-top, 0px))'
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
        } ${location.pathname === '/chat' ? 'h-screen overflow-hidden' : ''}`}>
          {/* Main Content Area - pt accounts for fixed header + iOS safe-area */}
          <main className={`flex-1 pt-[calc(3.5rem+env(safe-area-inset-top,0px))] ${location.pathname === '/chat' ? 'pb-0 h-full overflow-hidden relative' : 'pb-16 sm:pb-20 lg:pb-0'}`}>
            {children}
          </main>
        </div>
      </div>

      {/* Mobile Bottom Navigation */}
      {isMobile && (
        <div className="fixed bottom-0 left-0 right-0 z-[90] bg-gray-900 bg-opacity-95 backdrop-blur-sm border-t border-gray-700 shadow-2xl"
             style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
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
