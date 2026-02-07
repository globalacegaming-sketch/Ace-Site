import { useState, useEffect, useCallback } from 'react';
import { Award, Flame, Star, Target, Zap, Crown, Trophy, Shield } from 'lucide-react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

interface Achievement {
  id: string;
  name: string;
  description: string;
  icon: string;
  earnedAt: string;
}

// Available badge definitions (earned + unearned)
const ALL_BADGES = [
  { id: '7_day_streak', name: '7-Day Streak', description: 'Log in 7 consecutive days', icon: 'flame' },
  { id: 'first_spin', name: 'First Spin', description: 'Spin the Wheel of Fortune', icon: 'zap' },
  { id: 'first_deposit', name: 'First Deposit', description: 'Make your first deposit', icon: 'star' },
  { id: 'high_roller', name: 'High Roller', description: 'Deposit $100 or more', icon: 'crown' },
  { id: 'social_butterfly', name: 'Social Butterfly', description: 'Refer 3 friends', icon: 'target' },
  { id: 'verified', name: 'Verified', description: 'Verify your email address', icon: 'shield' },
  { id: 'loyal_player', name: 'Loyal Player', description: 'Play for 30 days', icon: 'trophy' },
  { id: 'big_winner', name: 'Big Winner', description: 'Win $50+ on a single spin', icon: 'award' },
];

const ICON_MAP: Record<string, typeof Flame> = {
  flame: Flame,
  zap: Zap,
  star: Star,
  crown: Crown,
  target: Target,
  shield: Shield,
  trophy: Trophy,
  award: Award,
};

export default function AchievementBadges() {
  const { token } = useAuthStore();
  const [earned, setEarned] = useState<Achievement[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBadge, setSelectedBadge] = useState<string | null>(null);

  const fetchAchievements = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${getApiBaseUrl()}/user/achievements`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setEarned(res.data.data.achievements || []);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchAchievements();
  }, [fetchAchievements]);

  if (loading) {
    return (
      <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border mb-4 sm:mb-6 animate-pulse">
        <div className="h-28 rounded-lg" style={{ backgroundColor: 'rgba(106,27,154,0.05)' }} />
      </div>
    );
  }

  const earnedIds = new Set(earned.map((a) => a.id));

  return (
    <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 lg:p-8 casino-border shadow-lg mt-4 sm:mt-6">
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center gap-2">
          <Award className="w-5 h-5" style={{ color: 'var(--casino-highlight-gold)' }} />
          <h2 className="text-lg sm:text-xl font-semibold casino-text-primary">
            Achievements & Badges
          </h2>
        </div>
        <span className="text-xs sm:text-sm casino-text-secondary">
          {earned.length}/{ALL_BADGES.length}
        </span>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-4 md:grid-cols-8 gap-3 sm:gap-4">
        {ALL_BADGES.map((badge) => {
          const isEarned = earnedIds.has(badge.id);
          const earnedData = earned.find((a) => a.id === badge.id);
          const IconComponent = ICON_MAP[badge.icon] || Award;
          const isSelected = selectedBadge === badge.id;

          return (
            <button
              key={badge.id}
              onClick={() => setSelectedBadge(isSelected ? null : badge.id)}
              className={`relative flex flex-col items-center justify-center rounded-xl p-2 sm:p-3 transition-all touch-manipulation ${
                isEarned
                  ? 'hover:scale-105 active:scale-95'
                  : 'opacity-40 grayscale'
              }`}
              style={{
                background: isEarned
                  ? 'linear-gradient(135deg, rgba(255,215,0,0.12), rgba(106,27,154,0.08))'
                  : 'rgba(255,255,255,0.02)',
                border: isEarned
                  ? '1px solid rgba(255,215,0,0.3)'
                  : '1px solid rgba(255,255,255,0.05)',
              }}
            >
              <div
                className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-1.5"
                style={{
                  background: isEarned
                    ? 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)'
                    : '#333',
                }}
              >
                <IconComponent
                  className="w-4 h-4 sm:w-5 sm:h-5"
                  style={{ color: isEarned ? 'var(--casino-primary-dark)' : '#666' }}
                />
              </div>
              <span
                className="text-[10px] sm:text-xs font-medium text-center leading-tight"
                style={{ color: isEarned ? 'var(--casino-text-primary)' : '#666' }}
              >
                {badge.name}
              </span>

              {/* Earned date indicator */}
              {isEarned && (
                <div
                  className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center"
                  style={{ backgroundColor: 'var(--casino-accent-green)' }}
                >
                  <span className="text-[8px] text-white font-bold">✓</span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Tooltip / detail for selected badge */}
      {selectedBadge && (
        <div
          className="mt-4 p-3 sm:p-4 rounded-lg text-center"
          style={{
            background: 'rgba(255,215,0,0.05)',
            border: '1px solid rgba(255,215,0,0.15)',
          }}
        >
          {(() => {
            const badge = ALL_BADGES.find((b) => b.id === selectedBadge);
            const isEarned = earnedIds.has(selectedBadge);
            const earnedData = earned.find((a) => a.id === selectedBadge);
            if (!badge) return null;
            return (
              <>
                <p className="text-sm font-semibold" style={{ color: 'var(--casino-highlight-gold)' }}>
                  {badge.name}
                </p>
                <p className="text-xs casino-text-secondary mt-1">{badge.description}</p>
                {isEarned && earnedData && (
                  <p className="text-xs mt-1" style={{ color: 'var(--casino-accent-green)' }}>
                    Earned {new Date(earnedData.earnedAt).toLocaleDateString()}
                  </p>
                )}
                {!isEarned && (
                  <p className="text-xs mt-1" style={{ color: '#888' }}>
                    Not yet earned
                  </p>
                )}
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
}
