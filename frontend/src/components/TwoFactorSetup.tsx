import { useState, useCallback, useEffect } from 'react';
import { Shield, Copy, Check, Loader2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

interface TwoFAState {
  enabled: boolean;
  qrDataUrl: string | null;
  secret: string | null;
  backupCodes: string[] | null;
}

/**
 * Two-Factor Authentication setup component for Settings page.
 * Communicates with:
 *   POST /api/user/2fa/setup   → returns { qrDataUrl, secret, backupCodes }
 *   POST /api/user/2fa/verify  → verifies TOTP and enables 2FA
 *   POST /api/user/2fa/disable → disables 2FA
 */
export default function TwoFactorSetup() {
  const token = useAuthStore.getState().token;
  const headers = { Authorization: `Bearer ${token}` };

  const [state, setState] = useState<TwoFAState>({
    enabled: false,
    qrDataUrl: null,
    secret: null,
    backupCodes: null,
  });
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupStarted, setSetupStarted] = useState(false);
  const [copied, setCopied] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);

  // Check if 2FA is already enabled on mount
  useEffect(() => {
    (async () => {
      try {
        const res = await axios.get(`${getApiBaseUrl()}/user/profile`, { headers });
        if (res.data.success && res.data.data?.user?.twoFactorEnabled) {
          setState((s) => ({ ...s, enabled: true }));
        }
      } catch { /* ignore */ }
      setInitialLoading(false);
    })();
  }, []);

  // Start 2FA setup — backend generates TOTP secret + QR
  const handleSetup = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${getApiBaseUrl()}/user/2fa/setup`, {}, { headers });
      if (res.data.success) {
        setState((s) => ({
          ...s,
          qrDataUrl: res.data.data.qrDataUrl,
          secret: res.data.data.secret,
          backupCodes: res.data.data.backupCodes || null,
        }));
        setSetupStarted(true);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start 2FA setup');
    } finally {
      setLoading(false);
    }
  }, []);

  // Verify OTP and finalize 2FA
  const handleVerify = useCallback(async () => {
    if (otp.length !== 6) {
      toast.error('Enter a 6-digit code');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${getApiBaseUrl()}/user/2fa/verify`, { token: otp }, { headers });
      if (res.data.success) {
        setState((s) => ({
          ...s,
          enabled: true,
          backupCodes: res.data.data?.backupCodes || s.backupCodes,
        }));
        toast.success('Two-factor authentication enabled!');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid code');
    } finally {
      setLoading(false);
    }
  }, [otp]);

  // Disable 2FA
  const handleDisable = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${getApiBaseUrl()}/user/2fa/disable`, {}, { headers });
      if (res.data.success) {
        setState({ enabled: false, qrDataUrl: null, secret: null, backupCodes: null });
        setSetupStarted(false);
        setOtp('');
        toast.success('Two-factor authentication disabled');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to disable 2FA');
    } finally {
      setLoading(false);
    }
  }, []);

  const copyBackupCodes = useCallback(() => {
    if (state.backupCodes) {
      navigator.clipboard.writeText(state.backupCodes.join('\n')).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  }, [state.backupCodes]);

  if (initialLoading) {
    return (
      <div className="flex items-center gap-3 py-2">
        <Loader2 className="w-4 h-4 animate-spin casino-text-secondary" />
        <span className="text-sm casino-text-secondary">Checking 2FA status...</span>
      </div>
    );
  }

  // ── Already enabled ──
  if (state.enabled) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-green-500" />
          <span className="text-sm font-medium" style={{ color: '#00C853' }}>
            Two-factor authentication is enabled
          </span>
        </div>
        {state.backupCodes && (
          <div className="rounded-lg p-3" style={{ backgroundColor: 'rgba(27, 27, 47, 0.6)', border: '1px solid #2C2C3A' }}>
            <p className="text-xs casino-text-secondary mb-2 font-medium">Backup codes (save these):</p>
            <div className="grid grid-cols-2 gap-1">
              {state.backupCodes.map((c, i) => (
                <code key={i} className="text-xs casino-text-primary font-mono">{c}</code>
              ))}
            </div>
            <button
              onClick={copyBackupCodes}
              className="mt-2 flex items-center gap-1 text-xs casino-text-secondary hover:casino-text-primary transition-colors touch-manipulation"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? 'Copied' : 'Copy all'}
            </button>
          </div>
        )}
        <button
          onClick={handleDisable}
          disabled={loading}
          className="text-sm text-red-400 hover:text-red-300 transition-colors disabled:opacity-50 touch-manipulation"
        >
          {loading ? 'Disabling...' : 'Disable 2FA'}
        </button>
      </div>
    );
  }

  // ── Setup flow ──
  if (setupStarted) {
    return (
      <div className="space-y-4">
        <p className="text-sm casino-text-secondary">
          Scan this QR code with your authenticator app (Google Authenticator, Authy, etc.):
        </p>
        {state.qrDataUrl && (
          <div className="bg-white rounded-lg p-3 inline-block">
            <img src={state.qrDataUrl} alt="2FA QR Code" className="w-48 h-48" />
          </div>
        )}
        {state.secret && (
          <p className="text-xs casino-text-secondary">
            Manual key: <code className="casino-text-primary font-mono text-xs">{state.secret}</code>
          </p>
        )}
        <div>
          <label className="block text-sm casino-text-secondary mb-2">
            Enter the 6-digit code from your app:
          </label>
          <div className="flex gap-2 max-w-xs">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={otp}
              onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
              className="input-casino flex-1 px-4 py-3 rounded-lg text-center font-mono text-lg tracking-widest"
              placeholder="000000"
            />
            <button
              onClick={handleVerify}
              disabled={loading || otp.length !== 6}
              className="btn-casino-primary px-4 py-3 rounded-lg font-medium disabled:opacity-50 touch-manipulation"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Verify'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Not started ──
  return (
    <div className="flex items-center justify-between">
      <div>
        <h3 className="font-medium casino-text-primary">Two-Factor Authentication</h3>
        <p className="text-sm casino-text-secondary">
          Add an extra layer of security with an authenticator app
        </p>
      </div>
      <button
        onClick={handleSetup}
        disabled={loading}
        className="btn-casino-primary px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 touch-manipulation flex items-center gap-2"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Shield className="w-4 h-4" />}
        Enable
      </button>
    </div>
  );
}
