import React, { useState, useEffect } from 'react';
import { 
  Shield, 
  Gamepad2, 
  Users, 
  DollarSign, 
  Settings, 
  LogOut, 
  Search,
  Plus,
  Gift,
  Download,
  Handshake,
  TrendingUp,
  Globe,
  AlertCircle,
  CheckCircle,
  Loader2
} from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { useNavigate } from 'react-router-dom';

interface User {
  id: string;
  account: string;
  nickname: string;
  balance: string;
  registerDate: string;
  lastLogin: string;
  manager: string;
  status: 'Active' | 'Inactive' | 'Banned';
}

const AdminDashboard: React.FC = () => {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  
  // Mock admin user for display purposes
  const adminUser = { email: 'admin@globalacegaming.com', role: 'admin' };
  
  // State management
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [activeTab, setActiveTab] = useState('users');
  const [searchQuery, setSearchQuery] = useState('');
  const [showProhibited, setShowProhibited] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check admin session status on component mount
  useEffect(() => {
    checkAdminStatus();
    loadUsers();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const result = await axios.get('/api/health/fortune-panda');
      setIsLoggedIn(result.data.isLoggedIn);
      if (result.data.isLoggedIn) {
        await loadGames();
      }
    } catch (error) {
      // Failed to check admin status
    }
  };

  const handleAdminLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await axios.post('/api/health/fortune-panda/relogin');
      if (result.data.status === 'OK') {
        setIsLoggedIn(true);
        await loadGames();
      } else {
        setError(result.data.message);
      }
    } catch (error: any) {
      setError('Failed to login as admin');
    } finally {
      setIsLoading(false);
    }
  };

  const loadGames = async () => {
    try {
      const result = await axios.get('/api/games/fortune-panda');
      if (result.data.success) {
        // Games loaded successfully
      } else {
      }
    } catch (error) {
      // Failed to load games
    }
  };

  const loadUsers = async () => {
    try {
      const result = await axios.get('/api/fortune-panda/users');
      if (result.data.success) {
        setUsers(result.data.data);
      } else {
        // Fallback to empty array if API fails
        setUsers([]);
      }
    } catch (error) {
      // Fallback to empty array if API fails
      setUsers([]);
    }
  };

  const handleLogout = async () => {
    try {
      await axios.post('/api/fortune-panda/admin/logout');
      setIsLoggedIn(false);
      if (user) {
        logout(); // Clear frontend auth state only if user is authenticated
        navigate('/login'); // Redirect to login page
      } else {
        navigate('/'); // Redirect to home if not authenticated
      }
    } catch (error) {
      // Logout failed
    }
  };

  const handleUserAction = async (action: string, userId?: string) => {
    try {
      switch (action) {
        case 'recharge':
          const rechargeAmount = prompt('Enter recharge amount (in cents):');
          if (rechargeAmount && userId) {
            const result = await axios.post('/api/fortune-panda/recharge', {
              username: userId,
              amount: parseInt(rechargeAmount)
            });
            if (result.data.success) {
              alert('Recharge successful!');
            } else {
              alert(`Recharge failed: ${result.data.message}`);
            }
          }
          break;
          
        case 'redeem':
          const redeemAmount = prompt('Enter redeem amount (in cents):');
          if (redeemAmount && userId) {
            const result = await axios.post('/api/fortune-panda/redeem', {
              username: userId,
              amount: parseInt(redeemAmount)
            });
            if (result.data.success) {
              alert('Redeem successful!');
            } else {
              alert(`Redeem failed: ${result.data.message}`);
            }
          }
          break;
          
        case 'reset-password':
          if (userId) {
            const newPassword = prompt('Enter new password:');
            if (newPassword) {
              const result = await axios.post('/api/fortune-panda/users/change-password', {
                username: userId,
                oldPassword: 'temp', // This would need to be handled differently
                newPassword: newPassword
              });
              if (result.data.success) {
                alert('Password reset successful!');
              } else {
                alert(`Password reset failed: ${result.data.message}`);
              }
            }
          }
          break;
          
        case 'game-records':
          if (userId) {
            const result = await axios.get(`/api/fortune-panda/users/${userId}/game-records`);
            if (result.data.success) {
              alert(`Game records loaded successfully.`);
            } else {
              alert(`Failed to load game records: ${result.data.message}`);
            }
          }
          break;
          
        case 'jp-records':
          if (userId) {
            const fromDate = prompt('Enter start date (YYYY-MM-DD):');
            const toDate = prompt('Enter end date (YYYY-MM-DD):');
            if (fromDate && toDate) {
              const result = await axios.get(`/api/fortune-panda/users/${userId}/jp-records?fromDate=${fromDate}&toDate=${toDate}`);
              if (result.data.success) {
                alert(`JP records loaded successfully.`);
              } else {
                alert(`Failed to load JP records: ${result.data.message}`);
              }
            }
          }
          break;
          
        case 'transaction-records':
          if (userId) {
            const fromDate = prompt('Enter start date (YYYY-MM-DD):');
            const toDate = prompt('Enter end date (YYYY-MM-DD):');
            if (fromDate && toDate) {
              const result = await axios.get(`/api/fortune-panda/users/${userId}/trade-records?fromDate=${fromDate}&toDate=${toDate}`);
              if (result.data.success) {
                alert(`Transaction records loaded successfully.`);
              } else {
                alert(`Failed to load transaction records: ${result.data.message}`);
              }
            }
          }
          break;
          
        case 'device-unbind':
          alert('Device unbind functionality not yet implemented');
          break;
          
        default:
          alert(`Action ${action} not implemented yet`);
      }
    } catch (error: any) {
      alert(`Error: ${error.response?.data?.message || error.message}`);
    }
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.account.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.nickname.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         user.id.includes(searchQuery);
    const matchesProhibited = showProhibited || user.status === 'Active';
    return matchesSearch && matchesProhibited;
  });

  const sidebarItems = [
    { name: 'User Management', icon: Users, active: activeTab === 'users' },
    { name: 'Transaction Records', icon: DollarSign, active: false },
    { name: 'Game Records', icon: Gamepad2, active: false },
    { name: 'JP Records', icon: Gift, active: false },
    { name: 'Welfare Records', icon: Gift, active: false },
    { name: 'Admin Structure', icon: Users, active: false },
    { name: 'Transaction Records', icon: Handshake, active: false },
    { name: 'Reports', icon: TrendingUp, active: false },
    { name: 'JP Setting', icon: Settings, active: false },
    { name: 'Setting', icon: Settings, active: false },
    { name: 'Download', icon: Download, active: false },
    { name: 'Logout', icon: LogOut, active: false }
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex">
      {/* Sidebar */}
      <div className="w-64 bg-gray-200 border-r border-gray-300">
        <div className="p-4 border-b border-gray-300">
          <div className="text-green-600 font-semibold text-sm mb-2">
            Balance: 764
          </div>
        </div>
        
        <nav className="mt-4">
          {sidebarItems.map((item, index) => (
            <button
              key={index}
              onClick={() => {
                if (item.name === 'Logout') {
                  logout();
                  navigate('/');
                } else if (item.name === 'User Management') {
                  setActiveTab('users');
                }
              }}
              className={`w-full flex items-center px-4 py-3 text-left hover:bg-gray-300 transition-colors ${
                item.active ? 'bg-gray-300 border-r-2 border-blue-500' : ''
              }`}
            >
              <item.icon className="w-5 h-5 mr-3" />
              <span className="text-sm font-medium">{item.name}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-blue-900 text-white px-6 py-4">
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-lg font-semibold">Milkyway (Release) / User Management</h1>
            </div>
             <div className="flex items-center space-x-4">
               <span className="text-sm">Welcome {adminUser?.email || 'Admin'} (STORE)</span>
              <div className="flex items-center space-x-2">
                <Globe className="w-4 h-4" />
                <select className="bg-blue-800 text-white border-none rounded px-2 py-1 text-sm">
                  <option>English</option>
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content Area */}
        <div className="flex-1 p-6">
          <div className="bg-white rounded-lg shadow-sm">
            {/* User Management Header */}
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-semibold text-gray-900 mb-4">User Management</h2>
              
              {/* Search and Controls */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-4">
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="ID or Account"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  </div>
                  <button className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                    Search
                  </button>
                </div>
                
                <div className="flex items-center space-x-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-600">Display prohibited accounts:</span>
                    <button
                      onClick={() => setShowProhibited(!showProhibited)}
                      className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                        showProhibited 
                          ? 'bg-blue-600 text-white' 
                          : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                      }`}
                    >
                      {showProhibited ? 'ON' : 'OFF'}
                    </button>
                  </div>
                  <button className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2">
                    <Plus className="w-4 h-4" />
                    <span>Create Player</span>
                  </button>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center space-x-2 mb-4">
                <button 
                  onClick={() => handleUserAction('recharge')}
                  className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                >
                  Recharge
                </button>
                <button 
                  onClick={() => handleUserAction('redeem')}
                  className="bg-purple-600 text-white px-3 py-2 rounded text-sm hover:bg-purple-700 transition-colors"
                >
                  Redeem
                </button>
                <button 
                  onClick={() => handleUserAction('reset-password')}
                  className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Reset Password
                </button>
                <button 
                  onClick={() => handleUserAction('game-records')}
                  className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Game Records
                </button>
                <button 
                  onClick={() => handleUserAction('jp-records')}
                  className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  JP Records
                </button>
                <button 
                  onClick={() => handleUserAction('transaction-records')}
                  className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Transaction Records
                </button>
                <button 
                  onClick={() => handleUserAction('device-unbind')}
                  className="bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors"
                >
                  Device:Unbind
                </button>
              </div>
            </div>

            {/* User Table */}
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-blue-600 text-white">
                  <tr>
                    <th className="px-4 py-3 text-left text-sm font-medium">ID</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Account</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">NickName</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Balance</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Register Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Last Login</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Manager</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filteredUsers.map((user) => (
                    <tr key={user.id} className="border-b border-gray-200 hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <button 
                          onClick={() => handleUserAction('recharge', user.account)}
                          className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 transition-colors"
                        >
                          Actions
                        </button>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.id}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.account}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.nickname}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.balance}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.registerDate}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.lastLogin}</td>
                      <td className="px-4 py-3 text-sm text-gray-900">{user.manager}</td>
                      <td className="px-4 py-3">
                        <button className={`px-3 py-1 rounded text-sm font-medium ${
                          user.status === 'Active' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {user.status}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Agent Status Section */}
          {!isLoggedIn && (
            <div className="mt-6 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="text-center">
                <Shield className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Fortune Panda Agent</h3>
                <p className="text-gray-600 mb-4">Agent is not logged in. Click below to establish connection.</p>
                <button
                  onClick={handleAdminLogin}
                  disabled={isLoading}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 mx-auto"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <Shield className="w-4 h-4" />
                      <span>Connect Agent</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Agent Status Display */}
          {isLoggedIn && (
            <div className="mt-6 bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-center">
                <CheckCircle className="w-5 h-5 text-green-600 mr-2" />
                <span className="text-green-800 font-medium">Fortune Panda Agent Connected</span>
                <button
                  onClick={handleLogout}
                  className="ml-auto text-red-600 hover:text-red-800 text-sm"
                >
                  Disconnect
                </button>
              </div>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="mt-6 bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-600 mr-2" />
                <span className="text-red-800">{error}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;