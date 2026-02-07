import { useState, useRef } from 'react';
import { 
  User, 
  Camera, 
  Save, 
  Check, 
  X,
  Edit3,
  Mail,
  Calendar,
  ChevronDown,
  Send,
  AlertCircle,
  Loader2
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import toast from 'react-hot-toast';
import AchievementBadges from '../components/AchievementBadges';

const ProfilePage = () => {
  const { user, setUser, token } = useAuthStore();
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showAvatarOptions, setShowAvatarOptions] = useState(false);
  const [isResendingVerification, setIsResendingVerification] = useState(false);
  const [verificationCodes, setVerificationCodes] = useState(['', '', '', '', '', '']);
  const [isVerifying, setIsVerifying] = useState(false);
  const [showVerificationInput, setShowVerificationInput] = useState(false);
  const verificationInputRefs = useRef<(HTMLInputElement | null)[]>([]);

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

  const handleResendVerification = async () => {
    setIsResendingVerification(true);
    try {
      const response = await axios.post(`${getApiBaseUrl()}/auth/resend-verification`, {}, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        toast.success('Verification code sent! Please check your email.');
        setShowVerificationInput(true);
        setVerificationCodes(['', '', '', '', '', '']);
        // Focus first input after a short delay
        setTimeout(() => {
          if (verificationInputRefs.current[0]) {
            verificationInputRefs.current[0].focus();
          }
        }, 100);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to send verification code');
    } finally {
      setIsResendingVerification(false);
    }
  };

  const handleVerificationCodeChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    const newCodes = [...verificationCodes];
    newCodes[index] = value.slice(-1); // Only take the last character
    setVerificationCodes(newCodes);

    // Auto-focus next input
    if (value && index < 5) {
      verificationInputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCodes.every(code => code !== '') && value) {
      handleVerifyCode(newCodes.join(''));
    }
  };

  const handleVerificationKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !verificationCodes[index] && index > 0) {
      verificationInputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerificationPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    
    if (/^\d+$/.test(pastedData)) {
      const newCodes = pastedData.split('').slice(0, 6);
      const updatedCodes = [...verificationCodes];
      
      for (let i = 0; i < 6; i++) {
        updatedCodes[i] = newCodes[i] || '';
      }
      
      setVerificationCodes(updatedCodes);
      
      // Focus the last filled input or submit if all filled
      const lastFilledIndex = updatedCodes.findIndex(code => !code);
      if (lastFilledIndex === -1) {
        handleVerifyCode(updatedCodes.join(''));
      } else {
        verificationInputRefs.current[lastFilledIndex]?.focus();
      }
    }
  };

  const handleVerifyCode = async (code?: string) => {
    const verificationCode = code || verificationCodes.join('');
    
    if (verificationCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    setIsVerifying(true);
    try {
      const response = await axios.post(`${getApiBaseUrl()}/auth/verify-email`, {
        code: verificationCode,
        email: user?.email
      }, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        toast.success('Email verified successfully!');
        
        // Update user in store
        try {
          const userResponse = await axios.get(`${getApiBaseUrl()}/auth/me`, {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          });
          if (userResponse.data.success) {
            setUser(userResponse.data.data.user);
            setShowVerificationInput(false);
            setVerificationCodes(['', '', '', '', '', '']);
          }
        } catch (e) {
          console.error('Failed to update user:', e);
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid verification code');
      // Clear codes on error
      setVerificationCodes(['', '', '', '', '', '']);
      verificationInputRefs.current[0]?.focus();
    } finally {
      setIsVerifying(false);
    }
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
          </div>

          {/* Email Verification Status */}
          <div className="mt-4 sm:mt-6 p-3 sm:p-4 rounded-lg" style={{ 
            backgroundColor: user?.isEmailVerified ? 'rgba(0, 200, 83, 0.1)' : 'rgba(255, 152, 0, 0.1)',
            border: `1px solid ${user?.isEmailVerified ? '#00C853' : '#FF9800'}`
          }}>
            <div className="flex items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3">
              <div className="flex items-start sm:items-center gap-3 flex-1">
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0`} style={{ 
                  backgroundColor: user?.isEmailVerified ? '#00C853' : '#FF9800' 
                }}>
                  {user?.isEmailVerified ? (
                    <Check className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  ) : (
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold casino-text-primary text-sm sm:text-base mb-1">
                    {user?.isEmailVerified ? 'Email Verified' : 'Email Not Verified'}
                  </p>
                  <p className="text-xs sm:text-sm casino-text-secondary">
                    {user?.isEmailVerified 
                      ? 'Your email address has been verified successfully.' 
                      : 'Please verify your email address to secure your account and access all features.'}
                  </p>
                </div>
              </div>
              {!user?.isEmailVerified && (
                <button
                  onClick={handleResendVerification}
                  disabled={isResendingVerification}
                  className="btn-casino-primary px-3 sm:px-4 py-2 rounded-lg transition-colors text-xs sm:text-sm flex items-center gap-2 flex-shrink-0 disabled:opacity-50"
                >
                  <Send className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>{isResendingVerification ? 'Sending...' : 'Resend Code'}</span>
                </button>
              )}
            </div>

            {/* Verification Code Input - Only show if not verified */}
            {!user?.isEmailVerified && (showVerificationInput || verificationCodes.some(code => code !== '')) && (
              <div className="mt-4 pt-4 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
                <label className="block text-sm font-medium casino-text-secondary mb-3">
                  Enter Verification Code
                </label>
                <div className="flex justify-center gap-2 sm:gap-3 mb-4">
                  {verificationCodes.map((code, index) => (
                    <input
                      key={index}
                      ref={(el) => { verificationInputRefs.current[index] = el; }}
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={code}
                      onChange={(e) => handleVerificationCodeChange(index, e.target.value)}
                      onKeyDown={(e) => handleVerificationKeyDown(index, e)}
                      onPaste={index === 0 ? handleVerificationPaste : undefined}
                      disabled={isVerifying}
                      className="w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold casino-bg-primary casino-border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 casino-text-primary disabled:opacity-50"
                    />
                  ))}
                </div>
                <button
                  onClick={() => handleVerifyCode()}
                  disabled={isVerifying || verificationCodes.some(code => !code)}
                  className="btn-casino-primary w-full sm:w-auto px-4 py-2 rounded-lg transition-colors text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    'Verify Email'
                  )}
                </button>
                {showVerificationInput && (
                  <button
                    onClick={() => {
                      setShowVerificationInput(false);
                      setVerificationCodes(['', '', '', '', '', '']);
                    }}
                    className="mt-2 text-xs casino-text-secondary hover:casino-text-primary transition-colors"
                  >
                    Cancel
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Achievement Badges */}
        <AchievementBadges />

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
