import { useState, useEffect, useCallback } from 'react';
import { RotateCw, Clock, Sparkles } from 'lucide-react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

interface SpinStatus {
  spinsRemaining: number;
  spinsPerDay: number;
  todaySpins: number;
  nextResetTime: string;
}

export default function DailySpinCTA() {
  const { token } = useAuthStore();
  const [status, setStatus] = useState<SpinStatus | null>(null);
  const [wheelEnabled, setWheelEnabled] = useState<boolean | null>(null);
  const [countdown, setCountdown] = useState('');
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    if (!token) return;
    try {
      // Check wheel config first — if wheel is off, don't show CTA
      const configRes = await axios.get(`${getApiBaseUrl()}/wheel/config`);
      if (configRes.data.success && configRes.data.data) {
        setWheelEnabled(configRes.data.data.isEnabled);
        if (!configRes.data.data.isEnabled) {
          setLoading(false);
          return; // Wheel is off, skip spin-status
        }
      }

      const res = await axios.get(`${getApiBaseUrl()}/wheel/spin-status`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setStatus(res.data.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  // Countdown timer to next reset
  useEffect(() => {
    if (!status?.nextResetTime) return;

    const tick = () => {
      const diff = new Date(status.nextResetTime).getTime() - Date.now();
      if (diff <= 0) {
        setCountdown('Now!');
        fetchStatus(); // Refresh
        return;
      }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${h}h ${m}m ${s}s`);
    };

    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [status?.nextResetTime, fetchStatus]);

  const handleOpenWheel = () => {
    // Find and click the wheel floating button
    const wheelBtn = document.querySelector('[aria-label="Open Wheel of Fortune"]') as HTMLButtonElement;
    if (wheelBtn) wheelBtn.click();
  };

  if (loading) {
    return (
      <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border mb-4 sm:mb-6 animate-pulse">
        <div className="h-20 rounded-lg" style={{ backgroundColor: 'rgba(255,215,0,0.05)' }} />
      </div>
    );
  }

  // Hide entirely when wheel is disabled or config not loaded
  if (wheelEnabled === false || !status) return null;

  const hasSpins = status.spinsRemaining === -1 || status.spinsRemaining > 0;
  const spinsText =
    status.spinsRemaining === -1
      ? 'Unlimited spins available!'
      : status.spinsRemaining === 0
        ? 'No spins remaining today'
        : `You have ${status.spinsRemaining} free spin${status.spinsRemaining > 1 ? 's' : ''} today!`;

  return (
    <div
      className="relative overflow-hidden rounded-xl sm:rounded-2xl p-4 sm:p-6 mb-4 sm:mb-6 casino-border"
      style={{
        background: hasSpins
          ? 'linear-gradient(135deg, rgba(255,165,0,0.15) 0%, rgba(255,215,0,0.08) 50%, rgba(139,0,0,0.15) 100%)'
          : 'linear-gradient(135deg, rgba(50,50,60,0.4) 0%, rgba(30,30,40,0.4) 100%)',
        border: hasSpins ? '1px solid rgba(255,215,0,0.3)' : undefined,
      }}
    >
      {/* Sparkle decorations */}
      {hasSpins && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden>
          <Sparkles
            className="absolute top-3 right-4 w-5 h-5 animate-pulse"
            style={{ color: 'var(--casino-highlight-gold)', opacity: 0.5 }}
          />
          <Sparkles
            className="absolute bottom-4 left-6 w-4 h-4 animate-pulse"
            style={{ color: '#FFA000', opacity: 0.35, animationDelay: '0.7s' }}
          />
        </div>
      )}

      <div className="relative flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-4 flex-1 min-w-0">
          {/* Wheel icon */}
          <div
            className={`flex-shrink-0 w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center ${hasSpins ? 'animate-[spin_8s_linear_infinite]' : ''}`}
            style={{
              background: hasSpins
                ? 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)'
                : 'linear-gradient(135deg, #555 0%, #333 100%)',
              boxShadow: hasSpins ? '0 0 20px rgba(255,215,0,0.35)' : 'none',
            }}
          >
            <RotateCw
              className="w-6 h-6 sm:w-7 sm:h-7"
              style={{ color: hasSpins ? 'var(--casino-primary-dark)' : '#888' }}
            />
          </div>

          <div className="min-w-0">
            <h3
              className="text-sm sm:text-base font-bold truncate"
              style={{ color: hasSpins ? '#FFD700' : '#888' }}
            >
              {hasSpins ? 'Wheel of Fortune' : 'Spins Used Up'}
            </h3>
            <p className="text-xs sm:text-sm casino-text-secondary">{spinsText}</p>
            {!hasSpins && (
              <p className="text-xs mt-1 flex items-center gap-1" style={{ color: '#F59E0B' }}>
                <Clock className="w-3 h-3" />
                Resets in {countdown}
              </p>
            )}
          </div>
        </div>

        <button
          onClick={handleOpenWheel}
          disabled={!hasSpins}
          className={`flex-shrink-0 px-4 sm:px-6 py-2.5 sm:py-3 rounded-xl font-bold text-sm sm:text-base transition-all active:scale-95 touch-manipulation ${
            hasSpins
              ? 'hover:scale-105'
              : 'opacity-50 cursor-not-allowed'
          }`}
          style={{
            background: hasSpins
              ? 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)'
              : '#333',
            color: hasSpins ? 'var(--casino-primary-dark)' : '#666',
            boxShadow: hasSpins ? '0 0 20px rgba(255,215,0,0.3)' : 'none',
            animation: hasSpins ? 'ctaPulse 2s ease-in-out infinite' : 'none',
          }}
        >
          {hasSpins ? 'Spin Now' : 'Come Back'}
        </button>
      </div>

      <style>{`
        @keyframes ctaPulse {
          0%, 100% { box-shadow: 0 0 20px rgba(255,215,0,0.3); }
          50% { box-shadow: 0 0 30px rgba(255,215,0,0.5), 0 0 60px rgba(255,165,0,0.2); }
        }
      `}</style>
    </div>
  );
}
