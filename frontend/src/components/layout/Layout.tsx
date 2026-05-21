import { type ReactNode, useState, useEffect, useRef } from 'react';
import { Link, NavLink, useLocation } from 'react-router-dom';
import {
  Gamepad2,
  Menu,
  Home,
  Layers,
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
  Info,
} from 'lucide-react';
import { useAuthStore } from '../../stores/authStore';
import { useBalancePolling } from '../../hooks/useBalancePolling';
import { triggerHaptic } from '../../utils/haptic';
import axios from 'axios';
import { getApiBaseUrl, getWsBaseUrl } from '../../utils/api';
import { io, type Socket } from 'socket.io-client';
import Footer from './Footer';

interface LayoutProps {
  children: ReactNode;
}

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isRead: boolean;
  link?: string;
  createdAt: string;
}

const NAV_ITEMS: { name: string; href: string; icon: typeof Home }[] = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Games', href: '/games', icon: Gamepad2 },
  { name: 'Platforms', href: '/platforms', icon: Layers },
  { name: 'Bonuses', href: '/bonuses', icon: Gift },
  { name: 'About Us', href: '/about-us', icon: User },
  { name: 'Support', href: '/support', icon: Headphones },
];

const MOBILE_TABS: { name: string; href: string; icon: typeof Home }[] = [
  { name: 'Home', href: '/', icon: Home },
  { name: 'Games', href: '/games', icon: Gamepad2 },
  { name: 'Bonuses', href: '/bonuses', icon: Gift },
  { name: 'Chat', href: '/chat', icon: MessageCircle },
];

const AUTH_LAYOUT_ROUTES = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/verify-code',
];

const HIDE_HEADER_ROUTES = AUTH_LAYOUT_ROUTES;

const HIDE_FOOTER_ROUTES = ['/chat', ...AUTH_LAYOUT_ROUTES];

/** Auth flows that stay focused (no tab bar); login/register/forgot keep mobile nav. */
const HIDE_BOTTOM_NAV_ROUTES = [
  '/reset-password',
  '/verify-email',
  '/verify-code',
];

