import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import axios from 'axios';
import { getApiBaseUrl } from '../../utils/api';

const INACTIVITY_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours
const CHECK_INTERVAL_MS = 60_000; // 60 seconds

/**
 * AdminSessionManager – mirrors the user-side SessionManager.
 * Mount this component anywhere inside the AceAgent route tree.
 *
 * Responsibilities:
 *  1. Track user activity (mouse, keyboard, scroll, touch, click).
 *  2. Every 60 s, check if:
 *     a) The session's `expiresAt` has passed, OR
 *     b) The agent has been inactive for more than 24 h.
 *  3. If either condition is true, clear `admin_session` from localStorage,
 *     call the server-side logout endpoint, and redirect to login with a toast.
 */
const AdminSessionManager: React.FC = () => {
  const navigate = useNavigate();
  const lastActivityRef = useRef<number>(Date.now());

  // ── Utility: read session from localStorage ──────────────────────────────
  const getSession = () => {
    try {
      const raw = localStorage.getItem('admin_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  };

  // ── Utility: server-side logout (best effort) ────────────────────────────
  const serverLogout = (token: string | undefined) => {
    if (!token) return;
    const API_BASE_URL = getApiBaseUrl();
    axios
      .post(`${API_BASE_URL}/admin/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .catch(() => {
        /* swallow – we already cleared local state */
      });
  };

  // ── Core: check validity ──────────────────────────────────────────────────
  const checkSession = () => {
    const session = getSession();

    if (!session) {
      // No session at all – probably already logged out elsewhere
      return;
    }

    const now = Date.now();
    const expired = session.expiresAt && now > session.expiresAt;
    const inactive = now - lastActivityRef.current > INACTIVITY_TIMEOUT_MS;

    if (expired || inactive) {
      serverLogout(session.token);
      localStorage.removeItem('admin_session');
      toast.error(
        expired
          ? 'Session expired. Please login again.'
          : 'Logged out due to inactivity.',
      );
      navigate('/aceagent/login', { replace: true });
    }
  };

  useEffect(() => {
    // Immediate check on mount
    checkSession();

    // Activity tracking
    const handleActivity = () => {
      lastActivityRef.current = Date.now();
    };

    const events = ['mousedown', 'keypress', 'scroll', 'touchstart', 'click'];
    events.forEach((e) => document.addEventListener(e, handleActivity, { passive: true }));

    // Periodic check
    const interval = setInterval(checkSession, CHECK_INTERVAL_MS);

    return () => {
      events.forEach((e) => document.removeEventListener(e, handleActivity));
      clearInterval(interval);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
};

export default AdminSessionManager;
