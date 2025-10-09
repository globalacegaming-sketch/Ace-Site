import { useState } from 'react';
import { 
  Shield, 
  Eye, 
  EyeOff, 
  Save, 
  Bell, 
  Globe, 
  Moon, 
  Sun,
  Lock,
  User,
  Calendar,
  Music,
  Play,
  Pause
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useMusic } from '../contexts/MusicContext';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import toast from 'react-hot-toast';

const Settings = () => {
  const { user } = useAuthStore();
  const { 
    enabled: musicEnabled, 
    volume: musicVolume, 
    currentTrack: musicCurrentTrack, 
    isPlaying: musicIsPlaying,
    setEnabled: setMusicEnabled,
    setVolume: setMusicVolume,
    setCurrentTrack: setMusicCurrentTrack,
    togglePlayPause: toggleMusicPlayPause
  } = useMusic();
  const [isLoading, setIsLoading] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Password change form
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Notification settings
  const [notificationSettings, setNotificationSettings] = useState({
    emailNotifications: true,
    pushNotifications: true,
    gameUpdates: true,
    promotions: false
  });

  // Theme settings
  const [themeSettings, setThemeSettings] = useState({
    theme: 'dark',
    language: 'en'
  });

  // Music tracks
  const musicTracks = [
    { id: 0, name: 'Casino Ambience', file: '/music/casino-ambience.mp3' },
    { id: 1, name: 'Jazz Lounge', file: '/music/jazz-lounge.mp3' },
    { id: 2, name: 'Electronic Vibes', file: '/music/electronic-vibes.mp3' },
    { id: 3, name: 'Classical Elegance', file: '/music/classical-elegance.mp3' },
    { id: 4, name: 'Modern Casino', file: '/music/modern-casino.mp3' }
  ];

  // Music control functions
  const handleMusicToggle = () => {
    setMusicEnabled(!musicEnabled);
  };

  const handleVolumeChange = (volume: number) => {
    setMusicVolume(volume);
  };

  const handleTrackChange = (trackId: number) => {
    setMusicCurrentTrack(trackId);
  };

  const handlePlayPause = () => {
    toggleMusicPlayPause();
  };

  const handlePasswordChange = async () => {
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    if (passwordData.newPassword.length < 6) {
      toast.error('New password must be at least 6 characters long');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.put(`${getApiBaseUrl()}/user/password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, {
        headers: {
          'Authorization': `Bearer ${useAuthStore.getState().token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.data.success) {
        setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
        toast.success('Password changed successfully!');
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to change password');
    } finally {
      setIsLoading(false);
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
      
      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold casino-text-primary mb-8">⚙️ Settings</h1>

        {/* Audio element is handled by MusicContext */}

        <div className="space-y-6">
          {/* Music Settings */}
          <div className="casino-bg-secondary rounded-2xl p-8 casino-border shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <Music className="w-6 h-6" style={{ color: '#FFD700' }} />
              <h2 className="text-xl font-semibold casino-text-primary">Music</h2>
            </div>
            
            <div className="space-y-6">
              {/* Music Toggle */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium casino-text-primary">Background Music</h3>
                  <p className="text-sm casino-text-secondary">Enable background music</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={musicEnabled}
                    onChange={handleMusicToggle}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>

              {/* Music Tracks */}
              <div>
                <h3 className="font-medium casino-text-primary mb-4">Select Track</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {musicTracks.map((track) => (
                    <button
                      key={track.id}
                      onClick={() => handleTrackChange(track.id)}
                      className={`p-3 rounded-lg border-2 transition-all duration-300 ${
                        musicCurrentTrack === track.id
                          ? 'border-yellow-400 bg-yellow-400 bg-opacity-10'
                          : 'casino-border hover:border-yellow-400'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="casino-text-primary font-medium">{track.name}</span>
                        {musicCurrentTrack === track.id && (
                          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#FFD700' }}></div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Play/Pause Controls */}
              <div className="flex items-center space-x-4">
                <button
                  onClick={handlePlayPause}
                  disabled={!musicEnabled}
                  className="btn-casino-primary p-3 rounded-lg disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {musicIsPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
                </button>
                <div className="flex-1">
                  <p className="text-sm casino-text-secondary mb-2">Volume</p>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={musicVolume}
                    onChange={(e) => handleVolumeChange(parseFloat(e.target.value))}
                    disabled={!musicEnabled}
                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer slider"
                    style={{
                      background: `linear-gradient(to right, #FFD700 0%, #FFD700 ${musicVolume * 100}%, #2C2C3A ${musicVolume * 100}%, #2C2C3A 100%)`
                    }}
                  />
                </div>
                <div className="text-sm casino-text-secondary">
                  {Math.round(musicVolume * 100)}%
                </div>
              </div>
            </div>
          </div>

          {/* Security Settings */}
          <div className="casino-bg-secondary rounded-2xl p-8 casino-border shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <Shield className="w-6 h-6" style={{ color: '#00B0FF' }} />
              <h2 className="text-xl font-semibold casino-text-primary">Security</h2>
            </div>
            
            <div className="max-w-md space-y-6">
              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Current Password</label>
                <div className="relative">
                  <input
                    type={showCurrentPassword ? 'text' : 'password'}
                    value={passwordData.currentPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, currentPassword: e.target.value })}
                    className="input-casino w-full px-4 py-3 rounded-lg pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 casino-text-secondary hover:casino-text-primary"
                  >
                    {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">New Password</label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={passwordData.newPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, newPassword: e.target.value })}
                    className="input-casino w-full px-4 py-3 rounded-lg pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 casino-text-secondary hover:casino-text-primary"
                  >
                    {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Confirm New Password</label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    className="input-casino w-full px-4 py-3 rounded-lg pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 casino-text-secondary hover:casino-text-primary"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                onClick={handlePasswordChange}
                disabled={isLoading || !passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword}
                className="btn-casino-primary w-full font-medium py-3 px-6 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
              >
                <Save className="w-4 h-4" />
                <span>{isLoading ? 'Changing Password...' : 'Change Password'}</span>
              </button>
            </div>
          </div>

          {/* Notification Settings */}
          <div className="casino-bg-secondary rounded-2xl p-8 casino-border shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <Bell className="w-6 h-6" style={{ color: '#00C853' }} />
              <h2 className="text-xl font-semibold casino-text-primary">Notifications</h2>
            </div>
            
            <div className="space-y-4">
              <div className="flex items-center justify-between">
              <div>
                  <h3 className="font-medium casino-text-primary">Email Notifications</h3>
                  <p className="text-sm casino-text-secondary">Receive updates via email</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.emailNotifications}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, emailNotifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
              <div>
                  <h3 className="font-medium casino-text-primary">Push Notifications</h3>
                  <p className="text-sm casino-text-secondary">Receive push notifications</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.pushNotifications}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, pushNotifications: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
              <div>
                  <h3 className="font-medium casino-text-primary">Game Updates</h3>
                  <p className="text-sm casino-text-secondary">Get notified about new games and features</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.gameUpdates}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, gameUpdates: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>

              <div className="flex items-center justify-between">
              <div>
                  <h3 className="font-medium casino-text-primary">Promotions</h3>
                  <p className="text-sm casino-text-secondary">Receive promotional offers and bonuses</p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={notificationSettings.promotions}
                    onChange={(e) => setNotificationSettings({ ...notificationSettings, promotions: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-yellow-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-yellow-500"></div>
                </label>
              </div>
            </div>
              </div>

          {/* Appearance Settings */}
          <div className="casino-bg-secondary rounded-2xl p-8 casino-border shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <Globe className="w-6 h-6" style={{ color: '#6A1B9A' }} />
              <h2 className="text-xl font-semibold casino-text-primary">Appearance</h2>
              </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Theme</label>
                <div className="flex space-x-2">
                  <button
                    onClick={() => setThemeSettings({ ...themeSettings, theme: 'light' })}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                      themeSettings.theme === 'light' 
                        ? 'border-yellow-400 bg-yellow-400 bg-opacity-10 casino-text-primary' 
                        : 'casino-border casino-text-secondary hover:casino-text-primary'
                    }`}
                  >
                    <Sun className="w-4 h-4" />
                    <span>Light</span>
                  </button>
                  <button
                    onClick={() => setThemeSettings({ ...themeSettings, theme: 'dark' })}
                    className={`flex items-center space-x-2 px-4 py-2 rounded-lg border transition-colors ${
                      themeSettings.theme === 'dark' 
                        ? 'border-yellow-400 bg-yellow-400 bg-opacity-10 casino-text-primary' 
                        : 'casino-border casino-text-secondary hover:casino-text-primary'
                    }`}
                  >
                    <Moon className="w-4 h-4" />
                    <span>Dark</span>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium casino-text-secondary mb-2">Language</label>
                <select
                  value={themeSettings.language}
                  onChange={(e) => setThemeSettings({ ...themeSettings, language: e.target.value })}
                  className="input-casino w-full px-4 py-3 rounded-lg"
                >
                  <option value="en">English</option>
                  <option value="es">Spanish</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                </select>
              </div>
            </div>
          </div>

          {/* Account Information */}
          <div className="casino-bg-secondary rounded-2xl p-8 casino-border shadow-lg">
            <div className="flex items-center space-x-3 mb-6">
              <User className="w-6 h-6 casino-text-secondary" />
              <h2 className="text-xl font-semibold casino-text-primary">Account Information</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="flex items-center space-x-3">
                <Lock className="w-5 h-5 casino-text-secondary" />
                <div>
                  <p className="text-sm casino-text-secondary">Account Status</p>
                  <p className="font-medium" style={{ color: '#00C853' }}>Active</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <Calendar className="w-5 h-5 casino-text-secondary" />
                <div>
                  <p className="text-sm casino-text-secondary">Member Since</p>
                  <p className="font-medium casino-text-primary">
                    {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;
