import { useState, useMemo } from 'react';
import { Loader2, Ticket, Search } from 'lucide-react';
import TicketListItem from './TicketListItem';
import TicketDetailPanel from './TicketDetailPanel';

export interface SupportTicketSectionProps {
  activeTickets: any[];
  completedTickets: any[];
  ticketsLoading: boolean;
  ticketCategoryFilter: string;
  showClosedTickets: boolean;
  ticketSearchQuery: string;
  ticketSortOrder: 'newest' | 'oldest';
  apiBaseUrl: string;
  onCategoryChange: (value: string) => void;
  onShowClosedChange: (value: boolean) => void;
  onSearchChange: (value: string) => void;
  onSortChange: (value: 'newest' | 'oldest') => void;
  onUpdateStatus: (ticketId: string, status: string) => Promise<void>;
  onTicketUpdated?: (ticket: any) => void;
}

export default function SupportTicketSection({
  activeTickets,
  completedTickets,
  ticketsLoading,
  ticketCategoryFilter,
  showClosedTickets,
  ticketSearchQuery,
  ticketSortOrder,
  apiBaseUrl,
  onCategoryChange,
  onShowClosedChange,
  onSearchChange,
  onSortChange,
  onUpdateStatus,
  onTicketUpdated,
}: SupportTicketSectionProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'completed' | 'all'>('active');

  const allTickets = useMemo(() => {
    let list: any[] = [];
    if (viewMode === 'active') list = [...activeTickets];
    else if (viewMode === 'completed') list = [...completedTickets];
    else list = [...activeTickets, ...completedTickets];
    const sorted = [...list].sort((a, b) => {
      const da = new Date(a.createdAt).getTime();
      const db = new Date(b.createdAt).getTime();
      return ticketSortOrder === 'newest' ? db - da : da - db;
    });
    return sorted;
  }, [activeTickets, completedTickets, viewMode, ticketSortOrder]);

  const selectedTicket = useMemo(
    () => allTickets.find((t) => t._id === selectedTicketId) || null,
    [allTickets, selectedTicketId]
  );

  const showDetailPanel = !!selectedTicketId;
  const showBackOnMobile = showDetailPanel;

  return (
    <div className="flex flex-col h-[calc(100vh-180px)] min-h-[480px]">
      <div className="flex flex-col lg:flex-row gap-4 flex-1 min-h-0">
        {/* Left: Ticket list (30% on desktop) */}
        <div
          className={`flex flex-col w-full lg:w-[30%] lg:min-w-[280px] lg:max-w-[400px] ${
            showDetailPanel ? 'hidden lg:flex' : 'flex'
          }`}
        >
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[140px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="search"
                placeholder="Search tickets..."
                value={ticketSearchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-gray-200 rounded-xl text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
            <select
              value={ticketSortOrder}
              onChange={(e) => onSortChange(e.target.value as 'newest' | 'oldest')}
              className="px-3 py-2 border border-gray-200 rounded-xl text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
          </div>
          <div className="flex gap-2 mb-3">
            <select
              value={ticketCategoryFilter}
              onChange={(e) => onCategoryChange(e.target.value)}
              className="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm text-black focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
            >
              <option value="all">All Categories</option>
              <option value="payment_related_queries">Payment</option>
              <option value="game_issue">Game Issue</option>
              <option value="complaint">Complaint</option>
              <option value="feedback">Feedback</option>
              <option value="business_queries">Business</option>
            </select>
            <label className="flex items-center gap-2 px-3 py-2 cursor-pointer shrink-0">
              <input
                type="checkbox"
                checked={showClosedTickets}
                onChange={(e) => onShowClosedChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-xs text-gray-600 whitespace-nowrap">Closed</span>
            </label>
          </div>
          <div className="flex gap-1 p-1 bg-gray-100 rounded-xl mb-3">
            {(['active', 'completed', 'all'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                  viewMode === mode
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {mode === 'active' ? `Active (${activeTickets.length})` : mode === 'completed' ? `Done (${completedTickets.length})` : 'All'}
              </button>
            ))}
          </div>

          {ticketsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
            </div>
          ) : allTickets.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 bg-white rounded-xl border border-gray-200">
              <Ticket className="w-12 h-12 text-gray-300 mb-3" />
              <p className="text-sm text-gray-500">No tickets found</p>
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto space-y-2 pr-1">
              {allTickets.map((ticket: any) => (
                <TicketListItem
                  key={ticket._id}
                  ticket={ticket}
                  isSelected={selectedTicketId === ticket._id}
                  onClick={() => setSelectedTicketId(ticket._id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Right: Conversation view (70% on desktop) */}
        <div
          className={`flex-1 min-w-0 ${showDetailPanel ? 'flex' : 'hidden lg:flex'}`}
        >
          <TicketDetailPanel
            ticket={selectedTicket}
            apiBaseUrl={apiBaseUrl}
            onBack={() => setSelectedTicketId(null)}
            onUpdateStatus={onUpdateStatus}
            onTicketUpdated={onTicketUpdated}
            showBackButton={showBackOnMobile}
          />
        </div>
      </div>
    </div>
  );
}
