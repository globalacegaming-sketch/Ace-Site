import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Cookie, X } from 'lucide-react';

const CONSENT_KEY = 'gag-cookie-consent';

type ConsentValue = 'accepted' | 'declined' | null;

function getStoredConsent(): ConsentValue {
  try {
    const v = localStorage.getItem(CONSENT_KEY);
    return v === 'accepted' || v === 'declined' ? v : null;
  } catch {
    return null;
  }
}

/**
 * GDPR / CCPA-compliant cookie consent banner.
 * - Blocks non-essential cookies / analytics until consent is given.
 * - Stores choice in localStorage so it persists across sessions.
 * - Links to /cookies policy page.
 */
export default function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Show banner only if user hasn't made a choice yet
    if (getStoredConsent() === null) {
      // Small delay so it doesn't flash on mount
      const id = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(id);
    }
  }, []);

  const handleAccept = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, 'accepted'); } catch { /* noop */ }
    setVisible(false);
  }, []);

  const handleDecline = useCallback(() => {
    try { localStorage.setItem(CONSENT_KEY, 'declined'); } catch { /* noop */ }
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed bottom-0 inset-x-0 z-[9998] p-3 sm:p-4 animate-slide-up"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 12px)' }}
    >
      <div
        className="max-w-lg mx-auto rounded-2xl shadow-2xl border p-4 sm:p-5 backdrop-blur-xl"
        style={{
          backgroundColor: 'rgba(27, 27, 47, 0.95)',
          borderColor: '#2C2C3A',
        }}
      >
        <div className="flex items-start gap-3">
          <Cookie className="w-5 h-5 flex-shrink-0 mt-0.5" style={{ color: '#FFD700' }} />
          <div className="flex-1 min-w-0">
            <p className="text-sm casino-text-primary font-medium mb-1">We use cookies</p>
            <p className="text-xs casino-text-secondary leading-relaxed mb-3">
              We use essential cookies for authentication and security. Optional cookies help us
              improve your experience.{' '}
              <Link to="/cookies" className="text-yellow-400 hover:underline">
                Learn more
              </Link>
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={handleAccept}
                className="btn-casino-primary px-4 py-2 rounded-lg text-xs font-semibold touch-manipulation active:scale-95 transition-transform"
              >
                Accept All
              </button>
              <button
                onClick={handleDecline}
                className="px-4 py-2 rounded-lg text-xs font-semibold casino-text-secondary border transition-colors hover:casino-text-primary touch-manipulation active:scale-95"
                style={{ borderColor: '#2C2C3A' }}
              >
                Essential Only
              </button>
            </div>
          </div>
          <button
            onClick={handleDecline}
            className="flex-shrink-0 casino-text-secondary hover:casino-text-primary transition-colors touch-manipulation"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Check if the user has given full cookie consent (for analytics / non-essential). */
export function hasCookieConsent(): boolean {
  return getStoredConsent() === 'accepted';
}
