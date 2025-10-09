import { useState } from 'react';
import { 
  User, 
  Camera, 
  Save, 
  Check, 
  X,
  Edit3,
  Mail,
  Calendar,
  ChevronDown
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import toast from 'react-hot-toast';

const ProfilePage = () => {
  const { user, setUser } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);

  // Form states
  const [profileData, setProfileData] = useState({
    firstName: user?.firstName || '',
    lastName: user?.lastName || '',
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    country: user?.country || '',
    currency: user?.currency || 'USD'
  });

  // Avatar options
  const avatarOptions = [
    { id: 'gorilla', name: 'Gorilla', emoji: '🦍' },
    { id: 'lion', name: 'Lion', emoji: '🦁' },
    { id: 'tiger', name: 'Tiger', emoji: '🐅' },
    { id: 'eagle', name: 'Eagle', emoji: '🦅' },
    { id: 'shark', name: 'Shark', emoji: '🦈' },
    { id: 'wolf', name: 'Wolf', emoji: '🐺' },
    { id: 'bear', name: 'Bear', emoji: '🐻' },
    { id: 'dragon', name: 'Dragon', emoji: '🐉' }
  ];

  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar || 'gorilla');

  // Country and currency options
  const countries = [
    'United States', 'Canada', 'United Kingdom', 'Australia', 'Germany', 
    'France', 'Japan', 'India', 'Brazil', 'Mexico', 'Spain', 'Italy'
  ];

  const currencies = ['USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY', 'CNY', 'INR', 'BRL', 'MXN'];

  const handleProfileUpdate = async () => {
    setIsLoading(true);
    try {
      const response = await axios.put(`${getApiBaseUrl()}/user/profile`, profileData, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        setUser(response.data.data.user);
        setIsEditing(false);
        toast.success('Profile updated successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAvatarUpdate = async (avatarId: string) => {
    setIsLoading(true);
    try {
      const response = await axios.put(`${getApiBaseUrl()}/user/avatar`, 
        { avatar: avatarId }, 
        {
          headers: {
            'Authorization': `Bearer ${useAuthStore.getState().token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.data.success) {
        setSelectedAvatar(avatarId);
        setUser({ ...user!, avatar: avatarId });
        setShowAvatarOptions(false);
        toast.success('Avatar updated successfully!');
      }
    } catch (error: any) {
      toast.error('Failed to update avatar');
    } finally {
      setIsLoading(false);
    }
  };

  const getCurrentAvatar = () => {
    return avatarOptions.find(avatar => avatar.id === selectedAvatar) || avatarOptions[0];
  };

  return (
    <div className="min-h-screen pt-20 pb-4 sm:pb-6 lg:pb-8" style={{ 
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
    }}>
      {/* Decorative glowing orbs */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-30 animate-pulse" style={{ backgroundColor: '#6A1B9A' }}></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-25 animate-ping" style={{ backgroundColor: '#00B0FF' }}></div>
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-20 animate-pulse" style={{ backgroundColor: '#FFD700' }}></div>
      </div>
      
      <div className="relative z-10 max-w-4xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header with Profile Picture and Edit Button */}
        <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mb-4 sm:mb-6 casino-border shadow-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
            <div className="flex items-center space-x-4 sm:space-x-6">
              {/* Profile Picture */}
              <div className="relative">
                <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center text-2xl sm:text-3xl" style={{ 
                  background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
                  boxShadow: '0 0 20px rgba(106, 27, 154, 0.3)'
                }}>
                  {getCurrentAvatar().emoji}
                </div>
                <button
                  onClick={() => setShowAvatarOptions(!showAvatarOptions)}
                  className="absolute -bottom-1 -right-1 w-6 h-6 sm:w-8 sm:h-8 rounded-full flex items-center justify-center text-white transition-colors" 
                  style={{ 
                    backgroundColor: '#FFD700',
                    boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)'
                  }}
                >
                  <Camera className="w-3 h-3 sm:w-4 sm:h-4" style={{ color: '#0A0A0F' }} />
                </button>
              </div>
              
              {/* User Info */}
              <div>
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold casino-text-primary">
                  {user?.firstName} {user?.lastName}
                </h1>
                <p className="text-sm sm:text-base casino-text-secondary">{user?.email}</p>
              </div>
            </div>
            
            {/* Edit Button */}
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="btn-casino-primary px-4 sm:px-6 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm sm:text-base"
              >
                <Edit3 className="w-4 h-4" />
                <span>Edit</span>
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                <button
                  onClick={() => setIsEditing(false)}
                  className="btn-casino-outline px-3 sm:px-4 py-2 rounded-lg transition-colors flex items-center space-x-2 text-sm sm:text-base"
                >
                  <X className="w-4 h-4" />
                  <span>Cancel</span>
                </button>
                <button
                  onClick={handleProfileUpdate}
                  disabled={isLoading}
                  className="btn-casino-primary px-3 sm:px-4 py-2 rounded-lg transition-colors disabled:opacity-50 flex items-center space-x-2 text-sm sm:text-base"
                >
                  <Save className="w-4 h-4" />
                  <span>{isLoading ? 'Saving...' : 'Save'}</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Avatar Selection Dropdown */}
        {showAvatarOptions && (
          <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 casino-border shadow-lg">
            <h3 className="text-base sm:text-lg font-semibold casino-text-primary mb-3 sm:mb-4">Choose Your Avatar</h3>
            <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3 sm:gap-4">
              {avatarOptions.map((avatar) => (
                <button
                  key={avatar.id}
                  onClick={() => handleAvatarUpdate(avatar.id)}
                  disabled={isLoading}
                  className={`relative p-2 sm:p-3 rounded-lg sm:rounded-xl border-2 transition-all duration-300 ${
                    selectedAvatar === avatar.id
                      ? 'scale-105'
                      : 'casino-border hover:border-yellow-400 hover:scale-105'
                  } disabled:opacity-50`}
                  style={selectedAvatar === avatar.id ? {
                    borderColor: '#FFD700',
                    backgroundColor: 'rgba(255, 215, 0, 0.1)',
                    boxShadow: '0 0 10px rgba(255, 215, 0, 0.3)'
                  } : {}}
                >
                  <div className="text-xl sm:text-2xl mb-1">{avatar.emoji}</div>
                  <p className="text-xs casino-text-secondary font-medium">{avatar.name}</p>
                  {selectedAvatar === avatar.id && (
                    <div className="absolute top-1 right-1 w-4 h-4 sm:w-5 sm:h-5 rounded-full flex items-center justify-center" style={{ backgroundColor: '#00C853' }}>
                      <Check className="w-2 h-2 sm:w-3 sm:h-3 text-white" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Profile Information */}
        <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 casino-border shadow-lg">
          <h2 className="text-lg sm:text-xl font-semibold casino-text-primary mb-4 sm:mb-6">Personal Information</h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
            {/* Left Column */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Full Name</label>
                <input
                  type="text"
                  value={`${profileData.firstName} ${profileData.lastName}`}
                  onChange={(e) => {
                    const names = e.target.value.split(' ');
                    setProfileData({ 
                      ...profileData, 
                      firstName: names[0] || '', 
                      lastName: names.slice(1).join(' ') || '' 
                    });
                  }}
                  disabled={!isEditing}
                  placeholder="Your Full Name"
                  className="input-casino w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Username</label>
                <input
                  type="text"
                  value={profileData.username}
                  onChange={(e) => setProfileData({ ...profileData, username: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Your Username"
                  className="input-casino w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Country</label>
                <div className="relative">
                  <select
                    value={profileData.country}
                    onChange={(e) => setProfileData({ ...profileData, country: e.target.value })}
                    disabled={!isEditing}
                    className="input-casino w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg appearance-none text-sm sm:text-base"
                  >
                    <option value="">Select Country</option>
                    {countries.map((country) => (
                      <option key={country} value={country}>{country}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 casino-text-secondary pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Right Column */}
            <div className="space-y-4 sm:space-y-6">
              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Phone Number</label>
                <input
                  type="tel"
                  value={profileData.phone}
                  onChange={(e) => setProfileData({ ...profileData, phone: e.target.value })}
                  disabled={!isEditing}
                  placeholder="Your Phone Number"
                  className="input-casino w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg text-sm sm:text-base"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Currency</label>
                <div className="relative">
                  <select
                    value={profileData.currency}
                    onChange={(e) => setProfileData({ ...profileData, currency: e.target.value })}
                    disabled={!isEditing}
                    className="input-casino w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg appearance-none text-sm sm:text-base"
                  >
                    {currencies.map((currency) => (
                      <option key={currency} value={currency}>{currency}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 casino-text-secondary pointer-events-none" />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Language</label>
                <div className="relative">
                  <select
                    disabled={!isEditing}
                    className="input-casino w-full px-3 sm:px-4 py-2 sm:py-3 rounded-lg appearance-none text-sm sm:text-base"
                  >
                    <option value="en">English</option>
                    <option value="es">Spanish</option>
                    <option value="fr">French</option>
                    <option value="de">German</option>
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 casino-text-secondary pointer-events-none" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Email Address Section */}
        <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mt-4 sm:mt-6 casino-border shadow-lg">
          <h2 className="text-lg sm:text-xl font-semibold casino-text-primary mb-4 sm:mb-6">My Email Address</h2>
          
          <div className="flex flex-col sm:flex-row sm:items-center space-y-3 sm:space-y-0 sm:space-x-4 p-3 sm:p-4 rounded-lg" style={{ backgroundColor: 'rgba(0, 176, 255, 0.1)' }}>
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center" style={{ backgroundColor: '#00B0FF' }}>
              <Mail className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-medium casino-text-primary text-sm sm:text-base">{user?.email}</p>
              <p className="text-xs sm:text-sm casino-text-secondary">
                {user?.createdAt ? `${Math.ceil((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24 * 30))} months ago` : 'Recently added'}
              </p>
            </div>
            <button className="btn-casino-primary px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm">
              + Add Email Address
            </button>
          </div>
        </div>

        {/* Account Information */}
        <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 mt-4 sm:mt-6 casino-border shadow-lg">
          <h2 className="text-lg sm:text-xl font-semibold casino-text-primary mb-4 sm:mb-6">Account Information</h2>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
            <div className="flex items-center space-x-3">
              <Calendar className="w-4 h-4 sm:w-5 sm:h-5 casino-text-secondary" />
              <div>
                <p className="text-xs sm:text-sm casino-text-secondary">Member Since</p>
                <p className="font-medium casino-text-primary text-sm sm:text-base">
                  {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                </p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <User className="w-4 h-4 sm:w-5 sm:h-5 casino-text-secondary" />
              <div>
                <p className="text-xs sm:text-sm casino-text-secondary">Account Status</p>
                <p className="font-medium text-sm sm:text-base" style={{ color: '#00C853' }}>Active</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ProfilePage;
