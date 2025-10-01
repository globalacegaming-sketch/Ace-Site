import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, UserSession } from '../types';

interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  lastRechargeStatus: 'success' | 'failed' | 'processing' | null;
  fortunePandaBalance: string | null;
  balanceLastUpdated: number | null;
  
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

      setUser: (user: User) => set({ user }),
      
      setToken: (token: string) => set({ token }),
      
      setLastRechargeStatus: (status) => set({ lastRechargeStatus: status }),
      
      setLoading: (loading: boolean) => set({ isLoading: loading }),
      
      login: (session: UserSession) => set({
        user: session.user,
        token: session.token,
        isAuthenticated: true,
        isLoading: false,
      }),
      
      logout: () => set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
        lastRechargeStatus: null,
        fortunePandaBalance: null,
        balanceLastUpdated: null,
      }),
      
      updateBalance: (balance: number) => {
        const { user } = get();
        if (user) {
          set({
            user: { ...user, balance }
          });
        }
      },

      setFortunePandaBalance: (balance: string) => set({ 
        fortunePandaBalance: balance,
        balanceLastUpdated: Date.now()
      }),

      setBalanceLastUpdated: (timestamp: number) => set({ balanceLastUpdated: timestamp }),
    }),
    {
      name: 'global-ace-auth',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
        lastRechargeStatus: state.lastRechargeStatus,
      }),
    }
  )
);