const Layout = ({ children }: LayoutProps) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isNotificationOpen, setIsNotificationOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  const { isAuthenticated, user, logout, token } = useAuthStore();
  const { balance, isLoading: balanceLoading, fetchBalance } =
    useBalancePolling(30000);
  const location = useLocation();
  const userMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);
  const notificationSoundRef = useRef<HTMLAudioElement | null>(null);

  const homeHref = isAuthenticated ? '/dashboard' : '/';

  /* --------------------------------------------------------------------- */
  /* Notification sound                                                     */
  /* --------------------------------------------------------------------- */

  useEffect(() => {
    notificationSoundRef.current = new Audio('/sounds/notification.mp3');
    notificationSoundRef.current.volume = 0.5;
  }, []);

  /* --------------------------------------------------------------------- */
  /* Notification fetching                                                  */
  /* --------------------------------------------------------------------- */

  const loadNotifications = async () => {
    if (!isAuthenticated || !token) return;
    try {
      setLoadingNotifications(true);
      const API_BASE_URL = getApiBaseUrl();
      const [listRes, countRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/notifications?limit=20`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
        axios.get(`${API_BASE_URL}/notifications/unread-count`, {
          headers: { Authorization: `Bearer ${token}` },
        }),
      ]);
      if (listRes.data.success) setNotifications(listRes.data.data || []);
      if (countRes.data.success) setUnreadCount(countRes.data.count || 0);
    } catch (err) {
      // Non-fatal — notifications panel will simply show empty state.
      console.error('Failed to load notifications:', err);
    } finally {
      setLoadingNotifications(false);
    }
  };

  const markAsRead = async (notificationId: string) => {
    if (!isAuthenticated || !token) return;
    try {
      const API_BASE_URL = getApiBaseUrl();
      await axios.put(
        `${API_BASE_URL}/notifications/${notificationId}/read`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNotifications((prev) =>
        prev.map((n) => (n._id === notificationId ? { ...n, isRead: true } : n)),
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    if (!isAuthenticated || !token) return;
    try {
      const API_BASE_URL = getApiBaseUrl();
      await axios.put(
        `${API_BASE_URL}/notifications/read-all`,
        {},
        { headers: { Authorization: `Bearer ${token}` } },
      );
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadNotifications();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, token]);

  /* --------------------------------------------------------------------- */
  /* Socket.IO real-time notifications + ban broadcast                      */
  /* --------------------------------------------------------------------- */

  useEffect(() => {
    if (!isAuthenticated || !token) return;

    const socket = io(getWsBaseUrl(), {
      auth: { token },
      withCredentials: true,
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('notification:new', (data: Partial<Notification>) => {
      const next: Notification = {
        _id: data._id ?? `temp-${Date.now()}`,
        title: data.title ?? 'New notification',
        message: data.message ?? '',
        type: data.type ?? 'info',
        isRead: false,
        link: data.link ?? undefined,
        createdAt: data.createdAt ?? new Date().toISOString(),
      };
      setNotifications((prev) => [next, ...prev]);
      setUnreadCount((prev) => prev + 1);
      notificationSoundRef.current?.play().catch(() => {
        /* autoplay may be blocked — that's fine */
      });
    });

    socket.on('account:banned', (data: { reason?: string }) => {
      socket.disconnect();
      useAuthStore.getState().logout();
      window.alert(
        data?.reason
          ? `Your account has been suspended: ${data.reason}`
          : 'Your account has been suspended. Please contact support if you believe this is an error.',
      );
      window.location.href = '/login';
    });

    return () => {
      socket.disconnect();
    };
  }, [isAuthenticated, token]);

  /* --------------------------------------------------------------------- */
  /* Close menus on outside click / touch                                   */
  /* --------------------------------------------------------------------- */

  useEffect(() => {
    if (!isNotificationOpen && !isUserMenuOpen) return;

    const handler = (event: MouseEvent | TouchEvent) => {
      const target = event.target as Node;

      const notificationBtn = notificationRef.current?.querySelector('button');
      if (notificationBtn && notificationBtn.contains(target)) return;

      const dropdown = document.querySelector('[data-notification-dropdown]');
      if (dropdown && dropdown.contains(target)) return;

      if (userMenuRef.current && !userMenuRef.current.contains(target)) {
        setIsUserMenuOpen(false);
      }
      if (
        notificationRef.current &&
        !notificationRef.current.contains(target)
      ) {
        setIsNotificationOpen(false);
      }
    };

    const id = window.setTimeout(() => {
      document.addEventListener('mousedown', handler, { passive: true });
      document.addEventListener('touchstart', handler, { passive: true });
    }, 200);

    return () => {
      window.clearTimeout(id);
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('touchstart', handler);
    };
  }, [isUserMenuOpen, isNotificationOpen]);

  /* Lock document scroll on /chat so only the message list scrolls (Windows-safe). */
  useEffect(() => {
    const onChat = location.pathname === '/chat';
    if (!onChat) return;

    const html = document.documentElement;
    html.classList.add('chat-page-lock');
    const prevHtmlOverflow = html.style.overflow;
    const prevBodyOverflow = document.body.style.overflow;
    html.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';

    return () => {
      html.classList.remove('chat-page-lock');
      html.style.overflow = prevHtmlOverflow;
      document.body.style.overflow = prevBodyOverflow;
    };
  }, [location.pathname]);

  /* --------------------------------------------------------------------- */
  /* Logout                                                                 */
  /* --------------------------------------------------------------------- */

  const handleLogout = async () => {
    if (!window.confirm('Are you sure you want to logout?')) return;
    try {
      const API_BASE_URL = getApiBaseUrl();
      await fetch(`${API_BASE_URL}/auth/logout`, {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        credentials: 'include',
      });
    } catch {
      // best-effort
    }
    logout();
    setIsUserMenuOpen(false);
    setMenuOpen(false);
    window.location.href = '/';
  };

  /* --------------------------------------------------------------------- */
  /* NavLink class helpers                                                  */
  /* --------------------------------------------------------------------- */

  const desktopNavClass = ({ isActive }: { isActive: boolean }) =>
    ['cosmic-nav-link', isActive ? 'cosmic-nav-link-active' : 'cosmic-nav-link-inactive'].join(
      ' ',
    );

  const drawerNavLinkClass = ({ isActive }: { isActive: boolean }) =>
    [
      'block rounded-lg px-4 py-3 text-sm font-semibold transition touch-manipulation',
      isActive
        ? 'border-l-2 border-[color:var(--casino-highlight-gold)] cosmic-nav-link-active'
        : 'cosmic-nav-link-inactive hover:bg-white/[0.06]',
    ].join(' ');

  const isHomeActive = location.pathname === homeHref;
  const hideHeader = HIDE_HEADER_ROUTES.some((p) =>
    location.pathname.startsWith(p),
  );
  const hideFooter = HIDE_FOOTER_ROUTES.some((p) =>
    location.pathname.startsWith(p),
  );
  const hideBottomNav = HIDE_BOTTOM_NAV_ROUTES.some((p) =>
    location.pathname.startsWith(p),
  );
  const isChatPage = location.pathname === '/chat';
  const isGuestHome = location.pathname === '/' && !isAuthenticated;

  /* --------------------------------------------------------------------- */
  /* Render                                                                 */
  /* --------------------------------------------------------------------- */

  return (
    <div
      className={`overflow-x-clip ${
        isChatPage || isGuestHome
          ? 'flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden'
          : 'cosmic-page-bg min-h-screen'
      } ${isGuestHome ? 'bg-[#0A0A0F]' : ''}`}
    >
      {/* ---------------- Sticky Header ---------------- */}
      {!hideHeader && (
      <header
        className="sticky top-0 z-40 border-b backdrop-blur-md"
        style={{
          backgroundColor: 'rgba(10, 10, 15, 0.92)',
          borderBottomColor: 'var(--casino-card-border)',
          boxShadow: 'var(--cosmic-header-glow)',
          paddingTop: 'env(safe-area-inset-top, 0px)',
        }}
      >
        <div className="cosmic-content-width grid grid-cols-[auto_1fr_auto] items-center gap-2 px-3 py-2.5 sm:px-4 sm:py-3 lg:gap-4">
          {/* Left: hamburger (mobile) + brand */}
          <div className="flex min-w-0 items-center gap-2">
            <button
              type="button"
              onClick={() => setMenuOpen(true)}
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg lg:hidden"
              aria-label="Open menu"
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.06)',
                color: 'var(--casino-text-primary)',
              }}
            >
              <Menu className="h-5 w-5" />
            </button>
            <Link
              to={homeHref}
              className="flex min-w-0 items-center gap-2"
              aria-label="Global Ace Gaming home"
            >
              <img
                src="/logo.png"
                alt=""
                className="h-8 w-8 shrink-0 object-contain sm:h-9 sm:w-9"
              />
              <span
                className="hidden truncate text-base font-extrabold tracking-tight sm:inline lg:text-lg"
                style={{ color: 'var(--casino-text-primary)' }}
              >
                Global Ace Gaming
              </span>
              <span
                className="text-base font-extrabold tracking-tight sm:hidden"
                style={{ color: 'var(--casino-text-primary)' }}
              >
                GAG
              </span>
            </Link>
          </div>

          {/* Center: desktop horizontal nav */}
          <nav
            className="hidden min-w-0 items-center justify-center gap-1 lg:flex"
            aria-label="Primary"
          >
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.name === 'Home' ? isHomeActive : location.pathname === item.href;
              const to = item.name === 'Home' ? homeHref : item.href;
              return (
                <NavLink
                  key={item.name}
                  to={to}
                  className={() => desktopNavClass({ isActive })}
                  end={item.name === 'Home'}
                >
                  {item.name}
                </NavLink>
              );
            })}
          </nav>

          {/* Right: notifications, balance, avatar / auth CTAs */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2">
            {isAuthenticated && (
              <div
                className="relative"
                ref={notificationRef}
                style={{ zIndex: 100 }}
              >
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    const next = !isNotificationOpen;
                    setIsNotificationOpen(next);
                    if (next) void loadNotifications();
                  }}
                  aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ''}`}
                  className="relative flex h-10 w-10 items-center justify-center rounded-lg transition active:scale-95"
                  style={{
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                    color: 'var(--casino-text-secondary)',
                  }}
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold"
                      style={{
                        backgroundColor: 'var(--casino-accent-red)',
                        color: '#fff',
                      }}
                    >
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {isAuthenticated && (
              <div
                className="hidden items-center gap-1 rounded-full border-2 px-2 py-1.5 shadow-lg sm:flex sm:px-3 sm:py-2"
                style={{
                  background:
                    'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                  color: 'var(--casino-primary-dark)',
                  borderColor: 'var(--casino-highlight-gold)',
                  boxShadow: '0 0 16px rgba(255, 215, 0, 0.28)',
                }}
              >
                <Coins className="h-4 w-4" />
                <span className="text-xs font-bold sm:text-sm">
                  ${balance || '0.00'}
                </span>
                <button
                  type="button"
                  onClick={() => fetchBalance(true)}
                  disabled={balanceLoading}
                  className="rounded-full p-0.5 transition active:scale-95"
                  style={{
                    backgroundColor: 'rgba(0, 0, 0, 0.1)',
                    opacity: balanceLoading ? 0.5 : 1,
                  }}
                  title="Refresh balance"
                  aria-label="Refresh balance"
                >
                  <RefreshCw
                    className={`h-3 w-3 ${balanceLoading ? 'animate-spin' : ''}`}
                  />
                </button>
              </div>
            )}

            {isAuthenticated ? (
              <div className="relative" ref={userMenuRef} style={{ zIndex: 100 }}>
                <button
                  type="button"
                  onClick={() => setIsUserMenuOpen((o) => !o)}
                  className="flex h-9 w-9 items-center justify-center rounded-full border-2 text-sm font-bold transition hover:scale-105"
                  style={{
                    background:
                      'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                    borderColor: 'var(--casino-highlight-gold)',
                    color: 'var(--casino-primary-dark)',
                    boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)',
                  }}
                  aria-label="Open account menu"
                >
                  {user?.avatar
                    ? (
                        {
                          gorilla: '🦍',
                          lion: '🦁',
                          tiger: '🐅',
                          eagle: '🦅',
                          shark: '🦈',
                          wolf: '🐺',
                          bear: '🐻',
                          dragon: '🐉',
                        } as Record<string, string>
                      )[user.avatar] || '👤'
                    : user?.email?.charAt(0).toUpperCase() ?? '👤'}
                </button>
                {isUserMenuOpen && (
                  <div
                    className="absolute right-0 top-11 w-44 overflow-hidden rounded-md border shadow-lg"
                    style={{
                      backgroundColor: 'var(--casino-secondary-dark)',
                      borderColor: 'var(--casino-card-border)',
                      boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5)',
                    }}
                  >
                    <Link
                      to="/profile"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.06]"
                      style={{ color: 'var(--casino-text-primary)' }}
                    >
                      <User className="h-4 w-4" />
                      My Account
                    </Link>
                    <Link
                      to="/settings"
                      onClick={() => setIsUserMenuOpen(false)}
                      className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-white/[0.06]"
                      style={{ color: 'var(--casino-text-primary)' }}
                    >
                      <Settings className="h-4 w-4" />
                      Settings
                    </Link>
                    <div
                      className="my-1"
                      style={{
                        borderTop: '1px solid var(--casino-card-border)',
                      }}
                    />
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-sm"
                      style={{
                        color: 'var(--casino-accent-red)',
                        backgroundColor: 'rgba(229, 57, 53, 0.08)',
                      }}
                    >
                      <LogOut className="h-4 w-4" />
                      Logout
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <Link
                  to="/login"
                  className="btn-casino-primary cosmic-btn-text inline-flex min-h-10 items-center justify-center rounded-xl px-3 py-2 text-xs sm:px-4 sm:text-sm"
                >
                  Login
                </Link>
                <Link
                  to="/register"
                  className="inline-flex min-h-10 items-center justify-center rounded-xl border px-3 py-2 text-xs font-semibold sm:px-4 sm:text-sm"
                  style={{
                    borderColor: 'var(--casino-highlight-gold)',
                    color: 'var(--casino-highlight-gold)',
                  }}
                >
                  Sign up
                </Link>
              </div>
            )}
          </div>
        </div>
      </header>
      )}

      {/* ---------------- Notification panel (rendered outside header) ---------------- */}
      {isNotificationOpen && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[9998] bg-black/50 lg:hidden"
            onClick={() => setIsNotificationOpen(false)}
            aria-label="Close notifications"
          />
          <div
            data-notification-dropdown
            className="fixed z-[9999] flex flex-col overflow-hidden rounded-2xl border shadow-2xl lg:right-4 lg:top-[calc(4rem+env(safe-area-inset-top,0px))] lg:w-96 lg:rounded-lg"
            style={{
              backgroundColor: 'var(--casino-secondary-dark)',
              borderColor: 'var(--casino-card-border)',
              left: 0,
              right: 0,
              top: 'calc(3.5rem + env(safe-area-inset-top, 0px))',
              maxHeight: '60vh',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="flex items-center justify-between border-b px-4 py-3"
              style={{ borderColor: 'var(--casino-card-border)' }}
            >
              <h3
                className="text-base font-semibold"
                style={{ color: 'var(--casino-text-primary)' }}
              >
                Notifications{unreadCount > 0 ? ` (${unreadCount})` : ''}
              </h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void markAllAsRead();
                    }}
                    className="rounded px-3 py-1 text-xs font-medium text-blue-400 hover:text-blue-300"
                    style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)' }}
                  >
                    Mark all read
                  </button>
                )}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setIsNotificationOpen(false);
                  }}
                  className="rounded-lg p-1.5 lg:hidden"
                  style={{
                    color: 'var(--casino-text-secondary)',
                    backgroundColor: 'rgba(255, 255, 255, 0.06)',
                  }}
                  aria-label="Close notifications"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {loadingNotifications ? (
                <div
                  className="flex flex-col items-center gap-2 p-8 text-center"
                  style={{ color: 'var(--casino-text-secondary)' }}
                >
                  <RefreshCw className="h-6 w-6 animate-spin" />
                  <p className="text-sm">Loading notifications…</p>
                </div>
              ) : notifications.length === 0 ? (
                <div
                  className="flex flex-col items-center gap-2 p-8 text-center"
                  style={{ color: 'var(--casino-text-secondary)' }}
                >
                  <Bell className="h-10 w-10 opacity-50" />
                  <p className="text-sm">No notifications</p>
                  <p className="text-xs opacity-70">You're all caught up!</p>
                </div>
              ) : (
                <ul
                  className="divide-y"
                  style={{ borderColor: 'var(--casino-card-border)' }}
                >
                  {notifications.map((n) => {
                    const Icon =
                      n.type === 'warning'
                        ? AlertTriangle
                        : n.type === 'success'
                          ? CheckCircle
                          : n.type === 'error'
                            ? AlertCircle
                            : Info;
                    const color =
                      n.type === 'warning'
                        ? '#F59E0B'
                        : n.type === 'success'
                          ? '#10B981'
                          : n.type === 'error'
                            ? '#EF4444'
                            : '#3B82F6';
                    return (
                      <li key={n._id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (!n.isRead) void markAsRead(n._id);
                            if (n.link) {
                              setIsNotificationOpen(false);
                              window.location.href = n.link;
                            }
                          }}
                          className="w-full p-3 text-left transition hover:bg-white/[0.03]"
                          style={{
                            backgroundColor: !n.isRead
                              ? 'rgba(59, 130, 246, 0.08)'
                              : 'transparent',
                          }}
                        >
                          <div className="flex items-start gap-3">
                            <div className="mt-0.5" style={{ color }}>
                              <Icon className="h-5 w-5" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <h4
                                  className="text-sm font-semibold break-words"
                                  style={{
                                    color: 'var(--casino-text-primary)',
                                  }}
                                >
                                  {n.title}
                                </h4>
                                {!n.isRead && (
                                  <span
                                    className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                                    style={{ backgroundColor: color }}
                                  />
                                )}
                              </div>
                              <p
                                className="mt-1 text-xs leading-relaxed break-words"
                                style={{
                                  color: 'var(--casino-text-secondary)',
                                }}
                              >
                                {n.message}
                              </p>
                              <p
                                className="mt-1.5 text-[10px] opacity-70"
                                style={{
                                  color: 'var(--casino-text-secondary)',
                                }}
                              >
                                {new Date(n.createdAt).toLocaleString(
                                  undefined,
                                  {
                                    month: 'short',
                                    day: 'numeric',
                                    hour: 'numeric',
                                    minute: '2-digit',
                                  },
                                )}
                              </p>
                            </div>
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </div>
        </>
      )}

      {/* ---------------- Slide-over drawer (mobile / tablet) ---------------- */}
      {menuOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Site menu"
        >
          <button
            type="button"
            className="absolute inset-0 bg-black/70"
            aria-label="Close menu"
            onClick={() => setMenuOpen(false)}
          />
          <div
            className="cosmic-card-solid absolute left-0 top-0 flex h-full w-[min(100%,18rem)] flex-col p-4 shadow-xl"
            style={{
              paddingTop: 'calc(1rem + env(safe-area-inset-top, 0px))',
            }}
          >
            <div className="mb-6 flex items-center justify-between">
              <span
                className="text-lg font-bold"
                style={{ color: 'var(--casino-text-primary)' }}
              >
                Menu
              </span>
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="rounded-lg p-2"
                style={{
                  color: 'var(--casino-text-secondary)',
                  backgroundColor: 'rgba(255, 255, 255, 0.06)',
                }}
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <nav
              className="flex flex-col gap-1"
              aria-label="Site pages"
              onClick={() => setMenuOpen(false)}
            >
              {NAV_ITEMS.map((item) => {
                const isActive =
                  item.name === 'Home'
                    ? isHomeActive
                    : location.pathname === item.href;
                const to = item.name === 'Home' ? homeHref : item.href;
                return (
                  <NavLink
                    key={item.name}
                    to={to}
                    end={item.name === 'Home'}
                    className={() => drawerNavLinkClass({ isActive })}
                  >
                    {item.name}
                  </NavLink>
                );
              })}
              <Link
                to="/privacy"
                className="block rounded-lg px-4 py-3 text-sm hover:bg-white/[0.06]"
                style={{ color: 'var(--casino-text-primary)' }}
              >
                Privacy Policy
              </Link>
              <Link
                to="/terms"
                className="block rounded-lg px-4 py-3 text-sm hover:bg-white/[0.06]"
                style={{ color: 'var(--casino-text-primary)' }}
              >
                Terms of Service
              </Link>
            </nav>

            <div
              className="mt-auto border-t pt-4"
              style={{ borderColor: 'var(--casino-card-border)' }}
            >
              {isAuthenticated ? (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/profile"
                    onClick={() => setMenuOpen(false)}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm"
                    style={{
                      color: 'var(--casino-text-primary)',
                      backgroundColor: 'rgba(255, 255, 255, 0.04)',
                    }}
                  >
                    <User className="h-4 w-4" />
                    My Account
                  </Link>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-semibold"
                    style={{
                      color: 'var(--casino-accent-red)',
                      backgroundColor: 'rgba(229, 57, 53, 0.08)',
                    }}
                  >
                    <LogOut className="h-4 w-4" />
                    Logout
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <Link
                    to="/login"
                    onClick={() => setMenuOpen(false)}
                    className="btn-casino-primary text-center text-sm"
                    style={{ borderRadius: '0.75rem' }}
                  >
                    Login
                  </Link>
                  <Link
                    to="/register"
                    onClick={() => setMenuOpen(false)}
                    className="rounded-xl border py-3 text-center text-sm font-semibold"
                    style={{
                      borderColor: 'var(--casino-highlight-gold)',
                      color: 'var(--casino-highlight-gold)',
                    }}
                  >
                    Sign up
                  </Link>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------- Main content ---------------- */}
      <main
        className={`${
          isChatPage
            ? 'fixed inset-x-0 z-0 flex min-h-0 flex-col overflow-hidden top-[calc(var(--layout-header-height)+env(safe-area-inset-top,0px))] max-lg:bottom-[calc(var(--mobile-tab-bar-height)+env(safe-area-inset-bottom,0px))] lg:relative lg:top-auto lg:bottom-auto lg:z-auto lg:flex-1 lg:min-h-0'
            : isGuestHome
              ? 'flex min-h-0 flex-1 flex-col overflow-x-clip overflow-y-auto overscroll-y-contain'
              : 'relative cosmic-page-bg overflow-visible'
        } ${isChatPage || hideBottomNav ? '' : 'pb-[calc(var(--mobile-tab-bar-height)+env(safe-area-inset-bottom,0px))] lg:pb-0'}`}
      >
        {children}
        {!hideFooter && isGuestHome ? <Footer /> : null}
      </main>

      {/* ---------------- Footer ---------------- */}
      {!hideFooter && !isGuestHome ? <Footer /> : null}

      {/* ---------------- Mobile bottom tab bar ---------------- */}
      {!hideBottomNav && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 border-t backdrop-blur-lg lg:hidden"
          aria-label="Mobile primary"
          style={{
            backgroundColor: 'rgba(10, 10, 15, 0.9)',
            borderTopColor: 'var(--casino-card-border)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
          }}
        >
          <div className="mx-auto flex max-w-lg items-stretch justify-between gap-1 px-2 pt-1.5">
            {MOBILE_TABS.map((item) => {
              const to = item.name === 'Home' ? homeHref : item.href;
              const isActive =
                item.name === 'Home'
                  ? isHomeActive
                  : location.pathname === item.href;
              return (
                <NavLink
                  key={item.name}
                  to={to}
                  end={item.name === 'Home'}
                  onClick={() => triggerHaptic('light')}
                  className={`flex min-h-[48px] min-w-0 flex-1 touch-manipulation flex-col items-center justify-center gap-0.5 rounded-xl px-2 py-1.5 transition-colors active:scale-95 ${
                    isActive
                      ? 'text-[color:var(--casino-highlight-gold)]'
                      : 'text-[color:var(--casino-text-secondary)]'
                  }`}
                  style={{
                    backgroundColor: isActive
                      ? 'rgba(255, 215, 0, 0.08)'
                      : 'transparent',
                  }}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <item.icon className="h-5 w-5" />
                  <span className="text-[11px] font-semibold leading-tight">
                    {item.name}
                  </span>
                </NavLink>
              );
            })}
          </div>
        </nav>
      )}
    </div>
  );
};

export default Layout;
