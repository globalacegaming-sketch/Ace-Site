import { HelpCircle } from 'lucide-react';

const Support = () => {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-center mb-4">
            <HelpCircle className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            Support & Help
          </h1>
          <p className="text-gray-300 mb-8">
            Get help with your account, games, or technical issues.
          </p>
          
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 max-w-md mx-auto">
            <p className="text-gray-300">
              🚧 Support page is under development. Coming soon with help center and contact forms!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Support;
