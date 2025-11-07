import React, { useState } from 'react';
import { Shield, Loader2, Lock, User } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../utils/api';

const AdminLogin: React.FC = () => {
  const [agentName, setAgentName] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const API_BASE_URL = getApiBaseUrl();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentName || !agentPassword) {
      toast.error('Please enter both agent name and password');
      return;
    }

    try {
      setLoading(true);
      console.log('🔐 Attempting admin login...', { agentName, hasPassword: !!agentPassword });
      
      const response = await axios.post(
        `${API_BASE_URL}/admin/login`,
        {
          agentName,
          agentPassword
        }
      );

      console.log('📥 Login response:', response.data);

      if (response.data.success) {
        // Store admin session
        const adminSession = {
          token: response.data.data.token,
          expiresAt: response.data.data.expiresAt,
          agentName: response.data.data.agentName
        };
        localStorage.setItem('admin_session', JSON.stringify(adminSession));
        
        console.log('✅ Admin session stored');
        toast.success('Admin login successful!');
        navigate('/adminacers');
      } else {
        console.error('❌ Login failed:', response.data.message);
        toast.error(response.data.message || 'Login failed');
      }
    } catch (error: any) {
      console.error('❌ Login error:', error);
      const errorMessage = error.response?.data?.message || 
                          error.message || 
                          'Login failed. Please check your credentials.';
      console.error('Error details:', {
        status: error.response?.status,
        data: error.response?.data,
        message: errorMessage
      });
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ 
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
    }}>
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-40 animate-pulse" style={{ backgroundColor: '#6A1B9A' }}></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-35 animate-ping" style={{ backgroundColor: '#00B0FF' }}></div>
      </div>

      <div className="casino-bg-secondary backdrop-blur-lg rounded-3xl shadow-2xl p-8 md:p-12 w-full max-w-md casino-border">
        <div className="text-center mb-8">
          <div className="flex justify-center mb-4">
            <div className="p-4 rounded-full casino-bg-primary">
              <Shield className="w-12 h-12 text-white" />
            </div>
          </div>
          <h1 className="text-3xl font-bold casino-text-primary mb-2">Admin Login</h1>
          <p className="casino-text-secondary">Enter your FortunePanda agent credentials</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div>
            <label className="block casino-text-secondary mb-2 font-semibold flex items-center gap-2">
              <User className="w-4 h-4" />
              Agent Name
            </label>
            <input
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Enter agent name"
              className="w-full p-4 rounded-xl casino-bg-primary casino-text-primary border casino-border focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              required
              autoFocus
            />
          </div>

          <div>
            <label className="block casino-text-secondary mb-2 font-semibold flex items-center gap-2">
              <Lock className="w-4 h-4" />
              Agent Password
            </label>
            <input
              type="password"
              value={agentPassword}
              onChange={(e) => setAgentPassword(e.target.value)}
              placeholder="Enter agent password"
              className="w-full p-4 rounded-xl casino-bg-primary casino-text-primary border casino-border focus:outline-none focus:ring-2 focus:ring-yellow-400 transition-all"
              required
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full btn-casino-primary py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105"
          >
            {loading ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Logging in...
              </>
            ) : (
              <>
                <Shield className="w-5 h-5" />
                Login to Admin Panel
              </>
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-sm casino-text-secondary">
            Use your FortunePanda agent credentials to access the admin dashboard
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin;

