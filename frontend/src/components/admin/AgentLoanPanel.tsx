import React, { useState, useEffect, useCallback } from 'react';
import {
  Loader2,
  Search,
  CheckCircle,
  XCircle,
  Clock,
  AlertTriangle,
  DollarSign,
  TrendingUp,
  FileText,
  Users,
  CreditCard,
  SlidersHorizontal,
  Download,
  ClipboardList,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { agentLoanApi } from '../../services/loanApi';

type SubTab = 'pending' | 'active' | 'ledger' | 'search' | 'logs';

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

const AgentLoanPanel: React.FC = () => {
  const [subTab, setSubTab] = useState<SubTab>('pending');
  const [stats, setStats] = useState<LoanStats | null>(null);
  const [loading, setLoading] = useState(false);

  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [pendingTotal, setPendingTotal] = useState(0);
  const [pendingPage, setPendingPage] = useState(1);

  const [activeLoans, setActiveLoans] = useState<any[]>([]);
  const [activeTotal, setActiveTotal] = useState(0);
  const [activePage, setActivePage] = useState(1);

  const [ledgerEntries, setLedgerEntries] = useState<any[]>([]);
  const [ledgerTotal, setLedgerTotal] = useState(0);
  const [ledgerPage, setLedgerPage] = useState(1);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);

  const [agentLogs, setAgentLogs] = useState<any[]>([]);
  const [agentLogsTotal, setAgentLogsTotal] = useState(0);
  const [agentLogsPage, setAgentLogsPage] = useState(1);

  const [actionModal, setActionModal] = useState<{
    type: 'approve' | 'reject' | 'repay' | 'limit' | 'issue';
    data: any;
  } | null>(null);
  const [modalRemarks, setModalRemarks] = useState('');
  const [repayAmount, setRepayAmount] = useState('');
  const [repayMethod, setRepayMethod] = useState('CASH');
  const [newLimit, setNewLimit] = useState('');
  const [issueAmount, setIssueAmount] = useState('');
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
      }
    } catch { toast.error('Failed to load active loans.'); }
    finally { setLoading(false); }
  }, [activePage]);

  const loadLedger = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentLoanApi.getLedger(ledgerPage);
      if (res.success) {
        setLedgerEntries(res.data.entries);
        setLedgerTotal(res.data.total);
      }
    } catch { toast.error('Failed to load ledger.'); }
    finally { setLoading(false); }
  }, [ledgerPage]);

  useEffect(() => { loadStats(); }, [loadStats]);

  const loadAgentLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await agentLoanApi.getAgentLogs(agentLogsPage);
      if (res.success) {
        setAgentLogs(res.data.logs);
        setAgentLogsTotal(res.data.total);
      }
    } catch { toast.error('Failed to load agent logs.'); }
    finally { setLoading(false); }
  }, [agentLogsPage]);

  const loadAllAccounts = useCallback(async () => {
    setSearchLoading(true);
    try {
      const res = await agentLoanApi.searchAccounts('');
      if (res.success) setSearchResults(res.data.accounts);
    } catch { /* silent */ }
    finally { setSearchLoading(false); }
  }, []);

  useEffect(() => {
    if (subTab === 'pending') loadPending();
    else if (subTab === 'active') loadActiveLoans();
    else if (subTab === 'ledger') loadLedger();
    else if (subTab === 'search') loadAllAccounts();
    else if (subTab === 'logs') loadAgentLogs();
  }, [subTab, loadPending, loadActiveLoans, loadLedger, loadAllAccounts, loadAgentLogs]);

  const handleSearch = async () => {
    setSearchLoading(true);
    try {
      const res = await agentLoanApi.searchAccounts(searchQuery);
      if (res.success) setSearchResults(res.data.accounts);
    } catch { toast.error('Search failed.'); }
    finally { setSearchLoading(false); }
  };

  const handleApprove = async () => {
    if (!actionModal) return;
    setActionLoading(true);
    try {
      const res = await agentLoanApi.approveRequest(actionModal.data._id, modalRemarks);
      if (res.success) {
        toast.success('Loan approved!');
        setActionModal(null);
        setModalRemarks('');
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
        loadActiveLoans();
        loadStats();
      } else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Repayment failed.');
    } finally { setActionLoading(false); }
  };

  const handleLimitAdjust = async () => {
    if (!actionModal) return;
    const limit = parseInt(newLimit);
    if (!limit || limit < 20 || limit > 500) {
      toast.error('Limit must be between $20 and $500.');
      return;
    }
    setActionLoading(true);
    try {
      const userId = actionModal.data.userId?._id || actionModal.data.userId;
      const res = await agentLoanApi.adjustLimit(userId, limit);
      if (res.success) {
        toast.success(`Limit updated to $${limit}.`);
        setActionModal(null);
        setNewLimit('');
        if (searchQuery) handleSearch();
        loadStats();
      } else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Limit adjustment failed.');
    } finally { setActionLoading(false); }
  };

  const handleIssueLoan = async () => {
    if (!actionModal) return;
    const amount = parseFloat(issueAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid amount.');
      return;
    }
    setActionLoading(true);
    try {
      const userId = actionModal.data.userId?._id || actionModal.data.userId;
      const res = await agentLoanApi.manualIssueLoan(userId, amount, modalRemarks);
      if (res.success) {
        toast.success(`Loan of $${amount.toFixed(2)} issued!`);
        setActionModal(null);
        setIssueAmount('');
        setModalRemarks('');
        if (searchQuery) handleSearch();
        loadStats();
      } else toast.error(res.message);
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Failed to issue loan.');
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
          { key: 'ledger', label: 'Ledger', icon: <FileText className="w-3.5 h-3.5" /> },
          { key: 'search', label: 'Users', icon: <Users className="w-3.5 h-3.5" /> },
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
                      {req.userId?.username || 'Unknown User'}
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
                    <p className="font-semibold text-gray-900">{loan.userId?.username || 'Unknown'}</p>
                    <p className="text-xs text-gray-500">{loan.userId?.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-gray-900">${loan.principalAmount.toFixed(2)}</p>
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
                    setActionModal({ type: 'repay', data: loan });
                    setRepayAmount('');
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

      {/* Ledger */}
      {subTab === 'ledger' && !loading && (
        <div className="space-y-2">
          <div className="flex justify-end">
            <a
              href={agentLoanApi.exportLedgerCsvUrl()}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-medium transition"
              onClick={(e) => {
                e.preventDefault();
                const session = localStorage.getItem('admin_session');
                let token = '';
                if (session) {
                  try { token = JSON.parse(session).token; } catch { /* */ }
                }
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
          {ledgerEntries.length === 0 ? (
            <p className="text-center text-gray-500 py-8 text-sm">No ledger entries.</p>
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
                        <td className="py-2 pr-2 font-medium text-gray-900">{(e.userId as any)?.username || '—'}</td>
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

      {/* Search Users */}
      {subTab === 'search' && (
        <div className="space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (!e.target.value.trim()) loadAllAccounts();
                }}
                onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                placeholder="Search by username or email..."
                className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none text-gray-900 placeholder:text-gray-400"
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searchLoading}
              className="px-4 py-2.5 bg-indigo-500 hover:bg-indigo-600 text-white rounded-xl text-sm font-medium flex items-center gap-1 transition disabled:opacity-50"
            >
              {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
            </button>
          </div>

          {searchResults.map((acc) => (
            <div key={acc._id} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-semibold text-gray-900">{(acc.userId as any)?.username || 'Unknown'}</p>
                  <p className="text-xs text-gray-500">{(acc.userId as any)?.email}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Limit</p>
                  <p className="font-bold text-gray-900">${acc.loanLimit.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Owed</p>
                  <p className={`font-bold ${acc.activeBalance > 0 ? 'text-red-600' : 'text-green-600'}`}>${acc.activeBalance.toFixed(2)}</p>
                </div>
                <div className="bg-gray-50 rounded-lg p-2 text-center">
                  <p className="text-[10px] text-gray-500 uppercase">Available</p>
                  <p className="font-bold text-green-600">${(acc.loanLimit - acc.activeBalance).toFixed(2)}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActionModal({ type: 'issue', data: acc });
                    setIssueAmount('');
                    setModalRemarks('');
                  }}
                  className="flex-1 py-2 rounded-lg bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-1 transition"
                >
                  <DollarSign className="w-4 h-4" /> Issue Loan
                </button>
                <button
                  onClick={() => {
                    setActionModal({ type: 'limit', data: acc });
                    setNewLimit(acc.loanLimit.toString());
                  }}
                  className="flex-1 py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium flex items-center justify-center gap-1 transition"
                >
                  <SlidersHorizontal className="w-4 h-4" /> Adjust Limit
                </button>
              </div>
            </div>
          ))}
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
                        <td className="py-2 pr-2 text-gray-900 text-xs">{(log.targetUserId as any)?.username || '—'}</td>
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
                  Loan: <strong>${actionModal.data.principalAmount.toFixed(2)}</strong> — {actionModal.data.userId?.username}
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
                        placeholder="0.00"
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

            {/* Limit Adjust Modal */}
            {actionModal.type === 'limit' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Adjust Loan Limit</h3>
                <p className="text-sm text-gray-500 mb-4">
                  User: <strong>{(actionModal.data.userId as any)?.username || 'Unknown'}</strong>
                  {' '}| Current: <strong>${actionModal.data.loanLimit.toFixed(2)}</strong>
                  {' '}| Owed: <strong>${actionModal.data.activeBalance.toFixed(2)}</strong>
                </p>
                <div className="mb-4">
                  <label className="block text-xs font-medium text-gray-600 mb-1">New Limit ($20 – $500)</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      type="number"
                      value={newLimit}
                      onChange={(e) => setNewLimit(e.target.value)}
                      min="20"
                      max="500"
                      step="10"
                      className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-indigo-500 outline-none text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                  <input
                    type="range"
                    min="20"
                    max="500"
                    step="10"
                    value={newLimit || 20}
                    onChange={(e) => setNewLimit(e.target.value)}
                    className="w-full mt-2 accent-indigo-500"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} disabled={actionLoading} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">Cancel</button>
                  <button onClick={handleLimitAdjust} disabled={actionLoading} className="flex-1 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-600 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><SlidersHorizontal className="w-4 h-4" /> Update</>}
                  </button>
                </div>
              </>
            )}

            {/* Issue Loan Modal */}
            {actionModal.type === 'issue' && (
              <>
                <h3 className="text-lg font-bold text-gray-900 mb-1">Issue Loan</h3>
                <p className="text-sm text-gray-500 mb-4">
                  User: <strong>{(actionModal.data.userId as any)?.username || 'Unknown'}</strong>
                  {' '}| Limit: <strong>${actionModal.data.loanLimit.toFixed(2)}</strong>
                  {' '}| Available: <strong>${(actionModal.data.loanLimit - actionModal.data.activeBalance).toFixed(2)}</strong>
                </p>
                <div className="space-y-3 mb-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Loan Amount</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="number"
                        value={issueAmount}
                        onChange={(e) => setIssueAmount(e.target.value)}
                        min="1"
                        step="1"
                        placeholder="0.00"
                        className="w-full pl-8 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-green-500 outline-none text-gray-900 placeholder:text-gray-400"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Remarks (optional)</label>
                    <textarea
                      value={modalRemarks}
                      onChange={(e) => setModalRemarks(e.target.value)}
                      placeholder="Reason for manual issuance..."
                      rows={2}
                      className="w-full border border-gray-300 rounded-xl p-3 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none text-gray-900 placeholder:text-gray-400"
                    />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setActionModal(null)} disabled={actionLoading} className="flex-1 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-sm font-medium">Cancel</button>
                  <button onClick={handleIssueLoan} disabled={actionLoading || !issueAmount} className="flex-1 py-2.5 rounded-xl bg-green-500 hover:bg-green-600 text-white text-sm font-medium flex items-center justify-center gap-1 disabled:opacity-50">
                    {actionLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><DollarSign className="w-4 h-4" /> Issue Loan</>}
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
