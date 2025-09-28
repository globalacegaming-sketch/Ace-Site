import { User } from 'lucide-react';

const ProfilePage = () => {
  return (
    <div className="min-h-screen py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-purple-400 to-purple-500 rounded-full flex items-center justify-center mb-4">
            <User className="w-8 h-8 text-black" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-4">
            User Profile
          </h1>
          <p className="text-gray-300 mb-8">
            Update your account information and preferences.
          </p>
          
          <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-8 border border-gray-700 max-w-md mx-auto">
            <p className="text-gray-300">
              🚧 Profile page is under development. Coming soon with user management features!
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
