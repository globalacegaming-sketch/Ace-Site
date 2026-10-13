import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, Loader2, Lock, User } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../../utils/api';
import { useMusic } from '../../contexts/MusicContext';
import { AuthHeroBg } from '../../components/auth/AuthHeroBg';
import { shouldAuthAutoFocus } from '../../utils/authMobile';

const AceagentLogin: React.FC = () => {
  const [agentName, setAgentName] = useState('');
  const [agentPassword, setAgentPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const API_BASE_URL = getApiBaseUrl();
  const { stopMusic } = useMusic();

  useEffect(() => {
    stopMusic();
  }, [stopMusic]);

  useEffect(() => {
    const session = localStorage.getItem('admin_session');
    if (session) {
      try {
        const parsedSession = JSON.parse(session);
        if (parsedSession.expiresAt && Date.now() < parsedSession.expiresAt) {
          navigate('/aceagent', { replace: true });
          return;
        }
        localStorage.removeItem('admin_session');
      } catch {
        localStorage.removeItem('admin_session');
      }
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!agentName.trim() || !agentPassword) {
      toast.error('Please enter your username and password');
      return;
    }

    try {
      setLoading(true);

      const response = await axios.post(`${API_BASE_URL}/admin/login`, {
        agentName: agentName.trim(),
        agentPassword,
      });

      if (response.data.success) {
        const adminSession = {
          token: response.data.data.token,
          expiresAt: response.data.data.expiresAt,
          agentName: response.data.data.agentName,
          agentBalance: response.data.data.agentBalance || '0.00',
          role: response.data.data.role || 'agent',
          permissions: response.data.data.permissions || ['chat', 'users', 'verification', 'referrals'],
        };
        localStorage.setItem('admin_session', JSON.stringify(adminSession));
        toast.success('Signed in');
        navigate('/aceagent');
      } else {
        toast.error(response.data.message || 'Login failed');
      }
    } catch (error: unknown) {
      const axiosError = axios.isAxiosError(error) ? error : null;
      const errorMessage =
        axiosError?.response?.data?.message ||
        (error instanceof Error ? error.message : '') ||
        'Login failed. Please check your credentials.';
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const fieldClass =
    'w-full min-h-[48px] rounded-xl border bg-black/30 px-4 text-base text-[color:var(--casino-text-primary)] placeholder:text-white/35 outline-none transition focus:ring-2 focus:ring-[color:var(--casino-highlight-gold)]';

  return (
    <div className="relative flex min-h-[100dvh] w-full flex-col overflow-x-clip">
      <AuthHeroBg />

      <div
        className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:flex-row lg:items-center lg:gap-16 lg:px-10 lg:py-12"
        style={{
          paddingTop: 'max(2rem, env(safe-area-inset-top))',
          paddingBottom: 'max(2rem, env(safe-area-inset-bottom))',
        }}
      >
        <aside className="mb-10 hidden max-w-md flex-1 flex-col lg:flex">
          <div className="mb-8 flex items-center gap-3">
            <img src="/logo.png" alt="" className="h-14 w-14 object-contain" width={56} height={56} />
            <div>
              <p className="text-xl font-extrabold tracking-tight" style={{ color: 'var(--casino-highlight-gold)' }}>
                Global Ace Gaming
              </p>
              <p className="text-sm" style={{ color: 'var(--casino-text-secondary)' }}>
                Here for our members
              </p>
            </div>
          </div>
          <p className="text-3xl font-bold leading-snug" style={{ color: 'var(--casino-text-primary)' }}>
            Ready to start with{' '}
            <span style={{ color: 'var(--casino-highlight-gold)' }}>fellow members.</span>
          </p>
          <ul className="mt-8 space-y-3 text-sm leading-relaxed" style={{ color: 'var(--casino-text-secondary)' }}>
            <li>Be someone they can trust.</li>
            <li>Be helpful when they need a hand.</li>
            <li>Treat every member like someone you know.</li>
          </ul>
        </aside>

        <div className="mx-auto w-full max-w-md lg:mx-0">
          <div className="mb-6 flex flex-col items-center text-center lg:mb-8 lg:items-start lg:text-left">
            <img
              src="/logo.png"
              alt="Global Ace Gaming"
              className="mb-4 h-14 w-14 object-contain lg:hidden"
              width={56}
              height={56}
            />
            <h1 className="text-3xl font-bold tracking-tight sm:text-4xl" style={{ color: 'var(--casino-text-primary)' }}>
              Login
            </h1>
            <p className="mt-2 text-sm sm:text-base" style={{ color: 'rgba(245, 245, 245, 0.72)' }}>
              Ready to help fellow members.
            </p>
          </div>

          <form
            onSubmit={handleLogin}
            className="rounded-2xl border border-white/12 bg-black/40 p-5 shadow-[0_24px_70px_rgba(0,0,0,0.45)] backdrop-blur-xl sm:rounded-3xl sm:p-7"
            noValidate
          >
            <div className="flex flex-col gap-5">
              <div>
                <label
                  htmlFor="staff-username"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--casino-text-secondary)' }}
                >
                  <User className="h-4 w-4" aria-hidden />
                  Username
                </label>
                <input
                  id="staff-username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  enterKeyHint="next"
                  value={agentName}
                  onChange={(e) => setAgentName(e.target.value)}
                  placeholder="Username"
                  className={fieldClass}
                  style={{ borderColor: 'rgba(255, 255, 255, 0.14)' }}
                  autoFocus={shouldAuthAutoFocus()}
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  required
                />
              </div>

              <div>
                <label
                  htmlFor="staff-password"
                  className="mb-2 flex items-center gap-2 text-sm font-semibold"
                  style={{ color: 'var(--casino-text-secondary)' }}
                >
                  <Lock className="h-4 w-4" aria-hidden />
                  Password
                </label>
                <div className="relative">
                  <input
                    id="staff-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    enterKeyHint="done"
                    value={agentPassword}
                    onChange={(e) => setAgentPassword(e.target.value)}
                    placeholder="Password"
                    className={`${fieldClass} pr-12`}
                    style={{ borderColor: 'rgba(255, 255, 255, 0.14)' }}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-1 top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-lg text-white/60 hover:text-white"
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-casino-primary mt-1 inline-flex min-h-[48px] w-full items-center justify-center gap-2 rounded-xl text-base font-bold disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  'Login'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AceagentLogin;
