import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  oneSignalEnsurePushSetup,
  oneSignalLogin,
  oneSignalLogout,
  oneSignalOptInIfGranted,
  oneSignalRequestPermission,
} from '../services/oneSignal';

/** Re-prompt at most once per week if user dismissed (not if they denied in browser). */
const PROMPT_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;
const PROMPT_KEY = 'gag-onesignal-prompt-at';

export default function OneSignalAuthSync() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) {
      oneSignalLogout().catch(() => {});
      return;
    }

    const userId = String(user.id);

    void (async () => {
      await oneSignalEnsurePushSetup(userId);

      if (typeof window === 'undefined' || !('Notification' in window)) return;

      const perm = Notification.permission;
      if (perm === 'granted') {
        await oneSignalOptInIfGranted();
        return;
      }
      if (perm === 'denied') {
        return;
      }

      const last = localStorage.getItem(PROMPT_KEY);
      if (last && Date.now() - Number(last) < PROMPT_COOLDOWN_MS) {
        return;
      }

      window.setTimeout(async () => {
        await oneSignalLogin(userId);
        const shown = await oneSignalRequestPermission(true);
        if (shown) {
          localStorage.setItem(PROMPT_KEY, String(Date.now()));
        }
        if (Notification.permission === 'granted') {
          await oneSignalOptInIfGranted();
        }
      }, 2500);
    })();
  }, [isAuthenticated, user?.id]);

  return null;
}
