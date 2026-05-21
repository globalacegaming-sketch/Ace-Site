import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useEffect, lazy, Suspense } from 'react';
import { Loader2 } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from './stores/authStore';
import { MusicProvider } from './contexts/MusicContext';
import ClickSoundProvider from './components/ClickSoundProvider';
import Layout from './components/layout/Layout';
import UserChatWidget from './components/chat/UserChatWidget';
import OneSignalAuthSync from './components/OneSignalAuthSync';
import IOSAddToHomeScreenBanner from './components/IOSAddToHomeScreenBanner';
import AnalyticsProvider from './components/AnalyticsProvider';
import WheelOfFortune from './components/wheel/WheelOfFortune';
import CookieConsentBanner from './components/CookieConsentBanner';
import { ScrollToTop } from './components/ScrollToTop';

// Global axios interceptor: auto-logout when the server says the account is banned
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error?.response?.data?.code === 'ACCOUNT_BANNED') {
      useAuthStore.getState().logout();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// ——— Lazy-loaded pages ———
// Reduces initial JS bundle by ~40 %. Each page is fetched only when navigated to.
const Home = lazy(() => import('./pages/Home'));
const Login = lazy(() => import('./pages/Login'));
const Register = lazy(() => import('./pages/Register'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Games = lazy(() => import('./pages/Games'));
const Bonuses = lazy(() => import('./pages/Bonuses'));
const Platforms = lazy(() => import('./pages/Platforms'));
const AboutUs = lazy(() => import('./pages/AboutUs'));
const ProfilePage = lazy(() => import('./pages/Profile'));
const Settings = lazy(() => import('./pages/Settings'));
const Support = lazy(() => import('./pages/Support'));
const GameLaunch = lazy(() => import('./pages/GameLaunch'));
const AceagentLogin = lazy(() => import('./pages/aceagent/AceagentLogin'));
const AceagentDashboard = lazy(() => import('./pages/aceagent/AceagentDashboard'));
const UserFortunePandaDashboard = lazy(() => import('./pages/UserFortunePandaDashboard'));
const AceadminLogin = lazy(() => import('./pages/aceadmin/AceadminLogin'));
const AceadminDashboard = lazy(() => import('./pages/aceadmin/AceadminDashboard'));
const RoleSubdomainGuard = lazy(() => import('./components/RoleSubdomainGuard'));
const NotFound = lazy(() => import('./pages/NotFound'));
const ForgotPassword = lazy(() => import('./pages/ForgotPassword'));
const ResetPassword = lazy(() => import('./pages/ResetPassword'));
const VerifyEmail = lazy(() => import('./pages/VerifyEmail'));
const VerifyCode = lazy(() => import('./pages/VerifyCode'));
const Chat = lazy(() => import('./pages/Chat'));
const Terms = lazy(() => import('./pages/Terms'));
const Privacy = lazy(() => import('./pages/Privacy'));
const Cookies = lazy(() => import('./pages/Cookies'));
const Referrals = lazy(() => import('./pages/Referrals'));
const Loans = lazy(() => import('./pages/Loans'));

/** Lightweight full-screen loader shown while a lazy chunk downloads */
const PageLoader = () => (
  <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#0A0A0F' }}>
    <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#FFD700' }} />
  </div>
);

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, checkSession, logout } = useAuthStore();
  
  if (!isAuthenticated || !checkSession()) {
    if (isAuthenticated) {
      logout();
    }
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Home Route Component
const HomeRoute = () => {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Layout><Home /></Layout>;
};

// Session Manager Component
const SessionManager = () => {
  const { isAuthenticated, lastActivityTime } = useAuthStore();

  useEffect(() => {
    const checkInitialSession = setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.isAuthenticated) {
        if (!state.checkSession()) {
          state.logout();
          toast.error('Your session has expired due to inactivity. Please login again.');
        } else {
          state.updateActivity();
        }
      }
    }, 100);

    return () => clearTimeout(checkInitialSession);
  }, []);

  useEffect(() => {
    if (isAuthenticated && !lastActivityTime) {
      useAuthStore.getState().updateActivity();
    }
  }, [isAuthenticated, lastActivityTime]);

  useEffect(() => {
    if (!isAuthenticated) return;

    const state = useAuthStore.getState();
    if (!state.checkSession()) {
      state.logout();
      toast.error('Your session has expired due to inactivity. Please login again.');
      return;
    }

    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated) {
        currentState.updateActivity();
      }
    };

    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    const sessionCheckInterval = setInterval(() => {
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated && !currentState.checkSession()) {
        currentState.logout();
        toast.error('Your session has expired due to inactivity. Please login again.');
      }
    }, 60000);

    return () => {
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(sessionCheckInterval);
    };
  }, [isAuthenticated]);

  return null;
};

