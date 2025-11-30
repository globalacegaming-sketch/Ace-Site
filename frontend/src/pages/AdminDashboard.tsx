import React, { useState, useEffect, useMemo } from 'react';
import { 
  TrendingUp,
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
  Shield
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl, getWsBaseUrl } from '../utils/api';
import AdminChatPanel from '../components/admin/chat/AdminChatPanel';
import { useMusic } from '../contexts/MusicContext';

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
  createdAt: string;
  lastLogin?: string;
}

interface RecordData {
  data?: any[];
  [key: string]: any;
}

// Helper function to get the FP account name (use as stored in database)
const getFPAccountName = (dbUsername: string | undefined): string => {
  return dbUsername || 'N/A';
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const API_BASE_URL = getApiBaseUrl();
  const { stopMusic } = useMusic();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'chat' | 'verification'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [verificationSearchQuery, setVerificationSearchQuery] = useState('');
  const [selectedUserForVerification, setSelectedUserForVerification] = useState<User | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [resetting, setResetting] = useState(false);
  const [agentBalance, setAgentBalance] = useState<string>('0.00');
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalAction, setModalAction] = useState<'recharge' | 'redeem' | null>(null);
  
  // Form states
  const [depositAmount, setDepositAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [kindId, setKindId] = useState('');
  const wsBaseUrl = useMemo(() => getWsBaseUrl(), []);
  
  // Records states
  const [tradeRecords, setTradeRecords] = useState<RecordData | null>(null);
  const [jpRecords, setJpRecords] = useState<RecordData | null>(null);
  const [gameRecords, setGameRecords] = useState<RecordData | null>(null);

  // Stop music when admin dashboard loads
  useEffect(() => {
    stopMusic();
  }, [stopMusic]);

  useEffect(() => {
    // Check for admin session
    const session = localStorage.getItem('admin_session');
    if (!session) {
      toast.error('Please login to access admin panel');
      navigate('/adminacers/login');
      return;
    }

    try {
      const parsedSession = JSON.parse(session);
      // Check if session expired
      if (parsedSession.expiresAt && Date.now() > parsedSession.expiresAt) {
        localStorage.removeItem('admin_session');
        toast.error('Session expired. Please login again.');
        navigate('/adminacers/login');
        return;
      }
      // Set agent balance from session if available
      if (parsedSession.agentBalance) {
        setAgentBalance(parsedSession.agentBalance);
      }
      loadUsers();
      loadAgentBalance();
      
      // Set default date range (last 30 days)
      const today = new Date();
      const lastMonth = new Date(today);
      lastMonth.setDate(lastMonth.getDate() - 30);
      setToDate(today.toISOString().split('T')[0]);
      setFromDate(lastMonth.toISOString().split('T')[0]);
    } catch (error) {
      localStorage.removeItem('admin_session');
      navigate('/adminacers/login');
    }
  }, [navigate]);

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


  const syncAllUsersFromFortunePanda = async () => {
    try {
      setLoading(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/adminacers/login');
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
        navigate('/adminacers/login');
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
        navigate('/adminacers/login');
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
        navigate('/adminacers/login');
        return;
      }

      // Check if session is still valid
      const session = localStorage.getItem('admin_session');
      if (session) {
        const parsed = JSON.parse(session);
        if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
          toast.error('Admin session expired. Please login again.');
          localStorage.removeItem('admin_session');
          navigate('/adminacers/login');
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
            navigate('/adminacers/login');
          }, 2000);
        }
      } else {
        toast.error(error.response?.data?.message || 'Failed to reset password');
      }
    } finally {
      setResetting(false);
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
        navigate('/adminacers/login');
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
        navigate('/adminacers/login');
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

  const loadTradeRecords = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    if (!fromDate || !toDate) {
      toast.error('Please select date range');
      return;
    }

    try {
      setLoading(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/adminacers/login');
        return;
      }
      const response = await axios.get(
        `${API_BASE_URL}/admin/trades?userId=${selectedUser._id}&fromDate=${fromDate}&toDate=${toDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setTradeRecords(response.data.data);
        toast.success('Trade records loaded successfully');
      } else {
        toast.error(response.data.message || 'Failed to load trade records');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load trade records');
    } finally {
      setLoading(false);
    }
  };

  const loadJpRecords = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    if (!fromDate || !toDate) {
      toast.error('Please select date range');
      return;
    }

    try {
      setLoading(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/adminacers/login');
        return;
      }
      const response = await axios.get(
        `${API_BASE_URL}/admin/jackpots?userId=${selectedUser._id}&fromDate=${fromDate}&toDate=${toDate}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setJpRecords(response.data.data);
        toast.success('Jackpot records loaded successfully');
      } else {
        toast.error(response.data.message || 'Failed to load jackpot records');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load jackpot records');
    } finally {
      setLoading(false);
    }
  };

  const loadGameRecords = async () => {
    if (!selectedUser) {
      toast.error('Please select a user');
      return;
    }

    if (!fromDate || !toDate) {
      toast.error('Please select date range');
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams({
        userId: selectedUser._id,
        fromDate,
        toDate
      });
      if (kindId) params.append('kindId', kindId);

      const token = getAdminToken();
      if (!token) {
        navigate('/adminacers/login');
        return;
      }
      const response = await axios.get(
        `${API_BASE_URL}/admin/game-records?${params.toString()}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (response.data.success) {
        setGameRecords(response.data.data);
        toast.success('Game records loaded successfully');
      } else {
        toast.error(response.data.message || 'Failed to load game records');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to load game records');
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(u => 
    u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
    u.fortunePandaUsername?.toLowerCase().includes(searchQuery.toLowerCase())
  );


  const adminToken = getAdminToken();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50">
      {/* Header - Modern Gradient Style */}
      <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white shadow-xl">
        <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-white drop-shadow-md">
                FortunePanda (Release) / User Management
              </h1>
              <div className="mt-2 flex items-center gap-2">
                <span className="text-xs sm:text-sm text-blue-100 font-medium">Agent Balance:</span>
                <span className="text-sm sm:text-base font-bold text-white bg-white/20 px-3 py-1 rounded-full backdrop-blur-sm">
                  ${parseFloat(agentBalance).toFixed(2)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <button
                onClick={loadAgentBalance}
                className="p-2 sm:px-3 sm:py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm hover:scale-105"
                title="Refresh agent balance"
              >
                <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('admin_session');
                  toast.success('Logged out successfully');
                  navigate('/adminacers/login');
                }}
                className="px-3 sm:px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg transition-all duration-200 backdrop-blur-sm flex items-center gap-2 text-sm sm:text-base font-medium hover:scale-105"
              >
                <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Logout</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <button
            onClick={() => setActiveTab('users')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'users'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            User Management
          </button>
          <button
            onClick={() => setActiveTab('chat')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'chat'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            Support Chat
          </button>
          <button
            onClick={() => setActiveTab('verification')}
            className={`px-4 py-2 rounded-xl text-sm font-semibold transition ${
              activeTab === 'verification'
                ? 'bg-indigo-600 text-white shadow-md'
                : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'
            }`}
          >
            User Verification
          </button>
        </div>

        {activeTab === 'users' ? (
          <>
            {/* Search and Actions Bar */}
            <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 mb-6 border border-gray-100">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 sm:gap-4">
                <div className="flex-1 w-full">
                  <div className="relative">
                    <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search by ID, Account or NickName"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm sm:text-base text-gray-700 placeholder-gray-400"
                    />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  <button
                    onClick={syncAllUsersFromFortunePanda}
                    disabled={loading}
                    className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
                    title="Sync all users from FortunePanda API"
                  >
                    {loading ? (
                      <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4 sm:w-5 sm:h-5" />
                    )}
                    <span className="hidden sm:inline">Sync from FP</span>
                    <span className="sm:hidden">Sync</span>
                  </button>
                  <button
                    onClick={loadUsers}
                    className="px-4 sm:px-5 py-2.5 bg-gradient-to-r from-gray-600 to-gray-700 text-white rounded-lg hover:from-gray-700 hover:to-gray-800 transition-all duration-200 flex items-center gap-2 text-sm sm:text-base font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
                  >
                    <RefreshCw className="w-4 h-4 sm:w-5 sm:h-5" />
                    <span className="hidden sm:inline">Refresh</span>
                    <span className="sm:hidden">Refresh</span>
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
                      <table className="w-full">
                        <thead>
                          <tr className="bg-gradient-to-r from-indigo-50 to-blue-50 border-b-2 border-indigo-200">
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">ID</th>
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">Account</th>
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">NickName</th>
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">Balance</th>
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">Register Date</th>
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">Last Login</th>
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">Manager</th>
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">Status</th>
                            <th className="text-left p-4 text-xs sm:text-sm font-bold text-indigo-900 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {filteredUsers.map((u, index) => (
                            <tr 
                              key={u._id} 
                              className={`hover:bg-gradient-to-r hover:from-indigo-50 hover:to-blue-50 transition-all duration-200 ${
                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/50'
                              }`}
                            >
                              <td className="p-4 text-sm font-mono font-semibold text-gray-700">{u._id.slice(-6).toUpperCase()}</td>
                              <td className="p-4 text-sm font-medium text-gray-800">{getFPAccountName(u.fortunePandaUsername)}</td>
                              <td className="p-4 text-sm font-semibold text-gray-900">{u.username}</td>
                              <td className="p-4">
                                <span className="text-sm font-bold text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                  ${u.fortunePandaBalance?.toFixed(2) || '0.00'}
                                </span>
                              </td>
                              <td className="p-4 text-xs text-gray-600">
                                {new Date(u.createdAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })}
                              </td>
                              <td className="p-4 text-xs text-gray-600">
                                {u.lastLogin 
                                  ? new Date(u.lastLogin).toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit',
                                      second: '2-digit'
                                    })
                                  : <span className="text-gray-400 italic">Never</span>}
                              </td>
                              <td className="p-4 text-sm font-medium text-gray-700">GAGame</td>
                              <td className="p-4">
                                {u.isActive ? (
                                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                    Active
                                  </span>
                                ) : (
                                  <span className="px-3 py-1.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                    Inactive
                                  </span>
                                )}
                              </td>
                              <td className="p-4">
                                <button
                                  onClick={() => {
                                    setSelectedUser(u);
                                    setShowUserModal(true);
                                  }}
                                  className="px-4 py-2 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all duration-200 text-sm font-semibold shadow-md hover:shadow-lg transform hover:scale-105"
                                >
                                  Update
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {/* Mobile/Tablet Card View */}
                    <div className="lg:hidden space-y-4">
                      {filteredUsers.map((u) => (
                        <div 
                          key={u._id} 
                          className="bg-gradient-to-br from-white to-gray-50 rounded-xl p-4 sm:p-5 border border-gray-200 shadow-md hover:shadow-lg transition-all duration-200"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3 pb-3 border-b border-gray-200">
                            <div className="flex-1">
                              <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-1">{u.username}</h3>
                              <p className="text-xs sm:text-sm text-gray-600 font-mono">{getFPAccountName(u.fortunePandaUsername)}</p>
                            </div>
                            <div className="flex items-center gap-2">
                              {u.isActive ? (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
                                  Active
                                </span>
                              ) : (
                                <span className="px-3 py-1 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">
                                  Inactive
                                </span>
                              )}
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                            <div>
                              <p className="text-xs text-gray-500 mb-1">ID</p>
                              <p className="text-sm font-mono font-semibold text-gray-700">{u._id.slice(-6).toUpperCase()}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Balance</p>
                              <p className="text-sm font-bold text-green-600">${u.fortunePandaBalance?.toFixed(2) || '0.00'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-500 mb-1">Manager</p>
                              <p className="text-sm font-medium text-gray-700">GAGame</p>
                            </div>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 text-xs sm:text-sm">
                            <div>
                              <p className="text-gray-500 mb-1">Register Date</p>
                              <p className="text-gray-700 font-medium">
                                {new Date(u.createdAt).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit'
                                })}
                              </p>
                            </div>
                            <div>
                              <p className="text-gray-500 mb-1">Last Login</p>
                              <p className="text-gray-700 font-medium">
                                {u.lastLogin 
                                  ? new Date(u.lastLogin).toLocaleString('en-US', {
                                      year: 'numeric',
                                      month: '2-digit',
                                      day: '2-digit',
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : <span className="text-gray-400 italic">Never</span>}
                              </p>
                            </div>
                          </div>

                          <button
                            onClick={() => {
                              setSelectedUser(u);
                              setShowUserModal(true);
                            }}
                            className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg hover:from-indigo-700 hover:to-blue-700 transition-all duration-200 text-sm font-semibold shadow-md hover:shadow-lg"
                          >
                            Update User
                          </button>
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
        ) : activeTab === 'verification' ? (
          <div className="bg-white rounded-xl shadow-lg p-4 sm:p-6 border border-gray-100">
            <div className="mb-6">
              <h2 className="text-xl sm:text-2xl font-bold text-gray-900 mb-2 flex items-center gap-2">
                <Shield className="w-6 h-6 text-indigo-600" />
                User Verification & Password Reset
              </h2>
              <p className="text-sm text-gray-600">Manually verify user emails and reset passwords</p>
            </div>

            {/* Search Bar */}
            <div className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 sm:left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by username, email, or user ID"
                  value={verificationSearchQuery}
                  onChange={(e) => setVerificationSearchQuery(e.target.value)}
                  className="w-full pl-10 sm:pl-12 pr-4 py-2.5 sm:py-3 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all text-sm sm:text-base text-gray-700 placeholder-gray-400"
                />
              </div>
            </div>

            {/* User List */}
            <div className="space-y-3 max-h-[600px] overflow-y-auto">
              {users
                .filter((user) => {
                  if (!verificationSearchQuery) return true;
                  const query = verificationSearchQuery.toLowerCase();
                  return (
                    user.username.toLowerCase().includes(query) ||
                    user.email.toLowerCase().includes(query) ||
                    user._id.toLowerCase().includes(query) ||
                    (user.firstName && user.firstName.toLowerCase().includes(query)) ||
                    (user.lastName && user.lastName.toLowerCase().includes(query))
                  );
                })
                .map((user) => (
                  <div
                    key={user._id}
                    className={`p-4 border rounded-lg transition-all ${
                      selectedUserForVerification?._id === user._id
                        ? 'border-indigo-500 bg-indigo-50'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-gray-900 truncate">
                            {user.firstName && user.lastName
                              ? `${user.firstName} ${user.lastName}`
                              : user.username}
                          </h3>
                          {user.isEmailVerified ? (
                            <div title="Email Verified">
                              <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                            </div>
                          ) : (
                            <div title="Email Not Verified">
                              <Mail className="w-4 h-4 text-red-500 flex-shrink-0" />
                            </div>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 truncate">{user.email}</p>
                        <p className="text-xs text-gray-500">@{user.username} • ID: {user._id.substring(0, 8)}...</p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {!user.isEmailVerified && (
                          <button
                            onClick={() => handleVerifyEmail(user._id)}
                            disabled={verifying}
                            className="px-3 py-1.5 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                          >
                            <CheckCircle className="w-4 h-4" />
                            {verifying ? 'Verifying...' : 'Verify Email'}
                          </button>
                        )}
                        <button
                          onClick={() => {
                            setSelectedUserForVerification(user);
                            setShowPasswordModal(true);
                            setNewPassword('');
                          }}
                          className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition flex items-center gap-1"
                        >
                          <Key className="w-4 h-4" />
                          Reset Password
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              {users.filter((user) => {
                if (!verificationSearchQuery) return true;
                const query = verificationSearchQuery.toLowerCase();
                return (
                  user.username.toLowerCase().includes(query) ||
                  user.email.toLowerCase().includes(query) ||
                  user._id.toLowerCase().includes(query)
                );
              }).length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>No users found</p>
                </div>
              )}
            </div>
          </div>
        ) : activeTab === 'chat' ? (
          adminToken ? (
            <div className="h-[calc(100vh-12rem)] min-h-[600px]">
              <AdminChatPanel
                adminToken={adminToken}
                apiBaseUrl={API_BASE_URL}
                wsBaseUrl={wsBaseUrl}
              />
            </div>
          ) : (
            <div className="bg-white rounded-xl shadow-lg border border-gray-100 p-8 text-center text-gray-600">
              <p className="text-lg font-semibold mb-2">Admin session required</p>
              <p className="text-sm">
                Please sign in again to access the support chat dashboard.
              </p>
            </div>
          )
        ) : (
          <>
            {/* Deposit Tab */}
            {activeTab === 'deposit' && (
              <div>
                <h2 className="text-2xl font-bold casino-text-primary mb-6">Deposit (Load Money)</h2>
                <div className="max-w-md space-y-4">
                  <div>
                    <label className="block casino-text-secondary mb-2">Select User</label>
                    <select
                      value={selectedUser?._id || ''}
                      onChange={(e) => {
                        const user = users.find(u => u._id === e.target.value);
                        setSelectedUser(user || null);
                      }}
                      className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                    >
                      <option value="">Select a user...</option>
                      {users.map(u => (
                        <option key={u._id} value={u._id}>
                          {u.username} ({getFPAccountName(u.fortunePandaUsername)})
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedUser && (
                    <div className="p-4 rounded-lg casino-bg-primary">
                      <p className="casino-text-secondary">FP Account: <span className="font-bold casino-text-primary">
                        {getFPAccountName(selectedUser.fortunePandaUsername)}
                      </span></p>
                      <p className="casino-text-secondary mt-2">Current Balance: <span className="font-bold casino-text-primary">
                        ${selectedUser.fortunePandaBalance?.toFixed(2) || '0.00'}
                      </span></p>
                    </div>
                  )}
                  <div>
                    <label className="block casino-text-secondary mb-2">Amount</label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                    />
                  </div>
                  <button
                    onClick={handleDeposit}
                    disabled={loading || !selectedUser || !depositAmount}
                    className="btn-casino-primary w-full py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <ArrowUp className="w-5 h-5" />
                        Deposit
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Redeem Tab */}
            {activeTab === 'redeem' && (
              <div>
                <h2 className="text-2xl font-bold casino-text-primary mb-6">Redeem (Withdraw Money)</h2>
                <div className="max-w-md space-y-4">
                  <div>
                    <label className="block casino-text-secondary mb-2">Select User</label>
                    <select
                      value={selectedUser?._id || ''}
                      onChange={(e) => {
                        const user = users.find(u => u._id === e.target.value);
                        setSelectedUser(user || null);
                      }}
                      className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                    >
                      <option value="">Select a user...</option>
                      {users.map(u => (
                        <option key={u._id} value={u._id}>
                          {u.username} ({getFPAccountName(u.fortunePandaUsername)})
                        </option>
                      ))}
                    </select>
                  </div>
                  {selectedUser && (
                    <div className="p-4 rounded-lg casino-bg-primary">
                      <p className="casino-text-secondary">FP Account: <span className="font-bold casino-text-primary">
                        {getFPAccountName(selectedUser.fortunePandaUsername)}
                      </span></p>
                      <p className="casino-text-secondary mt-2">Current Balance: <span className="font-bold casino-text-primary">
                        ${selectedUser.fortunePandaBalance?.toFixed(2) || '0.00'}
                      </span></p>
                    </div>
                  )}
                  <div>
                    <label className="block casino-text-secondary mb-2">Amount</label>
                    <input
                      type="number"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      placeholder="Enter amount"
                      className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                    />
                  </div>
                  <button
                    onClick={handleRedeem}
                    disabled={loading || !selectedUser || !redeemAmount}
                    className="btn-casino-primary w-full py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {loading ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <>
                        <ArrowDown className="w-5 h-5" />
                        Redeem
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}

            {/* Trade Records Tab */}
            {activeTab === 'trades' && (
              <div>
                <h2 className="text-2xl font-bold casino-text-primary mb-6">Trade Records</h2>
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block casino-text-secondary mb-2">Select User</label>
                      <select
                        value={selectedUser?._id || ''}
                        onChange={(e) => {
                          const user = users.find(u => u._id === e.target.value);
                          setSelectedUser(user || null);
                        }}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      >
                        <option value="">Select a user...</option>
                        {users.map(u => (
                          <option key={u._id} value={u._id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block casino-text-secondary mb-2">From Date</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      />
                    </div>
                    <div>
                      <label className="block casino-text-secondary mb-2">To Date</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={loadTradeRecords}
                        disabled={loading || !selectedUser}
                        className="btn-casino-primary w-full py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Download className="w-5 h-5" />
                            Load Records
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {tradeRecords && (
                  <div className="mt-6">
                    <pre className="p-4 rounded-lg casino-bg-primary overflow-auto max-h-96 casino-text-secondary text-sm">
                      {JSON.stringify(tradeRecords, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Jackpot Records Tab */}
            {activeTab === 'jackpots' && (
              <div>
                <h2 className="text-2xl font-bold casino-text-primary mb-6">Jackpot Records</h2>
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                      <label className="block casino-text-secondary mb-2">Select User</label>
                      <select
                        value={selectedUser?._id || ''}
                        onChange={(e) => {
                          const user = users.find(u => u._id === e.target.value);
                          setSelectedUser(user || null);
                        }}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      >
                        <option value="">Select a user...</option>
                        {users.map(u => (
                          <option key={u._id} value={u._id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block casino-text-secondary mb-2">From Date</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      />
                    </div>
                    <div>
                      <label className="block casino-text-secondary mb-2">To Date</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={loadJpRecords}
                        disabled={loading || !selectedUser}
                        className="btn-casino-primary w-full py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <Gift className="w-5 h-5" />
                            Load Records
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {jpRecords && (
                  <div className="mt-6">
                    <pre className="p-4 rounded-lg casino-bg-primary overflow-auto max-h-96 casino-text-secondary text-sm">
                      {JSON.stringify(jpRecords, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}

            {/* Game Records Tab */}
            {activeTab === 'games' && (
              <div>
                <h2 className="text-2xl font-bold casino-text-primary mb-6">Game Records</h2>
                <div className="space-y-4 mb-6">
                  <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                    <div>
                      <label className="block casino-text-secondary mb-2">Select User</label>
                      <select
                        value={selectedUser?._id || ''}
                        onChange={(e) => {
                          const user = users.find(u => u._id === e.target.value);
                          setSelectedUser(user || null);
                        }}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      >
                        <option value="">Select a user...</option>
                        {users.map(u => (
                          <option key={u._id} value={u._id}>
                            {u.username}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block casino-text-secondary mb-2">From Date</label>
                      <input
                        type="date"
                        value={fromDate}
                        onChange={(e) => setFromDate(e.target.value)}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      />
                    </div>
                    <div>
                      <label className="block casino-text-secondary mb-2">To Date</label>
                      <input
                        type="date"
                        value={toDate}
                        onChange={(e) => setToDate(e.target.value)}
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      />
                    </div>
                    <div>
                      <label className="block casino-text-secondary mb-2">Game ID (Optional)</label>
                      <input
                        type="text"
                        value={kindId}
                        onChange={(e) => setKindId(e.target.value)}
                        placeholder="Game kindId"
                        className="w-full p-3 rounded-lg casino-bg-primary casino-text-primary border casino-border"
                      />
                    </div>
                    <div className="flex items-end">
                      <button
                        onClick={loadGameRecords}
                        disabled={loading || !selectedUser}
                        className="btn-casino-primary w-full py-3 rounded-lg flex items-center justify-center gap-2 disabled:opacity-50"
                      >
                        {loading ? (
                          <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                          <>
                            <TrendingUp className="w-5 h-5" />
                            Load Records
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
                {gameRecords && (
                  <div className="mt-6">
                    <pre className="p-4 rounded-lg casino-bg-primary overflow-auto max-h-96 casino-text-secondary text-sm">
                      {JSON.stringify(gameRecords, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* User Update Modal */}
        {activeTab === 'users' && showUserModal && selectedUser && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-fadeIn">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md mx-auto animate-slideUp border border-gray-200 max-h-[90vh] overflow-y-auto">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-indigo-600 via-blue-600 to-purple-600 text-white px-4 sm:px-6 py-4 sm:py-5 rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
                <h3 className="text-lg sm:text-xl font-bold text-white drop-shadow-md">
                  Update User: <span className="text-blue-100">{selectedUser.username}</span>
                </h3>
                <button
                  onClick={() => {
                    setShowUserModal(false);
                    setModalAction(null);
                    setDepositAmount('');
                    setRedeemAmount('');
                  }}
                  className="text-white hover:text-gray-200 transition-colors p-1 hover:bg-white/20 rounded-lg"
                >
                  <X className="w-5 h-5 sm:w-6 sm:h-6" />
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
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      modalAction === 'recharge'
                        ? 'bg-gradient-to-r from-green-600 to-green-700 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-green-300'
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
                    className={`flex-1 py-3 px-4 rounded-xl font-semibold transition-all duration-200 flex items-center justify-center gap-2 ${
                      modalAction === 'redeem'
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 border-2 border-transparent hover:border-red-300'
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
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-green-600 to-green-700 text-white rounded-xl font-semibold hover:from-green-700 hover:to-green-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
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
                      className="w-full py-3.5 px-4 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-xl font-semibold hover:from-red-700 hover:to-red-800 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105 disabled:hover:scale-100"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                <Key className="w-5 h-5 text-indigo-600" />
                Reset Password
              </h3>
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setSelectedUserForVerification(null);
                }}
                className="text-gray-400 hover:text-gray-600 transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-1">
                <span className="font-semibold">User:</span> {selectedUserForVerification.firstName && selectedUserForVerification.lastName
                  ? `${selectedUserForVerification.firstName} ${selectedUserForVerification.lastName}`
                  : selectedUserForVerification.username}
              </p>
              <p className="text-sm text-gray-600">
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
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all text-gray-700 placeholder-gray-400"
                minLength={6}
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">Password must be at least 6 characters long</p>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setShowPasswordModal(false);
                  setNewPassword('');
                  setSelectedUserForVerification(null);
                }}
                className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={resetting || !newPassword || newPassword.length < 6}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {resetting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Resetting...
                  </>
                ) : (
                  <>
                    <Key className="w-4 h-4" />
                    Reset Password
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
