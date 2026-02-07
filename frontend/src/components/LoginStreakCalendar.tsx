import { useState, useEffect, useCallback } from 'react';
import { Flame, Gift, Check, Lock, Loader2 } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

interface StreakReward {
  day: number;
  label: string;
  description: string;
  claimed: boolean;
  current: boolean;
  unlocked: boolean;
}

interface StreakData {
  loginStreak: number;
  streakDay: number;
  rewards: StreakReward[];
}

const DAY_ICONS: Record<number, string> = {
  1: '🎰',
  2: '🎰🎰',
  3: '💰',
  4: '💰',
  5: '💎',
  6: '💎🎰',
  7: '🏆',
};

export default function LoginStreakCalendar() {
  const { token } = useAuthStore();
  const [data, setData] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<number | null>(null);

  const fetchStreak = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${getApiBaseUrl()}/user/streak`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchStreak();
  }, [fetchStreak]);

  const handleClaim = async (day: number) => {
    if (!token || claiming !== null) return;
    setClaiming(day);
    try {
      const res = await axios.post(
        `${getApiBaseUrl()}/user/streak/claim`,
        { day },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        toast.success(res.data.data.reward.label, { icon: '🎁', duration: 3000 });
        fetchStreak(); // refresh
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to claim reward');
    } finally {
      setClaiming(null);
    }
  };

  if (loading) {
    return (
      <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border mb-4 sm:mb-6 animate-pulse">
        <div className="h-32 rounded-lg" style={{ backgroundColor: 'rgba(255,215,0,0.05)' }} />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border mb-4 sm:mb-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Flame className="w-5 h-5" style={{ color: '#FF6B00' }} />
          <h3 className="text-base sm:text-lg font-bold casino-text-primary">
            Daily Login Streak
          </h3>
        </div>
        <div
          className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs sm:text-sm font-bold"
          style={{
            background: 'linear-gradient(135deg, rgba(255,107,0,0.2), rgba(255,165,0,0.1))',
            color: '#FF6B00',
            border: '1px solid rgba(255,107,0,0.3)',
          }}
        >
          <Flame className="w-3.5 h-3.5" />
          {data.loginStreak} day{data.loginStreak !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Streak calendar grid */}
      <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
        {data.rewards.map((reward) => {
          const isCurrent = reward.current;
          const isUnlocked = reward.unlocked;
          const isClaimed = reward.claimed;
          const canClaim = isUnlocked && !isClaimed && isCurrent;

          return (
            <button
              key={reward.day}
              onClick={() => canClaim && handleClaim(reward.day)}
              disabled={!canClaim || claiming !== null}
              className={`relative flex flex-col items-center justify-center rounded-lg sm:rounded-xl p-1.5 sm:p-2.5 transition-all touch-manipulation min-h-[72px] sm:min-h-[90px] ${
                canClaim
                  ? 'hover:scale-105 active:scale-95 cursor-pointer'
                  : isClaimed
                    ? 'cursor-default'
                    : 'cursor-not-allowed opacity-60'
              }`}
              style={{
                background: isClaimed
                  ? 'linear-gradient(135deg, rgba(0,200,83,0.15), rgba(0,150,60,0.1))'
                  : isCurrent
                    ? 'linear-gradient(135deg, rgba(255,215,0,0.2), rgba(255,165,0,0.1))'
                    : 'rgba(255,255,255,0.03)',
                border: isCurrent
                  ? '2px solid rgba(255,215,0,0.5)'
                  : isClaimed
                    ? '1px solid rgba(0,200,83,0.3)'
                    : '1px solid rgba(255,255,255,0.06)',
                boxShadow: isCurrent ? '0 0 12px rgba(255,215,0,0.2)' : 'none',
                animation: canClaim ? 'streakPulse 2s ease-in-out infinite' : 'none',
              }}
            >
              {/* Day label */}
              <span
                className="text-[10px] sm:text-xs font-semibold mb-0.5"
                style={{ color: isCurrent ? '#FFD700' : '#888' }}
              >
                Day {reward.day}
              </span>

              {/* Icon */}
              <span className="text-base sm:text-xl mb-0.5">
                {isClaimed ? (
                  <Check className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: 'var(--casino-accent-green)' }} />
                ) : isUnlocked ? (
                  DAY_ICONS[reward.day] || '🎁'
                ) : (
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#555' }} />
                )}
              </span>

              {/* Reward label */}
              <span
                className="text-[9px] sm:text-[10px] font-medium text-center leading-tight"
                style={{ color: isUnlocked ? '#ccc' : '#555' }}
              >
                {reward.label.replace('Deposit ', '').replace('Bonus', '')}
              </span>

              {/* Claim indicator */}
              {canClaim && claiming !== reward.day && (
                <Gift
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 sm:w-4 sm:h-4 animate-bounce"
                  style={{ color: 'var(--casino-highlight-gold)' }}
                />
              )}
              {claiming === reward.day && (
                <Loader2
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 animate-spin"
                  style={{ color: 'var(--casino-highlight-gold)' }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Next reward hint */}
      {data.streakDay < 7 && (
        <p className="text-xs casino-text-secondary mt-3 text-center">
          Come back tomorrow for{' '}
          <span style={{ color: 'var(--casino-highlight-gold)' }}>
            {data.rewards.find((r) => r.day === data.streakDay + 1)?.label || 'a reward'}
          </span>
          !
        </p>
      )}

      <style>{`
        @keyframes streakPulse {
          0%, 100% { box-shadow: 0 0 12px rgba(255,215,0,0.2); }
          50% { box-shadow: 0 0 20px rgba(255,215,0,0.4); }
        }
      `}</style>
    </div>
  );
}
