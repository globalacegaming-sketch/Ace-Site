import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  FileText,
  CreditCard,
  Download,
  ClipboardList,
  SlidersHorizontal,
  Search,
  Banknote,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';
import { agentLoanApi } from '../../services/loanApi';
import { getApiBaseUrl } from '../../utils/api';

const API_BASE_URL = getApiBaseUrl();
const getAdminToken = () => {
  for (const key of ['agent_session', 'admin_session']) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      if (parsed.token && (!parsed.expiresAt || Date.now() <= parsed.expiresAt)) {
        return parsed.token;
      }
    } catch { /* skip */ }
  }
  return null;
};

type SubTab = 'pending' | 'active' | 'manage' | 'ledger' | 'logs';

interface LoanStats {
  totalLoansIssued: number;
  totalOutstandingBalance: number;
  totalOverdueLoans: number;
  totalPaidLoans: number;
  totalRepaid: number;
  activeAccounts: number;
  repaymentRate: string;
}

const PAYMENT_METHODS = [
  { value: 'CASH', label: 'Cash' },
  { value: 'WINNING_DEDUCTION', label: 'Winning Deduction' },
  { value: 'REFERRAL_CREDIT', label: 'Referral Credit' },
  { value: 'TASK_CREDIT', label: 'Task Credit' },
  { value: 'MANUAL_ADJUSTMENT', label: 'Manual Adjustment' },
];

interface AgentLoanPanelProps {
  onNavigateToChat?: (userId: string) => void;
}

