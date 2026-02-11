import { Clock, Loader2, CheckCircle2, XCircle } from 'lucide-react';

export type TicketStatus = 'pending' | 'in_progress' | 'resolved' | 'closed';

const STATUS_CONFIG: Record<
  TicketStatus,
  { bg: string; text: string; icon: typeof Clock }
> = {
  pending: {
    bg: 'bg-amber-100',
    text: 'text-amber-800',
    icon: Clock,
  },
  in_progress: {
    bg: 'bg-blue-100',
    text: 'text-blue-800',
    icon: Loader2,
  },
  resolved: {
    bg: 'bg-emerald-100',
    text: 'text-emerald-800',
    icon: CheckCircle2,
  },
  closed: {
    bg: 'bg-gray-100',
    text: 'text-gray-700',
    icon: XCircle,
  },
};

function formatStatus(s: string): string {
  return s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

interface TicketStatusBadgeProps {
  status: string;
  className?: string;
}

export default function TicketStatusBadge({ status, className = '' }: TicketStatusBadgeProps) {
  const cfg = STATUS_CONFIG[status as TicketStatus] || STATUS_CONFIG.closed;
  const Icon = cfg.icon;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold ${cfg.bg} ${cfg.text} ${className}`}
    >
      {status === 'in_progress' ? (
        <Icon className="w-3.5 h-3.5 animate-spin flex-shrink-0" />
      ) : (
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
      )}
      {formatStatus(status)}
    </span>
  );
}
