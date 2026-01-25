import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Wallet as WalletIcon, Loader2, ExternalLink, AlertCircle, CheckCircle, Clock } from 'lucide-react';
import toast from 'react-hot-toast';
import { walletApi, type CryptoTransactionItem } from '../services/walletApi';

const CRYPTO_OPTIONS = [
  { value: 'usdttrc20', label: 'USDT TRC20' },
  { value: 'usdtbep20', label: 'USDT BEP20' },
  { value: 'ltc', label: 'LTC' }
] as const;

// Min $6 so the crypto amount stays above NowPayments' minimum (e.g. 5 USDT) after conversion
const MIN_USD = 6;
const MAX_USD = 10000;

const WalletPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [balance, setBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [transactions, setTransactions] = useState<CryptoTransactionItem[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  const [payCurrency, setPayCurrency] = useState<string>(CRYPTO_OPTIONS[0].value);
  const [amountUSD, setAmountUSD] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const success = searchParams.get('success');
  const cancel = searchParams.get('cancel');

  const fetchBalance = async () => {
    setBalanceLoading(true);
    try {
      const res = await walletApi.getBalance();
      if (res.success) {
        const raw = res.data?.balance;
        setBalance(typeof raw === 'number' ? raw : Number(raw) || 0);
      }
    } catch {
      toast.error('Failed to load balance');
    } finally {
      setBalanceLoading(false);
    }
  };

  const fetchTransactions = async () => {
    setTxLoading(true);
    try {
      const res = await walletApi.getCryptoTransactions({ limit: 30 });
      if (res.success && res.data) {
        setTransactions(res.data.items);
      }
    } catch {
      toast.error('Failed to load transactions');
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    fetchBalance();
    fetchTransactions();
  }, []);

  // Clear success/cancel from URL after showing, and refetch
  useEffect(() => {
    if (success === '1') {
      toast.success('Returned from payment. Your balance will update once the payment is confirmed.');
      setSearchParams((p) => {
        p.delete('success');
        p.delete('order');
        return p;
      }, { replace: true });
      fetchBalance();
      fetchTransactions();
    }
    if (cancel === '1') {
      toast('Payment was cancelled.', { icon: 'ℹ️' });
      setSearchParams((p) => {
        p.delete('cancel');
        p.delete('order');
        return p;
      }, { replace: true });
    }
  }, [success, cancel]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const num = parseFloat(amountUSD);
    if (isNaN(num) || num < MIN_USD || num > MAX_USD) {
      toast.error(`Enter an amount between $${MIN_USD} and $${MAX_USD}`);
      return;
    }
    setSubmitting(true);
    try {
      const res = await walletApi.createCryptoPayment({
        amountUSD: num,
        payCurrency: payCurrency || undefined
      });
      if (res.success && res.data?.paymentUrl) {
        window.location.href = res.data.paymentUrl;
        return;
      }
      toast.error(res.message || 'Could not create payment');
    } catch (err: unknown) {
      const ax = err as { response?: { status?: number; data?: { message?: string } } };
      const msg = ax?.response?.data?.message;
      // 503 usually means NowPayments env vars are not set on the backend
      const fallback = ax?.response?.status === 503
        ? 'Crypto payments are not configured yet. Please try again later.'
        : 'Failed to create payment';
      toast.error(msg || fallback);
    } finally {
      setSubmitting(false);
    }
  };

  const statusBadge = (s: string) => {
    if (s === 'confirmed') return <span className="px-2 py-0.5 rounded text-xs bg-green-600/30 text-green-400">Confirmed</span>;
    if (s === 'pending') return <span className="px-2 py-0.5 rounded text-xs bg-amber-600/30 text-amber-400">Pending</span>;
    return <span className="px-2 py-0.5 rounded text-xs bg-red-600/30 text-red-400">Failed</span>;
  };

  return (
    <div className="min-h-screen py-8 pt-16">
      <div className="max-w-2xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-4" style={{
            background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
            boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'
          }}>
            <WalletIcon className="w-8 h-8" style={{ color: '#0A0A0F' }} />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold casino-text-primary mb-2">
            Wallet & Transactions
          </h1>
          <p className="casino-text-secondary text-sm sm:text-base">
            Manage your balance and view transaction history.
          </p>
        </div>

        {/* Wallet Balance */}
        <div className="card-casino rounded-2xl p-6 mb-6 casino-border">
          <h2 className="text-lg font-semibold casino-text-primary mb-1">Wallet Balance</h2>
          <p className="text-2xl font-bold" style={{ color: 'var(--casino-highlight-gold)' }}>
            {balanceLoading ? (
              <Loader2 className="w-7 h-7 animate-spin inline" />
            ) : (
              `$${(balance ?? 0).toFixed(2)}`
            )}
          </p>
          <p className="text-sm casino-text-secondary mt-1">USD</p>
        </div>

        {/* Load Wallet */}
        <div className="card-casino rounded-2xl p-6 mb-6 casino-border">
          <h2 className="text-lg font-semibold casino-text-primary mb-1">Load Wallet</h2>
          <p className="text-sm casino-text-secondary mb-4">
            Load balance using supported digital payment methods.
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium casino-text-secondary mb-2">Crypto</label>
              <select
                value={payCurrency}
                onChange={(e) => setPayCurrency(e.target.value)}
                className="w-full bg-[#0A0A0F] border border-[#2C2C3A] rounded-lg px-4 py-2.5 casino-text-primary focus:ring-2 focus:ring-[#FFD700]/50 focus:border-[#FFD700] outline-none"
              >
                {CRYPTO_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium casino-text-secondary mb-2">Amount (USD)</label>
              <input
                type="number"
                min={MIN_USD}
                max={MAX_USD}
                step="0.01"
                value={amountUSD}
                onChange={(e) => setAmountUSD(e.target.value)}
                placeholder={`${MIN_USD} - ${MAX_USD}`}
                className="w-full bg-[#0A0A0F] border border-[#2C2C3A] rounded-lg px-4 py-2.5 casino-text-primary placeholder-gray-500 focus:ring-2 focus:ring-[#FFD700]/50 focus:border-[#FFD700] outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={submitting}
              className="btn-casino-primary w-full flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <ExternalLink className="w-5 h-5" />}
              Generate Payment
            </button>
          </form>

          <p className="mt-4 text-xs casino-text-secondary flex items-start gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            Credits are non-refundable once used.
          </p>
        </div>

        {/* Transaction history */}
        <div className="card-casino rounded-2xl p-6 casino-border">
          <h2 className="text-lg font-semibold casino-text-primary mb-4">Deposit History</h2>
          {txLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-8 h-8 animate-spin casino-text-secondary" />
            </div>
          ) : transactions.length === 0 ? (
            <p className="casino-text-secondary text-sm py-4">No deposits yet.</p>
          ) : (
            <ul className="space-y-3">
              {transactions.map((t) => (
                <li
                  key={t._id}
                  className="flex flex-wrap items-center justify-between gap-2 py-2 border-b border-[#2C2C3A] last:border-0"
                >
                  <div className="flex items-center gap-2">
                    {t.status === 'confirmed' ? (
                      <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                    ) : t.status === 'pending' ? (
                      <Clock className="w-4 h-4 text-amber-500 flex-shrink-0" />
                    ) : null}
                    <span className="font-medium casino-text-primary">${t.amount.toFixed(2)}</span>
                    {t.payCurrency && (
                      <span className="text-xs casino-text-secondary uppercase">{t.payCurrency}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(t.status)}
                    <span className="text-xs casino-text-secondary">
                      {new Date(t.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};

export default WalletPage;