const AgentLoanPanel: React.FC<AgentLoanPanelProps> = ({ onNavigateToChat }) => {
  const [subTab, setSubTab] = useState<SubTab>('pending');
  const [stats, setStats] = useState<LoanStats | null>(null);
  const [loading, setLoading] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);
  const [pendingLoaded, setPendingLoaded] = useState(false);

  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [activePage, setActivePage] = useState(1);
  const [activeLoaded, setActiveLoaded] = useState(false);

  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);
  const [ledgerLoaded, setLedgerLoaded] = useState(false);
  const [ledgerUserId, setLedgerUserId] = useState<string | null>(null);
  const [ledgerUserName, setLedgerUserName] = useState<string>('');
  const [ledgerSearch, setLedgerSearch] = useState('');
  const [ledgerSearchResults, setLedgerSearchResults] = useState<any[]>([]);
  const [ledgerSearchOpen, setLedgerSearchOpen] = useState(false);

  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [agentLogsTotal, setAgentLogsTotal] = useState(0);
  const [agentLogsPage, setAgentLogsPage] = useState(1);
  const [logsLoaded, setLogsLoaded] = useState(false);

  // Manage tab state
  const [manageSearch, setManageSearch] = useState('');
  const [manageUsers, setManageUsers] = useState<any[]>([]);
  const [manageUsersLoading, setManageUsersLoading] = useState(false);
  const [manageUsersLoaded, setManageUsersLoaded] = useState(false);
  const [loanModalUser, setLoanModalUser] = useState<any | null>(null);
  const [loanModalType, setLoanModalType] = useState<'limit' | 'issue' | null>(null);
  const [loanAccount, setLoanAccount] = useState<{ loanLimit: number; activeBalance: number } | null>(null);
  const [loanLimitInput, setLoanLimitInput] = useState('');
  const [loanIssueAmount, setLoanIssueAmount] = useState('');
  const [loanRemarks, setLoanRemarks] = useState('');
  const [loanModalLoading, setLoanModalLoading] = useState(false);
  const [loanActionLoading, setLoanActionLoading] = useState(false);

  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'repay';
    data: any;
  } | null>(null);
  const [modalRemarks, setModalRemarks] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('CASH');
  const [actionLoading, setActionLoading] = useState(false);

  const loadStats = useCallback(async () => {
    try {
      const res = await agentLoanApi.getStats();
      if (res.success) setStats(res.data);
    } catch { /* silent */ }
  }, []);

  const loadPending = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentLoanApi.getPendingRequests(pendingPage);
      if (res.success) {
        setPendingRequests(res.data.requests);
        setPendingTotal(res.data.total);
        setPendingLoaded(true);
      }
    } catch { toast.error('Failed to load pending requests.'); }
    finally { setLoading(false); }
  }, [pendingPage]);

  const loadActiveLoans = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentLoanApi.getActiveLoans(activePage);
      if (res.success) {
        setActiveLoans(res.data.loans);
        setActiveTotal(res.data.total);
        setActiveLoaded(true);
      }
    } catch { toast.error('Failed to load active loans.'); }
    finally { setLoading(false); }
  }, [activePage]);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentLoanApi.getLedger(ledgerPage, 50, ledgerUserId || undefined);
      if (res.success) {
        setLedgerEntries(res.data.entries);
        setLedgerTotal(res.data.total);
        setLedgerLoaded(true);
      }
    } catch { toast.error('Failed to load ledger.'); }
    finally { setLoading(false); }
  }, [ledgerPage, ledgerUserId]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const loadAgentLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentLoanApi.getAgentLogs(agentLogsPage);
      if (res.success) {
        setAgentLogs(res.data.logs);
        setAgentLogsTotal(res.data.total);
        setLogsLoaded(true);
      }
    } catch { toast.error('Failed to load agent logs.'); }
    finally { setLoading(false); }
  }, [agentLogsPage]);

  useEffect(() => {
    if (subTab === 'pending' && !pendingLoaded) loadPending();
    else if (subTab === 'active' && !activeLoaded) loadActiveLoans();
    else if (subTab === 'ledger' && !ledgerLoaded) loadLedger();
    else if (subTab === 'logs' && !logsLoaded) loadAgentLogs();
  }, [subTab, pendingLoaded, activeLoaded, ledgerLoaded, logsLoaded, loadPending, loadActiveLoans, loadLedger, loadAgentLogs]);

  // Page changes always require a re-fetch
  useEffect(() => { loadPending(); }, [pendingPage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadActiveLoans(); }, [activePage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadLedger(); }, [ledgerPage]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { loadAgentLogs(); }, [agentLogsPage]); // eslint-disable-line react-hooks/exhaustive-deps

  const invalidateAll = useCallback(() => {
    setPendingLoaded(false);
    setActiveLoaded(false);
    setLedgerLoaded(false);
    setLogsLoaded(false);
  }, []);

  const loadManageUsers = useCallback(async () => {
    setManageUsersLoading(true);
    try {
      const token = getAdminToken();
      if (!token) return;
      const response = await axios.get(`${API_BASE_URL}/admin/users`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (response.data.success) {
        setManageUsers(response.data.data || []);
        setManageUsersLoaded(true);
      }
    } catch { toast.error('Failed to load users'); }
    finally { setManageUsersLoading(false); }
  }, []);

  useEffect(() => {
    if ((subTab === 'manage' || subTab === 'ledger') && !manageUsersLoaded) loadManageUsers();
  }, [subTab, manageUsersLoaded, loadManageUsers]);

  const filteredManageUsers = manageUsers.filter(u => {
    if (!manageSearch.trim()) return true;
    const q = manageSearch.toLowerCase();
    return (
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.fortunePandaUsername?.toLowerCase().includes(q) ||
      u._id?.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    if (!ledgerSearch.trim()) {
      setLedgerSearchResults([]);
      setLedgerSearchOpen(false);
      return;
    }
    const q = ledgerSearch.toLowerCase();
    const results = manageUsers.filter(u =>
      u.username?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u._id?.toLowerCase().includes(q)
    ).slice(0, 8);
    setLedgerSearchResults(results);
    setLedgerSearchOpen(results.length > 0);
  }, [ledgerSearch, manageUsers]);

  const viewUserLedger = useCallback((userId: string, username: string) => {
    setLedgerUserId(userId);
    setLedgerUserName(username);
    setLedgerSearch('');
    setLedgerSearchOpen(false);
    setLedgerPage(1);
    setLedgerLoaded(false);
  }, []);

  const clearLedgerUser = useCallback(() => {
    setLedgerUserId(null);
    setLedgerUserName('');
    setLedgerPage(1);
    setLedgerLoaded(false);
  }, []);

  const openLoanModal = useCallback(async (user: any, type: 'limit' | 'issue') => {
    setLoanModalUser(user);
    setLoanModalType(type);
    setLoanAccount(null);
    setLoanLimitInput('');
    setLoanIssueAmount('');
    setLoanRemarks('');
    setLoanModalLoading(true);
    try {
      const res = await agentLoanApi.getUserAccount(user._id);
      if (res.success && res.data) {
        setLoanAccount({ loanLimit: res.data.loanLimit, activeBalance: res.data.activeBalance });
        if (type === 'limit') setLoanLimitInput(String(res.data.loanLimit));
      } else {
        toast.error('Could not load loan account.');
        setLoanModalUser(null);
        setLoanModalType(null);
      }
    } catch {
      toast.error('Failed to load loan account.');
      setLoanModalUser(null);
      setLoanModalType(null);
    } finally {
      setLoanModalLoading(false);
    }
  }, []);

  const closeLoanModal = useCallback(() => {
    setLoanModalUser(null);
    setLoanModalType(null);
    setLoanAccount(null);
    setLoanLimitInput('');
    setLoanIssueAmount('');
    setLoanRemarks('');
  }, []);

  const handleLoanLimitSubmit = useCallback(async () => {
    if (!loanModalUser) return;
    const limit = Number(loanLimitInput);
    if (!Number.isFinite(limit) || limit < 20 || limit > 500) {
      toast.error('Limit must be between $20 and $500.');
      return;
    }
    setLoanActionLoading(true);
    try {
      const res = await agentLoanApi.adjustLimit(loanModalUser._id, limit);
      if (res.success) {
        toast.success(`Loan limit updated to $${limit}.`);
        closeLoanModal();
        invalidateAll();
        loadStats();
      } else {
        toast.error(res.message || 'Failed to update limit.');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to update limit.');
    } finally {
      setLoanActionLoading(false);
    }
  }, [loanModalUser, loanLimitInput, closeLoanModal, invalidateAll, loadStats]);

  const handleLoanIssueSubmit = useCallback(async () => {
    if (!loanModalUser) return;
    const amount = Number(loanIssueAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error('Enter a valid loan amount.');
      return;
    }
    setLoanActionLoading(true);
    try {
      const res = await agentLoanApi.manualIssueLoan(loanModalUser._id, amount, loanRemarks);
      if (res.success) {
        toast.success(`Loan of $${amount.toFixed(2)} issued.`);
        closeLoanModal();
        invalidateAll();
        loadStats();
      } else {
        toast.error(res.message || 'Failed to issue loan.');
      }
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to issue loan.');
    } finally {
      setLoanActionLoading(false);
    }
  }, [loanModalUser, loanIssueAmount, loanRemarks, closeLoanModal, invalidateAll, loadStats]);

  const handleApprove = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const res = await agentLoanApi.approveRequest(actionModal.data._id, modalRemarks);
      if (res.success) {
        toast.success('Loan approved!');
        setActionModal(null);
        setModalRemarks('');
        invalidateAll();
        loadPending();
        loadStats();
      } else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Approval failed.');
    } finally { setActionLoading(false); }
  };

  const handleReject = async () => {
    if (!actionModal || !modalRemarks.trim()) {
      toast.error('Remarks are required for rejection.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await agentLoanApi.rejectRequest(actionModal.data._id, modalRemarks);
      if (res.success) {
        toast.success('Loan rejected.');
        setActionModal(null);
        setModalRemarks('');
        invalidateAll();
        loadPending();
        loadStats();
      } else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Rejection failed.');
    } finally { setActionLoading(false); }
  };

  const handleRepay = async () => {
    if (!actionModal) return;
    const amount = parseFloat(repayAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setActionLoading(true);
    try {
      const res = await agentLoanApi.processRepayment(actionModal.data._id, amount, repayMethod, modalRemarks || undefined);
      if (res.success) {
        toast.success('Repayment processed!');
        setActionModal(null);
        setRepayAmount('');
        setModalRemarks('');
        invalidateAll();
        loadActiveLoans();
        loadStats();
      } else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Repayment failed.');
    } finally { setActionLoading(false); }
  };

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

  const statusBadge = (status: string) => {
    const map: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-700',
      APPROVED: 'bg-green-100 text-green-700',
      REJECTED: 'bg-red-100 text-red-700',
      ACTIVE: 'bg-blue-100 text-blue-700',
      PAID: 'bg-green-100 text-green-700',
      OVERDUE: 'bg-red-100 text-red-700',
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${map[status] || 'bg-gray-100 text-gray-600'}`}>
        {status}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total Issued', value: stats.totalLoansIssued, icon: <FileText className="w-4 h-4" />, color: 'text-blue-600' },
            { label: 'Outstanding', value: `$${stats.totalOutstandingBalance.toFixed(2)}`, icon: <DollarSign className="w-4 h-4" />, color: 'text-orange-600' },
            { label: 'Overdue', value: stats.totalOverdueLoans, icon: <AlertTriangle className="w-4 h-4" />, color: 'text-red-600' },
            { label: 'Repayment Rate', value: `${stats.repaymentRate}%`, icon: <TrendingUp className="w-4 h-4" />, color: 'text-green-600' },
          ].map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm">
              <div className={`flex items-center gap-1.5 text-xs font-medium mb-1 ${s.color}`}>{s.icon} {s.label}</div>
              <p className="text-lg font-bold text-gray-900">{s.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Sub-tabs */}
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 overflow-x-auto">
        {([
          { key: 'pending', label: 'Pending', icon: <Clock className="w-3.5 h-3.5" />, count: pendingTotal },
          { key: 'active', label: 'Active Loans', icon: <CreditCard className="w-3.5 h-3.5" /> },
          { key: 'manage', label: 'Issue / Limit', icon: <Banknote className="w-3.5 h-3.5" /> },
          { key: 'ledger', label: 'Ledger', icon: <FileText className="w-3.5 h-3.5" /> },
          { key: 'logs', label: 'Activity', icon: <ClipboardList className="w-3.5 h-3.5" /> },
        ] as const).map((t) => (
          <button
            key={t.key}
            onClick={() => setSubTab(t.key)}
            className={`flex items-center gap-1 px-3 py-2 rounded-lg text-xs sm:text-sm font-medium flex-1 justify-center transition ${
              subTab === t.key ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            {t.icon}
            <span className="hidden sm:inline">{t.label}</span>
            <span className="sm:hidden">{t.label.split(' ')[0]}</span>
            {'count' in t && t.count > 0 && (
              <span className="ml-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      {loading && (
        <div className="flex justify-center py-8">
          <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
        </div>
      )}

      {/* Pending Requests */}
      {subTab === 'pending' && !loading && (
        <div className="space-y-2">
          {pendingRequests.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No pending loan requests.</p>
          ) : (
            pendingRequests.map((req) => (
              <div key={req._id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {onNavigateToChat && req.userId?._id ? (
                        <button onClick={() => onNavigateToChat(req.userId._id)} className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left">
                          {req.userId?.username || 'Unknown User'}
                        </button>
                      ) : (req.userId?.username || 'Unknown User')}
                    </p>
                    <p className="text-xs text-gray-500">{req.userId?.email}</p>
                  </div>
                  <p className="text-lg font-bold text-indigo-600">${req.requestedAmount.toFixed(2)}</p>
                </div>
                <p className="text-xs text-gray-500 mb-3">Requested: {formatDate(req.createdAt)}</p>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setActionModal({ type: 'approve', data: req }); setModalRemarks(''); }}
                    className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-1 transition"
                  >
                    <CheckCircle className="w-4 h-4" /> Approve
                  </button>
                  <button
                    onClick={() => { setActionModal({ type: 'reject', data: req }); setModalRemarks(''); }}
                    className="flex-1 py-2 rounded-lg bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-1 transition"
                  >
                    <XCircle className="w-4 h-4" /> Reject
                  </button>
                </div>
              </div>
            ))
          )}
          {pendingTotal > 20 && (
            <div className="flex justify-center gap-2 pt-2">
              <button disabled={pendingPage <= 1} onClick={() => setPendingPage(p => p - 1)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {pendingPage}</span>
              <button disabled={pendingPage * 20 >= pendingTotal} onClick={() => setPendingPage(p => p + 1)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-50">Next</button>
            </div>
          )}
        </div>
      )}

      {/* Active Loans */}
      {subTab === 'active' && !loading && (
        <div className="space-y-2">
          {activeLoans.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No active loans.</p>
          ) : (
            activeLoans.map((loan) => (
              <div key={loan._id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <p className="font-semibold text-gray-900">
                      {onNavigateToChat && loan.userId?._id ? (
                        <button onClick={() => onNavigateToChat(loan.userId._id)} className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left">
                          {loan.userId?.username || 'Unknown'}
                        </button>
                      ) : (loan.userId?.username || 'Unknown')}
                    </p>
                    <p className="text-xs text-gray-500">{loan.userId?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">${(loan.remainingBalance ?? loan.principalAmount).toFixed(2)}</p>
                    {loan.remainingBalance != null && loan.remainingBalance !== loan.principalAmount && (
                      <p className="text-[10px] text-gray-500">of ${loan.principalAmount.toFixed(2)}</p>
                    )}
                    {statusBadge(loan.status)}
                  </div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-3">
                  <span>Issued: {formatDate(loan.issuedAt)}</span>
                  <span className={loan.status === 'OVERDUE' ? 'text-red-600 font-semibold' : ''}>
                    Due: {new Date(loan.dueAt).toLocaleDateString()}
                  </span>
                </div>
                <button
                  onClick={() => {
                    const remaining = loan.remainingBalance ?? loan.principalAmount;
                    setActionModal({ type: 'repay', data: loan });
                    setRepayAmount(remaining > 0 ? remaining.toFixed(2) : '');
                    setRepayMethod('CASH');
                    setModalRemarks('');
                  }}
                  className="w-full py-2 rounded-lg bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium flex items-center justify-center gap-1 transition"
                >
                  <DollarSign className="w-4 h-4" /> Process Repayment
                </button>
              </div>
            ))
          )}
          {activeTotal > 20 && (
            <div className="flex justify-center gap-2 pt-2">
              <button disabled={activePage <= 1} onClick={() => setActivePage(p => p - 1)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-50">Prev</button>
              <span className="px-3 py-1 text-sm text-gray-600">Page {activePage}</span>
              <button disabled={activePage * 20 >= activeTotal} onClick={() => setActivePage(p => p + 1)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-50">Next</button>
            </div>
          )}
        </div>
      )}

      {/* Manage - Issue / Limit */}
      {subTab === 'manage' && (
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search user by name, email, or FP account..."
              value={manageSearch}
              onChange={(e) => setManageSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-700 placeholder-gray-400"
            />
          </div>
          {manageUsersLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
            </div>
          ) : filteredManageUsers.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">
              {manageSearch.trim() ? 'No users match your search.' : 'No users found.'}
            </p>
          ) : (
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {filteredManageUsers.map((u) => (
                <div key={u._id} className="bg-white rounded-xl border border-gray-200 p-3 shadow-sm flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-gray-900 truncate">
                      {onNavigateToChat ? (
                        <button onClick={() => onNavigateToChat(u._id)} className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left">
                          {u.username}
                        </button>
                      ) : u.username}
                    </p>
                    <p className="text-xs text-gray-500 truncate">{u.email}</p>
                  </div>
                  <div className="flex items-center gap-1.5 flex-shrink-0">
                    <button
                      onClick={() => openLoanModal(u, 'limit')}
                      className="px-3 py-1.5 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200 transition-colors text-xs font-medium flex items-center gap-1"
                      title="Adjust loan limit"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Limit</span>
                    </button>
                    <button
                      onClick={() => openLoanModal(u, 'issue')}
                      className="px-3 py-1.5 rounded-lg bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 transition-colors text-xs font-medium flex items-center gap-1"
                      title="Issue loan"
                    >
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Issue</span>
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Loan Limit / Issue Modal */}
      {loanModalUser && loanModalType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4" onClick={() => !loanActionLoading && closeLoanModal()}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-md mx-auto border border-gray-200 max-h-[95vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-3 rounded-t-2xl sm:rounded-t-2xl flex items-center justify-between sticky top-0 z-10">
              <h3 className="text-base font-bold text-white">
                {loanModalType === 'limit' ? 'Adjust Loan Limit' : 'Issue Loan'} — {loanModalUser.username}
              </h3>
              <button onClick={closeLoanModal} disabled={loanActionLoading} className="text-white hover:bg-white/20 rounded-lg p-2 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 sm:p-6">
              {loanModalLoading ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-green-600" />
                </div>
              ) : loanAccount ? (
                <>
                  <p className="text-sm text-gray-600 mb-4">
                    Limit: <strong>${loanAccount.loanLimit.toFixed(2)}</strong>
                    {' · '}Owed: <strong>${loanAccount.activeBalance.toFixed(2)}</strong>
                    {' · '}Available: <strong>${(loanAccount.loanLimit - loanAccount.activeBalance).toFixed(2)}</strong>
                  </p>
                  {loanModalType === 'limit' ? (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">New limit ($20 – $500)</label>
                        <input
                          type="number"
                          min={20}
                          max={500}
                          value={loanLimitInput}
                          onChange={(e) => setLoanLimitInput(e.target.value)}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-green-500 outline-none"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={closeLoanModal} disabled={loanActionLoading} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">
                          Cancel
                        </button>
                        <button onClick={handleLoanLimitSubmit} disabled={loanActionLoading} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                          {loanActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><SlidersHorizontal className="w-4 h-4" /> Update</>}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Loan amount</label>
                        <input
                          type="number"
                          min={1}
                          step={1}
                          value={loanIssueAmount}
                          onChange={(e) => setLoanIssueAmount(e.target.value)}
                          placeholder="0.00"
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-green-500 outline-none placeholder:text-gray-400"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Remarks (optional)</label>
                        <textarea
                          value={loanRemarks}
                          onChange={(e) => setLoanRemarks(e.target.value)}
                          placeholder="Reason for manual issuance..."
                          rows={2}
                          className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-gray-900 focus:ring-2 focus:ring-green-500 outline-none resize-none placeholder:text-gray-400"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button onClick={closeLoanModal} disabled={loanActionLoading} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">
                          Cancel
                        </button>
                        <button onClick={handleLoanIssueSubmit} disabled={loanActionLoading || !loanIssueAmount} className="flex-1 py-2.5 rounded-xl bg-green-600 hover:bg-green-700 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                          {loanActionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><DollarSign className="w-4 h-4" /> Issue Loan</>}
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        </div>
      )}

      {/* Ledger */}
      {subTab === 'ledger' && !loading && (
        <div className="space-y-3">
          {ledgerUserId && (
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-200 rounded-lg px-4 py-2.5">
              <FileText className="w-4 h-4 text-indigo-600 flex-shrink-0" />
              <span className="text-sm text-indigo-900 font-medium">Showing records for <strong>{ledgerUserName}</strong></span>
              <button onClick={clearLedgerUser} className="ml-auto p-1 hover:bg-indigo-100 rounded-md transition-colors" title="Show all">
                <X className="w-4 h-4 text-indigo-600" />
              </button>
            </div>
          )}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search user to view their records..."
                value={ledgerSearch}
                onChange={(e) => setLedgerSearch(e.target.value)}
                onBlur={() => setTimeout(() => setLedgerSearchOpen(false), 200)}
                onFocus={() => { if (ledgerSearchResults.length > 0) setLedgerSearchOpen(true); }}
                className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm text-gray-700 placeholder-gray-400"
              />
              {ledgerSearchOpen && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-60 overflow-y-auto">
                  {ledgerSearchResults.map(u => (
                    <button
                      key={u._id}
                      onClick={() => viewUserLedger(u._id, u.username)}
                      className="w-full text-left px-4 py-2.5 hover:bg-indigo-50 transition-colors flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">{u.username}</p>
                        <p className="text-xs text-gray-500 truncate">{u.email}</p>
                      </div>
                      <FileText className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 ml-2" />
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className="flex gap-2 flex-shrink-0">
            <a
              href={agentLoanApi.exportLedgerCsvUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
              onClick={(e) => {
                e.preventDefault();
                const token = getAdminToken() || '';
                fetch(agentLoanApi.exportLedgerCsvUrl(), {
                  headers: { Authorization: `Bearer ${token}` },
                })
                  .then(r => r.blob())
                  .then(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = `loan_ledger_${new Date().toISOString().slice(0, 10)}.csv`;
                    a.click();
                    URL.revokeObjectURL(url);
                  })
                  .catch(() => toast.error('Export failed.'));
              }}
            >
              <Download className="w-3.5 h-3.5" /> Export CSV
            </a>
            </div>
          </div>
          {ledgerEntries.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">
              {ledgerUserId ? `No ledger entries for ${ledgerUserName}.` : 'No ledger entries.'}
            </p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">User</th>
                      <th className="py-2 pr-2">Type</th>
                      <th className="py-2 pr-2 text-right">Amount</th>
                      <th className="py-2 hidden sm:table-cell">Note</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledgerEntries.map((e) => (
                      <tr key={e._id} className="border-b border-gray-100">
                        <td className="py-2 pr-2 text-gray-600 text-xs whitespace-nowrap">{formatDate(e.createdAt)}</td>
                        <td className="py-2 pr-2 font-medium text-gray-900">
                          {(e.userId as any)?._id ? (
                            <button
                              onClick={() => viewUserLedger((e.userId as any)._id, (e.userId as any)?.username || '—')}
                              className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left"
                            >
                              {(e.userId as any)?.username || '—'}
                            </button>
                          ) : ((e.userId as any)?.username || '—')}
                        </td>
                        <td className="py-2 pr-2">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                            e.type === 'ISSUE' ? 'bg-blue-100 text-blue-700' : 'bg-green-100 text-green-700'
                          }`}>
                            {e.type.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className={`py-2 pr-2 text-right font-semibold ${e.type === 'ISSUE' ? 'text-blue-600' : 'text-green-600'}`}>
                          {e.type === 'ISSUE' ? '+' : '-'}${e.amount.toFixed(2)}
                        </td>
                        <td className="py-2 text-xs text-gray-500 hidden sm:table-cell truncate max-w-[150px]">{e.note || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {ledgerTotal > 50 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button disabled={ledgerPage <= 1} onClick={() => setLedgerPage(p => p - 1)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-50">Prev</button>
                  <span className="px-3 py-1 text-sm text-gray-600">Page {ledgerPage}</span>
                  <button disabled={ledgerPage * 50 >= ledgerTotal} onClick={() => setLedgerPage(p => p + 1)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-50">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Agent Activity Logs */}
      {subTab === 'logs' && !loading && (
        <div className="space-y-2">
          {agentLogs.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No activity logs yet.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 text-left text-xs text-gray-500 uppercase">
                      <th className="py-2 pr-2">Date</th>
                      <th className="py-2 pr-2">Agent</th>
                      <th className="py-2 pr-2">Action</th>
                      <th className="py-2 pr-2">User</th>
                      <th className="py-2 hidden sm:table-cell">Details</th>
                    </tr>
                  </thead>
                  <tbody>
                    {agentLogs.map((log: any) => (
                      <tr key={log._id} className="border-b border-gray-100">
                        <td className="py-2 pr-2 text-gray-600 text-xs whitespace-nowrap">{formatDate(log.createdAt)}</td>
                        <td className="py-2 pr-2 font-medium text-gray-900 text-xs">{log.agentId}</td>
                        <td className="py-2 pr-2">
                          <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${
                            log.action === 'APPROVE' ? 'bg-green-100 text-green-700' :
                            log.action === 'REJECT' ? 'bg-red-100 text-red-700' :
                            log.action === 'REPAYMENT' ? 'bg-blue-100 text-blue-700' :
                            log.action === 'MANUAL_ISSUE' ? 'bg-purple-100 text-purple-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {log.action.replace(/_/g, ' ')}
                          </span>
                        </td>
                        <td className="py-2 pr-2 text-gray-900 text-xs">
                          {onNavigateToChat && (log.targetUserId as any)?._id ? (
                            <button onClick={() => onNavigateToChat((log.targetUserId as any)._id)} className="hover:text-indigo-600 hover:underline transition-colors cursor-pointer text-left">
                              {(log.targetUserId as any)?.username || '—'}
                            </button>
                          ) : ((log.targetUserId as any)?.username || '—')}
                        </td>
                        <td className="py-2 text-xs text-gray-500 hidden sm:table-cell truncate max-w-[200px]">
                          {log.details?.amount ? `$${log.details.amount.toFixed(2)}` : ''}
                          {log.details?.remarks ? ` — ${log.details.remarks}` : ''}
                          {log.details?.oldLimit != null ? `$${log.details.oldLimit} → $${log.details.newLimit}` : ''}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {agentLogsTotal > 50 && (
                <div className="flex justify-center gap-2 pt-2">
                  <button disabled={agentLogsPage <= 1} onClick={() => setAgentLogsPage(p => p - 1)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-50">Prev</button>
                  <span className="px-3 py-1 text-sm text-gray-600">Page {agentLogsPage}</span>
                  <button disabled={agentLogsPage * 50 >= agentLogsTotal} onClick={() => setAgentLogsPage(p => p + 1)} className="px-3 py-1 text-sm bg-gray-100 rounded-lg disabled:opacity-50">Next</button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Modals */}
      {actionModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => !actionLoading && setActionModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
            {/* Approve Modal */}
            {actionModal.type === 'approve' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Approve Loan Request</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Approve <strong>${actionModal.data.requestedAmount.toFixed(2)}</strong> for <strong>{actionModal.data.userId?.username}</strong>?
                </p>
                <textarea
                  value={modalRemarks}
                  onChange={(e) => setModalRemarks(e.target.value)}
                  placeholder="Remarks (optional)..."
                  rows={2}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-4 focus:ring-2 focus:ring-green-500 outline-none resize-none text-gray-900 placeholder:text-gray-400"
                />
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} disabled={actionLoading} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">Cancel</button>
                  <button onClick={handleApprove} disabled={actionLoading} className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><CheckCircle className="w-4 h-4" /> Approve</>}
                  </button>
                </div>
              </>
            )}

            {/* Reject Modal */}
            {actionModal.type === 'reject' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Reject Loan Request</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Reject <strong>${actionModal.data.requestedAmount.toFixed(2)}</strong> for <strong>{actionModal.data.userId?.username}</strong>?
                </p>
                <textarea
                  value={modalRemarks}
                  onChange={(e) => setModalRemarks(e.target.value)}
                  placeholder="Reason for rejection (required)..."
                  rows={3}
                  className="w-full border border-gray-300 rounded-xl p-3 text-sm mb-4 focus:ring-2 focus:ring-red-500 outline-none resize-none text-gray-900 placeholder:text-gray-400"
                />
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} disabled={actionLoading} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">Cancel</button>
                  <button onClick={handleReject} disabled={actionLoading || !modalRemarks.trim()} className="flex-1 py-2.5 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><XCircle className="w-4 h-4" /> Reject</>}
                  </button>
                </div>
              </>
            )}

            {/* Repay Modal */}
            {actionModal.type === 'repay' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Process Repayment</h3>
                <p className="text-sm text-gray-500 mb-4">
                  Remaining: <strong>${actionModal.data.remainingBalance != null ? actionModal.data.remainingBalance.toFixed(2) : actionModal.data.principalAmount.toFixed(2)}</strong>
                  {actionModal.data.remainingBalance != null && actionModal.data.remainingBalance !== actionModal.data.principalAmount && (
                    <span> (of ${actionModal.data.principalAmount.toFixed(2)} principal)</span>
                  )}
                  {' — '}{actionModal.data.userId?.username}
                </p>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Amount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={repayAmount}
                        onChange={(e) => setRepayAmount(e.target.value)}
                        min="0.01"
                        step="0.01"
                        placeholder={(actionModal.data.remainingBalance ?? actionModal.data.principalAmount).toFixed(2)}
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
                    <select
                      value={repayMethod}
                      onChange={(e) => setRepayMethod(e.target.value)}
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none bg-white text-gray-900"
                    >
                      {PAYMENT_METHODS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remarks (optional)</label>
                    <input
                      value={modalRemarks}
                      onChange={(e) => setModalRemarks(e.target.value)}
                      placeholder="Notes..."
                      className="w-full px-3 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} disabled={actionLoading} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">Cancel</button>
                  <button onClick={handleRepay} disabled={actionLoading} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><DollarSign className="w-4 h-4" /> Submit</>}
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      )}
    </div>
  );
};

export default AgentLoanPanel;
