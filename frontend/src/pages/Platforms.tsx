import { useState, useEffect } from 'react';
import { ExternalLink, MessageCircle, Loader2, LogIn } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../utils/api';

interface Platform {
  _id: string;
  name: string;
  description: string;
  image: string;
  gameLink: string;
  isActive: boolean;
  order: number;
}

const Platforms = () => {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuthStore();
  const API_BASE_URL = getApiBaseUrl();
  
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadPlatforms();
  }, []);

  const loadPlatforms = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/platforms`);
      
      if (response.data.success) {
        setPlatforms(response.data.data || []);
      }
    } catch (error: any) {
      console.error('Failed to load platforms:', error);
      toast.error('Failed to load platforms');
    } finally {
      setLoading(false);
    }
  };

  const handleGameLink = (gameLink: string) => {
    window.open(gameLink, '_blank', 'noopener,noreferrer');
  };

  const handleRechargeNow = () => {
    if (!isAuthenticated) {
      toast.error('Please login to recharge your account');
      navigate('/login');
      return;
    }

    toast.success('Redirecting you to support...');
    navigate('/support');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 pt-16 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-white mx-auto mb-4" />
          <p className="text-white text-lg">Loading platforms...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900 pt-16 pb-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-white mb-4 drop-shadow-lg">
            OUR MOST POPULAR ONLINE SLOT GAMES IN USA
          </h1>
          <p className="text-lg sm:text-xl text-gray-200 max-w-3xl mx-auto leading-relaxed">
            Discover a world of thrilling online slot games with diverse themes, engaging gameplay, and rewarding features. 
            From classic fruit machines to modern video slots, explore new adventures and experience the excitement. 
            Start spinning, lay your wagers, and win big!
          </p>
        </div>

        {/* Platforms Grid */}
        {platforms.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-300 text-xl">No platforms available at the moment.</p>
            <p className="text-gray-400 text-sm mt-2">Please check back later.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {platforms.map((platform) => (
              <div
                key={platform._id}
                className="relative group bg-gradient-to-br from-gray-800 to-gray-900 rounded-xl overflow-hidden border-2 border-yellow-500/30 hover:border-yellow-500 transition-all duration-300 shadow-2xl hover:shadow-yellow-500/20"
              >
                {/* Platform Image */}
                <div className="relative h-64 overflow-hidden">
                  <img
                    src={platform.image}
                    alt={platform.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300/1a1a2e/ffffff?text=' + encodeURIComponent(platform.name);
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent"></div>
                  
                  {/* Platform Name Overlay */}
                  <div className="absolute bottom-0 left-0 right-0 p-4">
                    <h3 className="text-2xl font-bold text-white drop-shadow-lg mb-2">
                      {platform.name}
                    </h3>
                  </div>
                </div>

                {/* Platform Content */}
                <div className="p-6 bg-gradient-to-b from-gray-900 to-gray-800">
                  <p className="text-gray-300 text-sm mb-6 line-clamp-3 min-h-[60px]">
                    {platform.description}
                  </p>

                  {/* Action Buttons */}
                  <div className="space-y-3">
                    <button
                      onClick={() => handleGameLink(platform.gameLink)}
                      className="w-full py-3 px-4 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      <ExternalLink className="w-5 h-5" />
                      Game Link
                    </button>
                    
                    <button
                      onClick={handleRechargeNow}
                      className="w-full py-3 px-4 bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transform hover:scale-105"
                    >
                      {isAuthenticated ? (
                        <>
                          <MessageCircle className="w-5 h-5" />
                          Recharge Now
                        </>
                      ) : (
                        <>
                          <LogIn className="w-5 h-5" />
                          Login to Recharge
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Glow Effect */}
                <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                  <div className="absolute inset-0 bg-gradient-to-r from-yellow-500/20 via-transparent to-yellow-500/20"></div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Platforms;
