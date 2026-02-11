import { useEffect, useRef } from 'react';
import { FileText, ArrowLeft, User, Headphones } from 'lucide-react';
import TicketStatusBadge from './TicketStatusBadge';

const CATEGORY_LABELS: Record<string, string> = {
  payment_related_queries: 'Payment',
  game_issue: 'Game Issue',
  complaint: 'Complaint',
  feedback: 'Feedback',
  business_queries: 'Business',
};

export interface TicketDetailPanelProps {
  ticket: {
    _id: string;
    ticketNumber: string;
    status: string;
    category: string;
    name: string;
    email: string;
    phone?: string;
    description: string;
    attachmentUrl?: string;
    attachmentName?: string;
    createdAt: string;
    userId?: { username?: string; email?: string };
  } | null;
  apiBaseUrl: string;
  onBack?: () => void;
  onUpdateStatus: (ticketId: string, status: string) => Promise<void>;
  showBackButton?: boolean;
}

export default function TicketDetailPanel({
  ticket,
  apiBaseUrl,
  onBack,
  onUpdateStatus,
  showBackButton = false,
}: TicketDetailPanelProps) {
  if (!ticket) {
    return (
      <div className="flex flex-col items-center justify-center h-full min-h-[320px] bg-gray-50 rounded-2xl border border-gray-200">
        <Headphones className="w-16 h-16 text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium">Select a ticket</p>
        <p className="text-sm text-gray-400 mt-1">Choose a ticket from the list to view details</p>
      </div>
    );
  }

  const categoryLabel = CATEGORY_LABELS[ticket.category] || ticket.category;
  const conversationEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    conversationEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [ticket._id]);

  return (
    <div className="flex flex-col h-full min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Status progress bar */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center justify-between text-xs font-medium text-gray-500 mb-2">
          <span className={ticket.status !== 'pending' ? 'text-blue-600' : ''}>Pending</span>
          <span className={['in_progress', 'resolved', 'closed'].includes(ticket.status) ? 'text-blue-600' : ''}>In Progress</span>
          <span className={['resolved', 'closed'].includes(ticket.status) ? 'text-emerald-600' : ''}>Resolved</span>
          <span className={ticket.status === 'closed' ? 'text-gray-600' : ''}>Closed</span>
        </div>
        <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden flex">
          <div
            className="h-full bg-blue-500 transition-all duration-300"
            style={{ width: ticket.status === 'pending' ? '25%' : ticket.status === 'in_progress' ? '50%' : ticket.status === 'resolved' ? '75%' : '100%' }}
          />
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-gray-100 bg-gray-50/50">
        {showBackButton && onBack && (
          <button
            type="button"
            onClick={onBack}
            className="p-2 -ml-2 rounded-lg hover:bg-gray-200 transition-colors lg:hidden"
            aria-label="Back to list"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </button>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-gray-900">{ticket.ticketNumber}</h3>
            <TicketStatusBadge status={ticket.status} />
            <span className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-xs font-medium">
              {categoryLabel}
            </span>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{ticket.name} · {ticket.email}</p>
        </div>
      </div>

      {/* Chat-style conversation */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50/30">
        {/* User message (right-aligned bubble) */}
        <div className="flex justify-end">
          <div className="max-w-[85%] lg:max-w-[75%]">
            <div className="flex items-center gap-2 justify-end mb-1">
              <span className="text-xs font-medium text-gray-600">{ticket.name}</span>
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
            </div>
            <div className="bg-blue-500 text-white rounded-2xl rounded-tr-md px-4 py-3 shadow-sm">
              <p className="text-sm whitespace-pre-wrap">{ticket.description}</p>
            </div>
            <p className="text-xs text-gray-400 mt-1 text-right">
              {new Date(ticket.createdAt).toLocaleString()}
            </p>
            {ticket.attachmentUrl && (
              <div className="text-right">
              <a
                href={`${apiBaseUrl}${ticket.attachmentUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 mt-2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                <FileText className="w-4 h-4" />
                {ticket.attachmentName || 'Attachment'}
              </a>
              </div>
            )}
            <div ref={conversationEndRef} />
          </div>
        </div>
      </div>

      {/* Status actions */}
      <div className="p-4 border-t border-gray-100 bg-white">
        <p className="text-xs font-medium text-gray-500 mb-2">Update status</p>
        <div className="flex flex-wrap gap-2">
          {ticket.status !== 'pending' && (
            <button
              onClick={() => onUpdateStatus(ticket._id, 'pending')}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors"
            >
              Pending
            </button>
          )}
          {ticket.status !== 'in_progress' && (
            <button
              onClick={() => onUpdateStatus(ticket._id, 'in_progress')}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors"
            >
              In Progress
            </button>
          )}
          <button
            onClick={() => onUpdateStatus(ticket._id, 'resolved')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors"
          >
            Resolved
          </button>
          <button
            onClick={() => onUpdateStatus(ticket._id, 'closed')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
