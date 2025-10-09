import { useState } from 'react';
import { Monitor, Smartphone, Tablet, Gamepad2, Zap, Shield, Globe } from 'lucide-react';

const Platforms = () => {
  const [selectedPlatform, setSelectedPlatform] = useState('web');

  const platforms = [
    {
      id: 'web',
      name: 'Web Platform',
      icon: Monitor,
      description: 'Play directly in your browser with our responsive web platform',
      features: [
        'No downloads required',
        'Instant access to all games',
        'Cross-platform compatibility',
        'Real-time updates',
        'Secure SSL encryption'
      ],
      requirements: 'Modern web browser (Chrome, Firefox, Safari, Edge)',
      status: 'Available',
      isRecommended: true
    },
    {
      id: 'mobile',
      name: 'Mobile App',
      icon: Smartphone,
      description: 'Download our mobile app for the best gaming experience on the go',
      features: [
        'Native mobile performance',
        'Push notifications',
        'Offline mode for some games',
        'Touch-optimized interface',
        'Biometric authentication'
      ],
      requirements: 'iOS 12+ or Android 8+',
      status: 'Coming Soon',
      isRecommended: false
    },
    {
      id: 'tablet',
      name: 'Tablet App',
      icon: Tablet,
      description: 'Optimized for tablet devices with larger screen real estate',
      features: [
        'Larger game displays',
        'Enhanced graphics',
        'Multi-touch support',
        'Landscape/portrait modes',
        'Split-screen gaming'
      ],
      requirements: 'iPadOS 13+ or Android 8+',
      status: 'Coming Soon',
      isRecommended: false
    }
  ];

  const gameCategories = [
    {
      name: 'Fortune Panda',
      icon: Zap,
      description: 'Exclusive Fortune Panda games and slots',
      games: 25,
      status: 'Active'
    },
    {
      name: 'Classic Games',
      icon: Gamepad2,
      description: 'Traditional casino games and table games',
      games: 50,
      status: 'Active'
    },
    {
      name: 'Live Casino',
      icon: Globe,
      description: 'Live dealer games with real-time streaming',
      games: 15,
      status: 'Active'
    },
    {
      name: 'Sports Betting',
      icon: Shield,
      description: 'Sports betting and virtual sports',
      games: 30,
      status: 'Coming Soon'
    }
  ];

  const selectedPlatformData = platforms.find(p => p.id === selectedPlatform);

  return (
    <div className="min-h-screen bg-gray-50 pt-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Gaming Platforms
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Choose your preferred platform and enjoy seamless gaming across all devices
          </p>
        </div>

        {/* Platform Selection */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {platforms.map((platform) => {
            const IconComponent = platform.icon;
            return (
              <div
                key={platform.id}
                onClick={() => setSelectedPlatform(platform.id)}
                className={`cursor-pointer rounded-xl border-2 p-6 transition-all duration-300 ${
                  selectedPlatform === platform.id
                    ? 'border-primary-500 bg-primary-50 shadow-lg'
                    : 'border-gray-200 bg-white hover:border-primary-300 hover:shadow-md'
                }`}
              >
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center space-x-3">
                    <div className={`p-3 rounded-lg ${
                      selectedPlatform === platform.id
                        ? 'bg-primary-100 text-primary-600'
                        : 'bg-gray-100 text-gray-600'
                    }`}>
                      <IconComponent className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {platform.name}
                      </h3>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        platform.status === 'Available'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {platform.status}
                      </div>
                    </div>
                  </div>
                  {platform.isRecommended && (
                    <div className="bg-primary-600 text-white px-2 py-1 rounded-full text-xs font-medium">
                      Recommended
                    </div>
                  )}
                </div>
                <p className="text-gray-600 text-sm mb-4">{platform.description}</p>
                <div className="text-xs text-gray-500">
                  Requirements: {platform.requirements}
                </div>
              </div>
            );
          })}
        </div>

        {/* Platform Details */}
        {selectedPlatformData && (
          <div className="bg-white rounded-xl shadow-lg border p-8 mb-12">
            <div className="flex items-center space-x-4 mb-6">
              <div className="p-4 bg-primary-100 rounded-lg">
                <selectedPlatformData.icon className="w-8 h-8 text-primary-600" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900">
                  {selectedPlatformData.name}
                </h2>
                <p className="text-gray-600">{selectedPlatformData.description}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Features */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  Key Features
                </h3>
                <ul className="space-y-3">
                  {selectedPlatformData.features.map((feature, index) => (
                    <li key={index} className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-primary-600 rounded-full"></div>
                      <span className="text-gray-700">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* System Requirements */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">
                  System Requirements
                </h3>
                <div className="bg-gray-50 rounded-lg p-4">
                  <p className="text-gray-700">{selectedPlatformData.requirements}</p>
                </div>
              </div>
            </div>

            {/* Action Button */}
            <div className="mt-8 text-center">
              {selectedPlatformData.status === 'Available' ? (
                <button className="bg-primary-600 text-white px-8 py-3 rounded-lg font-medium hover:bg-primary-700 transition-colors duration-200">
                  Start Playing Now
                </button>
              ) : (
                <button
                  disabled
                  className="bg-gray-300 text-gray-500 px-8 py-3 rounded-lg font-medium cursor-not-allowed"
                >
                  Coming Soon
                </button>
              )}
            </div>
          </div>
        )}

        {/* Game Categories */}
        <div className="mb-12">
          <h2 className="text-2xl font-bold text-gray-900 mb-8 text-center">
            Available Game Categories
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {gameCategories.map((category, index) => {
              const IconComponent = category.icon;
              return (
                <div
                  key={index}
                  className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow duration-300"
                >
                  <div className="flex items-center space-x-3 mb-4">
                    <div className="p-3 bg-primary-100 rounded-lg">
                      <IconComponent className="w-6 h-6 text-primary-600" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">
                        {category.name}
                      </h3>
                      <div className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                        category.status === 'Active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-yellow-100 text-yellow-800'
                      }`}>
                        {category.status}
                      </div>
                    </div>
                  </div>
                  <p className="text-gray-600 text-sm mb-3">{category.description}</p>
                  <div className="text-sm text-gray-500">
                    {category.games} games available
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Technical Specifications */}
        <div className="bg-white rounded-xl shadow-lg border p-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">
            Technical Specifications
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Security Features
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• SSL/TLS encryption</li>
                <li>• Two-factor authentication</li>
                <li>• Secure payment processing</li>
                <li>• Regular security audits</li>
                <li>• GDPR compliance</li>
              </ul>
            </div>
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">
                Performance
              </h3>
              <ul className="space-y-2 text-gray-700">
                <li>• 99.9% uptime guarantee</li>
                <li>• Global CDN distribution</li>
                <li>• Real-time game updates</li>
                <li>• Optimized for all devices</li>
                <li>• 24/7 technical support</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Platforms;
