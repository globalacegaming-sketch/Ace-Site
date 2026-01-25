import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { Share2, X } from 'lucide-react';

const IOS_A2HS_DISMISS_KEY = 'ios-a2hs-dismissed';
const DISMISS_DAYS = 7;

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || navigator.vendor;
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    (window.matchMedia('(display-mode: standalone)').matches) ||
    ((navigator as any).standalone === true)
  );
}

function wasDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(IOS_A2HS_DISMISS_KEY);
    if (!raw) return false;
    const t = parseInt(raw, 10);
    if (isNaN(t)) return false;
    return Date.now() - t < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function dismiss(): void {
  try {
    localStorage.setItem(IOS_A2HS_DISMISS_KEY, String(Date.now()));
  } catch {}
}

/**
 * On iOS, web push permission is only available when the site is opened from the
 * Home Screen (Add to Home Screen). This banner guides users on Safari/Chrome/Edge
 * to add the site and open from the home screen.
 * @see https://documentation.onesignal.com/docs/en/web-push-for-ios
 */
export default function IOSAddToHomeScreenBanner() {
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  useEffect(() => {
    const onAdminOrAgent = location.pathname.startsWith('/adminacers') ||
      location.pathname.startsWith('/agent-login') ||
      location.pathname.startsWith('/agent-dashboard');
    if (onAdminOrAgent) {
      setVisible(false);
      return;
    }
    if (!isIOS() || isStandalone() || wasDismissedRecently()) {
      setVisible(false);
      return;
    }
    setVisible(true);
  }, [location.pathname]);

  const handleDismiss = () => {
    dismiss();
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[9998] bg-gradient-to-r from-indigo-900 to-indigo-800 text-white shadow-lg border-t border-indigo-700 px-4 py-3" style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom, 0.75rem))' }}>
      <div className="max-w-lg mx-auto flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5 p-1.5 rounded-full bg-white/20">
          <Share2 className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium mb-1">Get support notifications on this device</p>
          <p className="text-xs text-indigo-100">
            Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> → open the app from your home screen, then open Chat.
          </p>
        </div>
        <button
          type="button"
          onClick={handleDismiss}
          className="flex-shrink-0 p-1.5 rounded-full hover:bg-white/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
