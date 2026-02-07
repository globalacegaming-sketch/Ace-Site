import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Gift, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';

const DISMISS_KEY = 'gag-welcome-bonus-dismissed';

/**
 * Dismissible welcome-bonus banner shown on Dashboard for new users.
 * Criteria: account age < 7 days, not previously dismissed.
 */
export default function WelcomeBonusBanner() {
  const { user } = useAuthStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!user?.createdAt) return;

    // Already dismissed?
    try {
      if (localStorage.getItem(DISMISS_KEY) === user.id) return;
    } catch { /* noop */ }

    // Account older than 7 days? Don't show.
    const accountAge = Date.now() - new Date(user.createdAt).getTime();
    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    if (accountAge > SEVEN_DAYS) return;

    setVisible(true);
  }, [user]);

  const handleDismiss = () => {
    setVisible(false);
    try { localStorage.setItem(DISMISS_KEY, user?.id || 'dismissed'); } catch { /* noop */ }
  };

  if (!visible) return null;

  return (
    <div
      className="relative rounded-xl sm:rounded-2xl p-4 sm:p-5 mb-6 sm:mb-8 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 50%, #FF6F00 100%)',
        boxShadow: '0 0 30px rgba(255, 215, 0, 0.25)',
      }}
    >
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="absolute top-3 right-3 p-1 rounded-full bg-black/20 hover:bg-black/40 transition-colors touch-manipulation"
        aria-label="Dismiss welcome bonus"
      >
        <X className="w-4 h-4 text-white" />
      </button>

      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        >
          <Gift className="w-6 h-6 sm:w-7 sm:h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base font-bold text-gray-900 mb-0.5">
            Claim your Welcome Bonus!
          </h3>
          <p className="text-xs sm:text-sm text-gray-800 leading-snug">
            100% match on your first deposit — double your starting balance and get playing today.
          </p>
        </div>
      </div>

      <Link
        to="/bonuses"
        className="mt-3 inline-flex items-center gap-1.5 bg-black/80 hover:bg-black text-yellow-400 font-semibold text-xs sm:text-sm px-4 py-2 rounded-lg transition-colors touch-manipulation active:scale-95"
      >
        <Gift className="w-3.5 h-3.5" />
        Claim Now
      </Link>
    </div>
  );
}
