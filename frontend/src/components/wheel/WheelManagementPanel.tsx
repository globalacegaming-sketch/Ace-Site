import { useState, useEffect } from 'react';
import { Save, Loader2, Calendar, DollarSign, Settings, BarChart3, Power, RefreshCcw, RotateCcw } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../../utils/api';

// This is a comprehensive wheel management panel following the PRD
// It will have 5 sections as specified

const WheelManagementPanel = () => {
  const API_BASE_URL = getApiBaseUrl();
  const [activeSection, setActiveSection] = useState<'basics' | 'budget' | 'rules' | 'results'>('basics');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [togglingWheel, setTogglingWheel] = useState(false);
  const [resettingBudget, setResettingBudget] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const getAgentToken = () => {
    const session = localStorage.getItem('agent_session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.token;
    }
    return null;
  };

  // Section 1: Campaign Basics
  const [campaign, setCampaign] = useState({
    campaignName: '',
    status: 'draft' as 'draft' | 'live' | 'paused',
    startDate: '',
    endDate: ''
  });

  // Using hardcoded segments from WheelOfFortune.tsx
  // Segments are: 1, 5, try again, 1, better luck, 10, better luck, 5, 1, try again, 50%, better luck, 1, 5, better luck
  // Cost values: $1 = $1, $5 = $5, $10 = $10, Try Again = $0, Better Luck = $0, 50% = $0
  

  // Section 3: Budget
  const [budget, setBudget] = useState({
    mode: 'auto' as 'auto' | 'target_expense' | 'manual',
    totalBudget: 0,
    targetSpins: 0,
    targetExpensePerDay: 0,
    targetExpensePerSpins: 0,
    targetExpenseSpinsInterval: 10
  });

  // Section 4: Fairness Rules
  const [fairnessRules, setFairnessRules] = useState({
    spinsPerDay: 2,
    freeSpinCannotTriggerFreeSpin: true
  });

  // Section 5: Results
  const [results, setResults] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  
  // Budget stats
  const [budgetStats, setBudgetStats] = useState({
    totalSpins: 0,
    uniqueUsers: 0,
    budgetSpent: 0,
    budgetRemaining: 0,
    totalBudget: 0,
    averagePayout: 0
  });

  // Win breakdown by reward type (from stats endpoint)
  const [winBreakdown, setWinBreakdown] = useState<Record<string, { count: number; totalCost: number; label: string }>>({});

  useEffect(() => {
    loadCampaignData();
  }, []);

  useEffect(() => {
    if (activeSection === 'results') {
      loadResults();
    }
  }, [activeSection]);

  const loadResults = async () => {
    setResultsLoading(true);
    try {
      const token = getAgentToken();
      if (!token) return;
      const response = await axios.get(`${API_BASE_URL}/agent/wheel/results`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setResults(response.data.data);
      }
    } catch (error) {
      console.error('Failed to load results:', error);
    } finally {
      setResultsLoading(false);
    }
  };

  const loadCampaignData = async () => {
    setLoading(true);
    try {
      const token = getAgentToken();
      if (!token) {
        toast.error('Please login as agent');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Load all data in parallel (no slices - using hardcoded SEGMENTS)
      const [campaignRes, budgetRes, rulesRes, resultsRes] = await Promise.all([
        axios.get(`${API_BASE_URL}/agent/wheel/campaign`, { headers }),
        axios.get(`${API_BASE_URL}/agent/wheel/budget`, { headers }),
        axios.get(`${API_BASE_URL}/agent/wheel/fairness-rules`, { headers }),
        axios.get(`${API_BASE_URL}/agent/wheel/results`, { headers })
      ]);

      if (campaignRes.data.success) {
        const c = campaignRes.data.data;
        setCampaign({
          campaignName: c.campaignName || '',
          status: c.status || 'draft',
          startDate: c.startDate ? c.startDate.split('T')[0] : '',
          endDate: c.endDate ? c.endDate.split('T')[0] : ''
        });
      }

      // No longer loading slices - using hardcoded SEGMENTS

      if (budgetRes.data.success) {
        const b = budgetRes.data.data;
        setBudget({
          mode: b.mode || 'auto',
          totalBudget: b.totalBudget || 0,
          targetSpins: b.targetSpins || 0,
          targetExpensePerDay: b.targetExpensePerDay || 0,
          targetExpensePerSpins: b.targetExpensePerSpins || 0,
          targetExpenseSpinsInterval: b.targetExpenseSpinsInterval || 10
        });
        setBudgetStats({
          totalSpins: b.totalSpins || 0,
          uniqueUsers: 0, // Will be loaded from stats
          budgetSpent: b.budgetSpent || 0,
          budgetRemaining: b.budgetRemaining || 0,
          totalBudget: b.totalBudget || 0,
          averagePayout: b.averagePayoutPerSpin || 0
        });
      }

      // Load stats (includes win breakdown)
      try {
        const statsRes = await axios.get(`${API_BASE_URL}/agent/wheel/stats`, { headers });
        if (statsRes.data.success) {
          const { winBreakdown: wb, ...rest } = statsRes.data.data;
          setBudgetStats(prev => ({ ...prev, ...rest }));
          if (wb) setWinBreakdown(wb);
        }
      } catch (error) {
        // Stats loading is optional
      }

      if (rulesRes.data.success) {
        const r = rulesRes.data.data;
        setFairnessRules({
          spinsPerDay: r.spinsPerDay ?? 2,
          freeSpinCannotTriggerFreeSpin: r.freeSpinCannotTriggerFreeSpin !== false
        });
      }

      if (resultsRes.data.success) {
        setResults(resultsRes.data.data);
      }
    } catch (error: any) {
      console.error('Failed to load campaign data:', error);
      toast.error('Failed to load wheel configuration');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = getAgentToken();
      if (!token) {
        toast.error('Please login as agent');
        return;
      }

      const headers = { Authorization: `Bearer ${token}` };

      // Validate minimum requirements
      if (!campaign.campaignName.trim()) {
        toast.error('Campaign name is required');
        return;
      }

      // Save all sections — campaign system is the single source of truth
      await Promise.all([
        axios.put(`${API_BASE_URL}/agent/wheel/campaign`, {
          campaignName: campaign.campaignName,
          status: campaign.status,
          startDate: campaign.startDate || undefined,
          endDate: campaign.endDate || undefined
        }, { headers }),
        axios.put(`${API_BASE_URL}/agent/wheel/budget`, budget, { headers }),
        axios.put(`${API_BASE_URL}/agent/wheel/fairness-rules`, fairnessRules, { headers })
      ]);

      toast.success('Wheel configuration saved successfully');
      await loadCampaignData(); // Reload to get updated data
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to save configuration');
    } finally {
      setSaving(false);
    }
  };

  const handleWheelToggle = async () => {
    const token = getAgentToken();
    if (!token) {
      toast.error('Please login as agent');
      return;
    }
    const newStatus = campaign.status === 'live' ? 'paused' : 'live';
    setTogglingWheel(true);
    try {
      // Campaign status is the single source of truth (live = wheel on, paused = wheel off)
      await axios.put(
        `${API_BASE_URL}/agent/wheel/campaign`,
        { status: newStatus },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setCampaign((prev) => ({ ...prev, status: newStatus }));
      toast.success(newStatus === 'live' ? 'Wheel is now visible to users' : 'Wheel is now hidden from users');
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to update wheel visibility');
    } finally {
      setTogglingWheel(false);
    }
  };

  const handleBudgetReset = async () => {
    const token = getAgentToken();
    if (!token) { toast.error('Please login as agent'); return; }
    setResettingBudget(true);
    try {
      const res = await axios.post(
        `${API_BASE_URL}/agent/wheel/budget/reset`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        toast.success(res.data.message || 'Budget reset successfully');
        await loadCampaignData();
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || 'Failed to reset budget');
    } finally {
      setResettingBudget(false);
      setShowResetConfirm(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">Wheel of Fortune Management</h1>
        <button
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Save Configuration
        </button>
      </div>

      {/* Wheel On/Off Toggle */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Power className={`w-6 h-6 ${campaign.status === 'live' ? 'text-green-600' : 'text-gray-400'}`} />
          <div>
            <p className="font-semibold text-gray-900">Wheel visible to users</p>
            <p className="text-sm text-gray-500">
              {campaign.status === 'live' ? 'The wheel is shown on the site.' : 'The wheel is hidden. Use the switch to show it.'}
            </p>
          </div>
        </div>
        <button
          onClick={handleWheelToggle}
          disabled={togglingWheel}
          role="switch"
          aria-checked={campaign.status === 'live'}
          aria-label={campaign.status === 'live' ? 'Turn wheel off' : 'Turn wheel on'}
          className={`relative inline-flex h-8 w-14 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
            campaign.status === 'live' ? 'bg-green-600' : 'bg-gray-300'
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ${
              campaign.status === 'live' ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Navigation Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex space-x-8">
          {[
            { id: 'basics', label: 'Campaign Basics', icon: Calendar },
            { id: 'budget', label: 'Budget & Distribution', icon: DollarSign },
            { id: 'rules', label: 'Rules & Fairness', icon: Settings },
            { id: 'results', label: 'Results & Winners', icon: BarChart3 }
          ].map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveSection(id as any)}
              className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeSection === id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-5 h-5" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      {/* Section Content */}
      <div className="bg-white rounded-lg shadow p-6">
        {activeSection === 'basics' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Campaign Basics</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Campaign Name
                </label>
                <input
                  type="text"
                  value={campaign.campaignName}
                  onChange={(e) => setCampaign({ ...campaign, campaignName: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                  placeholder="Summer Promotion 2024"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status
                </label>
                <select
                  value={campaign.status}
                  onChange={(e) => setCampaign({ ...campaign, status: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                >
                  <option value="draft">Draft</option>
                  <option value="live">Live</option>
                  <option value="paused">Paused</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Start Date (Optional)
                </label>
                <input
                  type="date"
                  value={campaign.startDate}
                  onChange={(e) => setCampaign({ ...campaign, startDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  End Date (Optional)
                </label>
                <input
                  type="date"
                  value={campaign.endDate}
                  onChange={(e) => setCampaign({ ...campaign, endDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-black"
                />
              </div>
            </div>
          </div>
        )}

        {activeSection === 'budget' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Budget & Distribution Engine</h2>
              <button
                onClick={loadCampaignData}
                className="px-3 py-1.5 text-sm bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-1.5"
              >
                <RefreshCcw className="w-4 h-4" /> Refresh
              </button>
            </div>
            
            {/* Budget Summary Card */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
              <div className="flex justify-between items-start mb-4">
                <h3 className="text-lg font-semibold text-gray-800">Budget Summary</h3>
                {/* Reset Budget Button */}
                {!showResetConfirm ? (
                  <button
                    onClick={() => setShowResetConfirm(true)}
                    className="px-3 py-1.5 text-sm bg-red-50 text-red-700 rounded-lg hover:bg-red-100 border border-red-200 flex items-center gap-1.5"
                  >
                    <RotateCcw className="w-4 h-4" /> Reset Budget
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-red-700 font-medium">Are you sure?</span>
                    <button
                      onClick={handleBudgetReset}
                      disabled={resettingBudget}
                      className="px-3 py-1.5 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
                    >
                      {resettingBudget ? 'Resetting...' : 'Yes, Reset'}
                    </button>
                    <button
                      onClick={() => setShowResetConfirm(false)}
                      className="px-3 py-1.5 text-sm bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Total Budget</p>
                  <p className="text-2xl font-bold text-gray-900">${budgetStats.totalBudget.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Budget Remaining</p>
                  <p className={`text-2xl font-bold ${budgetStats.budgetRemaining < budgetStats.totalBudget * 0.1 ? 'text-red-600' : 'text-green-600'}`}>
                    ${budgetStats.budgetRemaining.toFixed(2)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Budget Spent</p>
                  <p className="text-2xl font-bold text-gray-900">${budgetStats.budgetSpent.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Spins Completed</p>
                  <p className="text-2xl font-bold text-gray-900">{budgetStats.totalSpins}</p>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">Average Payout Per Spin</p>
                  <p className="text-xl font-semibold text-gray-900">${budgetStats.averagePayout.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Unique Users</p>
                  <p className="text-xl font-semibold text-gray-900">{budgetStats.uniqueUsers}</p>
                </div>
              </div>
              {/* Budget progress bar */}
              {budgetStats.totalBudget > 0 && (
                <div className="mt-4">
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Spent: {((budgetStats.budgetSpent / budgetStats.totalBudget) * 100).toFixed(1)}%</span>
                    <span>Remaining: {((budgetStats.budgetRemaining / budgetStats.totalBudget) * 100).toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2.5">
                    <div
                      className={`h-2.5 rounded-full ${budgetStats.budgetRemaining < budgetStats.totalBudget * 0.1 ? 'bg-red-500' : 'bg-blue-500'}`}
                      style={{ width: `${Math.min(100, (budgetStats.budgetSpent / budgetStats.totalBudget) * 100)}%` }}
                    />
                  </div>
                </div>
              )}
              {budgetStats.budgetRemaining < budgetStats.totalBudget * 0.1 && budgetStats.totalBudget > 0 && (
                <div className="mt-4 p-3 bg-yellow-100 border border-yellow-400 rounded text-yellow-800 text-sm">
                  Warning: Budget is running low. Consider adding more budget, resetting, or pausing the campaign.
                </div>
              )}
            </div>

            {/* Win Breakdown */}
            {Object.keys(winBreakdown).length > 0 && (
              <div className="bg-white rounded-lg p-5 border border-gray-200">
                <h3 className="text-lg font-semibold text-gray-800 mb-3">Win Distribution</h3>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                  {Object.entries(winBreakdown).map(([type, data]) => (
                    <div key={type} className="p-3 bg-gray-50 rounded-lg text-center">
                      <p className="text-xs text-gray-500 truncate">{data.label}</p>
                      <p className="text-xl font-bold text-gray-900">{data.count}</p>
                      <p className="text-xs text-gray-400">${data.totalCost.toFixed(2)} cost</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Budget Mode
                </label>
                <select
                  value={budget.mode}
                  onChange={(e) => setBudget({ ...budget, mode: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                >
                  <option value="auto">Auto (Recommended) — paces prizes across target spins</option>
                  <option value="target_expense">Target Expense Rate — daily/per-N-spins caps</option>
                  <option value="manual">Custom / Manual Control</option>
                </select>
                {budget.mode === 'auto' && (
                  <p className="text-xs text-gray-500 mt-1">
                    Auto mode distributes your budget evenly across the target number of spins. When overspending, expensive prizes become rarer automatically.
                  </p>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Total Budget ($)
                  </label>
                  <input
                    type="number"
                    value={budget.totalBudget}
                    onChange={(e) => setBudget({ ...budget, totalBudget: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
                    min="0"
                    step="0.01"
                  />
                </div>
                {budget.mode === 'auto' && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Target Spins
                    </label>
                    <input
                      type="number"
                      value={budget.targetSpins}
                      onChange={(e) => setBudget({ ...budget, targetSpins: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
                      min="1"
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      Ideal spend per spin: ${budget.targetSpins > 0 ? (budget.totalBudget / budget.targetSpins).toFixed(2) : '—'}
                    </p>
                  </div>
                )}
                {budget.mode === 'target_expense' && (
                  <>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Expense Per Day ($)
                      </label>
                      <input
                        type="number"
                        value={budget.targetExpensePerDay}
                        onChange={(e) => setBudget({ ...budget, targetExpensePerDay: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
                        min="0"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Target Expense Per {budget.targetExpenseSpinsInterval} Spins ($)
                      </label>
                      <input
                        type="number"
                        value={budget.targetExpensePerSpins}
                        onChange={(e) => setBudget({ ...budget, targetExpensePerSpins: parseFloat(e.target.value) || 0 })}
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
                        min="0"
                      />
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        )}

        {activeSection === 'rules' && (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold text-gray-900">Rules & Fairness Controls</h2>
            <p className="text-sm text-gray-600">
              Configure spin limits and fairness rules to prevent abuse.
            </p>
            
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Spin Limits</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Spins Per Day (-1 for unlimited)
                    </label>
                    <input
                      type="number"
                      value={fairnessRules.spinsPerDay}
                      onChange={(e) => setFairnessRules({ ...fairnessRules, spinsPerDay: parseInt(e.target.value) || -1 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg text-black"
                      min="-1"
                    />
                    <p className="text-xs text-gray-500 mt-1">How many spins a user gets per 12-hour rolling window (-1 = unlimited)</p>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold text-gray-800 mb-4">Free Spin Rules</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={fairnessRules.freeSpinCannotTriggerFreeSpin}
                        onChange={(e) => setFairnessRules({ ...fairnessRules, freeSpinCannotTriggerFreeSpin: e.target.checked })}
                        className="w-5 h-5 text-blue-600"
                      />
                      <span className="text-sm text-gray-700">Free spin cannot trigger another free spin</span>
                    </label>
                  </div>
                  <div className="text-sm text-gray-600">
                    <p>Max free spins per user: <strong>1 per 24 hours</strong> (hardcoded)</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeSection === 'results' && (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold text-gray-900">Results & Winners</h2>
              <button
                onClick={async () => {
                  try {
                    const token = getAgentToken();
                    if (!token) return;
                    const response = await axios.get(`${API_BASE_URL}/agent/wheel/results`, {
                      headers: { Authorization: `Bearer ${token}` }
                    });
                    if (response.data.success) {
                      // Convert to CSV
                      const csv = [
                        ['User', 'Email', 'Prize', 'Cost', 'Timestamp', 'Redeemed'].join(','),
                        ...response.data.data.map((r: any) => [
                          r.username || 'N/A',
                          r.email || 'N/A',
                          r.prize || 'N/A',
                          r.cost || 0,
                          new Date(r.timestamp).toLocaleString(),
                          r.redeemed ? 'Yes' : 'No'
                        ].join(','))
                      ].join('\n');
                      const blob = new Blob([csv], { type: 'text/csv' });
                      const url = window.URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `wheel-results-${new Date().toISOString().split('T')[0]}.csv`;
                      a.click();
                      window.URL.revokeObjectURL(url);
                      toast.success('CSV exported successfully');
                    }
                  } catch (error) {
                    toast.error('Failed to export CSV');
                  }
                }}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                Export CSV
              </button>
            </div>
            {resultsLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Prize</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cost</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Timestamp</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Redeemed</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {results.map((result: any) => (
                      <tr key={result.id}>
                        <td className="px-4 py-3 text-sm text-gray-900">{result.username || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">{result.email || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{result.prize || 'N/A'}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">${result.cost?.toFixed(2) || '0.00'}</td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {new Date(result.timestamp).toLocaleString()}
                        </td>
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded ${result.redeemed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                            {result.redeemed ? 'Yes' : 'No'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm">
                          {!result.redeemed && (
                            <button
                              onClick={async () => {
                                try {
                                  const token = getAgentToken();
                                  if (!token) return;
                                  await axios.put(
                                    `${API_BASE_URL}/agent/wheel/results/${result.id}/redeem`,
                                    {},
                                    { headers: { Authorization: `Bearer ${token}` } }
                                  );
                                  toast.success('Prize marked as redeemed');
                                  await loadCampaignData();
                                } catch (error) {
                                  toast.error('Failed to mark as redeemed');
                                }
                              }}
                              className="text-blue-600 hover:text-blue-800"
                            >
                              Mark Redeemed
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {results.length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No spins recorded yet.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WheelManagementPanel;

