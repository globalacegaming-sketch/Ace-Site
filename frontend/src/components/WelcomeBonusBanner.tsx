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
      className="relative rounded-xl sm:rounded-2xl p-3.5 sm:p-5 md:p-6 mb-4 sm:mb-5 md:mb-6 lg:mb-8 overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 50%, #FF6F00 100%)',
        boxShadow: '0 0 30px rgba(255, 215, 0, 0.25)',
      }}
    >
      {/* Dismiss */}
      <button
        onClick={handleDismiss}
        className="absolute top-2.5 right-2.5 sm:top-3 sm:right-3 p-1 sm:p-1.5 rounded-full bg-black/20 hover:bg-black/40 transition-colors touch-manipulation"
        aria-label="Dismiss welcome bonus"
      >
        <X className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-white" />
      </button>

      <div className="flex items-center gap-3 sm:gap-4">
        <div
          className="w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14 rounded-full flex items-center justify-center shrink-0"
          style={{ backgroundColor: 'rgba(0,0,0,0.15)' }}
        >
          <Gift className="w-5 h-5 sm:w-6 sm:h-6 md:w-7 md:h-7 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm sm:text-base md:text-lg font-bold text-gray-900 mb-0.5">
            Claim your Welcome Bonus!
          </h3>
          <p className="text-[11px] sm:text-xs md:text-sm text-gray-800 leading-snug">
            100% match on your first deposit — double your starting balance and get playing today.
          </p>
        </div>
      </div>

      <Link
        to="/bonuses"
        className="mt-2.5 sm:mt-3 inline-flex items-center gap-1.5 bg-black/80 hover:bg-black text-yellow-400 font-semibold text-[11px] sm:text-xs md:text-sm px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg transition-colors touch-manipulation active:scale-95"
      >
        <Gift className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
        Claim Now
      </Link>
    </div>
  );
}
