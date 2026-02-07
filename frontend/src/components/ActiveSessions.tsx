import { useState, useEffect, useCallback } from 'react';
import { Monitor, Smartphone, Tablet, Trash2, Loader2, RefreshCw } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';

interface Session {
  _id: string;
  /** e.g. "Chrome on Windows" */
  userAgent: string;
  ip: string;
  lastActive: string;
  isCurrent: boolean;
}

function deviceIcon(ua: string) {
  const lower = ua.toLowerCase();
  if (lower.includes('mobile') || lower.includes('iphone') || lower.includes('android'))
    return <Smartphone className="w-4 h-4" />;
  if (lower.includes('ipad') || lower.includes('tablet'))
    return <Tablet className="w-4 h-4" />;
  return <Monitor className="w-4 h-4" />;
}

function maskIp(ip: string): string {
  if (!ip) return '—';
  // IPv4: show first two octets
  const v4 = ip.replace('::ffff:', '');
  const parts = v4.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.*.*`;
  // IPv6: show first segment
  return ip.split(':').slice(0, 2).join(':') + ':***';
}

function shortUA(ua: string): string {
  // Try to extract browser + OS
  const browser =
    ua.match(/(Chrome|Firefox|Safari|Edge|Opera|Samsung)/i)?.[1] || 'Browser';
  const os = ua.match(/(Windows|Mac|Linux|Android|iPhone|iPad)/i)?.[1] || '';
  return `${browser}${os ? ` on ${os}` : ''}`;
}

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/**
 * Active Sessions panel for Settings.
 * Communicates with:
 *   GET    /api/user/sessions          → list sessions
 *   DELETE /api/user/sessions/:id      → revoke one session
 */
export default function ActiveSessions() {
  const token = useAuthStore.getState().token;
  const headers = { Authorization: `Bearer ${token}` };

  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(true);
  const [revoking, setRevoking] = useState<string | null>(null);

  const loadSessions = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${getApiBaseUrl()}/user/sessions`, { headers });
      if (res.data.success) {
        setSessions(res.data.data || []);
      }
    } catch {
      // Endpoint may not exist yet — fail silently in UI
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadSessions(); }, [loadSessions]);

  const handleRevoke = useCallback(async (id: string) => {
    setRevoking(id);
    try {
      await axios.delete(`${getApiBaseUrl()}/user/sessions/${id}`, { headers });
      setSessions((prev) => prev.filter((s) => s._id !== id));
      toast.success('Session revoked');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to revoke session');
    } finally {
      setRevoking(null);
    }
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-6">
        <Loader2 className="w-5 h-5 animate-spin casino-text-secondary" />
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <p className="text-sm casino-text-secondary py-4">
        No active sessions found. This may mean the sessions endpoint is not yet configured on the backend.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs casino-text-secondary">{sessions.length} active session(s)</p>
        <button
          onClick={loadSessions}
          className="text-xs casino-text-secondary hover:casino-text-primary transition-colors touch-manipulation flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" /> Refresh
        </button>
      </div>
      {sessions.map((s) => (
        <div
          key={s._id}
          className="flex items-center justify-between p-3 rounded-lg"
          style={{ backgroundColor: 'rgba(27, 27, 47, 0.5)', border: '1px solid #2C2C3A' }}
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="casino-text-secondary flex-shrink-0">{deviceIcon(s.userAgent)}</div>
            <div className="min-w-0">
              <p className="text-sm casino-text-primary font-medium truncate">
                {shortUA(s.userAgent)}
                {s.isCurrent && (
                  <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-green-500/20 text-green-400">
                    This device
                  </span>
                )}
              </p>
              <p className="text-xs casino-text-secondary">
                {maskIp(s.ip)} · {timeAgo(s.lastActive)}
              </p>
            </div>
          </div>
          {!s.isCurrent && (
            <button
              onClick={() => handleRevoke(s._id)}
              disabled={revoking === s._id}
              className="text-red-400 hover:text-red-300 transition-colors p-2 rounded-lg touch-manipulation disabled:opacity-50"
              aria-label="Revoke session"
            >
              {revoking === s._id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      ))}
    </div>
  );
}
