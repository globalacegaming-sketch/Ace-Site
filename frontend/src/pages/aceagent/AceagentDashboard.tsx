import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { 
  Gift,
  Download,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2,
  XCircle,
  RefreshCw,
  X,
  CheckCircle,
  Key,
  Mail,
  Shield,
  Users,
  MessageCircle,
  Ban,
  UserCheck,
  LogOut,
  Banknote,
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate, useLocation } from 'react-router-dom';
import { getApiBaseUrl, getWsBaseUrl } from '../../utils/api';
import AdminChatPanel from '../../components/admin/chat/AdminChatPanel';
import AdminSessionManager from '../../components/admin/AdminSessionManager';
import { useMusic } from '../../contexts/MusicContext';
import AgentLoanPanel from '../../components/admin/AgentLoanPanel';

type AgentPermission = 'chat' | 'users' | 'referrals' | 'loans';

interface User {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  fortunePandaUsername?: string;
  fortunePandaBalance?: number;
  role: string;
  isActive: boolean;
  isEmailVerified?: boolean;
  isBanned?: boolean;
  bannedIPs?: string[];
  bannedAt?: string;
  banReason?: string;
  lastLoginIP?: string;
  createdAt: string;
  lastLogin?: string;
}

// Helper function to get the FP account name (use as stored in database)
const getFPAccountName = (dbUsername: string | undefined): string => {
  return dbUsername || 'N/A';
};

const AceagentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const API_BASE_URL = getApiBaseUrl();
  const { stopMusic } = useMusic();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedUserForVerification, setSelectedUserForVerification] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [agentBalance, setAgentBalance] = useState<string>('0.00');
  const [agentName, setAgentName] = useState<string>('');
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalAction, setModalAction] = useState<'recharge' | 'redeem' | null>(null);
  const [fixingFpAccount, setFixingFpAccount] = useState<string | null>(null);
  const [refreshingUserId, setRefreshingUserId] = useState<string | null>(null);

  
  // Form states
  const [depositAmount, setDepositAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const wsBaseUrl = useMemo(() => getWsBaseUrl(), []);

  const sessionCheckedRef = useRef(false);

  const [pendingChatUserId, setPendingChatUserId] = useState<string | null>(null);
  const [unreadChatCount, setUnreadChatCount] = useState(0);

  // ── Permissions ────────────────────────────────────────────────────────────
  const [permissions, setPermissions] = useState<AgentPermission[]>([
    'chat', 'users', 'referrals',
  ]);

  const hasPermission = useCallback(
    (perm: AgentPermission) => permissions.includes(perm),
    [permissions],
  );

  const navigateToUserChat = useCallback((userId: string) => {
    if (!hasPermission('chat')) {
      toast.error('You do not have chat permission.');
      return;
    }
    // Clear first so the same userId can be re-navigated to
    setPendingChatUserId(null);
    // Use microtask to ensure React processes the null before the new value
    queueMicrotask(() => {
      setPendingChatUserId(userId);
      setActiveTab('chat');
    });
  }, [hasPermission]);

  // Default tab = first allowed permission, or fallback to 'chat'
  const allTabs: AgentPermission[] = ['chat', 'users', 'referrals', 'loans'];
  const allowedTabs = allTabs.filter((t) => permissions.includes(t));
  const [activeTab, setActiveTab] = useState<AgentPermission>(
    allowedTabs[0] || 'chat',
  );

  // If the current active tab is no longer allowed, switch to the first allowed
  useEffect(() => {
    if (!hasPermission(activeTab) && allowedTabs.length > 0) {
      setActiveTab(allowedTabs[0]);
    }
  }, [permissions, activeTab, hasPermission, allowedTabs]);

  // ── Logout handler (calls backend) ────────────────────────────────────────
  const handleLogout = useCallback(async () => {
    try {
      const token = getAdminToken();
      if (token) {
        await axios.post(
          `${API_BASE_URL}/admin/logout`,
          {},
          { headers: { Authorization: `Bearer ${token}` } },
        ).catch(() => { /* swallow network errors */ });
      }
    } finally {
      localStorage.removeItem('admin_session');
      toast.success('Logged out successfully');
      navigate('/aceagent/login', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navigate, API_BASE_URL]);

  // Referrals state
  interface AgentReferral {
    _id: string;
    referredUser: { _id: string; username: string; email: string; firstName?: string; lastName?: string; createdAt: string } | null;
    referredBy: { _id: string; username: string; email: string; firstName?: string; lastName?: string; referralCode?: string } | null;
    referralCode: string;
    status: 'pending' | 'verified';
    bonusGranted: boolean;
    bonusAmount: number;
    verifiedAt?: string;
    verifiedBy?: string;
    createdAt: string;
  }
  const [referrals, setReferrals] = useState<AgentReferral[]>([]);
  const [referralsLoading, setReferralsLoading] = useState(false);
  const [referralFilter, setReferralFilter] = useState<'all' | 'pending' | 'verified'>('all');
  const [verifyingReferral, setVerifyingReferral] = useState<string | null>(null);

  // ── Referral helpers ──
  const fetchReferrals = async () => {
    setReferralsLoading(true);
    try {
      const session = JSON.parse(localStorage.getItem('admin_session') || '{}');
      const statusParam = referralFilter === 'all' ? '' : `?status=${referralFilter}`;
      const res = await axios.get(`${API_BASE_URL}/agent/referrals${statusParam}`, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.data.success) setReferrals(res.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load referrals');
    } finally {
      setReferralsLoading(false);
    }
  };

  const handleVerifyReferral = async (id: string) => {
    setVerifyingReferral(id);
    try {
      const session = JSON.parse(localStorage.getItem('admin_session') || '{}');
      const res = await axios.post(`${API_BASE_URL}/agent/referrals/${id}/verify`, {}, {
        headers: { Authorization: `Bearer ${session.token}` },
      });
      if (res.data.success) {
        toast.success('Referral verified & bonus sent!');
        fetchReferrals();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Verification failed');
    } finally {
      setVerifyingReferral(null);
    }
  };

  // Fetch referrals when tab is switched to referrals or filter changes
  useEffect(() => {
    if (activeTab === 'referrals') fetchReferrals();
  }, [activeTab, referralFilter]);

  // Stop music when admin dashboard loads
  useEffect(() => {
    stopMusic();
  }, [stopMusic]);

  // Prevent navigation to login page if already logged in
  useEffect(() => {
    const session = localStorage.getItem('admin_session');
    if (session && location.pathname === '/aceagent/login') {
      try {
        const parsedSession = JSON.parse(session);
        // If session is valid, reload to stay on dashboard
        if (parsedSession.expiresAt && Date.now() < parsedSession.expiresAt) {
          // Reload the page to stay on dashboard instead of login
          window.location.href = '/aceagent';
          return;
        }
      } catch (error) {
        // Invalid session, allow navigation to login
      }
    }
  }, [location.pathname]);

  // Handle browser back button - reload page instead of going to login if logged in
  useEffect(() => {
    const handlePopState = () => {
      const session = localStorage.getItem('admin_session');
      if (session) {
        try {
          const parsedSession = JSON.parse(session);
          // If session is valid and we're trying to go back to login, reload instead
          if (parsedSession.expiresAt && Date.now() < parsedSession.expiresAt) {
            // Small delay to let React Router update location
            setTimeout(() => {
              const currentPath = window.location.pathname;
              if (currentPath === '/aceagent/login' || currentPath.includes('/aceagent/login')) {
                // Reload the page to stay on dashboard
                window.location.href = '/aceagent';
              }
            }, 0);
          }
        } catch (error) {
          // Invalid session, allow normal navigation
        }
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => {
      window.removeEventListener('popstate', handlePopState);
    };
  }, []);

  // Session check and initialization - runs only once per mount
  // Uses ref to prevent re-running on browser back/forward navigation
  useEffect(() => {
    // Prevent duplicate session checks when navigating back/forward
    if (sessionCheckedRef.current) {
      return;
    }

    // Check for admin session
    const session = localStorage.getItem('admin_session');
    if (!session) {
      toast.error('Please login to access admin panel');
      navigate('/aceagent/login', { replace: true });
      return;
    }

    try {
      const parsedSession = JSON.parse(session);
      // Check if session expired
      if (parsedSession.expiresAt && Date.now() > parsedSession.expiresAt) {
        localStorage.removeItem('admin_session');
        toast.error('Session expired. Please login again.');
        navigate('/aceagent/login', { replace: true });
        return;
      }
      if (parsedSession.agentName) {
        setAgentName(parsedSession.agentName);
      }
      if (parsedSession.agentBalance) {
        setAgentBalance(parsedSession.agentBalance);
      }
      // Load permissions from session
      if (Array.isArray(parsedSession.permissions) && parsedSession.permissions.length > 0) {
        setPermissions(parsedSession.permissions);
      }
      loadUsers();
      loadAgentBalance();
      
      // Mark session as checked
      sessionCheckedRef.current = true;
    } catch (error) {
      localStorage.removeItem('admin_session');
      navigate('/aceagent/login', { replace: true });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty dependency array - only run once on mount, not on navigation or re-renders

  const getAdminToken = () => {
    const session = localStorage.getItem('admin_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        // Check if session expired
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          console.warn('⚠️ Admin session expired');
          localStorage.removeItem('admin_session');
          return null;
        }
        return parsed.token;
      } catch (error) {
        console.error('Error parsing admin session:', error);
        localStorage.removeItem('admin_session');
        return null;
      }
    }
    return null;
  };

  const loadAgentBalance = async () => {
    try {
      const token = getAdminToken();
      if (!token) return;

      const response = await axios.get(`${API_BASE_URL}/admin/agent-balance`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setAgentBalance(response.data.data?.agentBalance || '0.00');
      }
    } catch (error: any) {
      // Silently fail - agent balance is optional
    }
  };

  const refreshUserBalance = async (userId: string) => {
    try {
      setRefreshingUserId(userId);
      const token = getAdminToken();
      if (!token) return;

      const response = await axios.post(
        `${API_BASE_URL}/admin/users/${userId}/sync-balance`,
        {},
        { headers: { 'Authorization': `Bearer ${token}` } }
      );

      if (response.data.success) {
        const newBalance = response.data.data.balance;
        setUsers(prev => prev.map(u =>
          u._id === userId ? { ...u, fortunePandaBalance: newBalance } : u
        ));
        toast.success(`Balance updated: $${parseFloat(newBalance).toFixed(2)}`);
        if (response.data.data.agentBalance) {
          setAgentBalance(response.data.data.agentBalance);
        }
      } else {
        toast.error(response.data.message || 'Failed to refresh balance');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to refresh balance');
    } finally {
      setRefreshingUserId(null);
    }
  };

  const syncAllUsersFromFortunePanda = async () => {
    try {
      setLoading(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/aceagent/login');
        return;
      }

      toast.loading('Syncing all users from FortunePanda...', { id: 'sync-users' });

      const response = await axios.post(
        `${API_BASE_URL}/admin/users/sync-fortune-panda`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        const { successful, failed, total } = response.data.data;
        toast.success(
          `Synced ${successful} of ${total} users from FortunePanda${failed > 0 ? ` (${failed} failed)` : ''}`,
          { id: 'sync-users' }
        );
        // Refresh users list to show updated balances
        loadUsers();
        // Refresh agent balance
        loadAgentBalance();
      } else {
        toast.error(response.data.message || 'Failed to sync users', { id: 'sync-users' });
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to sync users from FortunePanda', { id: 'sync-users' });
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      setLoading(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/aceagent/login');
        return;
      }
      const response = await axios.get(`${API_BASE_URL}/admin/users`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        setUsers(response.data.data || []);
      } else {
        toast.error(response.data.message || 'Failed to load users');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyEmail = async (userId: string) => {
    try {
      setVerifying(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/aceagent/login');
        return;
      }

      const response = await axios.put(
        `${API_BASE_URL}/admin/users/${userId}/verify-email`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('User email verified successfully');
        loadUsers();
      } else {
        toast.error(response.data.message || 'Failed to verify email');
      }
    } catch (error: any) {
      console.error('Failed to verify email:', error);
      toast.error(error.response?.data?.message || 'Failed to verify email');
    } finally {
      setVerifying(false);
    }
  };

  const handleBanUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to permanently ban this user? This will also ban their IP address.')) {
      return;
    }

    try {
      const token = getAdminToken();
      if (!token) {
        navigate('/aceagent/login');
        return;
      }

      const response = await axios.put(
        `${API_BASE_URL}/admin/users/${userId}/ban`,
        { reason: 'Suspicious activity detected by admin' },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('User banned successfully');
        loadUsers();
      } else {
        toast.error(response.data.message || 'Failed to ban user');
      }
    } catch (error: any) {
      console.error('Failed to ban user:', error);
      toast.error(error.response?.data?.message || 'Failed to ban user');
    }
  };

  const handleUnbanUser = async (userId: string) => {
    if (!window.confirm('Are you sure you want to unban this user?')) {
      return;
    }

    try {
      const token = getAdminToken();
      if (!token) {
        navigate('/aceagent/login');
        return;
      }

      const response = await axios.put(
        `${API_BASE_URL}/admin/users/${userId}/unban`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success('User unbanned successfully');
        loadUsers();
      } else {
        toast.error(response.data.message || 'Failed to unban user');
      }
    } catch (error: any) {
      console.error('Failed to unban user:', error);
      toast.error(error.response?.data?.message || 'Failed to unban user');
    }
  };

  const handleResetPassword = async () => {
    if (!selectedUserForVerification) return;
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters long');
      return;
    }

    try {
      setResetting(true);
      const token = getAdminToken();
      if (!token) {
        toast.error('Admin session expired. Please login again.');
        navigate('/aceagent/login');
        return;
      }

      // Check if session is still valid
      const session = localStorage.getItem('admin_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          toast.error('Admin session expired. Please login again.');
          localStorage.removeItem('admin_session');
          navigate('/aceagent/login');
          return;
        }
      }

      console.log('🔐 Resetting password:', {
        userId: selectedUserForVerification._id,
        tokenPrefix: token.substring(0, 10) + '...',
        tokenLength: token.length,
        apiUrl: `${API_BASE_URL}/admin/users/${selectedUserForVerification._id}/reset-password`
      });

      const response = await axios.put(
        `${API_BASE_URL}/admin/users/${selectedUserForVerification._id}/reset-password`,
        { newPassword },
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        toast.success('Password reset successfully');
        setShowPasswordModal(false);
        setNewPassword('');
        setSelectedUserForVerification(null);
      } else {
        toast.error(response.data.message || 'Failed to reset password');
      }
    } catch (error: any) {
      console.error('Failed to reset password:', error);
      
      if (error.response?.status === 401) {
        // Session expired or invalid
        const errorMessage = error.response?.data?.message || 'Admin session expired or invalid';
        toast.error(errorMessage);
        
        // If it's a session issue, redirect to login
        if (errorMessage.includes('session') || errorMessage.includes('token') || errorMessage.includes('Access denied')) {
          localStorage.removeItem('admin_session');
          setTimeout(() => {
            navigate('/aceagent/login');
          }, 2000);
        }
      } else {
        toast.error(error.response?.data?.message || 'Failed to reset password');
      }
    } finally {
      setResetting(false);
    }
  };

  const handleFixFortunePandaAccount = async (userId: string) => {
    if (!window.confirm('This will assign a new unique Fortune Panda username and create/retry the account. Continue?')) {
      return;
    }

    try {
      setFixingFpAccount(userId);
      const token = getAdminToken();
      if (!token) {
        toast.error('Admin session expired. Please login again.');
        navigate('/aceagent/login');
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/admin/users/${userId}/fix-fortune-panda`,
        {},
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        const newUsername = response.data.data?.newUsername || 'N/A';
        toast.success(`Fortune Panda account fixed! New username: ${newUsername}`);
        loadUsers(); // Refresh to show updated FP username
      } else {
        toast.error(response.data.message || 'Failed to fix account');
      }
    } catch (error: any) {
      console.error('Failed to fix Fortune Panda account:', error);
      
      if (error.response?.status === 401) {
        const errorMessage = error.response?.data?.message || 'Admin session expired or invalid';
        toast.error(errorMessage);
        if (errorMessage.includes('session') || errorMessage.includes('token') || errorMessage.includes('Access denied')) {
          localStorage.removeItem('admin_session');
          setTimeout(() => {
            navigate('/aceagent/login');
          }, 2000);
        }
      } else {
        const errorMsg = error.response?.data?.message || 'Failed to fix Fortune Panda account';
        toast.error(errorMsg);
      }
    } finally {
      setFixingFpAccount(null);
    }
  };

  const handleDeposit = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    if (!depositAmount || parseFloat(depositAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/aceagent/login');
        return;
      }
      const response = await axios.post(
        `${API_BASE_URL}/admin/deposit`,
        {
          userId: selectedUser._id,
          amount: depositAmount
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success(`Deposit successful! New balance: ${response.data.data?.userbalance || 'N/A'}`);
        setDepositAmount('');
        loadUsers();
      } else {
        toast.error(response.data.message || 'Deposit failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Deposit failed');
    } finally {
      setLoading(false);
    }
  };

  const handleRedeem = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
      toast.error('Please enter a valid amount');
      return;
    }

    try {
      setLoading(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/aceagent/login');
        return;
      }
      const response = await axios.post(
        `${API_BASE_URL}/admin/redeem`,
        {
          userId: selectedUser._id,
          amount: redeemAmount
        },
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        toast.success(`Redeem successful! New balance: ${response.data.data?.userbalance || 'N/A'}`);
        setRedeemAmount('');
        loadUsers();
      } else {
        toast.error(response.data.message || 'Redeem failed');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Redeem failed');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch =
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.fortunePandaUsername?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });


  const adminToken = getAdminToken();

  // Prevent body scroll and ensure proper height
  useEffect(() => {
    // Prevent body scroll
    document.body.style.overflow = 'hidden';
    document.body.style.height = '100vh';
    document.documentElement.style.overflow = 'hidden';
    document.documentElement.style.height = '100vh';
    
    return () => {
      // Cleanup on unmount
      document.body.style.overflow = '';
      document.body.style.height = '';
      document.documentElement.style.overflow = '';
      document.documentElement.style.height = '';
    };
  }, []);

  return (
    <div className="h-screen flex flex-col bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 overflow-hidden" style={{ height: '100vh', maxHeight: '100vh' }}>
      <AdminSessionManager />
      <style>{`
        /* Hide scrollbar for Chrome, Safari and Opera */
        .hide-scrollbar::-webkit-scrollbar {
          display: none;
        }
        /* Hide scrollbar for IE, Edge and Firefox */
        .hide-scrollbar {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        /* Prevent body scroll */
        body {
          overflow: hidden;
          height: 100vh;
        }
        html {
          overflow: hidden;
          height: 100vh;
        }
      `}</style>
      {/* Navbar Header - Single Row Layout */}
      <nav className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white shadow-xl flex-shrink-0">
        <div className="max-w-full mx-auto px-3 sm:px-4 lg:px-8">
          <div className="flex flex-row items-center justify-between gap-2 lg:gap-4 py-2 sm:py-2.5">
            {/* Left Section: Title */}
            <div className="flex items-center gap-1.5 sm:gap-3 lg:gap-4 flex-shrink-0 min-w-0">
              <h1 className="text-sm sm:text-base md:text-lg lg:text-xl font-bold text-white drop-shadow-md whitespace-nowrap">
                Welcome{agentName ? `, ${agentName}` : ''}
              </h1>
            </div>

            {/* Center Section: Navigation Tabs - Desktop only (permission-filtered) */}
            <div className="hidden lg:flex items-center justify-center gap-2 flex-1">
              {hasPermission('users') && (
                <button
                  onClick={() => setActiveTab('users')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                    activeTab === 'users'
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                  }`}
                >
                  User Management
                </button>
              )}
              {hasPermission('chat') && (
                <button
                  onClick={() => setActiveTab('chat')}
                  className={`relative px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                    activeTab === 'chat'
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                  }`}
                >
                  Support Chat
                  {unreadChatCount > 0 && activeTab !== 'chat' && (
                    <span className="absolute -top-1.5 -right-1.5 min-w-[20px] h-5 px-1 flex items-center justify-center bg-red-500 text-white text-[10px] font-bold rounded-full shadow-lg animate-pulse">
                      {unreadChatCount > 99 ? '99+' : unreadChatCount}
                    </span>
                  )}
                </button>
              )}
              {hasPermission('referrals') && (
                <button
                  onClick={() => setActiveTab('referrals')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                    activeTab === 'referrals'
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                  }`}
                >
                  Referrals
                </button>
              )}
              {hasPermission('loans') && (
                <button
                  onClick={() => setActiveTab('loans')}
                  className={`px-4 py-2 rounded-xl text-sm font-semibold transition whitespace-nowrap ${
                    activeTab === 'loans'
                      ? 'bg-white text-indigo-600 shadow-md'
                      : 'bg-white/20 text-white hover:bg-white/30 border border-white/30'
                  }`}
                >
                  Loans
                </button>
              )}
            </div>

            {/* Right Section: Action Buttons - Icon only on mobile */}
            <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
              <button
                onClick={() => {
                  if (activeTab === 'chat') {
                    // Refresh chat conversations if on chat tab
                    const chatRefresh = (window as any).__adminChatRefresh;
                    if (chatRefresh && typeof chatRefresh === 'function') {
                      chatRefresh();
                    }
                  } else {
                    // Refresh agent balance for other tabs
                    loadAgentBalance();
                  }
                }}
                className="p-2 sm:px-3 sm:py-2 bg-white/20 active:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] hover:bg-white/25"
                title="Refresh"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline ml-1.5 text-xs sm:text-sm font-medium">Refresh</span>
              </button>
              <button
                onClick={handleLogout}
                className="p-2 sm:px-3 sm:py-2 bg-white/20 active:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm flex items-center justify-center min-w-[40px] min-h-[40px] sm:min-w-[44px] sm:min-h-[44px] hover:bg-white/25"
                title="Logout"
              >
                <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline ml-1.5 text-xs sm:text-sm font-medium">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </nav>

      <div className="flex-1 overflow-y-auto max-w-full mx-auto w-full px-3 sm:px-4 lg:px-8 py-3 sm:py-4 lg:py-6 pb-20 sm:pb-6" style={{ minHeight: 0, maxHeight: '100%', overflowY: 'auto' }}>

        {activeTab === 'users' && hasPermission('users') ? (
          <>
            {/* Agent Balance Card */}
            <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 rounded-xl shadow-lg p-3 sm:p-4 mb-4 sm:mb-5 border border-indigo-500/30">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-lg bg-white/20 flex items-center justify-center backdrop-blur-sm">
                    <ArrowUp className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-blue-100 font-medium">FortunePanda Agent Balance</p>
                    <p className="text-lg sm:text-xl font-bold text-white tracking-tight">
                      ${parseFloat(agentBalance).toFixed(2)}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => loadAgentBalance()}
                  className="p-2 sm:p-2.5 text-white/80 hover:text-white hover:bg-white/20 active:bg-white/30 rounded-lg transition-all duration-200 flex items-center justify-center"
                  title="Refresh balance"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Search and Actions Bar */}
            <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 lg:p-6 mb-4 sm:mb-6 border border-gray-100">
              <div className="flex flex-col gap-3">
                <div className="flex-1 w-full">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by ID, Account or NickName"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm text-gray-700 placeholder-gray-400"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={syncAllUsersFromFortunePanda}
                    disabled={loading}
                    className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 active:from-purple-800 active:to-purple-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 text-sm font-semibold shadow-md min-h-[44px] sm:min-h-0"
                    title="Sync all users from FortunePanda API"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                    <span className="hidden sm:inline">Sync from FP</span>
                    <span className="sm:hidden">Sync</span>
                  </button>
                  <button
                    onClick={loadUsers}
                    className="flex-1 sm:flex-none px-4 py-3 sm:py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 active:from-gray-800 active:to-gray-900 transition-all duration-200 flex items-center justify-center gap-2 text-sm font-semibold shadow-md min-h-[44px] sm:min-h-0"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Refresh</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="p-4 sm:p-6">
                {loading ? (
                  <div className="flex justify-center items-center py-20">
                    <div className="flex flex-col items-center gap-4">
                      <Loader2 className="w-10 h-10 animate-spin text-indigo-600" />
                      <p className="text-gray-600 font-medium">Loading users...</p>
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Desktop Table View */}
                    <div className="hidden lg:block overflow-x-auto">
                      <table className="w-full table-fixed">
                        <thead>
                          <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b-2 border-indigo-200">
                            <th className="text-left px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wider w-[22%]">User</th>
                            <th className="text-center px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wider w-[12%]">Balance</th>
                            <th className="text-center px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wider w-[10%]">Status</th>
                            <th className="text-right px-4 py-3 text-xs font-bold text-indigo-900 uppercase tracking-wider">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredUsers.map((u, index) => (
                            <tr
                              key={u._id}
                              className={`hover:bg-indigo-50/50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}
                            >
                              <td className="px-4 py-3">
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5">
                                    <button onClick={() => navigateToUserChat(u._id)} className="text-sm font-semibold text-gray-900 hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left truncate">{u.username}</button>
                                    {u.isEmailVerified ? (
                                      <div title="Email Verified"><CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" /></div>
                                    ) : (
                                      <div title="Email Not Verified"><Mail className="w-3.5 h-3.5 text-red-500 flex-shrink-0" /></div>
                                    )}
                                    {u.isBanned && <div title="Banned"><Ban className="w-3.5 h-3.5 text-red-600 flex-shrink-0" /></div>}
                                  </div>
                                  <p className="text-xs text-gray-500 truncate mt-0.5">{u.email}</p>
                                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">{getFPAccountName(u.fortunePandaUsername)} · {u._id.slice(-8).toUpperCase()}</p>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                <div className="inline-flex items-center gap-1.5 justify-center">
                                  <span className="text-sm font-bold text-green-600">${u.fortunePandaBalance?.toFixed(2) || '0.00'}</span>
                                  <button
                                    onClick={() => refreshUserBalance(u._id)}
                                    disabled={refreshingUserId === u._id}
                                    className="p-1 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                                    title="Refresh balance"
                                  >
                                    {refreshingUserId === u._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
                                  </button>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-center">
                                {u.isBanned ? (
                                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">Banned</span>
                                ) : u.isActive ? (
                                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700 border border-green-200">Active</span>
                                ) : (
                                  <span className="inline-block px-2.5 py-1 rounded-full text-xs font-semibold bg-red-100 text-red-700 border border-red-200">Inactive</span>
                                )}
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2 flex-wrap justify-end">
                                  <button
                                    onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium transition-colors shadow-sm"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                    Deposit
                                  </button>
                                  {!u.isEmailVerified && (
                                    <button
                                      onClick={() => handleVerifyEmail(u._id)}
                                      disabled={verifying}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 text-sm font-medium transition-colors disabled:opacity-50"
                                    >
                                      <CheckCircle className="w-3.5 h-3.5" />
                                      Verify
                                    </button>
                                  )}
                                  <button
                                    onClick={() => { setSelectedUserForVerification(u); setShowPasswordModal(true); setNewPassword(''); }}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-sm font-medium transition-colors"
                                  >
                                    <Key className="w-3.5 h-3.5" />
                                    Password
                                  </button>
                                  <button
                                    onClick={() => handleFixFortunePandaAccount(u._id)}
                                    disabled={fixingFpAccount === u._id}
                                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-sm font-medium transition-colors disabled:opacity-50"
                                  >
                                    {fixingFpAccount === u._id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shield className="w-3.5 h-3.5" />}
                                    Fix FP
                                  </button>
                                  {u.isBanned ? (
                                    <button
                                      onClick={() => handleUnbanUser(u._id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-sm font-medium transition-colors"
                                    >
                                      <UserCheck className="w-3.5 h-3.5" />
                                      Unban
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleBanUser(u._id)}
                                      className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-sm font-medium transition-colors"
                                    >
                                      <Ban className="w-3.5 h-3.5" />
                                      Ban
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile/Tablet Card View */}
                    <div className="lg:hidden space-y-2">
                      {filteredUsers.map((u) => (
                        <div
                          key={u._id}
                          className="bg-white rounded-lg p-3 border border-gray-200 shadow-sm"
                        >
                          <div className="flex items-center justify-between gap-2 mb-2">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <button onClick={() => navigateToUserChat(u._id)} className="text-sm font-bold text-gray-900 hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left truncate">{u.username}</button>
                                {u.isEmailVerified ? (
                                  <span title="Email Verified"><CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" /></span>
                                ) : (
                                  <span title="Not Verified"><Mail className="w-3 h-3 text-red-500 flex-shrink-0" /></span>
                                )}
                                {u.isBanned && <span title="Banned"><Ban className="w-3 h-3 text-red-600 flex-shrink-0" /></span>}
                              </div>
                              <p className="text-[11px] text-gray-400 font-mono truncate">{getFPAccountName(u.fortunePandaUsername)}</p>
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <span className="text-sm font-bold text-green-600">${u.fortunePandaBalance?.toFixed(2) || '0.00'}</span>
                              <button
                                onClick={() => refreshUserBalance(u._id)}
                                disabled={refreshingUserId === u._id}
                                className="p-0.5 rounded hover:bg-gray-100 text-gray-400 hover:text-indigo-600 transition-colors disabled:opacity-50"
                              >
                                {refreshingUserId === u._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
                              </button>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1.5">
                            <button
                              onClick={() => { setSelectedUser(u); setShowUserModal(true); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 text-white rounded-md text-xs font-medium active:bg-indigo-700"
                            >
                              <ArrowUp className="w-3 h-3" />
                              Deposit
                            </button>
                            {!u.isEmailVerified && (
                              <button
                                onClick={() => handleVerifyEmail(u._id)}
                                disabled={verifying}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-green-50 text-green-700 border border-green-200 rounded-md text-xs font-medium active:bg-green-100 disabled:opacity-50"
                              >
                                <CheckCircle className="w-3 h-3" />
                                Verify
                              </button>
                            )}
                            <button
                              onClick={() => { setSelectedUserForVerification(u); setShowPasswordModal(true); setNewPassword(''); }}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-md text-xs font-medium active:bg-blue-100"
                            >
                              <Key className="w-3 h-3" />
                              Password
                            </button>
                            <button
                              onClick={() => handleFixFortunePandaAccount(u._id)}
                              disabled={fixingFpAccount === u._id}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-md text-xs font-medium active:bg-purple-100 disabled:opacity-50"
                            >
                              {fixingFpAccount === u._id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                              Fix FP
                            </button>
                            {u.isBanned ? (
                              <button
                                onClick={() => handleUnbanUser(u._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-md text-xs font-medium active:bg-emerald-100"
                              >
                                <UserCheck className="w-3 h-3" />
                                Unban
                              </button>
                            ) : (
                              <button
                                onClick={() => handleBanUser(u._id)}
                                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 rounded-md text-xs font-medium active:bg-red-100"
                              >
                                <Ban className="w-3 h-3" />
                                Ban
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>

                    {filteredUsers.length === 0 && (
                      <div className="text-center py-16">
                        <div className="inline-block p-4 bg-gray-100 rounded-full mb-4">
                          <Search className="w-8 h-8 text-gray-400" />
                        </div>
                        <p className="text-gray-500 font-medium text-lg">No users found</p>
                        <p className="text-gray-400 text-sm mt-2">Try adjusting your search query</p>
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>
          </>
        ) : null}

        {/* Chat Tab - always mounted so WebSocket stays connected for real-time notifications */}
        {hasPermission('chat') && adminToken ? (
          <div className={activeTab === 'chat' ? 'h-full min-h-[500px] sm:min-h-[600px]' : 'hidden'}>
            <AdminChatPanel
              adminToken={adminToken}
              apiBaseUrl={API_BASE_URL}
              wsBaseUrl={wsBaseUrl}
              initialUserId={pendingChatUserId}
              onInitialUserConsumed={() => setPendingChatUserId(null)}
              onUnreadChange={setUnreadChatCount}
              onSessionExpired={() => {
                localStorage.removeItem('admin_session');
                toast.error('Session expired. Please login again.');
                navigate('/aceagent/login', { replace: true });
              }}
            />
          </div>
        ) : activeTab === 'chat' && hasPermission('chat') ? (
          <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-6 sm:p-8 text-center text-gray-600">
            <p className="text-base sm:text-lg font-semibold mb-2">Admin session required</p>
            <p className="text-xs sm:text-sm">
              Please sign in again to access the support chat dashboard.
            </p>
          </div>
        ) : null}

        {/* Referrals Tab */}
        {activeTab === 'referrals' && hasPermission('referrals') && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 lg:p-6 border border-gray-100">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Gift className="w-5 h-5 sm:w-6 sm:h-6 text-orange-500" />
                Referral Management
              </h2>
              <p className="text-sm text-gray-500">Review and verify user referrals. Verified referrals send a $10 bonus message to both users.</p>
            </div>

            {/* Filter tabs */}
            <div className="flex gap-2 mb-4">
              {(['all', 'pending', 'verified'] as const).map((f) => (
                <button
                  key={f}
                  onClick={() => setReferralFilter(f)}
                  className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-semibold transition ${
                    referralFilter === f
                      ? 'bg-indigo-600 text-white shadow'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              ))}
              <button
                onClick={() => fetchReferrals()}
                disabled={referralsLoading}
                className="ml-auto px-3 py-1.5 rounded-lg text-xs sm:text-sm font-semibold bg-gray-100 text-gray-600 hover:bg-gray-200 flex items-center gap-1 transition"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${referralsLoading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
            </div>

            {/* Table */}
            {referralsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
              </div>
            ) : referrals.length === 0 ? (
              <div className="text-center py-12 text-gray-400">
                <Gift className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">No referrals found</p>
              </div>
            ) : (
              <div className="overflow-x-auto -mx-3 sm:-mx-4 lg:-mx-6">
                <table className="w-full text-left min-w-[700px]">
                  <thead>
                    <tr className="border-b border-gray-200">
                      <th className="px-3 sm:px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">New User</th>
                      <th className="px-3 sm:px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Email</th>
                      <th className="px-3 sm:px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Referred By</th>
                      <th className="px-3 sm:px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-3 sm:px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
                      <th className="px-3 sm:px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {referrals.map((ref) => (
                      <tr key={ref._id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-3 sm:px-4 py-3">
                          <div className="font-medium text-sm text-gray-900">
                            {ref.referredUser ? (
                              <button onClick={() => navigateToUserChat(ref.referredUser!._id)} className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left">
                                {`${ref.referredUser.firstName || ''} ${ref.referredUser.lastName || ''}`.trim() || ref.referredUser.username}
                              </button>
                            ) : '—'}
                          </div>
                          <div className="text-xs text-gray-400">@{ref.referredUser?.username || '—'}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-sm text-gray-600">{ref.referredUser?.email || '—'}</td>
                        <td className="px-3 sm:px-4 py-3">
                          <div className="text-sm text-gray-900 font-medium">
                            {ref.referredBy ? (
                              <button onClick={() => navigateToUserChat(ref.referredBy!._id)} className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left">
                                @{ref.referredBy.username}
                              </button>
                            ) : '—'}
                          </div>
                          <div className="text-xs text-orange-600 font-mono">{ref.referralCode}</div>
                        </td>
                        <td className="px-3 sm:px-4 py-3">
                          {ref.status === 'verified' ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                              <CheckCircle className="w-3 h-3" />
                              Verified
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">
                              <XCircle className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-xs text-gray-400">
                          {new Date(ref.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-3 sm:px-4 py-3 text-right">
                          {ref.status === 'pending' ? (
                            <button
                              onClick={() => handleVerifyReferral(ref._id)}
                              disabled={verifyingReferral === ref._id}
                              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 transition disabled:opacity-50"
                            >
                              {verifyingReferral === ref._id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <CheckCircle className="w-3.5 h-3.5" />
                              )}
                              Verify
                            </button>
                          ) : (
                            <span className="text-xs text-gray-400">
                              by {ref.verifiedBy || 'agent'}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Loans Tab */}
        {activeTab === 'loans' && hasPermission('loans') && (
          <div className="bg-white rounded-xl shadow-lg p-3 sm:p-4 lg:p-6 border border-gray-100">
            <div className="mb-4 sm:mb-6">
              <h2 className="text-lg sm:text-xl lg:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Banknote className="w-5 h-5 sm:w-6 sm:h-6 text-green-500" />
                Loan Management
              </h2>
              <p className="text-sm text-gray-500">Review loan requests, process repayments, and manage user limits.</p>
            </div>
            <AgentLoanPanel onNavigateToChat={navigateToUserChat} />
          </div>
        )}

        {/* User Update Modal */}
        {activeTab === 'users' && hasPermission('users') && showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4 animate-fadeIn">
            <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md mx-auto animate-slideUp border border-gray-200 max-h-[95vh] sm:max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white px-4 py-4 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
                <h3 className="text-base sm:text-lg lg:text-xl font-bold text-white drop-shadow-md truncate pr-2">
                  Update: <span className="text-blue-100">{selectedUser.username}</span>
                </h3>
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setModalAction(null);
                    setDepositAmount('');
                    setRedeemAmount('');
                  }}
                  className="text-white hover:text-gray-200 active:text-gray-300 transition-colors p-2 hover:bg-white/20 active:bg-white/30 rounded-lg flex-shrink-0 min-w-[44px] min-h-[44px] items-center justify-center"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Modal Body */}
              <div className="p-4 sm:p-6">
                <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-indigo-50 to-blue-50 rounded-xl border border-indigo-100">
                  <div className="space-y-3">
                    <div>
                      <p className="text-xs sm:text-sm text-indigo-600 font-medium mb-1 uppercase tracking-wide">FP Account</p>
                      <p className="text-base sm:text-lg font-bold text-indigo-900 font-mono">{getFPAccountName(selectedUser.fortunePandaUsername)}</p>
                    </div>
                    <div className="pt-3 border-t border-indigo-200">
                      <p className="text-xs sm:text-sm text-indigo-600 font-medium mb-1 uppercase tracking-wide">Current Balance</p>
                      <p className="text-2xl sm:text-3xl font-bold text-green-600">
                        ${selectedUser.fortunePandaBalance?.toFixed(2) || '0.00'}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mb-6">
                  <button
                    onClick={() => {
                      setModalAction('recharge');
                      setRedeemAmount('');
                    }}
                    className={`flex-1 py-3.5 sm:py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 min-h-[44px] ${
                      modalAction === 'recharge'
                        ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 active:bg-gray-200 border-2 border-transparent active:border-green-300'
                    }`}
                  >
                    <ArrowUp className="w-5 h-5" />
                    <span>Recharge</span>
                  </button>
                  <button
                    onClick={() => {
                      setModalAction('redeem');
                      setDepositAmount('');
                    }}
                    className={`flex-1 py-3.5 sm:py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 min-h-[44px] ${
                      modalAction === 'redeem'
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg'
                        : 'bg-gray-100 text-gray-700 active:bg-gray-200 border-2 border-transparent active:border-red-300'
                    }`}
                  >
                    <ArrowDown className="w-5 h-5" />
                    <span>Redeem</span>
                  </button>
                </div>

                {/* Recharge Form */}
                {modalAction === 'recharge' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Recharge Amount (USD)
                      </label>
                      <input
                        type="number"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        placeholder="Enter amount to recharge"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 transition-all text-gray-700 placeholder-gray-400"
                        min="0.01"
                        step="0.01"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!depositAmount || parseFloat(depositAmount) <= 0) {
                          toast.error('Please enter a valid amount');
                          return;
                        }
                        await handleDeposit();
                        if (!loading) {
                          setShowUserModal(false);
                          setModalAction(null);
                          setDepositAmount('');
                        }
                      }}
                      disabled={loading || !depositAmount || parseFloat(depositAmount) <= 0}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 active:from-green-800 active:to-green-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg min-h-[44px]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <ArrowUp className="w-5 h-5" />
                          <span>Recharge Account</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {/* Redeem Form */}
                {modalAction === 'redeem' && (
                  <div className="space-y-4 animate-fadeIn">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">
                        Redeem Amount (USD)
                      </label>
                      <input
                        type="number"
                        value={redeemAmount}
                        onChange={(e) => setRedeemAmount(e.target.value)}
                        placeholder="Enter amount to redeem"
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500 transition-all text-gray-700 placeholder-gray-400"
                        min="0.01"
                        step="0.01"
                      />
                    </div>
                    <button
                      onClick={async () => {
                        if (!redeemAmount || parseFloat(redeemAmount) <= 0) {
                          toast.error('Please enter a valid amount');
                          return;
                        }
                        await handleRedeem();
                        if (!loading) {
                          setShowUserModal(false);
                          setModalAction(null);
                          setRedeemAmount('');
                        }
                      }}
                      disabled={loading || !redeemAmount || parseFloat(redeemAmount) <= 0}
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 active:from-red-800 active:to-red-900 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg min-h-[44px]"
                    >
                      {loading ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          <span>Processing...</span>
                        </>
                      ) : (
                        <>
                          <ArrowDown className="w-5 h-5" />
                          <span>Redeem from Account</span>
                        </>
                      )}
                    </button>
                  </div>
                )}

                {!modalAction && (
                  <div className="text-center py-8">
                    <div className="inline-block p-3 bg-indigo-100 rounded-full mb-3">
                      <ArrowUp className="w-6 h-6 text-indigo-600 inline mr-2" />
                      <ArrowDown className="w-6 h-6 text-indigo-600 inline" />
                    </div>
                    <p className="text-gray-600 font-medium">Select an action above</p>
                    <p className="text-gray-400 text-sm mt-1">to recharge or redeem funds</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Password Reset Modal */}
      {showPasswordModal && selectedUserForVerification && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-xl shadow-2xl max-w-md w-full p-4 sm:p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg sm:text-xl font-bold text-gray-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                <span>Reset Password</span>
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setSelectedUserForVerification(null);
                }}
                className="text-gray-400 hover:text-gray-600 active:text-gray-700 transition p-2 hover:bg-gray-100 active:bg-gray-200 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label="Close modal"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs sm:text-sm text-gray-600 mb-1 break-words">
                <span className="font-semibold">User:</span> {selectedUserForVerification.firstName && selectedUserForVerification.lastName
                  ? `${selectedUserForVerification.firstName} ${selectedUserForVerification.lastName}`
                  : selectedUserForVerification.username}
              </p>
              <p className="text-xs sm:text-sm text-gray-600 break-words">
                <span className="font-semibold">Email:</span> {selectedUserForVerification.email}
              </p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                New Password
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min 6 characters)"
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-sm sm:text-base text-gray-700 placeholder-gray-400"
                minLength={6}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setSelectedUserForVerification(null);
                }}
                className="flex-1 px-4 py-3 sm:py-2 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 active:bg-gray-100 transition min-h-[44px] sm:min-h-0"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || !newPassword || newPassword.length < 6}
                className="flex-1 px-4 py-3 sm:py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 active:bg-indigo-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 min-h-[44px] sm:min-h-0"
              >
                {resetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Resetting...</span>
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    <span className="hidden sm:inline">Reset Password</span>
                    <span className="sm:hidden">Reset</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Bottom Navigation Bar - permission-filtered */}
      <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 shadow-2xl z-40 sm:hidden" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        <div className="flex items-center justify-around h-16 px-2 max-w-full">
          {hasPermission('users') && (
            <button
              onClick={() => setActiveTab('users')}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 min-w-0 ${
                activeTab === 'users'
                  ? 'text-indigo-600'
                  : 'text-gray-500 active:text-gray-700'
              }`}
            >
              <div className={`relative mb-1 transition-all duration-200 ${
                activeTab === 'users' ? 'scale-110' : 'scale-100'
              }`}>
                <Users className={`w-6 h-6 transition-colors ${activeTab === 'users' ? 'text-indigo-600' : 'text-gray-500'}`} />
                {activeTab === 'users' && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></div>
                )}
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold transition-colors truncate w-full text-center ${
                activeTab === 'users' ? 'text-indigo-600' : 'text-gray-500'
              }`}>
                Users
              </span>
            </button>
          )}

          {hasPermission('chat') && (
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 min-w-0 ${
                activeTab === 'chat'
                  ? 'text-indigo-600'
                  : 'text-gray-500 active:text-gray-700'
              }`}
            >
              <div className={`relative mb-1 transition-all duration-200 ${
                activeTab === 'chat' ? 'scale-110' : 'scale-100'
              }`}>
                <MessageCircle className={`w-6 h-6 transition-colors ${activeTab === 'chat' ? 'text-indigo-600' : 'text-gray-500'}`} />
                {unreadChatCount > 0 && activeTab !== 'chat' ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-0.5 flex items-center justify-center bg-red-500 text-white text-[9px] font-bold rounded-full shadow animate-pulse">
                    {unreadChatCount > 99 ? '99+' : unreadChatCount}
                  </span>
                ) : activeTab === 'chat' ? (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></div>
                ) : null}
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold transition-colors truncate w-full text-center ${
                activeTab === 'chat' ? 'text-indigo-600' : 'text-gray-500'
              }`}>
                Chat
              </span>
            </button>
          )}

          {hasPermission('referrals') && (
            <button
              onClick={() => setActiveTab('referrals')}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 min-w-0 ${
                activeTab === 'referrals'
                  ? 'text-indigo-600'
                  : 'text-gray-500 active:text-gray-700'
              }`}
            >
              <div className={`relative mb-1 transition-all duration-200 ${
                activeTab === 'referrals' ? 'scale-110' : 'scale-100'
              }`}>
                <Gift className={`w-6 h-6 transition-colors ${activeTab === 'referrals' ? 'text-indigo-600' : 'text-gray-500'}`} />
                {activeTab === 'referrals' && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></div>
                )}
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold transition-colors truncate w-full text-center ${
                activeTab === 'referrals' ? 'text-indigo-600' : 'text-gray-500'
              }`}>
                Referrals
              </span>
            </button>
          )}

          {hasPermission('loans') && (
            <button
              onClick={() => setActiveTab('loans')}
              className={`flex flex-col items-center justify-center flex-1 h-full transition-all duration-200 min-w-0 ${
                activeTab === 'loans'
                  ? 'text-indigo-600'
                  : 'text-gray-500 active:text-gray-700'
              }`}
            >
              <div className={`relative mb-1 transition-all duration-200 ${
                activeTab === 'loans' ? 'scale-110' : 'scale-100'
              }`}>
                <Banknote className={`w-6 h-6 transition-colors ${activeTab === 'loans' ? 'text-indigo-600' : 'text-gray-500'}`} />
                {activeTab === 'loans' && (
                  <div className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-indigo-600 rounded-full border-2 border-white"></div>
                )}
              </div>
              <span className={`text-[10px] sm:text-xs font-semibold transition-colors truncate w-full text-center ${
                activeTab === 'loans' ? 'text-indigo-600' : 'text-gray-500'
              }`}>
                Loans
              </span>
            </button>
          )}
        </div>
      </div>

    </div>
  );
};

export default AceagentDashboard;
