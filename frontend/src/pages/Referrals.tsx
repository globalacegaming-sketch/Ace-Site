import { useState, useEffect, useCallback } from 'react';
import { Users, Copy, Share2, Gift, CheckCircle, Loader2, Clock } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

interface ReferralData {
  referralCode: string | null;
  referralCount: number;
  pendingCount: number;
  referredUsers: { username: string; joinedAt: string; verified: boolean }[];
}

export default function ReferralsPage() {
  const { token } = useAuthStore();
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchReferrals = useCallback(async () => {
    if (!token) return;
    try {
      const res = await axios.get(`${getApiBaseUrl()}/user/referrals`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReferrals();
  }, [fetchReferrals]);

  const handleCopy = async () => {
    if (!data?.referralCode) return;
    try {
      await navigator.clipboard.writeText(data.referralCode);
      setCopied(true);
      toast.success('Referral code copied!');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    if (!data?.referralCode) return;
    const shareData = {
      title: 'Join Global Ace Gaming!',
      text: `Use my referral code ${data.referralCode} when you sign up at Global Ace Gaming and we both earn rewards!`,
      url: `${window.location.origin}/register?ref=${data.referralCode}`,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch {
        // user cancelled or not supported
      }
    } else {
      handleCopy();
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-20 pb-4 sm:pb-6 lg:pb-8 flex items-center justify-center" style={{
        background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)',
      }}>
        <Loader2 className="w-8 h-8 animate-spin" style={{ color: '#FFD700' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen pt-20 pb-4 sm:pb-6 lg:pb-8" style={{
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)',
    }}>
      {/* Decorative orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse" style={{ backgroundColor: '#FF6F00' }} />
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-15" style={{ backgroundColor: '#00B0FF' }} />
      </div>

      <div className="relative z-10 max-w-2xl mx-auto px-3 sm:px-4 lg:px-6">
        {/* Header */}
        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold casino-text-primary mb-2 flex items-center gap-2">
            <Users className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#FFD700' }} />
            Invite Friends
          </h1>
          <p className="text-sm sm:text-base casino-text-secondary">
            Share your referral code and earn rewards when your friends sign up and play!
          </p>
        </div>

        {/* Referral Code Card */}
        <div
          className="rounded-xl sm:rounded-2xl p-5 sm:p-8 mb-4 sm:mb-6 casino-border text-center"
          style={{
            background: 'linear-gradient(135deg, rgba(255,107,0,0.1) 0%, rgba(255,215,0,0.05) 100%)',
            border: '1px solid rgba(255,215,0,0.25)',
          }}
        >
          <p className="text-sm casino-text-secondary mb-3">Your Referral Code</p>
          <div
            className="inline-block px-6 sm:px-8 py-3 sm:py-4 rounded-xl mb-4 sm:mb-6 font-mono text-2xl sm:text-3xl font-bold tracking-widest"
            style={{
              background: 'rgba(0,0,0,0.3)',
              color: '#FFD700',
              border: '2px dashed rgba(255,215,0,0.3)',
              letterSpacing: '0.25em',
            }}
          >
            {data?.referralCode || '—'}
          </div>

          <div className="flex gap-3 justify-center">
            <button
              onClick={handleCopy}
              disabled={!data?.referralCode}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 touch-manipulation disabled:opacity-40"
              style={{
                background: 'rgba(255,255,255,0.1)',
                color: '#F5F5F5',
                border: '1px solid rgba(255,255,255,0.15)',
              }}
            >
              {copied ? (
                <>
                  <CheckCircle className="w-4 h-4" style={{ color: '#00C853' }} />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>

            <button
              onClick={handleShare}
              disabled={!data?.referralCode}
              className="flex items-center gap-2 px-4 sm:px-6 py-2.5 rounded-xl font-semibold text-sm transition-all active:scale-95 touch-manipulation disabled:opacity-40"
              style={{
                background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                color: '#0A0A0F',
              }}
            >
              <Share2 className="w-4 h-4" />
              Share
            </button>
          </div>
        </div>

        {/* Pending notice */}
        {(data?.pendingCount || 0) > 0 && (
          <div
            className="rounded-xl p-3 sm:p-4 mb-4 sm:mb-6 flex items-center gap-3"
            style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.3)' }}
          >
            <Clock className="w-5 h-5 flex-shrink-0" style={{ color: '#F59E0B' }} />
            <p className="text-xs sm:text-sm" style={{ color: '#F59E0B' }}>
              {data.pendingCount} referral{data.pendingCount > 1 ? 's' : ''} pending verification by our team.
            </p>
          </div>
        )}

        {/* Stats — only verified referrals count */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 mb-4 sm:mb-6">
          <div className="casino-bg-secondary rounded-xl p-4 sm:p-6 casino-border text-center">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3"
              style={{ background: 'linear-gradient(135deg, #FF6F00 0%, #FFD700 100%)' }}
            >
              <Users className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#0A0A0F' }} />
            </div>
            <p className="text-xl sm:text-2xl font-bold casino-text-primary">
              {data?.referralCount || 0}
            </p>
            <p className="text-xs sm:text-sm casino-text-secondary">Friends Invited</p>
          </div>

          <div className="casino-bg-secondary rounded-xl p-4 sm:p-6 casino-border text-center">
            <div
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center mx-auto mb-2 sm:mb-3"
              style={{ background: 'linear-gradient(135deg, #00C853 0%, #00A844 100%)' }}
            >
              <Gift className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: '#F5F5F5' }} />
            </div>
            <p className="text-xl sm:text-2xl font-bold casino-text-primary">
              ${(data?.referralCount || 0) * 10}
            </p>
            <p className="text-xs sm:text-sm casino-text-secondary">Rewards Earned</p>
          </div>
        </div>

        {/* Referred Users */}
        <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border">
          <h3 className="text-base sm:text-lg font-semibold casino-text-primary mb-3 sm:mb-4">
            Verified Friends
          </h3>

          {(!data?.referredUsers || data.referredUsers.length === 0) ? (
            <div className="text-center py-6 sm:py-8">
              <Users className="w-10 h-10 mx-auto mb-3" style={{ color: '#555' }} />
              <p className="text-sm casino-text-secondary">
                {(data?.pendingCount || 0) > 0
                  ? 'Your referrals are pending verification. Check back soon!'
                  : 'No referrals yet. Share your code to get started!'}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {data.referredUsers.map((user, i) => (
                <div
                  key={i}
                  className="flex items-center justify-between py-2.5 px-3 rounded-lg"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold"
                      style={{ background: 'linear-gradient(135deg, #6A1B9A, #00B0FF)', color: '#fff' }}
                    >
                      {user.username.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm casino-text-primary font-medium">{user.username}</span>
                  </div>
                  <span className="text-xs casino-text-secondary">
                    {new Date(user.joinedAt).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* How it works */}
        <div className="casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-6 casino-border mt-4 sm:mt-6">
          <h3 className="text-base sm:text-lg font-semibold casino-text-primary mb-3 sm:mb-4">
            How It Works
          </h3>
          <div className="space-y-3">
            {[
              { step: '1', text: 'Share your unique referral code with friends' },
              { step: '2', text: 'They sign up using your code' },
              { step: '3', text: 'You both earn bonus credits when they play' },
            ].map((item) => (
              <div key={item.step} className="flex items-center gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                  style={{ background: 'linear-gradient(135deg, #FFD700, #FFA000)', color: '#0A0A0F' }}
                >
                  {item.step}
                </div>
                <p className="text-sm casino-text-secondary">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
