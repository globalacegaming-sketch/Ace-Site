import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { walletApi } from '../services/walletApi';
import toast from 'react-hot-toast';

/**
 * Polls /api/wallet/balance (internal Wallet from crypto deposits).
 * Use this in Layout/header so the displayed balance reflects crypto-loaded wallet.
 */
export const useWalletBalance = (intervalMs: number = 30000) => {
  const { isAuthenticated } = useAuthStore();
  const [balance, setBalance] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const fetchBalance = async (showLoading = false) => {
    if (!isAuthenticated) return;
    try {
      if (showLoading) setIsLoading(true);
      const res = await walletApi.getBalance();
      if (res.success) {
        const raw = res.data?.balance;
        setBalance(typeof raw === 'number' ? raw : Number(raw) || 0);
      } else if (showLoading) {
        toast.error('Failed to update balance. Please try again.');
      }
    } catch {
      if (showLoading) toast.error('Failed to update balance. Please check your connection.');
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!isAuthenticated) {
      setBalance(null);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }
    fetchBalance();
    intervalRef.current = window.setInterval(fetchBalance, intervalMs);
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [isAuthenticated, intervalMs]);

  const display = balance != null ? balance.toFixed(2) : '0.00';
  return { balance, display, isLoading, fetchBalance };
};
