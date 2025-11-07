import { useState, useEffect } from 'react';
import { Gift, Star, Clock, CheckCircle, Loader2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../utils/api';

interface Bonus {
  _id: string;
  title: string;
  description: string;
  image: string;
  bonusType: 'welcome' | 'deposit' | 'free_spins' | 'cashback' | 'other';
  bonusValue?: string;
  termsAndConditions?: string;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  claimedBy?: string[];
}

const Offers = () => {
  const API_BASE_URL = getApiBaseUrl();
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'current' | 'upcoming' | 'expired'>('current');
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  useEffect(() => {
    loadBonuses();
  }, []);

  const loadBonuses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/bonuses`);
      if (response.data.success) {
        setBonuses(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load bonuses:', error);
      toast.error('Failed to load bonuses');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimBonus = async (bonus: Bonus) => {
    if (!isAuthenticated || !user) {
      toast.error('Please login to claim bonuses');
      return;
    }

    // Check if already claimed
    if (bonus.claimedBy?.includes(user._id)) {
      toast.error('You have already claimed this bonus');
      return;
    }

    try {
      setClaiming(bonus._id);
      
      // Claim the bonus
      const claimResponse = await axios.post(
        `${API_BASE_URL}/bonuses/${bonus._id}/claim`,
        { userId: user._id }
      );

      if (claimResponse.data.success) {
        toast.success('Bonus claimed successfully!');
        
        // Send pre-message via Tawk.to if available
        const preMessage = claimResponse.data.data?.preMessage;
        if (preMessage && window.Tawk_API) {
          // Wait a bit for Tawk.to to be ready, then send message
          setTimeout(() => {
            if (window.Tawk_API) {
              window.Tawk_API.maximize();
              // Tawk.to doesn't have a direct API to send messages, but we can use setAttributes
              // The support team will see the user has claimed a bonus
              window.Tawk_API.setAttributes({
                bonusClaimed: bonus.title,
                bonusClaimMessage: preMessage
              }, () => {
                // Message sent to support team
              });
            }
          }, 500);
        } else if (preMessage) {
          // If Tawk.to is not loaded, show the message in a toast
          toast.success(`Bonus claimed! ${preMessage}`, { duration: 6000 });
        }

        // Reload bonuses to update claimed status
        loadBonuses();
      } else {
        toast.error(claimResponse.data.message || 'Failed to claim bonus');
      }
    } catch (error: any) {
      if (error.response?.data?.alreadyClaimed) {
        toast.error('You have already claimed this bonus');
      } else {
        toast.error(error.response?.data?.message || 'Failed to claim bonus');
      }
    } finally {
      setClaiming(null);
    }
  };

  const getFilteredBonuses = () => {
    const now = new Date();
    return bonuses.filter(bonus => {
      if (!bonus.isActive) return false;
      
      const validFrom = bonus.validFrom ? new Date(bonus.validFrom) : null;
      const validUntil = bonus.validUntil ? new Date(bonus.validUntil) : null;

      switch (activeTab) {
        case 'current':
          return (!validFrom || validFrom <= now) && (!validUntil || validUntil >= now);
        case 'upcoming':
          return validFrom && validFrom > now;
        case 'expired':
          return validUntil && validUntil < now;
        default:
          return true;
      }
    });
  };

  const isClaimed = (bonus: Bonus) => {
    return isAuthenticated && user && bonus.claimedBy?.includes(user._id);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-blue-600" />
      </div>
    );
  }

  const filteredBonuses = getFilteredBonuses();

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Exclusive Bonuses
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Discover amazing bonuses and promotions designed to enhance your gaming experience
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-8">
          <div className="bg-white rounded-lg p-1 shadow-sm border">
            <button
              onClick={() => setActiveTab('current')}
              className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'current'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Current Bonuses
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'upcoming'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'expired'
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-600 hover:text-blue-600'
              }`}
            >
              Expired
            </button>
          </div>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBonuses.map((bonus) => {
            const claimed = isClaimed(bonus);
            return (
              <div
                key={bonus._id}
                className={`bg-white rounded-xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                  bonus.isActive && !claimed
                    ? 'border-blue-200 hover:border-blue-300'
                    : 'border-gray-200 opacity-75'
                }`}
              >
                <div className="p-6">
                  {/* Image */}
                  {bonus.image && (
                    <div className="mb-4">
                      <img
                        src={bonus.image}
                        alt={bonus.title}
                        className="w-full h-48 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=' + encodeURIComponent(bonus.title);
                        }}
                      />
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center space-x-2">
                      <Gift className="w-6 h-6 text-blue-600" />
                      <h3 className="text-xl font-bold text-gray-900">{bonus.title}</h3>
                    </div>
                    {claimed && (
                      <div className="flex items-center space-x-1 text-green-600">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-medium">Claimed</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="text-gray-600 mb-4">{bonus.description}</p>

                  {/* Bonus Info */}
                  {bonus.bonusValue && (
                    <div className="bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg p-4 mb-4">
                      <div className="text-center">
                        <div className="text-3xl font-bold text-blue-600 mb-1">
                          {bonus.bonusValue}
                        </div>
                        <div className="text-sm text-gray-600">Bonus Value</div>
                        <div className="text-xs text-gray-500 mt-1 capitalize">
                          {bonus.bonusType.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Details */}
                  <div className="space-y-2 mb-4">
                    {bonus.validUntil && (
                      <div className="flex items-center space-x-2">
                        <Clock className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600">
                          Valid until: {new Date(bonus.validUntil).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    {bonus.termsAndConditions && (
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 text-gray-400" />
                        <span className="text-sm text-gray-600 line-clamp-1">
                          {bonus.termsAndConditions}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={() => handleClaimBonus(bonus)}
                    disabled={!bonus.isActive || claimed || claiming === bonus._id}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors duration-200 flex items-center justify-center gap-2 ${
                      claimed
                        ? 'bg-green-600 text-white cursor-not-allowed'
                        : bonus.isActive
                        ? 'bg-blue-600 text-white hover:bg-blue-700'
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                  >
                    {claiming === bonus._id ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Claiming...
                      </>
                    ) : claimed ? (
                      <>
                        <CheckCircle className="w-5 h-5" />
                        Already Claimed
                      </>
                    ) : bonus.isActive ? (
                      'Claim Offer'
                    ) : (
                      'Not Available'
                    )}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* No offers message */}
        {filteredBonuses.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No {activeTab} bonuses available
            </h3>
            <p className="text-gray-500">
              Check back later for new exciting offers!
            </p>
          </div>
        )}

        {/* Terms and Conditions */}
        <div className="mt-12 bg-white rounded-lg p-6 shadow-sm border">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Terms and Conditions
          </h3>
          <div className="text-sm text-gray-600 space-y-2">
            <p>• All offers are subject to terms and conditions</p>
            <p>• Bonuses must be wagered before withdrawal</p>
            <p>• One bonus per user per offer</p>
            <p>• Global Ace Gaming reserves the right to modify or cancel offers</p>
            <p>• Please gamble responsibly</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Offers;
