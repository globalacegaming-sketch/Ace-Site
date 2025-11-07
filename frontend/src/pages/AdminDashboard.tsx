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
  DollarSign
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

const AdminDashboard: React.FC = () => {
  const navigate = useNavigate();
  const API_BASE_URL = getApiBaseUrl();
  
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'users' | 'deposit' | 'redeem' | 'trades' | 'jackpots' | 'games'>('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [agentBalance, setAgentBalance] = useState<string>('0.00');
  const [userFpInfo, setUserFpInfo] = useState<any>(null);
  
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
        setUserFpInfo(response.data.data);
        toast.success('User info fetched from FortunePanda');
        // Refresh users list to update balance
        loadUsers();
      } else {
        toast.error(response.data.message || 'Failed to fetch user info');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to fetch user info');
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
    <div className="min-h-screen pt-16" style={{ 
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
    }}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-3xl font-bold casino-text-primary flex items-center gap-3">
              <Shield className="w-8 h-8" />
              Admin Dashboard
            </h1>
            <div className="flex items-center gap-4">
              {/* Agent Balance Display */}
              <div className="casino-bg-primary px-4 py-2 rounded-lg casino-border">
                <div className="text-xs casino-text-secondary mb-1">Agent Balance</div>
                <div className="text-lg font-bold casino-text-primary flex items-center gap-2">
                  <DollarSign className="w-4 h-4" />
                  ${parseFloat(agentBalance).toFixed(2)}
                </div>
              </div>
              <button
                onClick={loadAgentBalance}
                className="btn-casino-secondary px-3 py-2 rounded-lg flex items-center gap-2"
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
                className="btn-casino-secondary px-4 py-2 rounded-lg flex items-center gap-2"
              >
                <XCircle className="w-4 h-4" />
                Logout
              </button>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-4 py-2 rounded-lg font-semibold transition-all flex items-center gap-2 ${
                  activeTab === tab.id
                    ? 'casino-bg-primary text-white'
                    : 'casino-bg-secondary casino-text-secondary hover:casino-text-primary'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="casino-bg-secondary rounded-2xl p-6 casino-border shadow-xl">
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold casino-text-primary">User List</h2>
                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 casino-text-secondary" />
                    <input
                      type="text"
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 rounded-lg casino-bg-primary casino-text-primary border casino-border w-64"
                    />
                  </div>
                  <button
                    onClick={loadUsers}
                    className="btn-casino-primary px-4 py-2 rounded-lg flex items-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4" />
                    Refresh
                  </button>
                </div>
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-20">
                  <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#FFD700' }} />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b casino-border">
                        <th className="text-left p-3 casino-text-primary">Username</th>
                        <th className="text-left p-3 casino-text-primary">Email</th>
                        <th className="text-left p-3 casino-text-primary">FP Account</th>
                        <th className="text-left p-3 casino-text-primary">Balance</th>
                        <th className="text-left p-3 casino-text-primary">Role</th>
                        <th className="text-left p-3 casino-text-primary">Status</th>
                        <th className="text-left p-3 casino-text-primary">Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.map((u) => (
                        <tr key={u._id} className="border-b casino-border hover:casino-bg-primary/10">
                          <td className="p-3 casino-text-secondary">{u.username}</td>
                          <td className="p-3 casino-text-secondary">{u.email}</td>
                          <td className="p-3 casino-text-secondary">{u.fortunePandaUsername || 'N/A'}</td>
                          <td className="p-3 casino-text-secondary">
                            ${u.fortunePandaBalance?.toFixed(2) || '0.00'}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-1 rounded text-xs ${
                              u.role === 'admin' ? 'bg-purple-500/20 text-purple-300' : 'bg-blue-500/20 text-blue-300'
                            }`}>
                              {u.role}
                            </span>
                          </td>
                          <td className="p-3">
                            {u.isActive ? (
                              <span className="flex items-center gap-1 text-green-400">
                                <CheckCircle className="w-4 h-4" />
                                Active
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-red-400">
                                <XCircle className="w-4 h-4" />
                                Inactive
                              </span>
                            )}
                          </td>
                          <td className="p-3">
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => setSelectedUser(u)}
                                className="btn-casino-primary px-3 py-1 rounded text-sm"
                              >
                                Select
                              </button>
                              {u.fortunePandaUsername && (
                                <button
                                  onClick={() => loadUserFpInfo(u._id)}
                                  disabled={loading}
                                  className="btn-casino-secondary px-3 py-1 rounded text-sm flex items-center gap-1"
                                  title="Fetch from FortunePanda"
                                >
                                  <Download className="w-3 h-3" />
                                  Fetch FP
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredUsers.length === 0 && (
                    <div className="text-center py-10 casino-text-secondary">
                      No users found
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

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
                        {u.username} ({u.fortunePandaUsername || 'No FP Account'})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedUser && (
                  <div className="p-4 rounded-lg casino-bg-primary">
                    <p className="casino-text-secondary">Current Balance: <span className="font-bold casino-text-primary">
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
                        {u.username} ({u.fortunePandaUsername || 'No FP Account'})
                      </option>
                    ))}
                  </select>
                </div>
                {selectedUser && (
                  <div className="p-4 rounded-lg casino-bg-primary">
                    <p className="casino-text-secondary">Current Balance: <span className="font-bold casino-text-primary">
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
    </div>
  );
};

export default AdminDashboard;
