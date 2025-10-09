import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import fortunePandaApi from '../services/fortunePandaApi';
import toast from 'react-hot-toast';

export const useBalancePolling = (intervalMs: number = 20000) => {
  const {
    isAuthenticated,
    fortunePandaBalance,
    setFortunePandaBalance
  } = useAuthStore();
  const intervalRef = useRef<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  // Balance polling state

  const fetchBalance = async (showLoading: boolean = false) => {
    if (!isAuthenticated) {
      return;
    }

    try {
      if (showLoading) setIsLoading(true);
      const response = await fortunePandaApi.getUserBalance();

      if (response.success && response.data?.balance) {
        setFortunePandaBalance(response.data.balance);
      } else {
        if (showLoading) {
          toast.error('Failed to update balance. Please try again.');
        }
      }
    } catch (error) {
      if (showLoading) {
        toast.error('Failed to update balance. Please check your connection.');
      }
      // Don't update balance on error to keep last known value
    } finally {
      if (showLoading) setIsLoading(false);
    }
  };

  const startPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }

    // Fetch immediately
    fetchBalance();

    // Then poll at intervals
    intervalRef.current = setInterval(fetchBalance, intervalMs);
  };

  const stopPolling = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => {
      stopPolling();
    };
  }, [isAuthenticated, intervalMs]);

  return {
    balance: fortunePandaBalance,
    isLoading,
    fetchBalance,
    startPolling,
    stopPolling
  };
};
