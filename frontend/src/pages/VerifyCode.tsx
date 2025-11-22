import { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Mail, Loader2, ArrowLeft, RefreshCw } from 'lucide-react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';

const VerifyCode = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser, token } = useAuthStore();
  
  // Get email from location state or user store
  const email = (location.state?.email as string) || user?.email || '';
  
  const [codes, setCodes] = useState(['', '', '', '', '', '']);
  const [isLoading, setIsLoading] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    // Focus first input on mount
    if (inputRefs.current[0]) {
      inputRefs.current[0].focus();
    }
  }, []);

  useEffect(() => {
    if (!email) {
      toast.error('Email not found. Please register again.');
      navigate('/register');
    }
  }, [email, navigate]);

  const handleCodeChange = (index: number, value: string) => {
    // Only allow numbers
    if (value && !/^\d+$/.test(value)) {
      return;
    }

    const newCodes = [...codes];
    newCodes[index] = value.slice(-1); // Only take the last character
    setCodes(newCodes);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all 6 digits are entered
    if (newCodes.every(code => code !== '') && value) {
      handleVerify(newCodes.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !codes[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').slice(0, 6);
    
    if (/^\d+$/.test(pastedData)) {
      const newCodes = pastedData.split('').slice(0, 6);
      const updatedCodes = [...codes];
      
      for (let i = 0; i < 6; i++) {
        updatedCodes[i] = newCodes[i] || '';
      }
      
      setCodes(updatedCodes);
      
      // Focus the last filled input or submit if all filled
      const lastFilledIndex = updatedCodes.findIndex(code => !code);
      if (lastFilledIndex === -1) {
        handleVerify(updatedCodes.join(''));
      } else {
        inputRefs.current[lastFilledIndex]?.focus();
      }
    }
  };

  const handleVerify = async (code?: string) => {
    const verificationCode = code || codes.join('');
    
    if (verificationCode.length !== 6) {
      toast.error('Please enter the complete 6-digit code');
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${getApiBaseUrl()}/auth/verify-email`, {
        code: verificationCode,
        email: email
      });

      if (response.data.success) {
        toast.success('Email verified successfully!');
        
        // Update user in store if logged in
        if (token) {
          try {
            const userResponse = await axios.get(`${getApiBaseUrl()}/auth/me`, {
              headers: {
                'Authorization': `Bearer ${token}`
              }
            });
            if (userResponse.data.success) {
              setUser(userResponse.data.data.user);
            }
          } catch (e) {
            // User might not be logged in, that's okay
          }
        }
        
        setTimeout(() => {
          navigate('/dashboard');
        }, 1000);
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Invalid verification code');
      // Clear codes on error
      setCodes(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    setIsResending(true);
    try {
      if (token) {
        // Authenticated user - use resend-verification endpoint
        const response = await axios.post(
          `${getApiBaseUrl()}/auth/resend-verification`,
          {},
          {
            headers: {
              'Authorization': `Bearer ${token}`
            }
          }
        );
        
        if (response.data.success) {
          toast.success('Verification code sent! Please check your email.');
          setCodes(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      } else {
        // Unauthenticated user - use resend-verification-code endpoint
        const response = await axios.post(
          `${getApiBaseUrl()}/auth/resend-verification-code`,
          { email }
        );
        
        if (response.data.success) {
          toast.success('Verification code sent! Please check your email.');
          setCodes(['', '', '', '', '', '']);
          inputRefs.current[0]?.focus();
        }
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to resend code');
    } finally {
      setIsResending(false);
    }
  };

  if (!email) {
    return null;
  }

  return (
    <div className="min-h-screen casino-bg-primary relative overflow-hidden pt-16 flex items-center justify-center">
      {/* Casino-themed background elements */}
      <div className="absolute -top-40 -right-40 w-80 h-80 bg-gradient-to-br from-yellow-400/20 to-yellow-600/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>
      <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-gradient-to-br from-purple-500/20 to-blue-500/20 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-pulse"></div>

      <div className="relative z-10 w-full max-w-md mx-auto px-4">
        <div className="casino-bg-secondary rounded-2xl shadow-2xl p-8 casino-border">
          <div className="text-center mb-6">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-yellow-400 to-yellow-600 rounded-full mb-4">
              <Mail className="w-8 h-8 text-black" />
            </div>
            <h1 className="text-2xl font-bold casino-text-primary mb-2">Verify Your Email</h1>
            <p className="casino-text-secondary text-sm mb-2">
              We've sent a 6-digit verification code to
            </p>
            <p className="font-semibold casino-text-primary">{email}</p>
            <p className="casino-text-secondary text-xs mt-2">
              Please enter the code below
            </p>
          </div>

          <form onSubmit={(e) => { e.preventDefault(); handleVerify(); }} className="space-y-6">
            <div className="flex justify-center gap-2 sm:gap-3">
              {codes.map((code, index) => (
                <input
                  key={index}
                  ref={(el) => { inputRefs.current[index] = el; }}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={code}
                  onChange={(e) => handleCodeChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={index === 0 ? handlePaste : undefined}
                  className="w-12 h-14 sm:w-14 sm:h-16 text-center text-2xl font-bold casino-bg-primary casino-border rounded-lg focus:outline-none focus:ring-2 focus:ring-yellow-400 casino-text-primary"
                  disabled={isLoading}
                />
              ))}
            </div>

            <button
              type="submit"
              disabled={isLoading || codes.some(code => !code)}
              className="btn-casino-primary w-full py-3 rounded-lg font-semibold flex items-center justify-center gap-2 disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Verifying...
                </>
              ) : (
                'Verify Email'
              )}
            </button>
          </form>

          <div className="mt-6 text-center space-y-3">
            <button
              onClick={handleResend}
              disabled={isResending}
              className="text-sm casino-text-secondary hover:casino-text-primary transition-colors flex items-center justify-center gap-2 mx-auto disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isResending ? 'animate-spin' : ''}`} />
              {isResending ? 'Sending...' : "Didn't receive code? Resend"}
            </button>

            <div className="pt-4 border-t casino-border">
              <button
                onClick={() => navigate('/login')}
                className="inline-flex items-center gap-2 text-sm casino-text-secondary hover:casino-text-primary transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                Back to Login
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VerifyCode;

