import React, { useState } from 'react';
import { Shield, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import axios from 'axios';

const AgentLogin: React.FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentInfo, setAgentInfo] = useState<any>(null);

  const handleAgentLogin = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const result = await axios.post('/api/health/fortune-panda/relogin');
      
      if (result.data.status === 'OK') {
        setIsLoggedIn(true);
        setAgentInfo(result.data.data);
        console.log('Fortune Panda Agent login successful:', result.data);
      } else {
        setError(result.data.message || 'Failed to login as agent');
      }
    } catch (error: any) {
      console.error('Agent login error:', error);
      setError(error.response?.data?.message || 'Failed to login as agent');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenAdminDashboard = () => {
    window.open('/adminacers', '_blank');
  };

  if (isLoggedIn) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-900">
        <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 w-full max-w-md text-center">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-6" />
          <h2 className="text-3xl font-bold text-white mb-4">Agent Logged In</h2>
          <p className="text-gray-400 mb-6">Fortune Panda agent is successfully authenticated</p>
          
          {agentInfo && (
            <div className="bg-gray-700 p-4 rounded-lg mb-6 text-left">
              <h3 className="text-white font-semibold mb-2">Agent Information:</h3>
              <p className="text-gray-300 text-sm">Balance: {agentInfo.balance || 'N/A'}</p>
              <p className="text-gray-300 text-sm">Agent Key: {agentInfo.agentKey ? 'Active' : 'N/A'}</p>
            </div>
          )}
          
          <div className="space-y-3">
            <button
              onClick={handleOpenAdminDashboard}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2"
            >
              <Shield className="w-5 h-5" />
              <span>Open Admin Dashboard</span>
            </button>
            
            <button
              onClick={() => setIsLoggedIn(false)}
              className="w-full bg-gray-600 hover:bg-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300"
            >
              Logout Agent
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900">
      <div className="bg-gray-800 p-8 rounded-lg shadow-xl border border-gray-700 w-full max-w-md text-center">
        <Shield className="w-16 h-16 text-blue-500 mx-auto mb-6" />
        <h2 className="text-3xl font-bold text-white mb-4">Fortune Panda Agent Login</h2>
        <p className="text-gray-400 mb-8">Direct access to Fortune Panda agent dashboard</p>
        
        <button
          onClick={handleAgentLogin}
          disabled={isLoading}
          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-lg transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Logging in Agent...</span>
            </>
          ) : (
            <>
              <Shield className="w-5 h-5" />
              <span>Login as Fortune Panda Agent</span>
            </>
          )}
        </button>
        
        {error && (
          <div className="mt-4 p-3 bg-red-900 bg-opacity-50 border border-red-700 text-red-300 rounded-lg flex items-center justify-center">
            <AlertCircle className="w-5 h-5 mr-2" />
            <span>{error}</span>
          </div>
        )}
        
        <div className="mt-6 text-sm text-gray-500">
          <p>This will authenticate the Fortune Panda agent directly</p>
          <p>No user login required</p>
        </div>
      </div>
    </div>
  );
};

export default AgentLogin;
