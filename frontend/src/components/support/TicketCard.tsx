import { FileText } from 'lucide-react';
import TicketStatusBadge from './TicketStatusBadge';

const CATEGORY_LABELS: Record<string, string> = {
  payment_related_queries: 'Payment',
  game_issue: 'Game Issue',
  complaint: 'Complaint',
  feedback: 'Feedback',
  business_queries: 'Business',
};

export interface TicketCardProps {
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
  };
  isActive: boolean;
  apiBaseUrl: string;
  onUpdateStatus: (ticketId: string, status: string) => Promise<void>;
}

export default function TicketCard({
  ticket,
  isActive,
  apiBaseUrl,
  onUpdateStatus,
}: TicketCardProps) {
  const categoryLabel = CATEGORY_LABELS[ticket.category] || ticket.category;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 sm:p-6 shadow-sm hover:shadow-md transition-shadow duration-200">
      <div className="flex justify-between items-start gap-3 mb-4">
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <h3 className="text-base font-semibold text-gray-900 truncate">
              {ticket.ticketNumber}
            </h3>
            <TicketStatusBadge status={ticket.status} />
            <span className="px-2.5 py-0.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium">
              {categoryLabel}
            </span>
          </div>
          <div className="space-y-0.5 text-sm text-gray-600">
            <p className="truncate"><span className="font-medium text-gray-500">Name:</span> {ticket.name}</p>
            <p className="truncate"><span className="font-medium text-gray-500">Email:</span> {ticket.email}</p>
            {ticket.phone && (
              <p><span className="font-medium text-gray-500">Phone:</span> {ticket.phone}</p>
            )}
            {ticket.userId && (
              <p className="truncate">
                <span className="font-medium text-gray-500">User:</span>{' '}
                {ticket.userId.username || ticket.userId.email || 'N/A'}
              </p>
            )}
          </div>
        </div>
        <div className="text-right text-xs text-gray-500 flex-shrink-0">
          <p>{new Date(ticket.createdAt).toLocaleDateString()}</p>
          <p>{new Date(ticket.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
        </div>
      </div>

      <div className="mb-4">
        <p className="text-sm text-gray-700 whitespace-pre-wrap">
          {ticket.description}
        </p>
      </div>

      {ticket.attachmentUrl && (
        <div className="mb-4">
          <a
            href={`${apiBaseUrl}${ticket.attachmentUrl}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-700 text-sm font-medium transition-colors"
          >
            <FileText className="w-4 h-4 flex-shrink-0" />
            {ticket.attachmentName || 'View Attachment'}
          </a>
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-4 border-t border-gray-100">
        {isActive ? (
          <>
            {ticket.status !== 'pending' && (
              <button
                onClick={() => onUpdateStatus(ticket._id, 'pending')}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors min-h-[36px]"
              >
                Pending
              </button>
            )}
            {ticket.status !== 'in_progress' && (
              <button
                onClick={() => onUpdateStatus(ticket._id, 'in_progress')}
                className="px-3 py-2 rounded-lg text-xs font-medium bg-blue-50 text-blue-800 hover:bg-blue-100 transition-colors min-h-[36px]"
              >
                In Progress
              </button>
            )}
            <button
              onClick={() => onUpdateStatus(ticket._id, 'resolved')}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-emerald-50 text-emerald-800 hover:bg-emerald-100 transition-colors min-h-[36px]"
            >
              Resolved
            </button>
            <button
              onClick={() => onUpdateStatus(ticket._id, 'closed')}
              className="px-3 py-2 rounded-lg text-xs font-medium bg-gray-100 text-gray-700 hover:bg-gray-200 transition-colors min-h-[36px]"
            >
              Close
            </button>
          </>
        ) : (
          <button
            onClick={() => onUpdateStatus(ticket._id, 'pending')}
            className="px-3 py-2 rounded-lg text-xs font-medium bg-amber-50 text-amber-800 hover:bg-amber-100 transition-colors min-h-[36px]"
          >
            Reopen
          </button>
        )}
      </div>
    </div>
  );
}
