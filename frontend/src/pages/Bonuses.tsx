import { useState, useEffect, useCallback } from 'react';
import { Gift, Star, Clock, CheckCircle, Loader2, Bell, BellOff, Users, Copy, Share2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../utils/api';
import { PageMeta } from '../components/PageMeta';
import BonusCountdown from '../components/BonusCountdown';
import BonusProgressBar from '../components/BonusProgressBar';

interface Bonus {
  _id: string;
  title: string;
  description: string;
  image: string;
  bonusType: 'welcome' | 'deposit' | 'free_spins' | 'cashback' | 'other';
  bonusValue?: string;
  termsAndConditions?: string;
  isActive: boolean;
  validFrom?: string;
  validUntil?: string;
  claimedBy?: string[];
  /** Wagering progress — populated by backend when bonus is claimed */
  wagerRequired?: number;
  wagerCompleted?: number;
}

const REMIND_KEY = 'gag-bonus-reminders';

function getReminders(): Set<string> {
  try {
    const raw = localStorage.getItem(REMIND_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
}

function saveReminder(id: string) {
  const set = getReminders();
  set.add(id);
  try { localStorage.setItem(REMIND_KEY, JSON.stringify([...set])); } catch { /* noop */ }
}

const Offers = () => {
  const API_BASE_URL = getApiBaseUrl();
  const { isAuthenticated, user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<'current' | 'upcoming' | 'expired'>('current');
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Set<string>>(getReminders);

  const handleRemindMe = useCallback(async (bonusId: string) => {
    try {
      if (typeof window !== 'undefined' && 'OneSignalDeferred' in window) {
        (window as any).OneSignalDeferred.push(async (OneSignal: any) => {
          await OneSignal.Slidedown.promptPush();
        });
      }
      saveReminder(bonusId);
      setReminders(new Set(getReminders()));
      toast.success('You\'ll be notified when this bonus goes live!');
    } catch {
      toast.error('Could not set reminder');
    }
  }, []);

  useEffect(() => {
    loadBonuses();
  }, []);

  const loadBonuses = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/bonuses`);
      if (response.data.success) {
        setBonuses(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load bonuses:', error);
      toast.error('Failed to load bonuses');
    } finally {
      setLoading(false);
    }
  };

  const handleClaimBonus = async (bonus: Bonus) => {
    if (!isAuthenticated || !user) {
      toast.error('Please login to claim bonuses');
      return;
    }

    const userId = (user as any)._id || user.id;

    if (bonus.claimedBy?.includes(userId)) {
      toast.error('You have already claimed this bonus');
      return;
    }

    try {
      setClaiming(bonus._id);
      const claimResponse = await axios.post(
        `${API_BASE_URL}/bonuses/${bonus._id}/claim`,
        { userId: userId }
      );

      if (claimResponse.data.success) {
        toast.success('Bonus claimed successfully!');
        loadBonuses();
      } else {
        toast.error(claimResponse.data.message || 'Failed to claim bonus');
      }
    } catch (error: any) {
      if (error.response?.data?.alreadyClaimed) {
        toast.error('You have already claimed this bonus');
      } else {
        toast.error(error.response?.data?.message || 'Failed to claim bonus');
      }
    } finally {
      setClaiming(null);
    }
  };

  const getFilteredBonuses = () => {
    const now = new Date();
    return bonuses.filter(bonus => {
      if (!bonus.isActive) return false;
      const validFrom = bonus.validFrom ? new Date(bonus.validFrom) : null;
      const validUntil = bonus.validUntil ? new Date(bonus.validUntil) : null;

      switch (activeTab) {
        case 'current':
          return (!validFrom || validFrom <= now) && (!validUntil || validUntil >= now);
        case 'upcoming':
          return validFrom && validFrom > now;
        case 'expired':
          return validUntil && validUntil < now;
        default:
          return true;
      }
    });
  };

  const isClaimed = (bonus: Bonus) => {
    if (!isAuthenticated || !user) return false;
    const userId = (user as any)._id || user.id;
    return bonus.claimedBy?.includes(userId) || false;
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: 'var(--casino-primary-dark)' }}>
        <Loader2 className="w-12 h-12 animate-spin" style={{ color: 'var(--casino-highlight-gold)' }} />
      </div>
    );
  }

  const filteredBonuses = getFilteredBonuses();

  return (
    <div className="min-h-screen pt-20 pb-4 sm:pb-6 lg:pb-8" style={{
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
    }}>
      <PageMeta title="Bonuses & Promotions | Global Ace Gaming" description="Discover bonuses and promotions. Use them across our online slots, fish, and table games. See current offers." />

      {/* Decorative orbs */}
      <div className="absolute inset-0 -z-10 pointer-events-none" aria-hidden>
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-20 animate-pulse" style={{ backgroundColor: 'var(--casino-accent-purple)' }} />
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-15" style={{ backgroundColor: 'var(--casino-accent-blue)' }} />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-3 sm:px-4 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-2xl sm:text-4xl font-bold casino-text-primary mb-3 sm:mb-4">
            Exclusive Bonuses
          </h1>
          <p className="text-sm sm:text-xl casino-text-secondary max-w-3xl mx-auto">
            Discover amazing bonuses and promotions designed to enhance your gaming experience
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex justify-center mb-6 sm:mb-8">
          <div className="casino-bg-secondary rounded-xl p-1 casino-border border" style={{ boxShadow: '0 0 15px rgba(0,0,0,0.3)' }}>
            {(['current', 'upcoming', 'expired'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 sm:px-6 py-2 sm:py-2.5 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 ${
                  activeTab === tab
                    ? 'text-[#0A0A0F] font-bold'
                    : 'casino-text-secondary hover:text-[#F5F5F5]'
                }`}
                style={activeTab === tab ? {
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                  boxShadow: '0 0 12px rgba(255,215,0,0.3)',
                } : {}}
              >
                {tab === 'current' ? 'Current Bonuses' : tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Offers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* Referral card — shown as a bonus card inside Current tab */}
          {activeTab === 'current' && isAuthenticated && user?.referralCode && (
            <div className="casino-bg-secondary rounded-xl sm:rounded-2xl casino-border border transition-all duration-300 hover:border-[#FFD700]/40" style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}>
              <div className="p-4 sm:p-6">
                <div className="rounded-xl flex items-center justify-center h-40 sm:h-48 mb-4" style={{ background: 'linear-gradient(135deg, rgba(255,107,0,0.15), rgba(255,215,0,0.08))' }}>
                  <div className="text-center">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full flex items-center justify-center mx-auto mb-3" style={{ background: 'linear-gradient(135deg, #FF6F00 0%, #FFD700 100%)' }}>
                      <Users className="w-6 h-6 sm:w-7 sm:h-7" style={{ color: '#0A0A0F' }} />
                    </div>
                    <p className="font-mono font-bold text-lg sm:text-xl tracking-widest" style={{ color: 'var(--casino-highlight-gold)' }}>{user.referralCode}</p>
                  </div>
                </div>

                <div className="flex items-center space-x-2 mb-3 sm:mb-4">
                  <Gift className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--casino-highlight-gold)' }} />
                  <h3 className="text-lg sm:text-xl font-bold casino-text-primary">Invite Friends</h3>
                </div>

                <p className="casino-text-secondary text-sm mb-4">
                  Share your referral code with friends. When they sign up and play, you both earn bonus credits!
                </p>

                <div className="rounded-lg p-3 sm:p-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(255,215,0,0.1), rgba(255,165,0,0.05))', border: '1px solid rgba(255,215,0,0.15)' }}>
                  <div className="text-center">
                    <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--casino-highlight-gold)' }}>$10</div>
                    <div className="text-xs sm:text-sm casino-text-secondary">Per Referral</div>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(user.referralCode!);
                        toast.success('Referral code copied!');
                      } catch { toast.error('Failed to copy'); }
                    }}
                    className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg font-medium text-sm transition-colors duration-200 flex items-center justify-center gap-2 touch-manipulation casino-text-primary"
                    style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid var(--casino-card-border)' }}
                  >
                    <Copy className="w-4 h-4" />
                    Copy Code
                  </button>
                  <Link
                    to="/referrals"
                    className="flex-1 py-2.5 sm:py-3 px-3 sm:px-4 rounded-lg font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation"
                    style={{ background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)', color: '#0A0A0F' }}
                  >
                    <Share2 className="w-4 h-4" />
                    Share
                  </Link>
                </div>
              </div>
            </div>
          )}

          {filteredBonuses.map((bonus) => {
            const claimed = isClaimed(bonus);
            return (
              <div
                key={bonus._id}
                className={`casino-bg-secondary rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                  bonus.isActive && !claimed
                    ? 'casino-border hover:border-[#FFD700]/40'
                    : 'casino-border opacity-75'
                }`}
                style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.3)' }}
              >
                <div className="p-4 sm:p-6">
                  {/* Image */}
                  {bonus.image && (
                    <div className="mb-4">
                      <img
                        src={bonus.image}
                        alt={bonus.title}
                        className="w-full h-40 sm:h-48 object-cover rounded-lg"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x300?text=' + encodeURIComponent(bonus.title);
                        }}
                      />
                    </div>
                  )}

                  {/* Header */}
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center space-x-2">
                      <Gift className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: 'var(--casino-highlight-gold)' }} />
                      <h3 className="text-lg sm:text-xl font-bold casino-text-primary">{bonus.title}</h3>
                    </div>
                    {claimed && (
                      <div className="status-success-casino flex items-center space-x-1 px-2 py-1 rounded-full text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Claimed</span>
                      </div>
                    )}
                  </div>

                  {/* Description */}
                  <p className="casino-text-secondary text-sm mb-4">{bonus.description}</p>

                  {/* Bonus Info */}
                  {bonus.bonusValue && (
                    <div className="rounded-lg p-3 sm:p-4 mb-4" style={{ background: 'linear-gradient(135deg, rgba(106,27,154,0.15), rgba(0,176,255,0.1))', border: '1px solid rgba(106,27,154,0.2)' }}>
                      <div className="text-center">
                        <div className="text-2xl sm:text-3xl font-bold mb-1" style={{ color: 'var(--casino-highlight-gold)' }}>
                          {bonus.bonusValue}
                        </div>
                        <div className="text-xs sm:text-sm casino-text-secondary">Bonus Value</div>
                        <div className="text-xs casino-text-secondary mt-1 capitalize opacity-70">
                          {bonus.bonusType.replace('_', ' ')}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Details + Countdown */}
                  <div className="space-y-2 mb-4">
                    {bonus.validUntil && (
                      <div className="flex items-center justify-between flex-wrap gap-1">
                        <div className="flex items-center space-x-2">
                          <Clock className="w-4 h-4 casino-text-secondary" />
                          <span className="text-xs sm:text-sm casino-text-secondary">
                            Valid until: {new Date(bonus.validUntil).toLocaleDateString()}
                          </span>
                        </div>
                        {activeTab === 'current' && <BonusCountdown validUntil={bonus.validUntil} />}
                      </div>
                    )}
                    {bonus.termsAndConditions && (
                      <div className="flex items-center space-x-2">
                        <Star className="w-4 h-4 casino-text-secondary" />
                        <span className="text-xs sm:text-sm casino-text-secondary line-clamp-1">
                          {bonus.termsAndConditions}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Wagering Progress */}
                  {claimed && bonus.wagerRequired != null && bonus.wagerRequired > 0 && (
                    <BonusProgressBar
                      wagered={bonus.wagerCompleted || 0}
                      required={bonus.wagerRequired}
                    />
                  )}

                  {/* Action Buttons */}
                  {activeTab === 'upcoming' ? (
                    <button
                      onClick={() => handleRemindMe(bonus._id)}
                      disabled={reminders.has(bonus._id)}
                      className={`w-full py-2.5 sm:py-3 px-4 rounded-lg font-medium text-sm sm:text-base transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation ${
                        reminders.has(bonus._id)
                          ? 'cursor-not-allowed opacity-50'
                          : ''
                      }`}
                      style={reminders.has(bonus._id) ? {
                        background: 'var(--casino-card-border)',
                        color: 'var(--casino-text-secondary)',
                      } : {
                        background: 'linear-gradient(135deg, #F59E0B, #D97706)',
                        color: '#0A0A0F',
                      }}
                    >
                      {reminders.has(bonus._id) ? (
                        <>
                          <BellOff className="w-4 h-4" />
                          Reminder Set
                        </>
                      ) : (
                        <>
                          <Bell className="w-4 h-4" />
                          Remind Me
                        </>
                      )}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleClaimBonus(bonus)}
                      disabled={!bonus.isActive || claimed || claiming === bonus._id}
                      className="w-full py-2.5 sm:py-3 px-4 rounded-lg font-bold text-sm sm:text-base transition-all duration-200 flex items-center justify-center gap-2 touch-manipulation disabled:opacity-50"
                      style={claimed ? {
                        background: 'rgba(0,200,83,0.15)',
                        color: 'var(--casino-accent-green)',
                        border: '1px solid var(--casino-accent-green)',
                        cursor: 'not-allowed',
                      } : bonus.isActive ? {
                        background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                        color: '#0A0A0F',
                        boxShadow: '0 0 15px rgba(255,215,0,0.25)',
                      } : {
                        background: 'var(--casino-card-border)',
                        color: 'var(--casino-text-secondary)',
                        cursor: 'not-allowed',
                      }}
                    >
                      {claiming === bonus._id ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Claiming...
                        </>
                      ) : claimed ? (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Already Claimed
                        </>
                      ) : bonus.isActive ? (
                        'Claim Offer'
                      ) : (
                        'Not Available'
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* No offers message */}
        {filteredBonuses.length === 0 && (
          <div className="text-center py-12">
            <Gift className="w-14 h-14 sm:w-16 sm:h-16 mx-auto mb-4" style={{ color: 'var(--casino-card-border)' }} />
            <h3 className="text-lg sm:text-xl font-semibold casino-text-secondary mb-2">
              No {activeTab} bonuses available
            </h3>
            <p className="text-sm casino-text-secondary opacity-70">
              Check back later for new exciting offers!
            </p>
          </div>
        )}

        {/* Terms and Conditions */}
        <div className="mt-8 sm:mt-12 casino-bg-secondary rounded-xl sm:rounded-2xl p-4 sm:p-8 casino-border border">
          <h2 className="text-lg sm:text-2xl font-bold casino-text-primary mb-4 sm:mb-6">
            Terms and Conditions
          </h2>
          <p className="text-xs sm:text-sm casino-text-secondary mb-6">
            All offers are subject to the following Terms and Conditions:
          </p>

          <div className="space-y-6">
            {/* General Conditions */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                General Conditions
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>All promotions, bonuses, and offers are subject to these Terms and Conditions.</li>
                <li>Global Ace Gaming reserves the right to modify, suspend, or cancel any promotion at any time without prior notice.</li>
              </ul>
            </div>

            {/* Bonus Wagering Requirement */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                Bonus Wagering Requirement
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>All bonuses must be fully wagered before any withdrawal request can be processed.</li>
                <li>Wagering requirements must be completed within the promotional validity period.</li>
              </ul>
            </div>

            {/* Minimum Deposit Requirement */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                Minimum Deposit Requirement
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>A minimum deposit of $10 or more per week is required to qualify for any bonus.</li>
                <li>The same minimum deposit requirement of $10 or more applies to all Wheel of Fortune bonuses.</li>
              </ul>
            </div>

            {/* One Bonus Policy */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                One Bonus Policy
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>Only one bonus per user per offer is allowed.</li>
                <li>Bonuses cannot be combined unless explicitly stated.</li>
              </ul>
            </div>

            {/* Wheel of Fortune Rules */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                Wheel of Fortune Rules
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>The Wheel of Fortune is available once every 12 hours per user.</li>
                <li>Multiple spins caused by technical issues will not be counted. Only the first recorded spin in the system will be considered valid.</li>
                <li>Rewards from the wheel are subject to standard wagering requirements.</li>
              </ul>
            </div>

            {/* Account & Fair Play Policy */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                Account & Fair Play Policy
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>Any suspicious activity, abuse of promotions, or creation of multiple accounts will result in immediate suspension or permanent ban.</li>
                <li>Users are allowed only one account per person, household, IP address, and device.</li>
                <li>Global Ace Gaming reserves the right to verify user identity at any time.</li>
              </ul>
            </div>

            {/* Bonus Abuse & Fraud */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                Bonus Abuse & Fraud
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>Any attempt to manipulate, exploit, or abuse promotions may result in forfeiture of bonuses, winnings, and account closure.</li>
                <li>Irregular betting patterns or system exploitation will be investigated.</li>
              </ul>
            </div>

            {/* Withdrawal Policy */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                Withdrawal Policy
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>Deposits must be wagered at least once before withdrawal.</li>
                <li>Verification documents may be required before processing withdrawals.</li>
              </ul>
            </div>

            {/* Responsible Gaming */}
            <div>
              <h3 className="text-sm sm:text-base font-semibold casino-text-primary mb-2" style={{ color: 'var(--casino-highlight-gold)' }}>
                Responsible Gaming
              </h3>
              <ul className="text-xs sm:text-sm casino-text-secondary space-y-1.5 list-disc list-inside">
                <li>Please gamble responsibly.</li>
                <li>If you believe you have a gambling problem, please seek professional assistance.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Offers;
