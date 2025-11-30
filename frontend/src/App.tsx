import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './stores/authStore';
import { MusicProvider } from './contexts/MusicContext';
import ClickSoundProvider from './components/ClickSoundProvider';
import Layout from './components/layout/Layout';
import UserChatWidget from './components/chat/UserChatWidget';
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
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import UserFortunePandaDashboard from './pages/UserFortunePandaDashboard';
import AgentLogin from './pages/AgentLogin';
import AgentDashboard from './pages/AgentDashboard';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import VerifyEmail from './pages/VerifyEmail';
import VerifyCode from './pages/VerifyCode';
import Chat from './pages/Chat';

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated } = useAuthStore();
  
  if (!isAuthenticated) {
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

function App() {
  return (
    <MusicProvider>
      <ClickSoundProvider>
        <Router>
          <div className="App">
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#fff',
                },
              },
              error: {
                duration: 5000,
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
          
          <Route path="/support" element={
            <ProtectedRoute>
              <Layout><Support /></Layout>
            </ProtectedRoute>
          } />
          
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
          
          {/* Admin Routes */}
          <Route path="/adminacers/login" element={<AdminLogin />} />
          <Route path="/adminacers" element={<AdminDashboard />} />
          
          {/* Agent Login Route */}
          <Route path="/agent-login" element={<AgentLogin />} />
          <Route path="/agent-dashboard" element={<AgentDashboard />} />
          
          {/* Catch all route */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
        
        <UserChatWidget />
          </div>
        </Router>
      </ClickSoundProvider>
    </MusicProvider>
  );
}

export default App;
