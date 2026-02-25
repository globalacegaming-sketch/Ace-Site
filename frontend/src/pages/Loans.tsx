import { useState, useEffect, useCallback } from 'react';
import {
  Banknote,
  Loader2,
  Clock,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Send,
  DollarSign,
  CalendarDays,
  History,
  TrendingUp,
  RefreshCw,
  ScrollText,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { loanApi, type LoanSummary } from '../services/loanApi';

export default function LoansPage() {
  const [data, setData] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'requests' | 'loans' | 'payments' | 'terms'>('overview');

  const [historyPage, setHistoryPage] = useState<Record<string, number>>({ requests: 1, loans: 1, payments: 1 });
  const [historyHasMore, setHistoryHasMore] = useState<Record<string, boolean>>({ requests: true, loans: true, payments: true });
  const [loadingMore, setLoadingMore] = useState(false);

  const fetchData = useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await loanApi.getAccount();
      if (res.success && res.data) {
        setData(res.data);
      }
    } catch {
      toast.error('Failed to load loan information.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadMore = async (type: 'requests' | 'loans' | 'payments') => {
    const nextPage = historyPage[type] + 1;
    setLoadingMore(true);
    try {
      const res = await loanApi.getHistory(type, nextPage);
      if (res.success && res.data) {
        const newItems = res.data.items;
        if (data) {
          const key = type === 'requests' ? 'requestHistory' : type === 'loans' ? 'loanHistory' : 'repaymentHistory';
          setData({ ...data, [key]: [...(data as any)[key], ...newItems] });
        }
        setHistoryPage(prev => ({ ...prev, [type]: nextPage }));
        setHistoryHasMore(prev => ({ ...prev, [type]: nextPage < res.data.totalPages }));
      }
    } catch { /* silent */ }
    finally { setLoadingMore(false); }
  };

  const handleSubmitRequest = async () => {
    const amount = parseFloat(requestAmount);
    if (!amount || amount < 10 || amount > 100) {
      toast.error('Enter an amount between $10 and $100.');
      return;
    }
    if (data && amount > data.availableToBorrow) {
      toast.error(`Amount exceeds available limit of $${data.availableToBorrow.toFixed(2)}.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await loanApi.submitRequest(amount);
      if (res.success) {
        toast.success('Loan request submitted!');
        setRequestAmount('');
        fetchData();
      } else {
        toast.error(res.message || 'Failed to submit request.');
      }
    } catch (err: any) {
      toast.error(err?.response?.data?.message || 'Failed to submit request.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });

  const getStatusBadge = (status: string) => {
    const styles: Record<string, { bg: string; text: string; icon: React.ReactNode }> = {
      PENDING: { bg: 'rgba(255, 183, 0, 0.15)', text: '#FFB700', icon: <Clock className="w-3 h-3" /> },
      APPROVED: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', icon: <CheckCircle className="w-3 h-3" /> },
      REJECTED: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', icon: <XCircle className="w-3 h-3" /> },
      ACTIVE: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', icon: <TrendingUp className="w-3 h-3" /> },
      PAID: { bg: 'rgba(34, 197, 94, 0.15)', text: '#22c55e', icon: <CheckCircle className="w-3 h-3" /> },
      OVERDUE: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', icon: <AlertTriangle className="w-3 h-3" /> },
    };
    const s = styles[status] || styles.PENDING;
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: s.bg, color: s.text }}
      >
        {s.icon} {status}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-8 flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)' }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#FFD700' }} />
      </div>
    );
  }

  const canRequest = data && !data.pendingRequest && data.availableToBorrow >= 10;
  const hasOverdue = data?.activeLoan?.status === 'OVERDUE';

  return (
    <div className="min-h-screen pt-16 sm:pt-20 pb-4 sm:pb-6 lg:pb-8" style={{ background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)' }}>
      <div className="absolute inset-0 -z-10 pointer-events-none overflow-hidden" aria-hidden>
        <div className="absolute top-20 left-5 sm:left-10 w-40 sm:w-64 h-40 sm:h-64 rounded-full blur-3xl opacity-20 animate-pulse" style={{ backgroundColor: '#FF6F00' }} />
        <div className="absolute bottom-20 right-5 sm:right-10 w-48 sm:w-72 h-48 sm:h-72 rounded-full blur-3xl opacity-15" style={{ backgroundColor: '#00B0FF' }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="mb-4 sm:mb-8 flex items-start justify-between">
          <div>
            <h1 className="text-lg sm:text-2xl lg:text-3xl font-bold casino-text-primary mb-1 sm:mb-2 flex items-center gap-1.5 sm:gap-2">
              <Banknote className="w-5 h-5 sm:w-7 sm:h-7" style={{ color: '#FFD700' }} />
              Loans
            </h1>
            <p className="text-xs sm:text-base casino-text-secondary">
              Request short-term zero-interest loans to keep playing.
            </p>
          </div>
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="p-1.5 sm:p-2 rounded-lg transition-all active:scale-90"
            style={{ background: 'rgba(255, 255, 255, 0.08)' }}
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${refreshing ? 'animate-spin' : ''}`} style={{ color: '#FFD700' }} />
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3 mb-4 sm:mb-6">
          <div className="rounded-xl p-2.5 sm:p-4 text-center" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <p className="text-[10px] sm:text-xs casino-text-secondary mb-0.5 sm:mb-1">Loan Limit</p>
            <p className="text-sm sm:text-lg font-bold" style={{ color: '#FFD700' }}>${data?.loanLimit.toFixed(2)}</p>
          </div>
          <div className="rounded-xl p-2.5 sm:p-4 text-center" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <p className="text-[10px] sm:text-xs casino-text-secondary mb-0.5 sm:mb-1">Owed</p>
            <p className="text-sm sm:text-lg font-bold" style={{ color: data?.activeBalance ? '#ef4444' : '#22c55e' }}>
              ${data?.activeBalance.toFixed(2)}
            </p>
          </div>
          <div className="rounded-xl p-2.5 sm:p-4 text-center" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <p className="text-[10px] sm:text-xs casino-text-secondary mb-0.5 sm:mb-1">Available</p>
            <p className="text-sm sm:text-lg font-bold" style={{ color: '#22c55e' }}>${data?.availableToBorrow.toFixed(2)}</p>
          </div>
        </div>

        {/* Active Loan / Overdue Warning */}
        {data?.activeLoan && (
          <div
            className="rounded-xl p-3 sm:p-4 mb-4 sm:mb-6"
            style={{
              background: hasOverdue ? 'rgba(239, 68, 68, 0.08)' : 'rgba(59, 130, 246, 0.08)',
              border: `1px solid ${hasOverdue ? 'rgba(239, 68, 68, 0.25)' : 'rgba(59, 130, 246, 0.25)'}`,
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs sm:text-sm font-semibold casino-text-primary flex items-center gap-1.5">
                {hasOverdue ? <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#ef4444' }} /> : <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#3b82f6' }} />}
                Active Loan
              </h3>
              {getStatusBadge(data.activeLoan.status)}
            </div>
            <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
              <div>
                <p className="casino-text-secondary text-[10px] sm:text-xs">Amount</p>
                <p className="casino-text-primary font-medium">${data.activeLoan.principalAmount.toFixed(2)}</p>
              </div>
              <div>
                <p className="casino-text-secondary text-[10px] sm:text-xs">Due Date</p>
                <p className={`font-medium ${hasOverdue ? 'text-red-400' : 'casino-text-primary'}`}>
                  {new Date(data.activeLoan.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                </p>
              </div>
            </div>
            {hasOverdue && (
              <p className="text-[10px] sm:text-xs mt-2" style={{ color: '#ef4444' }}>
                This loan is overdue. Please contact support to arrange repayment.
              </p>
            )}
          </div>
        )}

        {/* Pending Request */}
        {data?.pendingRequest && (
          <div className="rounded-xl p-3 sm:p-4 mb-4 sm:mb-6" style={{ background: 'rgba(255, 183, 0, 0.08)', border: '1px solid rgba(255, 183, 0, 0.25)' }}>
            <div className="flex items-center justify-between">
              <h3 className="text-xs sm:text-sm font-semibold casino-text-primary flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#FFB700' }} />
                Pending Request
              </h3>
              {getStatusBadge('PENDING')}
            </div>
            <p className="text-xs sm:text-sm casino-text-secondary mt-1">
              You requested <span className="font-medium" style={{ color: '#FFD700' }}>${data.pendingRequest.requestedAmount.toFixed(2)}</span> on {formatDate(data.pendingRequest.createdAt)}
            </p>
          </div>
        )}

        {/* Request Loan */}
        {canRequest && !hasOverdue && (
          <div className="rounded-xl p-3.5 sm:p-5 mb-4 sm:mb-6" style={{ background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
            <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-2.5 sm:mb-3 flex items-center gap-1.5">
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" style={{ color: '#FFD700' }} />
              Request a Loan
            </h3>
            <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 casino-text-secondary" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={requestAmount}
                  onChange={(e) => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setRequestAmount(val);
                  }}
                  placeholder="10 - 100"
                  className="w-full pl-8 pr-4 py-2.5 rounded-lg text-sm casino-text-primary placeholder:text-gray-500 outline-none focus:ring-2 [appearance:textfield]"
                  style={{
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                />
              </div>
              <button
                onClick={handleSubmitRequest}
                disabled={submitting || !requestAmount}
                className="w-full sm:w-auto px-5 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50"
                style={{
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                  color: '#0A0A0F',
                }}
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Submit'}
              </button>
            </div>
            <p className="text-[10px] sm:text-xs casino-text-secondary mt-2">Min: $10 | Max: $100 | Available: ${data?.availableToBorrow.toFixed(2)}</p>
          </div>
        )}

        {/* Tabs */}
        <div className="flex overflow-x-auto scrollbar-hide border-b mb-3 sm:mb-4 -mx-3 px-3 sm:mx-0 sm:px-0" style={{ borderColor: 'rgba(255, 255, 255, 0.08)' }}>
          {([
            { key: 'overview', label: 'Requests', icon: <Send className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> },
            { key: 'loans', label: 'Loans', icon: <CalendarDays className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> },
            { key: 'payments', label: 'Payments', icon: <History className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> },
            { key: 'terms', label: 'Terms', icon: <ScrollText className="w-3 h-3 sm:w-3.5 sm:h-3.5" /> },
          ] as const).map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className="flex items-center gap-1 sm:gap-1.5 px-2.5 sm:px-4 py-2 sm:py-2.5 text-[11px] sm:text-sm font-medium transition-colors border-b-2 whitespace-nowrap flex-shrink-0"
              style={{
                borderColor: activeTab === tab.key ? '#FFD700' : 'transparent',
                color: activeTab === tab.key ? '#FFD700' : 'rgba(255, 255, 255, 0.5)',
              }}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="space-y-2">
          {activeTab === 'overview' && (
            <>
              {(!data?.requestHistory || data.requestHistory.length === 0) ? (
                <p className="text-xs sm:text-sm casino-text-secondary text-center py-6 sm:py-8">No loan requests yet.</p>
              ) : (
                <>
                  {data.requestHistory.map((req: any) => (
                    <div key={req._id} className="rounded-lg p-2.5 sm:p-3 flex items-center justify-between gap-2" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm casino-text-primary font-medium">${req.requestedAmount.toFixed(2)}</p>
                        <p className="text-[10px] sm:text-xs casino-text-secondary truncate">{formatDate(req.createdAt)}</p>
                        {req.agentRemarks && <p className="text-[10px] sm:text-xs casino-text-secondary mt-0.5 italic truncate">"{req.agentRemarks}"</p>}
                      </div>
                      {getStatusBadge(req.status)}
                    </div>
                  ))}
                  {historyHasMore.requests && (
                    <button onClick={() => loadMore('requests')} disabled={loadingMore} className="w-full py-2 mt-2 rounded-lg text-xs sm:text-sm font-medium casino-text-secondary transition-colors hover:text-white disabled:opacity-50" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                      {loadingMore ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Load More'}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'loans' && (
            <>
              {(!data?.loanHistory || data.loanHistory.length === 0) ? (
                <p className="text-xs sm:text-sm casino-text-secondary text-center py-6 sm:py-8">No loan history yet.</p>
              ) : (
                <>
                  {data.loanHistory.map((loan: any) => (
                    <div key={loan._id} className="rounded-lg p-2.5 sm:p-3" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div className="flex items-center justify-between mb-1">
                        <p className="text-xs sm:text-sm casino-text-primary font-medium">${loan.principalAmount.toFixed(2)}</p>
                        {getStatusBadge(loan.status)}
                      </div>
                      <div className="flex justify-between text-[10px] sm:text-xs casino-text-secondary">
                        <span>Issued: {formatDate(loan.issuedAt)}</span>
                        <span>Due: {new Date(loan.dueAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                      </div>
                    </div>
                  ))}
                  {historyHasMore.loans && (
                    <button onClick={() => loadMore('loans')} disabled={loadingMore} className="w-full py-2 mt-2 rounded-lg text-xs sm:text-sm font-medium casino-text-secondary transition-colors hover:text-white disabled:opacity-50" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                      {loadingMore ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Load More'}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'payments' && (
            <>
              {(!data?.repaymentHistory || data.repaymentHistory.length === 0) ? (
                <p className="text-xs sm:text-sm casino-text-secondary text-center py-6 sm:py-8">No payment history yet.</p>
              ) : (
                <>
                  {data.repaymentHistory.map((entry: any) => (
                    <div key={entry._id} className="rounded-lg p-2.5 sm:p-3 flex items-center justify-between gap-2" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs sm:text-sm font-medium" style={{ color: '#22c55e' }}>-${entry.amount.toFixed(2)}</p>
                        <p className="text-[10px] sm:text-xs casino-text-secondary truncate">
                          {entry.paymentMethod?.replace(/_/g, ' ') || entry.type?.replace(/_/g, ' ')}
                        </p>
                        <p className="text-[10px] sm:text-xs casino-text-secondary">{formatDate(entry.createdAt)}</p>
                      </div>
                      {entry.note && <p className="text-[10px] sm:text-xs casino-text-secondary italic max-w-[40%] text-right flex-shrink-0">"{entry.note}"</p>}
                    </div>
                  ))}
                  {historyHasMore.payments && (
                    <button onClick={() => loadMore('payments')} disabled={loadingMore} className="w-full py-2 mt-2 rounded-lg text-xs sm:text-sm font-medium casino-text-secondary transition-colors hover:text-white disabled:opacity-50" style={{ background: 'rgba(255, 255, 255, 0.05)' }}>
                      {loadingMore ? <Loader2 className="w-3 h-3 animate-spin mx-auto" /> : 'Load More'}
                    </button>
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'terms' && (
            <div className="rounded-xl p-3 sm:p-6 space-y-4 sm:space-y-5 text-xs sm:text-sm leading-relaxed" style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px solid rgba(255, 255, 255, 0.06)' }}>
              <div className="text-center mb-4 sm:mb-6">
                <h2 className="text-base sm:text-lg font-bold casino-text-primary">Zero Interest Loan Program</h2>
                <p className="text-[10px] sm:text-xs casino-text-secondary mt-1">Terms and Conditions</p>
              </div>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>1. Eligibility Requirements</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>1.1 The Member must have been active on the platform for the past 30 days.</li>
                  <li>1.2 The Member must have played at least three (3) days per week on average during the last thirty (30) days.</li>
                  <li>1.3 The Member must maintain an account in good standing with no record of fraud, abuse, or policy violations.</li>
                  <li>1.4 The Member must complete identity verification (ID Verification) if requested. Failure to comply may result in denial or cancellation of loan eligibility.</li>
                  <li>1.5 The Company reserves the sole right to determine eligibility at its discretion.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>2. Loan Limits</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>2.1 The initial loan limit begins at $20.</li>
                  <li>2.2 Based on repayment history, account activity, and loyalty, loan limits may increase progressively to $40, $50, $100, and up to $500.</li>
                  <li>2.3 Loan limit adjustments are entirely at the Company's discretion and are not guaranteed.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>3. Loan Repayment Terms</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>3.1 All loans must be repaid within seven (7) calendar days from the date of issuance.</li>
                  <li>3.2 The Loan Program is zero-interest provided repayment is made within the required timeframe.</li>
                  <li>3.3 Failure to repay within seven (7) days may affect future loan eligibility and limit increases.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>4. Loan Repayment Methods</h3>
                <p className="casino-text-secondary text-[10px] sm:text-xs mb-1 sm:mb-1.5">Loans may be repaid through one or more of the following methods:</p>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>4.1 Direct online payment.</li>
                  <li>4.2 Automatic deduction from winnings.</li>
                  <li>4.3 Referral-based repayment (subject to Section 5).</li>
                  <li>4.4 Approved marketing tasks (subject to Section 6).</li>
                </ul>
                <p className="casino-text-secondary text-[10px] sm:text-xs mt-1 sm:mt-1.5">The Company reserves the right to approve or reject any repayment method.</p>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>5. Referral-Based Loan Repayment</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>5.1 A Member may clear an existing loan by referring a new user.</li>
                  <li>5.2 To qualify as a valid referral: the referred user must be a legitimate new account, deposit a minimum of $20, complete at least two (2) deposits, remain active on the platform, and must not originate from the same device, IP address, household, or duplicate account.</li>
                  <li>5.3 One (1) qualifying referral may clear the loan amount up to the approved loan limit.</li>
                  <li>5.4 The Company reserves the right to determine referral validity at its sole discretion.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>6. Marketing Task Credit</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>6.1 Members may perform approved promotional tasks in exchange for loan credits.</li>
                  <li>6.2 Each approved public marketing post may be valued at $5 credit.</li>
                  <li>6.3 Posts must be publicly visible, original, not misleading, and approved by Company staff.</li>
                  <li>6.4 Spam, fake engagement, or fraudulent promotional activity will result in disqualification.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>7. Reapplication Policy</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>7.1 If a loan is cleared via referral repayment, the Member may be eligible to apply for a new loan immediately, subject to approval.</li>
                  <li>7.2 If a loan is cleared through winnings or direct payment, the Member must wait a minimum of seven (7) days before applying for another loan.</li>
                  <li>7.3 Loan approval after repayment is not guaranteed.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>8. Non-Payment Policy</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>8.1 Members will not be restricted from general platform services solely due to unpaid loans.</li>
                  <li>8.2 However, unpaid or late loans may result in: suspension of loan privileges, freeze of loan limit increases, and internal account flagging.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>9. Fraud and Abuse</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>9.1 The Company reserves the right to cancel, reject, reverse, or deny any loan application.</li>
                  <li>9.2 The Company may suspend or permanently ban accounts engaged in: fake referrals, self-referrals, duplicate accounts, deposit manipulation, abuse of the Loan Program, or fraudulent activity.</li>
                  <li>9.3 All decisions regarding fraud detection are final.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>10. Modification and Termination</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>10.1 Global Ace Gaming reserves the right to modify, suspend, or terminate the Loan Program at any time without prior notice.</li>
                  <li>10.2 Continued use of the Loan Program constitutes acceptance of updated terms.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>11. Limitation of Liability</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>11.1 The Loan Program is provided at the Company's discretion and may be withdrawn at any time.</li>
                  <li>11.2 The Company shall not be liable for any loss, damages, or consequences arising from participation in the Loan Program.</li>
                </ul>
              </section>

              <section>
                <h3 className="text-xs sm:text-sm font-semibold casino-text-primary mb-1.5 sm:mb-2" style={{ color: '#FFD700' }}>12. Governing Authority</h3>
                <ul className="space-y-1 sm:space-y-1.5 casino-text-secondary text-[10px] sm:text-xs">
                  <li>12.1 These Terms are governed by the internal policies and regulations of Global Ace Gaming.</li>
                  <li>12.2 All decisions made by the Company regarding loan eligibility, repayment qualification, or fraud determination are final and binding.</li>
                </ul>
              </section>

              <div className="pt-3 sm:pt-4 text-center" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.06)' }}>
                <p className="text-[10px] sm:text-xs casino-text-secondary italic">
                  By applying for or accepting a loan, you confirm that you have read, understood, and agreed to these Terms and Conditions.
                </p>
                <p className="text-[10px] sm:text-xs casino-text-secondary mt-1.5 sm:mt-2 font-medium">Global Ace Gaming — Customer Support Team</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
