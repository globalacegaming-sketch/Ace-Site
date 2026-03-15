import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { initTracker, trackPageView, setUserId, destroyTracker } from '../services/analyticsTracker';
import { useAuthStore } from '../stores/authStore';

export default function AnalyticsProvider() {
  const location = useLocation();
  const { user, isAuthenticated } = useAuthStore();
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initTracker(isAuthenticated && user ? (user as any)._id || (user as any).id : undefined);
      initialized.current = true;
    }
    return () => {
      destroyTracker();
    };
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      setUserId((user as any)._id || (user as any).id || '');
    }
  }, [isAuthenticated, user]);

  useEffect(() => {
    if (initialized.current) {
      trackPageView(location.pathname);
    }
  }, [location.pathname]);

  return null;
}
