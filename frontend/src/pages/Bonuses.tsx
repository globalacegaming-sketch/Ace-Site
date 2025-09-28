import { useState } from 'react';
import { Gift, Star, Clock, CheckCircle } from 'lucide-react';

const Offers = () => {
  const [activeTab, setActiveTab] = useState('current');

  const currentOffers = [
    {
      id: 1,
      title: 'Welcome Bonus',
      description: 'Get 100% bonus on your first deposit up to $500',
      bonus: '100%',
      maxAmount: '$500',
      validUntil: '2024-12-31',
      requirements: 'Minimum deposit $10',
      isActive: true
    },
    {
      id: 2,
      title: 'Weekend Special',
      description: '50% bonus on all deposits every weekend',
      bonus: '50%',
      maxAmount: '$1000',
      validUntil: '2024-12-31',
      requirements: 'Valid every Friday-Sunday',
      isActive: true
    },
    {
      id: 3,
      title: 'VIP Cashback',
      description: 'Get 10% cashback on all losses',
      bonus: '10%',
      maxAmount: 'Unlimited',
      validUntil: '2024-12-31',
      requirements: 'VIP status required',
      isActive: true
    }
  ];

  const upcomingOffers = [
    {
      id: 4,
      title: 'Holiday Mega Bonus',
      description: '200% bonus for the holiday season',
      bonus: '200%',
      maxAmount: '$2000',
      validUntil: '2024-12-25',
      requirements: 'Starts December 20th',
      isActive: false
    },
    {
      id: 5,
      title: 'New Year Special',
      description: 'Triple your deposit for the new year',
      bonus: '300%',
      maxAmount: '$3000',
      validUntil: '2025-01-15',
      requirements: 'Available from January 1st',
      isActive: false
    }
  ];

  const expiredOffers = [
    {
      id: 6,
      title: 'Black Friday Deal',
      description: '150% bonus on Black Friday',
      bonus: '150%',
      maxAmount: '$1500',
      validUntil: '2024-11-30',
      requirements: 'Expired',
      isActive: false
    }
  ];

  const getOffers = () => {
    switch (activeTab) {
      case 'current':
        return currentOffers;
      case 'upcoming':
        return upcomingOffers;
      case 'expired':
        return expiredOffers;
      default:
        return currentOffers;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
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
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              Current Bonuses
            </button>
            <button
              onClick={() => setActiveTab('upcoming')}
              className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'upcoming'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setActiveTab('expired')}
              className={`px-6 py-2 rounded-md font-medium transition-colors duration-200 ${
                activeTab === 'expired'
                  ? 'bg-primary-600 text-white'
                  : 'text-gray-600 hover:text-primary-600'
              }`}
            >
              Expired
            </button>
          </div>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {getOffers().map((offer) => (
            <div
              key={offer.id}
              className={`bg-white rounded-xl shadow-lg border-2 transition-all duration-300 hover:shadow-xl ${
                offer.isActive
                  ? 'border-primary-200 hover:border-primary-300'
                  : 'border-gray-200 opacity-75'
              }`}
            >
              <div className="p-6">
                {/* Header */}
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-2">
                    <Gift className="w-6 h-6 text-primary-600" />
                    <h3 className="text-xl font-bold text-gray-900">{offer.title}</h3>
                  </div>
                  {offer.isActive && (
                    <div className="flex items-center space-x-1 text-green-600">
                      <CheckCircle className="w-4 h-4" />
                      <span className="text-sm font-medium">Active</span>
                    </div>
                  )}
                </div>

                {/* Description */}
                <p className="text-gray-600 mb-4">{offer.description}</p>

                {/* Bonus Info */}
                <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-4 mb-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-primary-600 mb-1">
                      {offer.bonus}
                    </div>
                    <div className="text-sm text-gray-600">Bonus</div>
                    <div className="text-lg font-semibold text-gray-800 mt-2">
                      Up to {offer.maxAmount}
                    </div>
                  </div>
                </div>

                {/* Details */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center space-x-2">
                    <Clock className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">
                      Valid until: {offer.validUntil}
                    </span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Star className="w-4 h-4 text-gray-400" />
                    <span className="text-sm text-gray-600">{offer.requirements}</span>
                  </div>
                </div>

                {/* Action Button */}
                <button
                  className={`w-full py-3 px-4 rounded-lg font-medium transition-colors duration-200 ${
                    offer.isActive
                      ? 'bg-primary-600 text-white hover:bg-primary-700'
                      : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                  }`}
                  disabled={!offer.isActive}
                >
                  {offer.isActive ? 'Claim Offer' : 'Expired'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* No offers message */}
        {getOffers().length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-16 h-16 text-gray-300 mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-gray-600 mb-2">
              No {activeTab} offers available
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