function App() {
  return (
    <MusicProvider>
      <ClickSoundProvider>
        <Router>
          <div className="App">
          <ScrollToTop />
          <SessionManager />
          <AnalyticsProvider />
          <OneSignalAuthSync />
          <Toaster
            position="top-center"
            containerStyle={{
              top: 'calc(10px + env(safe-area-inset-top, 0px))',
              zIndex: 9999,
            }}
            gutter={8}
            toastOptions={{
              duration: 3500,
              style: {
                background: '#1B1B2F',
                color: '#F5F5F5',
                border: '1px solid #2C2C3A',
                borderRadius: '12px',
                padding: '10px 14px',
                fontSize: '14px',
                maxWidth: 'calc(100vw - 32px)',
                boxShadow:
                  '0 10px 30px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(255, 215, 0, 0.04)',
              },
              success: {
                iconTheme: { primary: '#FFD700', secondary: '#0A0A0F' },
                style: {
                  background: '#1B1B2F',
                  color: '#F5F5F5',
                  border: '1px solid rgba(255, 215, 0, 0.35)',
                  boxShadow:
                    '0 10px 30px rgba(0, 0, 0, 0.45), 0 0 24px rgba(255, 215, 0, 0.12)',
                },
              },
              error: {
                iconTheme: { primary: '#F87171', secondary: '#0A0A0F' },
                style: {
                  background: '#1B1B2F',
                  color: '#F5F5F5',
                  border: '1px solid rgba(248, 113, 113, 0.35)',
                },
              },
              loading: {
                iconTheme: { primary: '#00B0FF', secondary: '#0A0A0F' },
                style: {
                  background: '#1B1B2F',
                  color: '#F5F5F5',
                  border: '1px solid rgba(0, 176, 255, 0.35)',
                },
              },
            }}
          />
        
        {/* Suspense boundary wraps all lazy routes */}
        <Suspense fallback={<PageLoader />}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<HomeRoute />} />
            <Route path="/login" element={<Layout><Login /></Layout>} />
            <Route path="/register" element={<Layout><Register /></Layout>} />
            <Route path="/forgot-password" element={<Layout><ForgotPassword /></Layout>} />
            <Route path="/reset-password" element={<Layout><ResetPassword /></Layout>} />
            <Route path="/verify-email" element={<Layout><VerifyEmail /></Layout>} />
            <Route path="/verify-code" element={<Layout><VerifyCode /></Layout>} />
            
            {/* Protected Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <Layout><Dashboard /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/games" element={<Layout><Games /></Layout>} />
            <Route path="/bonuses" element={<Layout><Bonuses /></Layout>} />
            <Route path="/chat" element={<Layout><Chat /></Layout>} />
            <Route path="/platforms" element={<Layout><Platforms /></Layout>} />
            <Route path="/about-us" element={<Layout><AboutUs /></Layout>} />
            
            {/* /wallet has been retired — redirect any legacy links to the dashboard to preserve SEO link equity */}
            <Route path="/wallet" element={<Navigate to="/dashboard" replace />} />

            <Route path="/profile" element={
              <ProtectedRoute>
                <Layout><ProfilePage /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/settings" element={
              <ProtectedRoute>
                <Layout><Settings /></Layout>
              </ProtectedRoute>
            } />
            
            <Route path="/referrals" element={
              <ProtectedRoute>
                <Layout><Referrals /></Layout>
              </ProtectedRoute>
            } />

            <Route path="/loans" element={
              <ProtectedRoute>
                <Layout><Loans /></Layout>
              </ProtectedRoute>
            } />

            <Route path="/support" element={<Layout><Support /></Layout>} />
            <Route path="/terms" element={<Layout><Terms /></Layout>} />
            <Route path="/privacy" element={<Layout><Privacy /></Layout>} />
            <Route path="/cookies" element={<Layout><Cookies /></Layout>} />
            
            <Route path="/game/:id" element={
              <ProtectedRoute>
                <GameLaunch />
              </ProtectedRoute>
            } />
            
            {/* Fortune Panda Routes */}
            <Route path="/fortune-panda" element={
              <ProtectedRoute>
                <UserFortunePandaDashboard />
              </ProtectedRoute>
            } />
            
            {/* Admin (aceagent): only on aceagent.globalacegaming.com */}
            <Route path="/aceagent/login" element={<RoleSubdomainGuard role="admin"><AceagentLogin /></RoleSubdomainGuard>} />
            <Route path="/aceagent" element={<RoleSubdomainGuard role="admin"><AceagentDashboard /></RoleSubdomainGuard>} />
            
            {/* Agent (aceadmin): only on aceadmin.globalacegaming.com */}
            <Route path="/aceadmin" element={<Navigate to="/aceadmin/login" replace />} />
            <Route path="/aceadmin/login" element={<RoleSubdomainGuard role="agent"><AceadminLogin /></RoleSubdomainGuard>} />
            <Route path="/aceadmin/dashboard" element={<RoleSubdomainGuard role="agent"><AceadminDashboard /></RoleSubdomainGuard>} />
            
            {/* 404 */}
            <Route path="/404" element={<NotFound />} />

            {/* Catch all route */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Suspense>
        
        <UserChatWidget />
        <IOSAddToHomeScreenBanner />
        <WheelOfFortune />
        <CookieConsentBanner />
          </div>
        </Router>
      </ClickSoundProvider>
    </MusicProvider>
  );
}

export default App;
