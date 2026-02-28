import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

const API_BASE_URL = getApiBaseUrl();

function getUserHeaders() {
  const token = useAuthStore.getState().token;
  return {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
  };
}

function getAgentHeaders() {
  const keys = ['agent_session', 'admin_session'];
  let token: string | null = null;
  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.token && (!parsed.expiresAt || Date.now() <= parsed.expiresAt)) {
        token = parsed.token;
        break;
      }
    } catch { /* skip invalid */ }
  }
  return {
    Authorization: token ? `Bearer ${token}` : '',
    'Content-Type': 'application/json',
  };
}

export interface LoanSummary {
  loanLimit: number;
  activeBalance: number;
  availableToBorrow: number;
  activeLoan: {
    id: string;
    principalAmount: number;
    issuedAt: string;
    dueAt: string;
    status: 'ACTIVE' | 'PAID' | 'OVERDUE';
  } | null;
  pendingRequest: {
    id: string;
    requestedAmount: number;
    createdAt: string;
  } | null;
  loanHistory: any[];
  repaymentHistory: any[];
  requestHistory: any[];
}

export const loanApi = {
  async getAccount(): Promise<{ success: boolean; data?: LoanSummary; message?: string }> {
    const { data } = await axios.get(`${API_BASE_URL}/loan/account`, {
      headers: getUserHeaders(),
    });
    return data;
  },

  async submitRequest(amount: number): Promise<{ success: boolean; data?: any; message?: string }> {
    const { data } = await axios.post(
      `${API_BASE_URL}/loan/request`,
      { amount },
      { headers: getUserHeaders() }
    );
    return data;
  },

  async getHistory(type: 'requests' | 'loans' | 'payments', page = 1, limit = 20) {
    const { data } = await axios.get(`${API_BASE_URL}/loan/history/${type}`, {
      headers: getUserHeaders(),
      params: { page, limit },
    });
    return data;
  },
};

export const agentLoanApi = {
  async getPendingRequests(page = 1, limit = 20) {
    const { data } = await axios.get(`${API_BASE_URL}/agent/loan/pending`, {
      headers: getAgentHeaders(),
      params: { page, limit },
    });
    return data;
  },

  async getAllRequests(page = 1, limit = 20, status?: string) {
    const { data } = await axios.get(`${API_BASE_URL}/agent/loan/requests`, {
      headers: getAgentHeaders(),
      params: { page, limit, status },
    });
    return data;
  },

  async approveRequest(requestId: string, remarks: string) {
    const { data } = await axios.post(
      `${API_BASE_URL}/agent/loan/approve/${requestId}`,
      { remarks },
      { headers: getAgentHeaders() }
    );
    return data;
  },

  async rejectRequest(requestId: string, remarks: string) {
    const { data } = await axios.post(
      `${API_BASE_URL}/agent/loan/reject/${requestId}`,
      { remarks },
      { headers: getAgentHeaders() }
    );
    return data;
  },

  async manualIssueLoan(userId: string, amount: number, remarks: string) {
    const { data } = await axios.post(
      `${API_BASE_URL}/agent/loan/manual-issue`,
      { userId, amount, remarks },
      { headers: getAgentHeaders() }
    );
    return data;
  },

  async processRepayment(loanId: string, amount: number, paymentMethod: string, remarks?: string) {
    const { data } = await axios.post(
      `${API_BASE_URL}/agent/loan/repay/${loanId}`,
      { amount, paymentMethod, remarks },
      { headers: getAgentHeaders() }
    );
    return data;
  },

  async getActiveLoans(page = 1, limit = 20) {
    const { data } = await axios.get(`${API_BASE_URL}/agent/loan/active-loans`, {
      headers: getAgentHeaders(),
      params: { page, limit },
    });
    return data;
  },

  async adjustLimit(userId: string, newLimit: number) {
    const { data } = await axios.post(
      `${API_BASE_URL}/agent/loan/adjust-limit`,
      { userId, newLimit },
      { headers: getAgentHeaders() }
    );
    return data;
  },

  async getLedger(page = 1, limit = 50, userId?: string) {
    const { data } = await axios.get(`${API_BASE_URL}/agent/loan/ledger`, {
      headers: getAgentHeaders(),
      params: { page, limit, userId },
    });
    return data;
  },

  async getUserAccount(userId: string) {
    const { data } = await axios.get(`${API_BASE_URL}/agent/loan/user-account/${userId}`, {
      headers: getAgentHeaders(),
    });
    return data;
  },

  async getStats() {
    const { data } = await axios.get(`${API_BASE_URL}/agent/loan/stats`, {
      headers: getAgentHeaders(),
    });
    return data;
  },

  async searchAccounts(query: string, page = 1, limit = 20) {
    const { data } = await axios.get(`${API_BASE_URL}/agent/loan/search`, {
      headers: getAgentHeaders(),
      params: { q: query, page, limit },
    });
    return data;
  },

  async getAgentLogs(page = 1, limit = 50) {
    const { data } = await axios.get(`${API_BASE_URL}/agent/loan/agent-logs`, {
      headers: getAgentHeaders(),
      params: { page, limit },
    });
    return data;
  },

  exportLedgerCsvUrl() {
    return `${API_BASE_URL}/agent/loan/ledger/export-csv`;
  },
};
