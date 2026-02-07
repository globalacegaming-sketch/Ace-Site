import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../utils/api';
import toast from 'react-hot-toast';
import { useMusic } from '../contexts/MusicContext';

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rememberMe, setRememberMe] = useState(false);
  const navigate = useNavigate();
  const { login, setLastRechargeStatus } = useAuthStore();
  const { stopMusic, startMusic } = useMusic();

  // Stop music on login page
  useEffect(() => {
    stopMusic();
  }, [stopMusic]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    mode: 'onSubmit',
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    // Validate form data
    if (!data.email || !data.password) {
      setError('Please fill in all fields');
      setIsLoading(false);
      return;
    }
    
    // Check email format manually
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email.trim())) {
      setError('Please enter a valid email address');
      setIsLoading(false);
      return;
    }
    
    if (data.password.length < 6) {
      setError('Password must be at least 6 characters');
      setIsLoading(false);
      return;
    }

    try {
      // Call the backend API for authentication
      const API_BASE_URL = getApiBaseUrl();
      
      // credentials: 'include' tells the browser to accept and store the
      // session cookie returned by the server (httpOnly, secure).
      // This cookie is then sent automatically with every subsequent request
      // and Socket.io handshake, enabling shared session auth.
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          email: data.email,
          password: data.password,
          rememberMe,
        }),
      });

      const result = await response.json();

      // Check if user is banned (403 status)
      if (response.status === 403 && result.message) {
        setError(result.message);
        toast.error(result.message);
        setIsLoading(false);
        return;
      }

      if (result.success) {
        // Login successful
        const userSession = {
          user: {
            id: result.data.user.id,
            username: result.data.user.username || data.email.split('@')[0],
            email: result.data.user.email,
            firstName: result.data.user.firstName || data.email.split('@')[0],
            lastName: result.data.user.lastName || '',
            phone: result.data.user.phone || '',
            dateOfBirth: result.data.user.dateOfBirth || '',
            country: result.data.user.country || '',
            currency: result.data.user.currency || 'USD',
            isEmailVerified: result.data.user.isEmailVerified || false,
            isPhoneVerified: result.data.user.isPhoneVerified || false,
            isActive: result.data.user.isActive || true,
            role: result.data.user.role || 'user',
            lastLogin: result.data.user.lastLogin || new Date().toISOString(),
            fortunePandaUsername: result.data.user.fortunePandaUsername || data.email,
            fortunePandaPassword: result.data.user.fortunePandaPassword || '',
            fortunePandaBalance: result.data.user.fortunePandaBalance || 0,
            fortunePandaLastSync: result.data.user.fortunePandaLastSync || new Date().toISOString(),
            referralCode: result.data.user.referralCode || '',
            referredBy: result.data.user.referredBy || '',
            createdAt: result.data.user.createdAt || new Date().toISOString(),
            updatedAt: result.data.user.updatedAt || new Date().toISOString(),
          },
          token: result.data.accessToken,
          expires_at: result.data.expiresAt,
        };

        login(userSession);
        
        // Set last recharge status
        setLastRechargeStatus('success');

        // Start music after successful login
        startMusic();

        toast.success('Login successful! Welcome back!');
        navigate('/dashboard');
      } else {
        // Login failed
        setError(result.message || 'Invalid credentials. Please try again.');
        toast.error(result.message || 'Login failed');
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Login failed';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen casino-bg-primary relative overflow-hidden pt-16 lg:pt-16">
      {/* Casino-themed background elements */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>

      {/* Full screen layout - NO WRAPPERS */}
      <div className="flex h-[calc(100vh-4rem)] lg:h-screen overflow-hidden">
          {/* Left Side - Form */}
          <div className="w-full lg:w-1/2 casino-feature-card py-3 px-4 sm:py-4 sm:px-6 lg:p-12 flex flex-col justify-center relative overflow-hidden">
            {/* Casino decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full -translate-y-20 translate-x-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full translate-y-16 -translate-x-16"></div>
            <div className="absolute top-1/2 right-0 w-24 h-24 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full -translate-y-1/2 translate-x-12"></div>
            
            <div className="relative z-10 w-full max-h-full overflow-y-auto">
              <div className="text-center mb-4 sm:mb-5 lg:mb-8">
                <div className="inline-flex items-center justify-center w-16 h-16 sm:w-18 sm:h-18 lg:w-16 lg:h-16 mb-2 sm:mb-3 lg:mb-4">
                  <img 
                    src="/logo.png" 
                    alt="Global Ace Gaming" 
                    className="w-full h-full object-contain"
                  />
                </div>
                <h1 className="text-xl sm:text-2xl lg:text-4xl font-bold casino-text-primary mb-1 sm:mb-2 lg:mb-2">Welcome Back!</h1>
                <p className="casino-text-secondary text-xs sm:text-sm lg:text-lg">Sign in to continue your gaming journey</p>
              </div>
              
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-3 sm:space-y-4 lg:space-y-6" noValidate>
            <div>
                  <label htmlFor="email" className="block text-sm font-medium casino-text-primary mb-1.5 sm:mb-2">
                Email Address
              </label>
                  <div className="relative">
              <input
                      {...register('email', { required: 'Email is required' })}
                type="email"
                id="email"
                      className={`px-3 py-2.5 sm:px-3 sm:py-3 lg:px-4 lg:py-4 w-full rounded-lg border transition-all duration-300 text-sm sm:text-base ${
                        errors.email ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:border-yellow-400 focus:ring-yellow-400'
                      }`}
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#000000',
                      }}
                placeholder="Enter your email"
              />
                  </div>
              {errors.email && (
                    <p className="mt-1.5 text-xs sm:text-sm text-red-300 flex items-center">
                      <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
                  <label htmlFor="password" className="block text-sm font-medium casino-text-primary mb-1.5 sm:mb-2">
                Password
              </label>
              <div className="relative">
                <input
                      {...register('password', { required: 'Password is required' })}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                      className={`px-3 py-2.5 sm:px-3 sm:py-3 lg:px-4 lg:py-4 pr-9 sm:pr-10 lg:pr-12 w-full rounded-lg border transition-all duration-300 text-sm sm:text-base ${
                        errors.password ? 'border-red-400 focus:ring-red-400' : 'border-gray-300 focus:border-yellow-400 focus:ring-yellow-400'
                  }`}
                      style={{
                        backgroundColor: '#FFFFFF',
                        color: '#000000',
                      }}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                      className="absolute inset-y-0 right-0 pr-3 sm:pr-3 lg:pr-4 flex items-center hover:bg-yellow-400/20 rounded-r-lg transition-colors duration-200"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                        <EyeOff className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 casino-text-secondary" />
                  ) : (
                        <Eye className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 casino-text-secondary" />
                  )}
                </button>
              </div>
              {errors.password && (
                    <p className="mt-1.5 text-xs sm:text-sm text-red-300 flex items-center">
                      <AlertCircle className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5 sm:mr-2" />
                  {errors.password.message}
                </p>
              )}
            </div>

                <div className="flex justify-between items-center pt-1">
                  <label className="flex items-center cursor-pointer touch-manipulation">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="w-4 h-4 text-yellow-400 bg-casino-bg-secondary border-casino-border rounded focus:ring-yellow-400 focus:ring-2"
                    />
                    <span className="ml-2 text-sm casino-text-secondary">Remember me</span>
                  </label>
                </div>

                {error && (
                  <div className="status-error-casino rounded-xl lg:rounded-2xl p-3 lg:p-4">
                    <div className="flex items-center">
                      <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5 text-red-300 mr-2 lg:mr-3" />
                      <p className="text-xs lg:text-sm text-red-200">{error}</p>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="btn-casino-primary w-full py-2.5 sm:py-3 lg:py-4 px-4 sm:px-6 rounded-xl lg:rounded-2xl flex items-center justify-center space-x-2 lg:space-x-3 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base mt-1"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 border-2 border-black border-t-transparent"></div>
                      <span>Signing in...</span>
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4 sm:w-4 sm:h-4 lg:w-5 lg:h-5" />
                      <span>Sign In</span>
                    </>
                  )}
                </button>
          </form>

              <div className="mt-3 sm:mt-4 text-center">
                <Link
                  to="/forgot-password"
                  className="text-xs sm:text-sm casino-text-secondary hover:casino-text-primary transition-colors duration-200 underline"
                >
                  Forgot your password?
                </Link>
              </div>

              <div className="mt-3 sm:mt-4 lg:mt-8 text-center">
                <p className="casino-text-secondary text-sm lg:text-base">
                  Don't have an account?{' '}
                  <Link
                    to="/register"
                    className="font-semibold casino-text-primary hover:text-yellow-400 transition-colors duration-200 underline decoration-2 underline-offset-4"
                  >
                    Create one now
                  </Link>
                </p>
              </div>
            </div>
          </div>

          {/* Right Side - Casino Branding (Hidden on mobile) */}
          <div className="hidden lg:flex w-1/2 casino-bg-primary relative overflow-hidden">
            <div className="absolute inset-0">
              <div className="w-full h-full bg-gradient-to-br from-yellow-400/20 via-yellow-600/20 to-orange-500/20 flex items-center justify-center">
                <div className="text-center">
                  <div className="w-32 h-32 flex items-center justify-center mb-8 transform rotate-3 hover:rotate-0 transition-transform duration-500 mx-auto">
                    <img 
                      src="/logo.png" 
                      alt="Global Ace Gaming" 
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <h2 className="text-4xl font-bold casino-text-primary mb-4">Global Ace Gaming</h2>
                  <p className="casino-text-secondary text-xl mb-8">Your ultimate gaming destination</p>
                  
                  {/* Casino feature highlights */}
                  <div className="space-y-4 text-left max-w-sm mx-auto">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="casino-text-secondary">Premium gaming experience</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="casino-text-secondary">24/7 customer support</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="casino-text-secondary">Secure & reliable platform</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
  );
};

export default Login;
