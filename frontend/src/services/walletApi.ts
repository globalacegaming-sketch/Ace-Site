import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = getApiBaseUrl();

function getAuthHeaders() {
  const token = useAuthStore.getState().token;
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
}

export interface WalletBalance {
  balance: number;
  currency: string;
  updatedAt: string;
}

export interface CryptoTransactionItem {
  _id: string;
  userId: string;
  paymentId: string;
  invoiceId: string;
  orderId: string;
  amount: number;
  currency: string;
  payCurrency?: string;
  status: 'pending' | 'confirmed' | 'failed';
  txHash?: string;
  ipnReceivedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateCryptoPaymentBody {
  amountUSD: number;
  payCurrency?: string;
}

export interface CreateCryptoPaymentResponse {
  success: boolean;
  message?: string;
  data?: {
    paymentUrl: string;
    orderId: string;
    amount: number;
    currency: string;
  };
}

export const walletApi = {
  async getBalance(): Promise<{ success: boolean; data?: { balance: number; currency: string; updatedAt: string }; message?: string }> {
    const { data } = await axios.get(`${API_BASE_URL}/wallet/balance`, {
      headers: getAuthHeaders()
    });
    return data;
  },

  async getCryptoTransactions(params?: { limit?: number; skip?: number }): Promise<{
    success: boolean;
    data?: { items: CryptoTransactionItem[]; total: number };
    message?: string;
  }> {
    const q = new URLSearchParams();
    if (params?.limit != null) q.set('limit', String(params.limit));
    if (params?.skip != null) q.set('skip', String(params.skip));
    const { data } = await axios.get(`${API_BASE_URL}/wallet/crypto-transactions?${q.toString()}`, {
      headers: getAuthHeaders()
    });
    return data;
  },

  async createCryptoPayment(body: CreateCryptoPaymentBody): Promise<CreateCryptoPaymentResponse> {
    const { data } = await axios.post(`${API_BASE_URL}/wallet/create-crypto-payment`, body, {
      headers: getAuthHeaders()
    });
    return data;
  }
};
