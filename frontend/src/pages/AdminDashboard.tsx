import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Users, 
  TrendingUp,
  FileText,
  Gift,
  Download,
  ArrowUp,
  ArrowDown,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  RefreshCw,
  DollarSign,
  Edit,
  X
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/api';

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
  createdAt: string;
  lastLogin?: string;
}

interface RecordData {
  data?: any[];
  [key: string]: any;
}

// Helper function to get the actual FP account name (with _GAGame suffix)
const getFPAccountName = (dbUsername: string | undefined): string => {
  if (!dbUsername) return 'N/A';
  // If it already ends with _GAGame, return as is
  if (dbUsername.endsWith('_GAGame')) {
    return dbUsername;
  }
  // Otherwise append _GAGame
  return `${dbUsername}_GAGame`;
};

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const API_BASE_URL = getApiBaseUrl();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'deposit' | 'redeem' | 'trades' | 'jackpots' | 'games'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [agentBalance, setAgentBalance] = useState<string>('0.00');
  const [showUserModal, setShowUserModal] = useState(false);
  const [modalAction, setModalAction] = useState<'recharge' | 'redeem' | null>(null);
  
  // Form states
  const [depositAmount, setDepositAmount] = useState('');
  const [redeemAmount, setRedeemAmount] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [kindId, setKindId] = useState('');
  
  // Records states
  const [tradeRecords, setTradeRecords] = useState<RecordData | null>(null);
  const [jpRecords, setJpRecords] = useState<RecordData | null>(null);
  const [gameRecords, setGameRecords] = useState<RecordData | null>(null);

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
      const parsed = JSON.parse(session);
      return parsed.token;
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

  const loadUserFpInfo = async (userId: string) => {
    try {
      setLoading(true);
      const token = getAdminToken();
      if (!token) {
        navigate('/adminacers/login');
        return;
      }

      const response = await axios.get(`${API_BASE_URL}/admin/users/${userId}/fortune-panda`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.data.success) {
        toast.success(`User info fetched! Balance: $${response.data.data?.userBalance || '0.00'}, Agent Balance: $${response.data.data?.agentBalance || '0.00'}`);
        // Refresh users list to update balance
        loadUsers();
        // Refresh agent balance
        loadAgentBalance();
      } else {
        toast.error(response.data.message || 'Failed to fetch user info');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch user info');
    } finally {
      setLoading(false);
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

  const tabs = [
    { id: 'users', label: 'Users', icon: Users },
    { id: 'deposit', label: 'Deposit', icon: ArrowUp },
    { id: 'redeem', label: 'Redeem', icon: ArrowDown },
    { id: 'trades', label: 'Trade Records', icon: FileText },
    { id: 'jackpots', label: 'Jackpot Records', icon: Gift },
    { id: 'games', label: 'Game Records', icon: TrendingUp },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header - FortunePanda Style */}
      <div className="bg-blue-800 text-white shadow-lg">
        <div className="max-w-full mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold">FortunePanda (Release) / User Management</h1>
              <p className="text-sm text-blue-200 mt-1">Balance: ${parseFloat(agentBalance).toFixed(2)}</p>
            </div>
            <div className="flex items-center gap-4">
              <button
                onClick={loadAgentBalance}
                className="px-3 py-2 bg-blue-700 rounded hover:bg-blue-600 transition-colors"
                title="Refresh agent balance"
              >
                <RefreshCw className="w-4 h-4" />
              </button>
              <button
                onClick={() => {
                  localStorage.removeItem('admin_session');
                  toast.success('Logged out successfully');
                  navigate('/adminacers/login');
                }}
                className="px-4 py-2 bg-blue-700 rounded hover:bg-blue-600 transition-colors flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-full mx-auto px-6 py-6">
        {/* Search and Actions Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 min-w-[300px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ID, Account or NickName"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
            <button
              onClick={() => {
                const searchInput = document.querySelector('input[placeholder="ID, Account or NickName"]') as HTMLInputElement;
                if (searchInput) searchInput.focus();
              }}
              className="px-6 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors font-semibold"
            >
              Search
            </button>
            <button
              onClick={syncAllUsersFromFortunePanda}
              disabled={loading}
              className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors disabled:opacity-50 flex items-center gap-2"
              title="Sync all users from FortunePanda API"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              Sync from FP
            </button>
            <button
              onClick={loadUsers}
              className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 transition-colors flex items-center gap-2"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="bg-white rounded-lg shadow-md">
          <div className="p-6">

              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-gray-100 border-b">
                        <th className="text-left p-3 text-gray-700 font-semibold">ID</th>
                        <th className="text-left p-3 text-gray-700 font-semibold">Account</th>
                        <th className="text-left p-3 text-gray-700 font-semibold">NickName</th>
                        <th className="text-left p-3 text-gray-700 font-semibold">Balance</th>
                        <th className="text-left p-3 text-gray-700 font-semibold">Register date</th>
                        <th className="text-left p-3 text-gray-700 font-semibold">Last Login</th>
                        <th className="text-left p-3 text-gray-700 font-semibold">Manager</th>
                        <th className="text-left p-3 text-gray-700 font-semibold">Status</th>
                        <th className="text-left p-3 text-gray-700 font-semibold"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u, index) => (
                        <tr key={u._id} className="border-b hover:bg-gray-50">
                          <td className="p-3 text-gray-800">{u._id.slice(-6).toUpperCase()}</td>
                          <td className="p-3 text-gray-800">{getFPAccountName(u.fortunePandaUsername)}</td>
                          <td className="p-3 text-gray-800">{u.username}</td>
                          <td className="p-3 text-gray-800 font-semibold">
                            ${u.fortunePandaBalance?.toFixed(2) || '0.00'}
                          </td>
                          <td className="p-3 text-gray-600 text-sm">
                            {new Date(u.createdAt).toLocaleString('en-US', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit'
                            })}
                          </td>
                          <td className="p-3 text-gray-600 text-sm">
                            {u.lastLogin 
                              ? new Date(u.lastLogin).toLocaleString('en-US', {
                                  year: 'numeric',
                                  month: '2-digit',
                                  day: '2-digit',
                                  hour: '2-digit',
                                  minute: '2-digit',
                                  second: '2-digit'
                                })
                              : 'Never'}
                          </td>
                          <td className="p-3 text-gray-800">GAGame</td>
                          <td className="p-3">
                            {u.isActive ? (
                              <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800 font-semibold">
                                Active
                              </span>
                            ) : (
                              <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800 font-semibold">
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <button
                              onClick={() => {
                                setSelectedUser(u);
                                setShowUserModal(true);
                              }}
                              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors text-sm font-semibold"
                            >
                              Update
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-10 text-gray-500">
                      No users found
                    </div>
                  )}
                </div>
              )}
            </div>

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
        </div>
      </div>

      {/* User Update Modal */}
      {showUserModal && selectedUser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-2xl w-full max-w-md mx-4">
            {/* Modal Header */}
            <div className="bg-blue-600 text-white px-6 py-4 rounded-t-lg flex items-center justify-between">
              <h3 className="text-xl font-bold">Update User: {selectedUser.username}</h3>
              <button
                onClick={() => {
                  setShowUserModal(false);
                  setModalAction(null);
                  setDepositAmount('');
                  setRedeemAmount('');
                }}
                className="text-white hover:text-gray-200 transition-colors"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6">
              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-600 mb-1">FP Account</p>
                <p className="text-lg font-semibold text-gray-800">{getFPAccountName(selectedUser.fortunePandaUsername)}</p>
                <p className="text-sm text-gray-600 mt-2">Current Balance</p>
                <p className="text-xl font-bold text-blue-600">
                  ${selectedUser.fortunePandaBalance?.toFixed(2) || '0.00'}
                </p>
              </div>

              <div className="flex gap-3 mb-6">
                <button
                  onClick={() => {
                    setModalAction('recharge');
                    setRedeemAmount('');
                  }}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                    modalAction === 'recharge'
                      ? 'bg-green-600 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <ArrowUp className="w-5 h-5 inline mr-2" />
                  Recharge
                </button>
                <button
                  onClick={() => {
                    setModalAction('redeem');
                    setDepositAmount('');
                  }}
                  className={`flex-1 py-3 px-4 rounded-lg font-semibold transition-all ${
                    modalAction === 'redeem'
                      ? 'bg-red-600 text-white shadow-lg'
                      : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                  }`}
                >
                  <ArrowDown className="w-5 h-5 inline mr-2" />
                  Redeem
                </button>
              </div>

              {/* Recharge Form */}
              {modalAction === 'recharge' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recharge Amount (USD)
                    </label>
                    <input
                      type="number"
                      value={depositAmount}
                      onChange={(e) => setDepositAmount(e.target.value)}
                      placeholder="Enter amount to recharge"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full py-3 px-4 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ArrowUp className="w-5 h-5" />
                        Recharge Account
                      </>
                    )}
                  </button>
                </div>
              )}

              {/* Redeem Form */}
              {modalAction === 'redeem' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Redeem Amount (USD)
                    </label>
                    <input
                      type="number"
                      value={redeemAmount}
                      onChange={(e) => setRedeemAmount(e.target.value)}
                      placeholder="Enter amount to redeem"
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
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
                    className="w-full py-3 px-4 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  >
                    {loading ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <ArrowDown className="w-5 h-5" />
                        Redeem from Account
                      </>
                    )}
                  </button>
                </div>
              )}

              {!modalAction && (
                <p className="text-center text-gray-500 py-4">
                  Select an action above to recharge or redeem funds
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
