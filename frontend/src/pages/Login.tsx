import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, LogIn, AlertCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../utils/api';
import toast from 'react-hot-toast';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

type LoginFormData = z.infer<typeof loginSchema>;

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { login, setLastRechargeStatus } = useAuthStore();

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      // Call the backend API for authentication
      const API_BASE_URL = getApiBaseUrl();
      const response = await fetch(`${API_BASE_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: data.email,
          password: data.password,
        }),
      });

      const result = await response.json();

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
    <div className="min-h-screen flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-full flex items-center justify-center mb-4">
            <LogIn className="w-8 h-8 text-black" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-2">
            Welcome Back
          </h2>
          <p className="text-gray-300">
            Sign in to your Global Ace Gaming account
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-gray-900 bg-opacity-95 backdrop-blur-sm rounded-2xl p-8 border border-gray-700">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white mb-2">
                Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                className={`w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent ${
                  errors.email ? 'border-red-500 focus:ring-red-500' : ''
                }`}
                placeholder="Enter your email"
              />
              {errors.email && (
                <p className="mt-1 text-sm text-red-400 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.email.message}
                </p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                  className={`w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-yellow-400 focus:border-transparent pr-10 ${
                    errors.password ? 'border-red-500 focus:ring-red-500' : ''
                  }`}
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-gray-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-gray-400" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-red-400 flex items-center">
                  <AlertCircle className="w-4 h-4 mr-1" />
                  {errors.password.message}
                </p>
              )}
            </div>

            {error && (
              <div className="bg-red-900 bg-opacity-50 border border-red-500 rounded-lg p-4">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full bg-gradient-to-r from-yellow-400 to-yellow-500 text-black font-bold py-3 px-4 rounded-lg hover:from-yellow-500 hover:to-yellow-600 transition-all duration-300 flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-black"></div>
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-6 text-center">
            <p className="text-sm text-gray-300">
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-medium text-yellow-400 hover:text-yellow-300 transition-colors duration-200"
              >
                Sign up here
              </Link>
            </p>
          </div>

          <div className="mt-6 p-4 bg-blue-900 bg-opacity-50 border border-blue-500 rounded-lg">
            <h4 className="text-sm font-medium text-blue-300 mb-2">New to Global Ace Gaming?</h4>
            <div className="text-xs text-blue-200 space-y-1">
              <p>• Accounts are created automatically on first login</p>
              <p>• No verification required to start playing</p>
              <p>• Access to thousands of games instantly</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
