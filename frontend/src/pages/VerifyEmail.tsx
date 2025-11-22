import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CheckCircle, XCircle, Loader2, ArrowLeft } from 'lucide-react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';

const VerifyEmail = () => {
  const [searchParams] = useSearchParams();
  const { setUser } = useAuthStore();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(true);
  const [isVerified, setIsVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError('Invalid verification link');
      setIsLoading(false);
      return;
    }

    const verifyEmail = async () => {
      try {
        const response = await axios.post(`${getApiBaseUrl()}/auth/verify-email`, { token });

        if (response.data.success) {
          setIsVerified(true);
          toast.success('Email verified successfully!');
          
          // Update user in store if logged in
          try {
            const userResponse = await axios.get(`${getApiBaseUrl()}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${useAuthStore.getState().token}`
              }
            });
            if (userResponse.data.success) {
              setUser(userResponse.data.data.user);
            }
          } catch (e) {
            // User might not be logged in, that's okay
          }
        }
      } catch (error: any) {
        setError(error.response?.data?.message || 'Failed to verify email');
        toast.error(error.response?.data?.message || 'Failed to verify email');
      } finally {
        setIsLoading(false);
      }
    };

    verifyEmail();
  }, [token, setUser]);

  return (
    <div className="min-h-screen casino-bg-primary relative overflow-hidden pt-16 flex items-center justify-center">
      {/* Casino-themed background elements */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="casino-bg-secondary rounded-2xl shadow-2xl p-8 casino-border">
          <div className="text-center">
            {isLoading ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full mb-4">
                  <Loader2 className="w-8 h-8 text-black animate-spin" />
                </div>
                <h1 className="text-2xl font-bold casino-text-primary mb-2">Verifying Email...</h1>
                <p className="casino-text-secondary">Please wait while we verify your email address</p>
              </>
            ) : isVerified ? (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-400 to-green-600 rounded-full mb-4">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold casino-text-primary mb-2">Email Verified!</h1>
                <p className="casino-text-secondary mb-6">
                  Your email address has been successfully verified. You can now access all features of your account.
                </p>
                <Link
                  to="/dashboard"
                  className="btn-casino-primary px-6 py-3 rounded-lg font-semibold inline-block"
                >
                  Go to Dashboard
                </Link>
              </>
            ) : (
              <>
                <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-red-400 to-red-600 rounded-full mb-4">
                  <XCircle className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-bold casino-text-primary mb-2">Verification Failed</h1>
                <p className="casino-text-secondary mb-6">
                  {error || 'The verification link is invalid or has expired. Please request a new verification email.'}
                </p>
                <div className="space-y-3">
                  <Link
                    to="/profile"
                    className="btn-casino-primary px-6 py-3 rounded-lg font-semibold inline-block w-full text-center"
                  >
                    Go to Profile
                  </Link>
                  <Link
                    to="/login"
                    className="inline-flex items-center gap-2 text-sm casino-text-secondary hover:casino-text-primary transition-colors justify-center w-full"
                  >
                    <ArrowLeft className="w-4 h-4" />
                    Back to Login
                  </Link>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyEmail;

