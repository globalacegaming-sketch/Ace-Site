import { useNavigate } from 'react-router-dom';
import { Home, AlertTriangle } from 'lucide-react';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#0A0A0F]">
      <div className="text-center px-4">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-red-500/20 text-red-400 mb-6">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-bold text-white mb-2">404</h1>
        <p className="text-gray-400 mb-8">Page not found</p>
        <button
          onClick={() => navigate('/')}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-colors text-white"
          style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
            color: '#0A0A0F',
          }}
        >
          <Home className="w-4 h-4" />
          Go to Home
        </button>
      </div>
    </div>
  );
};

export default NotFound;
