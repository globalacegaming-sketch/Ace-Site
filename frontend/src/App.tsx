import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster, toast } from 'react-hot-toast';
import { useEffect } from 'react';
import { useAuthStore } from './stores/authStore';
import { MusicProvider } from './contexts/MusicContext';
import ClickSoundProvider from './components/ClickSoundProvider';
import Layout from './components/layout/Layout';
import UserChatWidget from './components/chat/UserChatWidget';
import OneSignalAuthSync from './components/OneSignalAuthSync';
import IOSAddToHomeScreenBanner from './components/IOSAddToHomeScreenBanner';
import WheelOfFortune from './components/wheel/WheelOfFortune';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Games from './pages/Games';
import Bonuses from './pages/Bonuses';
import Platforms from './pages/Platforms';
import AboutUs from './pages/AboutUs';
import WalletPage from './pages/Wallet';
import ProfilePage from './pages/Profile';
import Settings from './pages/Settings';
import Support from './pages/Support';
import GameLaunch from './pages/GameLaunch';
import AceagentLogin from './pages/aceagent/AceagentLogin';
import AceagentDashboard from './pages/aceagent/AceagentDashboard';
import UserFortunePandaDashboard from './pages/UserFortunePandaDashboard';
import AceadminLogin from './pages/aceadmin/AceadminLogin';
import AceadminDashboard from './pages/aceadmin/AceadminDashboard';
import RoleSubdomainGuard from './components/RoleSubdomainGuard';
import NotFound from './pages/NotFound';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import VerifyCode from './pages/VerifyCode';
import Chat from './pages/Chat';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, checkSession, logout } = useAuthStore();
  
  // Check if user is authenticated and session is valid
  if (!isAuthenticated || !checkSession()) {
    if (isAuthenticated) {
      // Session expired, logout and redirect
      logout();
    }
    return <Navigate to="/login" replace />;
  }
  
  return <>{children}</>;
};

// Home Route Component - shows Home for non-authenticated, redirects authenticated users
const HomeRoute = () => {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <Layout><Home /></Layout>;
};

// Admin Protected Route Component (commented out for now)
// const AdminProtectedRoute = ({ children }: { children: React.ReactNode }) => {
//   const { isAuthenticated, user } = useAuthStore();
//   
//   if (!isAuthenticated) {
//     return <Navigate to="/login" replace />;
//   }
//   
//   if (user?.role !== 'admin') {
//     return <Navigate to="/" replace />;
//   }
//   
//   return <>{children}</>;
// };

// Session Manager Component - handles session timeout and activity tracking
const SessionManager = () => {
  const { isAuthenticated, lastActivityTime } = useAuthStore();

  // Immediate check on mount - runs once when component mounts
  // This handles the case where user opens site after being inactive
  useEffect(() => {
    // Use a small timeout to ensure store is fully hydrated from localStorage
    const checkInitialSession = setTimeout(() => {
      const state = useAuthStore.getState();
      if (state.isAuthenticated) {
        if (!state.checkSession()) {
          // Session expired
          state.logout();
          toast.error('Your session has expired due to inactivity. Please login again.');
        } else {
          // Session is valid, update activity time (user just opened the site)
          state.updateActivity();
        }
      }
    }, 100); // Small delay to ensure localStorage hydration is complete

    return () => clearTimeout(checkInitialSession);
  }, []); // Run only once on mount

  // Separate effect for initializing activity time (only runs when authentication state changes)
  useEffect(() => {
    if (isAuthenticated && !lastActivityTime) {
      // Use getState() to get the latest updateActivity function
      useAuthStore.getState().updateActivity();
    }
  }, [isAuthenticated, lastActivityTime]); // Depend on isAuthenticated and lastActivityTime to detect when activity needs initialization

  // Main effect for session management and activity tracking
  useEffect(() => {
    if (!isAuthenticated) {
      return; // Don't set up listeners if not authenticated
    }

    // Check session on mount (additional check after hydration)
    // Use getState() to get the latest checkSession function
    const state = useAuthStore.getState();
    if (!state.checkSession()) {
      state.logout();
      // Show toast notification
      toast.error('Your session has expired due to inactivity. Please login again.');
      return;
    }

    // Set up activity tracking
    const activityEvents = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];
    const handleActivity = () => {
      // Use getState() to always get the latest functions and state
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated) {
        currentState.updateActivity();
      }
    };

    // Add event listeners for activity tracking
    activityEvents.forEach(event => {
      document.addEventListener(event, handleActivity, { passive: true });
    });

    // Set up periodic session check (every minute)
    const sessionCheckInterval = setInterval(() => {
      // Use getState() to always get the latest functions and state
      const currentState = useAuthStore.getState();
      if (currentState.isAuthenticated && !currentState.checkSession()) {
        currentState.logout();
        toast.error('Your session has expired due to inactivity. Please login again.');
      }
    }, 60000); // Check every minute

    return () => {
      // Cleanup event listeners
      activityEvents.forEach(event => {
        document.removeEventListener(event, handleActivity);
      });
      clearInterval(sessionCheckInterval);
    };
  }, [isAuthenticated]); // Only depend on isAuthenticated - use getState() for functions to avoid re-creating intervals

  return null;
};

function App() {
  return (
    <MusicProvider>
      <ClickSoundProvider>
        <Router>
          <div className="App">
          <SessionManager />
          <OneSignalAuthSync />
          <Toaster 
            position="top-right"
            containerStyle={{
              top: 20,
              right: 20,
              // Ensure toasts don't block important UI elements on mobile
              zIndex: 9999,
              maxHeight: 'calc(100vh - 120px)', // Prevent toasts from stacking too high (account for header)
            }}
            gutter={8}
            containerClassName="!z-[9999] md:!top-5 md:!right-5 !top-16 !right-2"
            toastOptions={{
              duration: 3000, // Reduced from 4000 to prevent blocking
              style: {
                background: '#363636',
                color: '#fff',
                maxWidth: 'calc(100vw - 40px)', // Prevent toasts from being too wide on mobile
                margin: '0 auto',
                fontSize: '14px',
                padding: '12px 16px',
                wordBreak: 'break-word', // Prevent text overflow on mobile
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 3000, // Shorter duration for errors to prevent blocking UI
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#fff',
                },
              },
            }}
          />
        
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
          <Route path="/chat" element={
            <ProtectedRoute>
              <Layout><Chat /></Layout>
            </ProtectedRoute>
          } />
          <Route path="/platforms" element={<Layout><Platforms /></Layout>} />
          <Route path="/about-us" element={<Layout><AboutUs /></Layout>} />
          
          <Route path="/wallet" element={
            <ProtectedRoute>
              <Layout><WalletPage /></Layout>
            </ProtectedRoute>
          } />
          
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
          
          <Route path="/support" element={<Layout><Support /></Layout>} />
          
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
          
          {/* 404 - fallback for unknown paths; RoleSubdomainGuard renders NotFound when hostname doesn't match */}
          <Route path="/404" element={<NotFound />} />

          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        <UserChatWidget />
        <IOSAddToHomeScreenBanner />
        <WheelOfFortune />
          </div>
        </Router>
      </ClickSoundProvider>
    </MusicProvider>
  );
}

export default App;
