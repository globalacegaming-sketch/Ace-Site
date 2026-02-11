import TicketStatusBadge from './TicketStatusBadge';

const CATEGORY_LABELS: Record<string, string> = {
  payment_related_queries: 'Payment',
  game_issue: 'Game Issue',
  complaint: 'Complaint',
  feedback: 'Feedback',
  business_queries: 'Business',
};

export interface TicketListItemProps {
  ticket: {
    _id: string;
    ticketNumber: string;
    status: string;
    category: string;
    name: string;
    description: string;
    createdAt: string;
  };
  isSelected: boolean;
  onClick: () => void;
}

export default function TicketListItem({ ticket, isSelected, onClick }: TicketListItemProps) {
  const categoryLabel = CATEGORY_LABELS[ticket.category] || ticket.category;
  const preview = ticket.description.length > 60 ? ticket.description.slice(0, 60) + '...' : ticket.description;
  const timeAgo = getTimeAgo(new Date(ticket.createdAt));

  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left p-4 rounded-xl border transition-all duration-200 min-h-[88px] ${
        isSelected
          ? 'bg-blue-50 border-blue-200 shadow-sm'
          : 'bg-white border-gray-200 hover:border-gray-300 hover:shadow-sm'
      }`}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium truncate">
          {categoryLabel}
        </span>
        <TicketStatusBadge status={ticket.status} className="flex-shrink-0" />
      </div>
      <p className="font-semibold text-gray-900 text-sm truncate">{ticket.ticketNumber}</p>
      <p className="text-xs text-gray-500 mt-1 truncate">{preview}</p>
      <p className="text-xs text-gray-400 mt-1">{timeAgo}</p>
    </button>
  );
}

function getTimeAgo(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}
