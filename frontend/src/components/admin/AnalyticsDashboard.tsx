import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  FunnelChart, Funnel, LabelList,
} from 'recharts';
import {
  Activity, Users, Eye, Clock, TrendingUp, MousePointerClick,
  Smartphone, Monitor, Tablet, AlertTriangle,
  CheckCircle2, ChevronDown, RefreshCw, Calendar,
  Globe, Layers, LogOut,
} from 'lucide-react';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

function getToken(): string {
  return localStorage.getItem('agent_session') || localStorage.getItem('admin_session') || '';
}

const COLORS = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#f97316', '#14b8a6'];
const FUNNEL_COLORS = ['#6366f1', '#818cf8', '#a78bfa', '#c4b5fd', '#ddd6fe', '#ede9fe'];

interface OverviewData {
  totalEvents: number;
  uniqueUsers: number;
  uniqueSessions: number;
  pageViews: number;
  avgSessionDuration: number;
  conversionRate: number;
  onboardingCompletionRate: number;
}

interface TrafficDay {
  date: string;
  pageViews: number;
  uniqueUsers: number;
  sessions: number;
}

interface PageData {
  page: string;
  views: number;
  uniqueUsers: number;
  avgDuration: number;
}

interface FeatureData {
  feature: string;
  uses: number;
  uniqueUsers: number;
  failures: number;
}

interface ClickData {
  topClicks: { element: string; elementId: string; clicks: number }[];
  rageClicks: number;
  clicksByPage: { page: string; clicks: number }[];
}

interface FunnelStep {
  step: string;
  event: string;
  users: number;
  rate: number;
  dropOff: number;
}

interface DropoffData {
  exitPages: { page: string; exits: number }[];
  abandonedFlows: { flow: string; count: number }[];
  bounceRate: number;
}

interface DeviceData {
  devices: { name: string; count: number }[];
  browsers: { name: string; count: number }[];
}

type Tab = 'overview' | 'pages' | 'features' | 'clicks' | 'funnel' | 'dropoff';

const TABS: { key: Tab; label: string; icon: typeof Activity }[] = [
  { key: 'overview', label: 'Overview', icon: Activity },
  { key: 'pages', label: 'Pages', icon: Globe },
  { key: 'features', label: 'Features', icon: Layers },
  { key: 'clicks', label: 'Clicks', icon: MousePointerClick },
  { key: 'funnel', label: 'Funnel', icon: TrendingUp },
  { key: 'dropoff', label: 'Drop-off', icon: LogOut },
];

const DATE_RANGES = [
  { label: 'Last 7 days', days: 7 },
  { label: 'Last 30 days', days: 30 },
  { label: 'Last 90 days', days: 90 },
];

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}m ${s}s`;
}

function formatNumber(n: number): string {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`;
  return n.toString();
}

