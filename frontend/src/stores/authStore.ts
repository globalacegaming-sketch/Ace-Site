import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserSession } from '../types';
import { isTokenExpired } from '../utils/jwt';

// Session timeout: 24 hours of inactivity on the client side.
// The server-side session in MongoDB has a 7-day TTL and is the source of truth.
// This client-side timeout is only a safety net; the server cookie handles
// actual session expiry. Previously this was 30 minutes, which caused
// users to be logged out too frequently.
const SESSION_TIMEOUT_MS = 24 * 60 * 60 * 1000; // 24 hours

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastRechargeStatus: 'success' | 'failed' | 'processing' | null;
  fortunePandaBalance: string | null;
  balanceLastUpdated: number | null;
  lastActivityTime: number | null;
  
  // Actions
  setUser: (user: User) => void;
  setToken: (token: string) => void;
  setLastRechargeStatus: (status: 'success' | 'failed' | 'processing' | null) => void;
  setLoading: (loading: boolean) => void;
  login: (session: UserSession) => void;
  logout: () => void;
  updateBalance: (balance: number) => void;
  setFortunePandaBalance: (balance: string) => void;
  setBalanceLastUpdated: (timestamp: number) => void;
  updateActivity: () => void;
  checkSession: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
      lastRechargeStatus: null,
      fortunePandaBalance: null,
      balanceLastUpdated: null,
      lastActivityTime: null,

      setUser: (user: User) => set({ user }),
      
      setToken: (token: string) => set({ token }),
      
      setLastRechargeStatus: (status) => set({ lastRechargeStatus: status }),
      
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      
      login: (session: UserSession) => set({
        user: session.user,
        token: session.token,
        isAuthenticated: true,
        isLoading: false,
        lastActivityTime: Date.now(), // Set activity time on login
      }),
      
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        lastRechargeStatus: null,
        fortunePandaBalance: null,
        balanceLastUpdated: null,
        lastActivityTime: null,
      }),
      
      updateBalance: (balance: number) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, fortunePandaBalance: balance }
          });
        }
      },

      setFortunePandaBalance: (balance: string) => set({ 
        fortunePandaBalance: balance,
        balanceLastUpdated: Date.now()
      }),

      setBalanceLastUpdated: (timestamp: number) => set({ balanceLastUpdated: timestamp }),

      // Update last activity time
      updateActivity: () => set({ lastActivityTime: Date.now() }),

      // Check if session is still valid (not expired and not inactive)
      checkSession: () => {
        const state = get();
        
        // If not authenticated, session is invalid
        if (!state.isAuthenticated || !state.token || !state.user) {
          return false;
        }

        // Check if token is expired
        if (isTokenExpired(state.token)) {
          return false;
        }

        // Check if session has timed out due to inactivity
        // If lastActivityTime is null, treat as expired (shouldn't happen, but safety check)
        if (state.lastActivityTime === null) {
          return false;
        }

        const now = Date.now();
        const inactiveTime = now - state.lastActivityTime;

        if (inactiveTime > SESSION_TIMEOUT_MS) {
          // Session expired due to inactivity
          return false;
        }

        return true;
      },
    }),
    {
      name: 'global-ace-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        lastRechargeStatus: state.lastRechargeStatus,
        lastActivityTime: state.lastActivityTime,
      }),
      onRehydrateStorage: () => (state) => {
        // Check session immediately when store is rehydrated from localStorage
        // Note: The 'state' parameter only contains persisted data fields, not action methods
        // We need to use getState() to access the full store instance with all methods
        if (state && state.isAuthenticated) {
          // The store is fully rehydrated when this callback runs, so we can safely access getState()
          const store = useAuthStore.getState();
          // Check if session is still valid using the full store instance
          if (!store.checkSession()) {
            // Session expired, clear it immediately
            store.logout();
            // Note: Toast notification will be shown by SessionManager component
          }
          // If session is valid, we'll update activity time in SessionManager
          // after confirming the session is valid (to avoid resetting timer for expired sessions)
        }
      },
    }
  )
);
