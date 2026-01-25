import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { oneSignalLogin, oneSignalLogout } from '../services/oneSignal';

/**
 * Syncs auth state with OneSignal: login (set external_id) when user is
 * logged in, logout (clear) when they sign out. Lets the backend target
 * push by user id for support messages.
 */
export default function OneSignalAuthSync() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      oneSignalLogin(user.id).catch(() => {});
    }
  }, [isAuthenticated, user?.id]);

  useEffect(() => {
    if (!isAuthenticated) {
      oneSignalLogout().catch(() => {});
    }
  }, [isAuthenticated]);

  return null;
}