function formatPageName(path: any): string {
  if (!path || path === '/') return 'Home';
  return path
    .replace(/^\//, '')
    .replace(/[-_]/g, ' ')
    .replace(/\//g, ' / ')
    .replace(/\b\w/g, (c: string) => c.toUpperCase());
}

export default function AnalyticsDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [dateRange, setDateRange] = useState(30);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(true);

  const [overview, setOverview] = useState<OverviewData | null>(null);
  const [traffic, setTraffic] = useState<TrafficDay[]>([]);
  const [pages, setPages] = useState<PageData[]>([]);
  const [features, setFeatures] = useState<FeatureData[]>([]);
  const [clicks, setClicks] = useState<ClickData | null>(null);
  const [funnel, setFunnel] = useState<FunnelStep[]>([]);
  const [dropoff, setDropoff] = useState<DropoffData | null>(null);
  const [devices, setDevices] = useState<DeviceData | null>(null);

  const headers = { Authorization: `Bearer ${getToken()}` };
  const getParams = useCallback(() => {
    const end = new Date();
    const start = new Date(end.getTime() - dateRange * 24 * 60 * 60 * 1000);
    return { startDate: start.toISOString(), endDate: end.toISOString() };
  }, [dateRange]);

  const loadTab = useCallback(async (tab: Tab) => {
    setLoading(true);
    const params = getParams();
    try {
      switch (tab) {
        case 'overview': {
          const [ovRes, trRes, dvRes] = await Promise.all([
            axios.get(`${API_BASE_URL}/api/analytics/overview`, { headers, params }),
            axios.get(`${API_BASE_URL}/api/analytics/traffic`, { headers, params }),
            axios.get(`${API_BASE_URL}/api/analytics/devices`, { headers, params }),
          ]);
          setOverview(ovRes.data.data);
          setTraffic(trRes.data.data);
          setDevices(dvRes.data.data);
          break;
        }
        case 'pages': {
          const r = await axios.get(`${API_BASE_URL}/api/analytics/pages`, { headers, params });
          setPages(r.data.data);
          break;
        }
        case 'features': {
          const r = await axios.get(`${API_BASE_URL}/api/analytics/features`, { headers, params });
          setFeatures(r.data.data);
          break;
        }
        case 'clicks': {
          const r = await axios.get(`${API_BASE_URL}/api/analytics/clicks`, { headers, params });
          setClicks(r.data.data);
          break;
        }
        case 'funnel': {
          const r = await axios.get(`${API_BASE_URL}/api/analytics/funnel`, { headers, params });
          setFunnel(r.data.data);
          break;
        }
        case 'dropoff': {
          const r = await axios.get(`${API_BASE_URL}/api/analytics/dropoff`, { headers, params });
          setDropoff(r.data.data);
          break;
        }
      }
    } catch (err) {
      console.error(`Analytics ${tab} load error:`, err);
    } finally {
      setLoading(false);
    }
  }, [getParams]);

  useEffect(() => {
    loadTab(activeTab);
  }, [activeTab, dateRange]);

  // ─── Renderers ─────────────────────────────────────────────

  const renderOverview = () => {
    if (!overview) return null;

    const stats = [
      { label: 'Unique Users', value: formatNumber(overview.uniqueUsers), icon: Users, color: 'bg-indigo-50 text-indigo-600' },
      { label: 'Page Views', value: formatNumber(overview.pageViews), icon: Eye, color: 'bg-blue-50 text-blue-600' },
      { label: 'Sessions', value: formatNumber(overview.uniqueSessions), icon: Activity, color: 'bg-purple-50 text-purple-600' },
      { label: 'Avg Duration', value: formatDuration(overview.avgSessionDuration), icon: Clock, color: 'bg-amber-50 text-amber-600' },
      { label: 'Conversion Rate', value: `${overview.conversionRate}%`, icon: TrendingUp, color: 'bg-emerald-50 text-emerald-600' },
      { label: 'Onboarding Rate', value: `${overview.onboardingCompletionRate}%`, icon: CheckCircle2, color: 'bg-teal-50 text-teal-600' },
    ];

    return (
      <div className="space-y-6">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {stats.map((s) => (
            <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-3 ${s.color}`}>
                <s.icon className="w-4.5 h-4.5" />
              </div>
              <p className="text-2xl font-bold text-gray-900">{s.value}</p>
              <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Traffic chart */}
        {traffic.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Traffic Over Time</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={traffic}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={(v) => v.slice(5)} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend iconSize={10} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="pageViews" name="Page Views" stroke="#6366f1" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="uniqueUsers" name="Users" stroke="#10b981" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="sessions" name="Sessions" stroke="#f59e0b" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Device & Browser */}
        {devices && (devices.devices.length > 0 || devices.browsers.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {devices.devices.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Devices</h3>
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={devices.devices} dataKey="count" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {devices.devices.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex justify-center gap-4 mt-2">
                  {devices.devices.map((d) => {
                    const Icon = d.name === 'mobile' ? Smartphone : d.name === 'tablet' ? Tablet : Monitor;
                    return (
                      <div key={d.name} className="flex items-center gap-1.5 text-xs text-gray-600">
                        <Icon className="w-3.5 h-3.5" />
                        <span className="capitalize">{d.name}</span>
                        <span className="font-semibold">{formatNumber(d.count)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            {devices.browsers.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                <h3 className="text-sm font-semibold text-gray-800 mb-4">Browsers</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={devices.browsers} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                    <XAxis type="number" tick={{ fontSize: 11 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={70} />
                    <Tooltip contentStyle={{ fontSize: 12 }} />
                    <Bar dataKey="count" name="Views" fill="#8b5cf6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Empty state */}
        {overview.totalEvents === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
            <Activity className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h3 className="text-lg font-semibold text-gray-700">No analytics data yet</h3>
            <p className="text-sm text-gray-500 mt-1">
              Events will appear here as users interact with the site. The tracker is now active and collecting data.
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderPages = () => (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">Top Pages</h3>
          <p className="text-xs text-gray-500 mt-0.5">Most visited pages ranked by total views</p>
        </div>
        {pages.length === 0 ? (
          <div className="p-8 text-center text-sm text-gray-400">No page data yet</div>
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Page</th>
                    <th className="text-right px-4 py-3 font-semibold">Views</th>
                    <th className="text-right px-4 py-3 font-semibold">Users</th>
                    <th className="text-right px-4 py-3 font-semibold">Avg Time</th>
                    <th className="px-4 py-3 font-semibold">Traffic</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {pages.map((p, i) => {
                    const maxViews = pages[0]?.views || 1;
                    return (
                      <tr key={i} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800">{formatPageName(p.page)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatNumber(p.views)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatNumber(p.uniqueUsers)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatDuration(p.avgDuration)}</td>
                        <td className="px-4 py-3 w-32">
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-indigo-500 rounded-full" style={{ width: `${(p.views / maxViews) * 100}%` }} />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Page views bar chart */}
            <div className="p-5 border-t border-gray-100">
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={pages.slice(0, 10)} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="page" tick={{ fontSize: 10 }} width={120} tickFormatter={formatPageName} />
                  <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={formatPageName} />
                  <Bar dataKey="views" name="Views" fill="#6366f1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}
      </div>
    </div>
  );

  const renderFeatures = () => (
    <div className="space-y-4">
      {features.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Layers className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">No feature usage data yet</h3>
          <p className="text-sm text-gray-500 mt-1">Track feature usage by calling <code className="bg-gray-100 px-1 rounded">trackFeature()</code> in your code.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Feature usage chart */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-gray-800 mb-4">Feature Usage</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={features.slice(0, 10)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis dataKey="feature" tick={{ fontSize: 10 }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="uses" name="Total Uses" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="uniqueUsers" name="Unique Users" fill="#10b981" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Feature table */}
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <div className="p-4 border-b border-gray-100">
                <h3 className="text-sm font-semibold text-gray-800">Feature Details</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold">Feature</th>
                      <th className="text-right px-4 py-3 font-semibold">Uses</th>
                      <th className="text-right px-4 py-3 font-semibold">Users</th>
                      <th className="text-right px-4 py-3 font-semibold">Failures</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {features.map((f, i) => (
                      <tr key={i} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3 font-medium text-gray-800 capitalize">{f.feature}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatNumber(f.uses)}</td>
                        <td className="px-4 py-3 text-right text-gray-600">{formatNumber(f.uniqueUsers)}</td>
                        <td className="px-4 py-3 text-right">
                          {f.failures > 0 ? (
                            <span className="text-red-600 font-medium">{f.failures}</span>
                          ) : (
                            <span className="text-gray-400">0</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );

  const renderClicks = () => {
    if (!clicks) return null;
    return (
      <div className="space-y-4">
        {/* Rage click alert */}
        {clicks.rageClicks > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-red-800">
                {clicks.rageClicks} rage click{clicks.rageClicks !== 1 ? 's' : ''} detected
              </p>
              <p className="text-xs text-red-600 mt-0.5">
                Users are repeatedly clicking in the same area — indicating frustration with unresponsive elements.
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Top clicked elements */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Most Clicked Elements</h3>
            </div>
            {clicks.topClicks.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No click data yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {clicks.topClicks.map((c, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-6 h-6 rounded-full bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {i + 1}
                      </span>
                      <span className="text-sm text-gray-800 truncate">{c.element || c.elementId || 'Unknown'}</span>
                    </div>
                    <span className="text-sm font-semibold text-gray-600 ml-3">{formatNumber(c.clicks)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clicks by page */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">Clicks by Page</h3>
            {clicks.clicksByPage.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No click data yet</div>
            ) : (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={clicks.clicksByPage} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                  <XAxis type="number" tick={{ fontSize: 11 }} />
                  <YAxis type="category" dataKey="page" tick={{ fontSize: 10 }} width={120} tickFormatter={formatPageName} />
                  <Tooltip contentStyle={{ fontSize: 12 }} labelFormatter={formatPageName} />
                  <Bar dataKey="clicks" name="Clicks" fill="#ec4899" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderFunnel = () => (
    <div className="space-y-4">
      {funnel.length === 0 || funnel.every((f) => f.users === 0) ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <TrendingUp className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-gray-700">No funnel data yet</h3>
          <p className="text-sm text-gray-500 mt-1">
            Track conversion events like <code className="bg-gray-100 px-1 rounded">signup_completed</code>,{' '}
            <code className="bg-gray-100 px-1 rounded">first_deposit</code>, etc. to see the funnel.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Visual funnel */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-gray-800 mb-4">User Journey Funnel</h3>
            <ResponsiveContainer width="100%" height={350}>
              <FunnelChart>
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Funnel dataKey="users" data={funnel.filter((f) => f.users > 0)} isAnimationActive>
                  <LabelList position="right" fill="#000" fontSize={11} formatter={(v: any) => formatNumber(Number(v))} />
                  <LabelList position="left" fill="#666" fontSize={10} dataKey="step" />
                  {funnel.filter((f) => f.users > 0).map((_, i) => (
                    <Cell key={i} fill={FUNNEL_COLORS[i % FUNNEL_COLORS.length]} />
                  ))}
                </Funnel>
              </FunnelChart>
            </ResponsiveContainer>
          </div>

          {/* Funnel table */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Step-by-Step Breakdown</h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                  <tr>
                    <th className="text-left px-4 py-3 font-semibold">Step</th>
                    <th className="text-right px-4 py-3 font-semibold">Users</th>
                    <th className="text-right px-4 py-3 font-semibold">Rate</th>
                    <th className="text-right px-4 py-3 font-semibold">Drop-off</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {funnel.map((f, i) => (
                    <tr key={i} className="hover:bg-gray-50 transition">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center flex-shrink-0">
                            {i + 1}
                          </span>
                          <span className="font-medium text-gray-800">{f.step}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-700">{formatNumber(f.users)}</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`font-medium ${f.rate > 50 ? 'text-emerald-600' : f.rate > 20 ? 'text-amber-600' : 'text-red-600'}`}>
                          {f.rate}%
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {i === 0 ? (
                          <span className="text-gray-400">—</span>
                        ) : (
                          <span className={`font-medium ${f.dropOff > 50 ? 'text-red-600' : f.dropOff > 25 ? 'text-amber-600' : 'text-emerald-600'}`}>
                            {f.dropOff}%
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  const renderDropoff = () => {
    if (!dropoff) return null;
    return (
      <div className="space-y-4">
        {/* Bounce rate card */}
        <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
              dropoff.bounceRate > 60 ? 'bg-red-100 text-red-600' : dropoff.bounceRate > 40 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
            }`}>
              <LogOut className="w-6 h-6" />
            </div>
            <div>
              <p className="text-3xl font-bold text-gray-900">{dropoff.bounceRate}%</p>
              <p className="text-sm text-gray-500">Bounce Rate</p>
            </div>
            <p className="text-xs text-gray-400 ml-auto max-w-[200px]">
              {dropoff.bounceRate > 60
                ? 'High — most visitors leave after one page'
                : dropoff.bounceRate > 40
                ? 'Average — room for improvement'
                : 'Good — users are exploring the site'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Exit pages */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Top Exit Pages</h3>
              <p className="text-xs text-gray-500 mt-0.5">Pages where users most often leave</p>
            </div>
            {dropoff.exitPages.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No exit data yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {dropoff.exitPages.map((p, i) => {
                  const maxExits = dropoff.exitPages[0]?.exits || 1;
                  return (
                    <div key={i} className="px-4 py-3 hover:bg-gray-50 transition">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-800 font-medium">{formatPageName(p.page)}</span>
                        <span className="text-sm font-semibold text-gray-600">{formatNumber(p.exits)} exits</span>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-red-400 rounded-full" style={{ width: `${(p.exits / maxExits) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Abandoned flows */}
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-gray-100">
              <h3 className="text-sm font-semibold text-gray-800">Abandoned Flows</h3>
              <p className="text-xs text-gray-500 mt-0.5">Processes users started but didn't finish</p>
            </div>
            {dropoff.abandonedFlows.length === 0 ? (
              <div className="p-8 text-center text-sm text-gray-400">No abandonment data yet</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {dropoff.abandonedFlows.map((f, i) => (
                  <div key={i} className="px-4 py-3 flex items-center justify-between hover:bg-gray-50 transition">
                    <span className="text-sm text-gray-800 capitalize">{f.flow.replace(/_/g, ' ')}</span>
                    <span className="text-sm font-semibold text-red-600">{formatNumber(f.count)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const tabContent: Record<Tab, () => React.ReactNode> = {
    overview: renderOverview,
    pages: renderPages,
    features: renderFeatures,
    clicks: renderClicks,
    funnel: renderFunnel,
    dropoff: renderDropoff,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Customer Behavior Analytics</h2>
          <p className="text-sm text-gray-500 mt-0.5">Track user interactions, conversions, and engagement</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Date range */}
          <div className="relative">
            <button
              onClick={() => setShowDatePicker(!showDatePicker)}
              className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition"
            >
              <Calendar className="w-4 h-4" />
              {DATE_RANGES.find((r) => r.days === dateRange)?.label || `Last ${dateRange} days`}
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
            {showDatePicker && (
              <div className="absolute right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-10 py-1 min-w-[150px]">
                {DATE_RANGES.map((r) => (
                  <button
                    key={r.days}
                    onClick={() => { setDateRange(r.days); setShowDatePicker(false); }}
                    className={`w-full text-left px-4 py-2 text-sm hover:bg-gray-50 transition ${dateRange === r.days ? 'text-indigo-600 font-medium bg-indigo-50' : 'text-gray-700'}`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            )}
          </div>
          {/* Refresh */}
          <button
            onClick={() => loadTab(activeTab)}
            disabled={loading}
            className="p-2 bg-white border border-gray-200 rounded-lg text-gray-500 hover:bg-gray-50 hover:text-indigo-600 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white border border-gray-200 rounded-xl p-1 overflow-x-auto">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              activeTab === tab.key
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <RefreshCw className="w-6 h-6 text-indigo-500 animate-spin" />
        </div>
      ) : (
        tabContent[activeTab]()
      )}
    </div>
  );
}
