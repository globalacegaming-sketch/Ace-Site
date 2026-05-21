import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { trackFeature } from '../services/analyticsTracker';
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
  MessageCircle,
  ChevronRight,
  Wallet,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { loanApi, type LoanSummary } from '../services/loanApi';
import { PageMeta } from '../components/PageMeta';
import { CosmicCard, PageShell } from '../components/cosmic';

type LoanTab = 'requests' | 'loans' | 'payments' | 'terms';

const QUICK_AMOUNTS = [10, 25, 50, 100] as const;

const HOW_IT_WORKS = [
  { step: '1', title: 'Request', desc: 'Pick an amount up to your available limit ($10–$100).' },
  { step: '2', title: 'Get approved', desc: 'Our team reviews your request — usually quick.' },
  { step: '3', title: 'Repay in 7 days', desc: 'Zero interest if you repay on time. See Terms for options.' },
] as const;

export default function LoansPage() {
  const [data, setData] = useState<LoanSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [requestAmount, setRequestAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState<LoanTab>('requests');

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
    trackFeature('loan', 'feature_opened');
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
        setHistoryPage((prev) => ({ ...prev, [type]: nextPage }));
        setHistoryHasMore((prev) => ({ ...prev, [type]: nextPage < res.data.totalPages }));
      }
    } catch {
      /* silent */
    } finally {
      setLoadingMore(false);
    }
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
        trackFeature('loan', 'feature_used', { amount });
        toast.success('Loan request submitted!');
        setRequestAmount('');
        fetchData();
      } else {
        trackFeature('loan', 'feature_failed', { reason: res.message });
        toast.error(res.message || 'Failed to submit request.');
      }
    } catch (err: unknown) {
      const message =
        err && typeof err === 'object' && 'response' in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : undefined;
      trackFeature('loan', 'feature_failed', { error: message });
      toast.error(message || 'Failed to submit request.');
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

  const formatShortDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

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
        className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-semibold"
        style={{ background: s.bg, color: s.text }}
      >
        {s.icon} {status}
      </span>
    );
  };

  if (loading) {
    return (
      <PageShell width="3xl" background="subtle" contentClassName="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#FFD700' }} />
      </PageShell>
    );
  }

  const hasOverdue = data?.activeLoan?.status === 'OVERDUE';
  const canRequest = data && !data.pendingRequest && !data.activeLoan && data.availableToBorrow >= 10 && !hasOverdue;
  const maxRequest = Math.min(100, data?.availableToBorrow ?? 0);
  const parsedAmount = parseFloat(requestAmount) || 0;

  const pickAmount = (n: number) => {
    const capped = Math.min(n, maxRequest);
    if (capped >= 10) setRequestAmount(String(Math.round(capped)));
  };

  type StatusKind = 'ready' | 'pending' | 'active' | 'overdue' | 'unavailable';
  let statusKind: StatusKind = 'unavailable';
  if (hasOverdue) statusKind = 'overdue';
  else if (data?.pendingRequest) statusKind = 'pending';
  else if (data?.activeLoan) statusKind = 'active';
  else if (canRequest) statusKind = 'ready';

  const statusCopy: Record<Exclude<StatusKind, 'ready'>, { title: string; desc: string; accent: string }> = {
    pending: {
      title: 'Request under review',
      desc: `We received your $${data?.pendingRequest?.requestedAmount.toFixed(2)} request. You'll be notified when it's reviewed.`,
      accent: '#FFB700',
    },
    active: {
      title: 'You have an active loan',
      desc: `Repay $${data?.activeLoan?.principalAmount.toFixed(2)} by ${data?.activeLoan ? formatShortDate(data.activeLoan.dueAt) : '—'}`,
      accent: '#3b82f6',
    },
    overdue: {
      title: 'Loan overdue',
      desc: 'Contact support to arrange repayment before requesting another loan.',
      accent: '#ef4444',
    },
    unavailable: {
      title: 'Not available right now',
      desc:
        (data?.availableToBorrow ?? 0) < 10
          ? 'Your available amount is below the $10 minimum. Build activity or contact support.'
          : 'Complete your current loan or wait for a pending request to be processed.',
      accent: '#B0B0B0',
    },
  };
  const showStatusBanner = statusKind !== 'ready';
  const status = showStatusBanner ? statusCopy[statusKind] : null;

  const tabs: { key: LoanTab; label: string; icon: React.ReactNode }[] = [
    { key: 'requests', label: 'Requests', icon: <Send className="h-4 w-4" /> },
    { key: 'loans', label: 'Loans', icon: <CalendarDays className="h-4 w-4" /> },
    { key: 'payments', label: 'Payments', icon: <History className="h-4 w-4" /> },
    { key: 'terms', label: 'Terms', icon: <ScrollText className="h-4 w-4" /> },
  ];

  return (
    <>
      <PageMeta
        title="Loans | Global Ace Gaming"
        description="Request short-term zero-interest loans from Global Ace Gaming. View your loan history and balance."
        noIndex
      />
      <PageShell
        title={
          <span className="inline-flex items-center gap-2">
            <Banknote className="h-6 w-6 sm:h-7 sm:w-7" style={{ color: '#FFD700' }} />
            Loans
          </span>
        }
        subtitle="Zero-interest short-term loans to keep you playing."
        width="3xl"
        background="subtle"
        actions={
          <button
            type="button"
            onClick={() => fetchData()}
            disabled={refreshing}
            className="rounded-xl p-2 transition active:scale-95"
            style={{ background: 'rgba(255, 255, 255, 0.08)' }}
            aria-label="Refresh loan info"
          >
            <RefreshCw
              className={`h-4 w-4 sm:h-5 sm:w-5 ${refreshing ? 'animate-spin' : ''}`}
              style={{ color: '#FFD700' }}
            />
          </button>
        }
      >
        {/* Request loan — first when eligible */}
        {canRequest && (
          <CosmicCard variant="glass" glow padding="md" className="mb-4 sm:mb-6">
            <h3 className="mb-1 flex items-center gap-2 text-base font-bold casino-text-primary">
              <Send className="h-5 w-5" style={{ color: '#FFD700' }} />
              Request a loan
            </h3>
            <p className="mb-4 text-sm casino-text-secondary">
              Choose a quick amount or enter your own ($10–${maxRequest.toFixed(0)}).
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {QUICK_AMOUNTS.filter((n) => n <= maxRequest).map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => pickAmount(n)}
                  className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition active:scale-95 ${
                    parsedAmount === n ? 'ring-2 ring-[#FFD700]' : ''
                  }`}
                  style={{
                    background:
                      parsedAmount === n
                        ? 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)'
                        : 'rgba(255, 255, 255, 0.08)',
                    color: parsedAmount === n ? '#0A0A0F' : 'var(--casino-text-primary)',
                    border: '1px solid rgba(255, 255, 255, 0.12)',
                  }}
                >
                  ${n}
                </button>
              ))}
              {maxRequest >= 10 &&
                maxRequest !== 10 &&
                maxRequest !== 25 &&
                maxRequest !== 50 &&
                maxRequest !== 100 && (
                  <button
                    type="button"
                    onClick={() => pickAmount(maxRequest)}
                    className={`min-h-10 rounded-xl px-4 text-sm font-semibold transition active:scale-95 ${
                      parsedAmount === maxRequest ? 'ring-2 ring-[#FFD700]' : ''
                    }`}
                    style={{
                      background:
                        parsedAmount === maxRequest
                          ? 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)'
                          : 'rgba(255, 255, 255, 0.08)',
                      color: parsedAmount === maxRequest ? '#0A0A0F' : 'var(--casino-text-primary)',
                      border: '1px solid rgba(255, 255, 255, 0.12)',
                    }}
                  >
                    Max ${Math.floor(maxRequest)}
                  </button>
                )}
            </div>
            <div className="flex flex-col gap-3 sm:flex-row">
              <div className="relative flex-1">
                <DollarSign className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 casino-text-secondary" />
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value.replace(/[^0-9]/g, ''))}
                  placeholder={`10 – ${Math.floor(maxRequest)}`}
                  aria-label="Loan amount in dollars"
                  className="input-casino w-full min-h-12 rounded-xl py-3 pl-10 pr-4 text-base"
                />
              </div>
              <button
                type="button"
                onClick={handleSubmitRequest}
                disabled={submitting || !requestAmount || parsedAmount < 10 || parsedAmount > maxRequest}
                className="btn-casino-primary flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-6 text-base font-bold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto sm:min-w-[140px]"
              >
                {submitting ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <>
                    Submit
                    <ChevronRight className="h-5 w-5" />
                  </>
                )}
              </button>
            </div>
          </CosmicCard>
        )}

        {showStatusBanner && status && (
          <CosmicCard
            variant="glass"
            padding="md"
            className="mb-4 sm:mb-6"
            style={{
              borderColor: statusKind === 'overdue' ? 'rgba(239, 68, 68, 0.35)' : undefined,
            }}
          >
            <div className="flex gap-3 sm:gap-4">
              <div
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl sm:h-12 sm:w-12"
                style={{ background: `${status.accent}22`, color: status.accent }}
              >
                {statusKind === 'pending' && <Clock className="h-5 w-5 sm:h-6 sm:w-6" />}
                {statusKind === 'active' && <TrendingUp className="h-5 w-5 sm:h-6 sm:w-6" />}
                {statusKind === 'overdue' && <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />}
                {statusKind === 'unavailable' && <AlertTriangle className="h-5 w-5 sm:h-6 sm:w-6" />}
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-base font-bold casino-text-primary sm:text-lg">{status.title}</h2>
                <p className="mt-1 text-sm leading-relaxed casino-text-secondary">{status.desc}</p>
                {(statusKind === 'overdue' || statusKind === 'unavailable') && (
                  <Link
                    to="/chat"
                    className="mt-3 inline-flex min-h-10 items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition active:scale-[0.98]"
                    style={{
                      background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                      color: '#0A0A0F',
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    Contact support
                  </Link>
                )}
              </div>
            </div>
          </CosmicCard>
        )}

        {/* Balance summary */}
        <div className="mb-4 grid grid-cols-1 gap-3 sm:mb-6 sm:grid-cols-3 sm:gap-4">
          <CosmicCard variant="solid" padding="sm" className="flex items-center gap-3 sm:flex-col sm:items-stretch sm:text-center">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'rgba(255, 215, 0, 0.12)' }}
            >
              <Banknote className="h-5 w-5" style={{ color: '#FFD700' }} />
            </div>
            <div className="min-w-0 sm:mt-2">
              <p className="text-xs casino-text-secondary">Your loan limit</p>
              <p className="text-xl font-bold sm:text-2xl" style={{ color: '#FFD700' }}>
                ${data?.loanLimit.toFixed(2)}
              </p>
            </div>
          </CosmicCard>
          <CosmicCard variant="solid" padding="sm" className="flex items-center gap-3 sm:flex-col sm:items-stretch sm:text-center">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'rgba(239, 68, 68, 0.12)' }}
            >
              <TrendingUp className="h-5 w-5" style={{ color: data?.activeBalance ? '#ef4444' : '#22c55e' }} />
            </div>
            <div className="min-w-0 sm:mt-2">
              <p className="text-xs casino-text-secondary">Amount owed</p>
              <p
                className="text-xl font-bold sm:text-2xl"
                style={{ color: data?.activeBalance ? '#ef4444' : '#22c55e' }}
              >
                ${data?.activeBalance.toFixed(2)}
              </p>
            </div>
          </CosmicCard>
          <CosmicCard variant="solid" padding="sm" glow className="flex items-center gap-3 sm:flex-col sm:items-stretch sm:text-center">
            <div
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
              style={{ background: 'rgba(34, 197, 94, 0.12)' }}
            >
              <DollarSign className="h-5 w-5" style={{ color: '#22c55e' }} />
            </div>
            <div className="min-w-0 sm:mt-2">
              <p className="text-xs casino-text-secondary">Available to borrow</p>
              <p className="text-xl font-bold sm:text-2xl" style={{ color: '#22c55e' }}>
                ${data?.availableToBorrow.toFixed(2)}
              </p>
            </div>
          </CosmicCard>
        </div>

        {/* Active loan detail */}
        {data?.activeLoan && (
          <CosmicCard
            variant="solid"
            padding="md"
            className="mb-4 sm:mb-6"
            style={{
              borderColor: hasOverdue ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)',
            }}
          >
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold casino-text-primary sm:text-base">
                {hasOverdue ? (
                  <AlertTriangle className="h-4 w-4 text-red-400" />
                ) : (
                  <CalendarDays className="h-4 w-4 text-blue-400" />
                )}
                Loan details
              </h3>
              {getStatusBadge(data.activeLoan.status)}
            </div>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs casino-text-secondary">Principal</dt>
                <dd className="mt-0.5 font-semibold casino-text-primary">
                  ${data.activeLoan.principalAmount.toFixed(2)}
                </dd>
              </div>
              <div>
                <dt className="text-xs casino-text-secondary">Due date</dt>
                <dd className={`mt-0.5 font-semibold ${hasOverdue ? 'text-red-400' : 'casino-text-primary'}`}>
                  {formatShortDate(data.activeLoan.dueAt)}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-xs casino-text-secondary">Issued</dt>
                <dd className="mt-0.5 casino-text-primary">{formatDate(data.activeLoan.issuedAt)}</dd>
              </div>
            </dl>
          </CosmicCard>
        )}

        {data?.pendingRequest && !data?.activeLoan && (
          <CosmicCard
            variant="solid"
            padding="md"
            className="mb-4 sm:mb-6"
            style={{ borderColor: 'rgba(255, 183, 0, 0.3)' }}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center gap-2 text-sm font-bold casino-text-primary">
                <Clock className="h-4 w-4" style={{ color: '#FFB700' }} />
                Pending request
              </h3>
              {getStatusBadge('PENDING')}
            </div>
            <p className="mt-2 text-sm casino-text-secondary">
              <span className="font-semibold" style={{ color: '#FFD700' }}>
                ${data.pendingRequest.requestedAmount.toFixed(2)}
              </span>{' '}
              submitted {formatDate(data.pendingRequest.createdAt)}
            </p>
          </CosmicCard>
        )}

        {/* How it works — below the action area */}
        <details className="mb-4 sm:mb-6 group">
          <summary className="cosmic-label mb-0 cursor-pointer list-none py-1 marker:hidden [&::-webkit-details-marker]:hidden">
            How it works
            <span className="ml-2 text-[10px] font-normal normal-case casino-text-secondary">
              (tap to expand)
            </span>
          </summary>
          <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3 sm:gap-3">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.step}
                className="flex gap-3 rounded-xl p-3 sm:flex-col sm:gap-2 sm:p-4"
                style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
              >
                <span
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold"
                  style={{ background: 'rgba(255, 215, 0, 0.15)', color: '#FFD700' }}
                >
                  {item.step}
                </span>
                <div>
                  <p className="text-sm font-semibold casino-text-primary">{item.title}</p>
                  <p className="mt-0.5 text-xs leading-relaxed casino-text-secondary">{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </details>

        {/* History tabs */}
        <div
          className="mb-4 flex gap-1 overflow-x-auto rounded-xl p-1 scrollbar-hide sm:mb-5"
          style={{ background: 'rgba(0, 0, 0, 0.25)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
          role="tablist"
          aria-label="Loan history sections"
        >
          {tabs.map((tab) => (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`flex min-h-10 flex-1 items-center justify-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-xs font-semibold transition sm:text-sm ${
                activeTab === tab.key ? 'shadow-sm' : 'casino-text-secondary hover:text-white/80'
              }`}
              style={
                activeTab === tab.key
                  ? {
                      background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                      color: '#0A0A0F',
                    }
                  : undefined
              }
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2" role="tabpanel">
          {activeTab === 'requests' && (
            <>
              {!data?.requestHistory?.length ? (
                <EmptyHistory message="No loan requests yet." hint="Submit a request above when you're eligible." />
              ) : (
                <>
                  {data.requestHistory.map((req: { _id: string; requestedAmount: number; createdAt: string; status: string; agentRemarks?: string }) => (
                    <HistoryRow
                      key={req._id}
                      primary={`$${req.requestedAmount.toFixed(2)}`}
                      secondary={formatDate(req.createdAt)}
                      note={req.agentRemarks}
                      badge={getStatusBadge(req.status)}
                    />
                  ))}
                  {historyHasMore.requests && (
                    <LoadMoreButton loading={loadingMore} onClick={() => loadMore('requests')} />
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'loans' && (
            <>
              {!data?.loanHistory?.length ? (
                <EmptyHistory message="No loans yet." hint="Approved requests appear here." />
              ) : (
                <>
                  {data.loanHistory.map((loan: { _id: string; principalAmount: number; status: string; issuedAt: string; dueAt: string }) => (
                    <div
                      key={loan._id}
                      className="rounded-xl p-4"
                      style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-base font-semibold casino-text-primary">
                          ${loan.principalAmount.toFixed(2)}
                        </p>
                        {getStatusBadge(loan.status)}
                      </div>
                      <div className="flex flex-col gap-0.5 text-xs casino-text-secondary sm:flex-row sm:justify-between">
                        <span>Issued: {formatDate(loan.issuedAt)}</span>
                        <span>Due: {formatShortDate(loan.dueAt)}</span>
                      </div>
                    </div>
                  ))}
                  {historyHasMore.loans && (
                    <LoadMoreButton loading={loadingMore} onClick={() => loadMore('loans')} />
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'payments' && (
            <>
              {!data?.repaymentHistory?.length ? (
                <EmptyHistory message="No payments yet." hint="Repayments show up here after you pay down a loan." />
              ) : (
                <>
                  {data.repaymentHistory.map((entry: { _id: string; amount: number; paymentMethod?: string; type?: string; createdAt: string; note?: string }) => (
                    <HistoryRow
                      key={entry._id}
                      primary={`-$${entry.amount.toFixed(2)}`}
                      primaryColor="#22c55e"
                      secondary={
                        (entry.paymentMethod || entry.type || 'Payment').replace(/_/g, ' ') +
                        ' · ' +
                        formatDate(entry.createdAt)
                      }
                      note={entry.note}
                    />
                  ))}
                  {historyHasMore.payments && (
                    <LoadMoreButton loading={loadingMore} onClick={() => loadMore('payments')} />
                  )}
                </>
              )}
            </>
          )}

          {activeTab === 'terms' && <LoanTermsContent />}
        </div>
      </PageShell>
    </>
  );
}

function EmptyHistory({ message, hint }: { message: string; hint: string }) {
  return (
    <div
      className="rounded-xl px-4 py-10 text-center"
      style={{ background: 'rgba(255, 255, 255, 0.03)', border: '1px dashed rgba(255, 255, 255, 0.12)' }}
    >
      <p className="text-sm font-medium casino-text-primary">{message}</p>
      <p className="mt-1 text-xs casino-text-secondary">{hint}</p>
    </div>
  );
}

function HistoryRow({
  primary,
  secondary,
  note,
  badge,
  primaryColor,
}: {
  primary: string;
  secondary: string;
  note?: string;
  badge?: React.ReactNode;
  primaryColor?: string;
}) {
  return (
    <div
      className="flex items-start justify-between gap-3 rounded-xl p-4"
      style={{ background: 'rgba(255, 255, 255, 0.04)', border: '1px solid rgba(255, 255, 255, 0.08)' }}
    >
      <div className="min-w-0 flex-1">
        <p className="text-base font-semibold casino-text-primary" style={primaryColor ? { color: primaryColor } : undefined}>
          {primary}
        </p>
        <p className="mt-0.5 text-xs casino-text-secondary">{secondary}</p>
        {note ? (
          <p className="mt-1 text-xs italic casino-text-secondary">&ldquo;{note}&rdquo;</p>
        ) : null}
      </div>
      {badge ? <div className="shrink-0">{badge}</div> : null}
    </div>
  );
}

function LoadMoreButton({ loading, onClick }: { loading: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="mt-2 flex min-h-11 w-full items-center justify-center rounded-xl text-sm font-semibold casino-text-secondary transition hover:text-white disabled:opacity-50"
      style={{ background: 'rgba(255, 255, 255, 0.06)', border: '1px solid rgba(255, 255, 255, 0.1)' }}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Load more'}
    </button>
  );
}

function LoanTermsContent() {
  const sections = [
    {
      title: '1. Eligibility Requirements',
      items: [
        'Active on the platform for the past 30 days.',
        'Played at least 3 days per week on average in the last 30 days.',
        'Account in good standing with no fraud or policy violations.',
        'ID verification if requested.',
      ],
    },
    {
      title: '2. Loan Limits',
      items: [
        'Initial limit starts at $20.',
        'May increase to $40, $50, $100, or up to $500 based on history.',
        'Increases are at the company’s discretion.',
      ],
    },
    {
      title: '3. Repayment',
      items: [
        'Repay within 7 calendar days from issuance.',
        'Zero interest when repaid on time.',
        'Late repayment may affect future eligibility.',
      ],
    },
    {
      title: '4. Repayment Methods',
      items: ['Direct online payment', 'Deduction from winnings', 'Referral-based repayment', 'Approved marketing tasks'],
    },
  ];

  return (
    <CosmicCard variant="solid" padding="md" className="space-y-5">
      <div className="text-center">
        <h2 className="text-lg font-bold casino-text-primary">Zero Interest Loan Program</h2>
        <p className="mt-1 text-xs casino-text-secondary">Terms and Conditions (summary)</p>
      </div>
      {sections.map((sec) => (
        <section key={sec.title}>
          <h3 className="mb-2 text-sm font-semibold" style={{ color: '#FFD700' }}>
            {sec.title}
          </h3>
          <ul className="list-inside list-disc space-y-1.5 text-sm casino-text-secondary">
            {sec.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      ))}
      <p className="border-t pt-4 text-center text-xs italic casino-text-secondary" style={{ borderColor: 'var(--casino-card-border)' }}>
        By applying for a loan you agree to the full terms. Contact support with questions.
      </p>
      <Link
        to="/chat"
        className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl text-sm font-semibold"
        style={{
          background: 'rgba(255, 255, 255, 0.08)',
          border: '1px solid rgba(255, 255, 255, 0.12)',
          color: 'var(--casino-highlight-gold)',
        }}
      >
        <MessageCircle className="h-4 w-4" />
        Ask about loans in chat
      </Link>
    </CosmicCard>
  );
}
