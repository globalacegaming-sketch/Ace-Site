import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { oneSignalLogin, oneSignalRequestPermission } from '../services/oneSignal';

// Bump this version to force every user to be re-prompted on their next page load.
const PROMPT_VERSION = 'v2';
const PROMPT_KEY = 'gag-onesignal-prompted';

export default function OneSignalAuthSync() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated || !user?.id) return;

    oneSignalLogin(user.id).catch(() => {});

    const storageVal = localStorage.getItem(PROMPT_KEY);
    if (storageVal === `${user.id}:${PROMPT_VERSION}`) return;

    const timer = setTimeout(() => {
      oneSignalRequestPermission(true)
        .then(() => {
          localStorage.setItem(PROMPT_KEY, `${user.id}:${PROMPT_VERSION}`);
        })
        .catch(() => {});
    }, 2000);

    return () => clearTimeout(timer);
  }, [isAuthenticated, user?.id]);

  return null;
}
