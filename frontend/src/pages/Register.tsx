import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff, UserPlus, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../utils/api';
import toast from 'react-hot-toast';

const registerSchema = z.object({
  firstName: z.string().min(2),
  lastName: z.string().min(2),
  username: z.string().min(3).max(30),
  email: z.string().email(),
  phoneNumber: z.string().min(10),
  password: z.string().min(6),
  confirmPassword: z.string(),
  referralCode: z.string().optional()
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type RegisterFormData = z.infer<typeof registerSchema>;

const Register = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();
  const { login } = useAuthStore();

  // Error boundary for form rendering
  if (typeof window === 'undefined') {
    return null;
  }

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterFormData) => {
    setIsLoading(true);
    setError(null);

    try {
      const API_BASE_URL = getApiBaseUrl();
      if (!API_BASE_URL) {
        throw new Error('API base URL is not configured');
      }
      
      const response = await fetch(`${API_BASE_URL}/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setSuccess(true);
        toast.success('Account created successfully!');
        login({
          user: result.data.user,
          token: result.data.accessToken,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        });

        if (result.data.fortunePanda) {
          toast.success(
            `Fortune Panda Account Created!\nUsername: ${result.data.fortunePanda.username}\nPassword: ${result.data.fortunePanda.password}`,
            { duration: 10000 }
          );
        }

        setTimeout(() => navigate('/dashboard'), 2000);
      } else {
        setError(result.message || 'Registration failed');
        toast.error(result.message || 'Registration failed');
      }
    } catch {
      const errorMessage = 'Network error. Please try again.';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen casino-bg-primary flex items-center justify-center pt-16">
        <div className="casino-bg-secondary rounded-3xl shadow-xl p-10 text-center max-w-md w-full casino-border">
          <div className="mx-auto w-16 h-16 flex items-center justify-center bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full mb-4 shadow-2xl">
              <CheckCircle className="w-8 h-8 text-black" />
            </div>
          <h2 className="text-3xl font-bold casino-text-primary mb-2">Registration Successful!</h2>
          <p className="casino-text-secondary">
              Your account has been created successfully. Redirecting to dashboard...
            </p>
        </div>
      </div>
    );
  }

  try {
    return (
      <div className="min-h-screen casino-bg-primary relative overflow-hidden pt-16">
      {/* Casino-themed background elements */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>

      {/* Full screen layout - NO WRAPPERS */}
      <div className="flex min-h-screen">
          {/* Left Side - Form */}
          <div className="w-full lg:w-1/2 casino-feature-card p-8 lg:p-12 flex flex-col justify-center relative">
            {/* Casino decorative elements */}
            <div className="absolute top-0 right-0 w-40 h-40 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full -translate-y-20 translate-x-20"></div>
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full translate-y-16 -translate-x-16"></div>
            <div className="absolute top-1/2 right-0 w-24 h-24 bg-gradient-to-br from-yellow-400/20 to-orange-500/20 rounded-full -translate-y-1/2 translate-x-12"></div>

            <div className="relative z-10">
              <div className="text-center mb-6 lg:mb-8">
                <div className="inline-flex items-center justify-center w-12 h-12 lg:w-16 lg:h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-2xl mb-3 lg:mb-4 shadow-2xl">
                  <UserPlus className="w-6 h-6 lg:w-8 lg:h-8 text-black" />
          </div>
                <h1 className="text-2xl lg:text-4xl font-bold casino-text-primary mb-2">Sign Up to Start your gaming journey</h1>
                <p className="casino-text-secondary text-sm lg:text-lg">Create your account and start playing today</p>
      </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 lg:space-y-6" noValidate>
                {/* Name Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                    <label htmlFor="firstName" className="block text-sm font-medium casino-text-primary mb-2">
                      First Name
                </label>
                <input
                  {...register('firstName')}
                  type="text"
                  id="firstName"
                      className={`input-casino px-3 py-3 lg:px-4 lg:py-4 ${
                        errors.firstName ? 'border-red-400 focus:ring-red-400' : ''
                      }`}
                      placeholder="Enter your first name"
                />
                 {errors.firstName && (
                   <p className="mt-2 text-sm text-red-300 flex items-center">
                     <AlertCircle className="w-4 h-4 mr-2" />
                     {errors.firstName?.message || 'Invalid first name'}
                   </p>
                 )}
              </div>
              <div>
                    <label htmlFor="lastName" className="block text-sm font-medium casino-text-primary mb-2">
                      Last Name
                </label>
                <input
                  {...register('lastName')}
                  type="text"
                  id="lastName"
                      className={`input-casino px-3 py-3 lg:px-4 lg:py-4 ${
                        errors.lastName ? 'border-red-400 focus:ring-red-400' : ''
                      }`}
                      placeholder="Enter your last name"
                />
                 {errors.lastName && (
                   <p className="mt-2 text-sm text-red-300 flex items-center">
                     <AlertCircle className="w-4 h-4 mr-2" />
                     {errors.lastName?.message || 'Invalid last name'}
                   </p>
                 )}
              </div>
            </div>

            {/* Username */}
            <div>
                  <label htmlFor="username" className="block text-sm font-medium casino-text-primary mb-2">
                    Username
              </label>
              <input
                {...register('username')}
                type="text"
                id="username"
                    className={`input-casino px-3 py-3 lg:px-4 lg:py-4 ${
                      errors.username ? 'border-red-400 focus:ring-red-400' : ''
                    }`}
                    placeholder="Choose a username"
              />
               {errors.username && (
                 <p className="mt-2 text-sm text-red-300 flex items-center">
                   <AlertCircle className="w-4 h-4 mr-2" />
                   {errors.username?.message || 'Invalid username'}
                 </p>
               )}
            </div>

                {/* Phone */}
                <div>
                  <label htmlFor="phoneNumber" className="block text-sm font-medium casino-text-primary mb-2">
                    Phone Number
                  </label>
                  <input
                    {...register('phoneNumber')}
                    type="tel"
                    id="phoneNumber"
                    className={`input-casino px-3 py-3 lg:px-4 lg:py-4 ${
                      errors.phoneNumber ? 'border-red-400 focus:ring-red-400' : ''
                    }`}
                    placeholder="Enter your phone number"
                  />
                   {errors.phoneNumber && (
                     <p className="mt-2 text-sm text-red-300 flex items-center">
                       <AlertCircle className="w-4 h-4 mr-2" />
                       {errors.phoneNumber?.message || 'Invalid phone number'}
                     </p>
                   )}
                </div>

            {/* Email */}
            <div>
                  <label htmlFor="email" className="block text-sm font-medium casino-text-primary mb-2">
                    Email Address
              </label>
              <input
                {...register('email')}
                type="email"
                id="email"
                    className={`input-casino px-3 py-3 lg:px-4 lg:py-4 ${
                      errors.email ? 'border-red-400 focus:ring-red-400' : ''
                    }`}
                    placeholder="Enter your email address"
              />
               {errors.email && (
                 <p className="mt-2 text-sm text-red-300 flex items-center">
                   <AlertCircle className="w-4 h-4 mr-2" />
                   {errors.email?.message || 'Invalid email address'}
                 </p>
               )}
          </div>

                {/* Password Fields */}
                <div className="grid grid-cols-2 gap-4">
            <div>
                    <label htmlFor="password" className="block text-sm font-medium casino-text-primary mb-2">
                      Password
              </label>
              <div className="relative">
                <input
                  {...register('password')}
                  type={showPassword ? 'text' : 'password'}
                  id="password"
                        className={`input-casino px-3 py-3 lg:px-4 lg:py-4 pr-10 lg:pr-12 ${
                          errors.password ? 'border-red-400 focus:ring-red-400' : ''
                        }`}
                        placeholder="Create a password"
                />
                <button
                  type="button"
                        className="absolute inset-y-0 right-0 pr-3 lg:pr-4 flex items-center hover:bg-yellow-400/20 rounded-r-lg transition-colors duration-200"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                          <EyeOff className="h-4 w-4 lg:h-5 lg:w-5 casino-text-secondary" />
                  ) : (
                          <Eye className="h-4 w-4 lg:h-5 lg:w-5 casino-text-secondary" />
                  )}
                </button>
              </div>
               {errors.password && (
                 <p className="mt-2 text-sm text-red-300 flex items-center">
                   <AlertCircle className="w-4 h-4 mr-2" />
                   {errors.password?.message || 'Invalid password'}
                 </p>
               )}
          </div>
            <div>
                    <label htmlFor="confirmPassword" className="block text-sm font-medium casino-text-primary mb-2">
                      Confirm Password
              </label>
              <div className="relative">
                <input
                  {...register('confirmPassword')}
                  type={showConfirmPassword ? 'text' : 'password'}
                  id="confirmPassword"
                        className={`input-casino px-3 py-3 lg:px-4 lg:py-4 pr-10 lg:pr-12 ${
                          errors.confirmPassword ? 'border-red-400 focus:ring-red-400' : ''
                        }`}
                  placeholder="Confirm your password"
                />
                <button
                  type="button"
                        className="absolute inset-y-0 right-0 pr-3 lg:pr-4 flex items-center hover:bg-yellow-400/20 rounded-r-lg transition-colors duration-200"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4 lg:h-5 lg:w-5 casino-text-secondary" />
                  ) : (
                          <Eye className="h-4 w-4 lg:h-5 lg:w-5 casino-text-secondary" />
                  )}
                </button>
              </div>
               {errors.confirmPassword && (
                 <p className="mt-2 text-sm text-red-300 flex items-center">
                   <AlertCircle className="w-4 h-4 mr-2" />
                   {errors.confirmPassword?.message || 'Passwords do not match'}
                 </p>
               )}
                  </div>
            </div>

                {/* Referral */}
            <div>
                  <label htmlFor="referralCode" className="block text-sm font-medium casino-text-primary mb-2">
                Referral Code (Optional)
              </label>
              <input
                {...register('referralCode')}
                type="text"
                id="referralCode"
                    className="input-casino px-3 py-3 lg:px-4 lg:py-4"
                    placeholder="Enter referral code if you have one"
                  />
            </div>

            {error && (
                  <div className="status-error-casino rounded-xl lg:rounded-2xl p-3 lg:p-4">
                <div className="flex items-center">
                      <AlertCircle className="w-4 h-4 lg:w-5 lg:h-5 text-red-300 mr-2 lg:mr-3" />
                      <p className="text-xs lg:text-sm text-red-200">{error}</p>
                </div>
              </div>
            )}

                {/* Terms */}
                <p className="casino-text-secondary text-xs lg:text-sm text-center">
                  By signing up, you agree to our{' '}
                  <a href="#" className="casino-text-primary hover:text-yellow-400 transition-colors duration-200 underline decoration-2 underline-offset-4">Terms</a>,{' '}
                  <a href="#" className="casino-text-primary hover:text-yellow-400 transition-colors duration-200 underline decoration-2 underline-offset-4">Data Policy</a> and{' '}
                  <a href="#" className="casino-text-primary hover:text-yellow-400 transition-colors duration-200 underline decoration-2 underline-offset-4">Cookie Policy</a>.
                </p>

                {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
                  className="btn-casino-primary w-full py-3 lg:py-4 px-6 rounded-xl lg:rounded-2xl flex items-center justify-center space-x-2 lg:space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <>
                      <div className="animate-spin rounded-full h-4 w-4 lg:h-5 lg:w-5 border-2 border-black border-t-transparent"></div>
                  <span>Creating Account...</span>
                </>
              ) : (
                <>
                      <UserPlus className="w-4 h-4 lg:w-5 lg:h-5" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

              <div className="mt-6 lg:mt-8 text-center">
                <p className="casino-text-secondary text-sm lg:text-base">
              Already have an account?{' '}
              <Link
                to="/login"
                    className="font-semibold casino-text-primary hover:text-yellow-400 transition-colors duration-200 underline decoration-2 underline-offset-4"
              >
                Sign in here
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
                  <div className="w-32 h-32 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-3xl flex items-center justify-center mb-8 shadow-2xl transform rotate-3 hover:rotate-0 transition-transform duration-500 mx-auto">
                    <div className="w-20 h-20 bg-black/20 rounded-2xl flex items-center justify-center backdrop-blur-sm">
                      <UserPlus className="w-10 h-10 text-black" />
                    </div>
                  </div>
                  <h2 className="text-4xl font-bold casino-text-primary mb-4">Global Ace Gaming</h2>
                  <p className="casino-text-secondary text-xl mb-8">Start your gaming adventure today</p>

                  {/* Casino feature highlights */}
                  <div className="space-y-4 text-left max-w-sm mx-auto">
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="casino-text-secondary">Free to play games</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="casino-text-secondary">Instant account setup</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="casino-text-secondary">Premium gaming experience</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <div className="w-2 h-2 bg-yellow-400 rounded-full"></div>
                      <span className="casino-text-secondary">24/7 customer support</span>
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
      </div>
    </div>
  );
  } catch (error) {
    console.error('Register component error:', error);
    return (
      <div className="min-h-screen casino-bg-primary flex items-center justify-center">
        <div className="casino-bg-secondary rounded-3xl shadow-xl p-10 text-center max-w-md w-full casino-border">
          <h2 className="text-2xl font-bold casino-text-primary mb-4">Something went wrong</h2>
          <p className="casino-text-secondary">Please refresh the page and try again.</p>
        </div>
      </div>
    );
  }
};

export default Register;
