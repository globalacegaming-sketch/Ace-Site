import { useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { oneSignalLogin } from '../services/oneSignal';

/**
 * Syncs auth state with OneSignal: login (set external_id) when user is
 * logged in. We do NOT call OneSignal.logout() on app sign-out so the
 * device stays targetable by external_id when the user is logged out
 * (support replies must reach them via push). When they log in as a
 * different user, login(newUserId) switches the subscription to that user.
 */
export default function OneSignalAuthSync() {
  const { isAuthenticated, user } = useAuthStore();

  useEffect(() => {
    if (isAuthenticated && user?.id) {
      oneSignalLogin(user.id).catch(() => {});
    }
  }, [isAuthenticated, user?.id]);

  return null;
}
