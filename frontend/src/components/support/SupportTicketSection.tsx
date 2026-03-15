import { useState, useMemo, useRef, useCallback } from 'react';
import { Loader2, Ticket, Search, Plus, X, UserSearch } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
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
  onTicketCreated?: () => void;
}

const CATEGORY_OPTIONS = [
  { value: 'payment_related_queries', label: 'Payment Related' },
  { value: 'game_issue', label: 'Game Issue' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'business_queries', label: 'Business Queries' },
];

interface UserResult {
  _id: string;
  username: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
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
  onTicketCreated,
}: SupportTicketSectionProps) {
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'active' | 'completed' | 'all'>('active');

  // Create ticket modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({
    category: 'payment_related_queries',
    description: '',
    name: '',
    email: '',
    phone: '',
  });
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);
  const [userSearchResults, setUserSearchResults] = useState<UserResult[]>([]);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [searchingUsers, setSearchingUsers] = useState(false);
  const [showUserDropdown, setShowUserDropdown] = useState(false);
  const [creatingTicket, setCreatingTicket] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function getToken(): string {
    return localStorage.getItem('agent_session') || localStorage.getItem('admin_session') || '';
  }

  const searchUsers = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setUserSearchResults([]);
      return;
    }
    setSearchingUsers(true);
    try {
      const res = await axios.get(`${apiBaseUrl}/support-tickets/search-users`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        params: { q: q.trim() },
      });
      setUserSearchResults(res.data.data || []);
      setShowUserDropdown(true);
    } catch {
      setUserSearchResults([]);
    } finally {
      setSearchingUsers(false);
    }
  }, [apiBaseUrl]);

  const handleUserSearchInput = (val: string) => {
    setUserSearchQuery(val);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => searchUsers(val), 300);
  };

  const selectUser = (user: UserResult) => {
    setSelectedUser(user);
    const fullName = `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username;
    setCreateForm((f) => ({
      ...f,
      name: fullName,
      email: user.email,
      phone: user.phone || '',
    }));
    setShowUserDropdown(false);
    setUserSearchQuery('');
  };

  const clearSelectedUser = () => {
    setSelectedUser(null);
    setCreateForm((f) => ({ ...f, name: '', email: '', phone: '' }));
  };

  const openCreateModal = () => {
    setCreateForm({ category: 'payment_related_queries', description: '', name: '', email: '', phone: '' });
    setSelectedUser(null);
    setUserSearchQuery('');
    setUserSearchResults([]);
    setShowCreateModal(true);
  };

  const handleCreateTicket = async () => {
    if (!createForm.description.trim()) {
      toast.error('Description is required');
      return;
    }
    if (!selectedUser && (!createForm.name.trim() || !createForm.email.trim())) {
      toast.error('Name and email are required');
      return;
    }
    setCreatingTicket(true);
    try {
      await axios.post(
        `${apiBaseUrl}/support-tickets/create-for-user`,
        {
          userId: selectedUser?._id,
          category: createForm.category,
          description: createForm.description.trim(),
          name: createForm.name.trim(),
          email: createForm.email.trim(),
          phone: createForm.phone.trim() || undefined,
        },
        { headers: { Authorization: `Bearer ${getToken()}` } }
      );
      toast.success('Ticket created successfully');
      setShowCreateModal(false);
      onTicketCreated?.();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create ticket');
    } finally {
      setCreatingTicket(false);
    }
  };

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
          {/* Create ticket button */}
          <button
            onClick={openCreateModal}
            className="w-full mb-3 flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Ticket
          </button>

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

      {/* Create Ticket Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Create Ticket</h3>
              <button onClick={() => setShowCreateModal(false)} className="p-1.5 hover:bg-gray-100 rounded-lg transition">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {/* User search */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Member</label>
                {selectedUser ? (
                  <div className="flex items-center justify-between bg-indigo-50 border border-indigo-200 rounded-lg px-3 py-2.5">
                    <div>
                      <p className="text-sm font-medium text-gray-900">
                        {selectedUser.firstName || selectedUser.lastName
                          ? `${selectedUser.firstName || ''} ${selectedUser.lastName || ''}`.trim()
                          : selectedUser.username}
                      </p>
                      <p className="text-xs text-gray-500">{selectedUser.email}</p>
                    </div>
                    <button onClick={clearSelectedUser} className="text-xs text-red-500 hover:text-red-700 font-medium">
                      Change
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <UserSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                      <input
                        type="text"
                        value={userSearchQuery}
                        onChange={(e) => handleUserSearchInput(e.target.value)}
                        onFocus={() => userSearchResults.length > 0 && setShowUserDropdown(true)}
                        placeholder="Search by username, email, or name..."
                        className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                      {searchingUsers && (
                        <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 animate-spin" />
                      )}
                    </div>
                    {showUserDropdown && userSearchResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                        {userSearchResults.map((u) => (
                          <button
                            key={u._id}
                            onClick={() => selectUser(u)}
                            className="w-full text-left px-3 py-2.5 hover:bg-indigo-50 transition text-sm border-b border-gray-50 last:border-0"
                          >
                            <p className="font-medium text-gray-800">
                              {u.firstName || u.lastName ? `${u.firstName || ''} ${u.lastName || ''}`.trim() : u.username}
                            </p>
                            <p className="text-xs text-gray-500">{u.email} · @{u.username}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    <p className="text-xs text-gray-400 mt-1">Search to link to an existing user, or fill in details manually below</p>
                  </div>
                )}
              </div>

              {/* Name & Email (editable, auto-filled from user) */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Name *</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="Full name"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email *</label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="user@example.com"
                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Phone (optional)</label>
                <input
                  type="tel"
                  value={createForm.phone}
                  onChange={(e) => setCreateForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+1234567890"
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Category */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category *</label>
                <select
                  value={createForm.category}
                  onChange={(e) => setCreateForm((f) => ({ ...f, category: e.target.value }))}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                >
                  {CATEGORY_OPTIONS.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description *</label>
                <textarea
                  value={createForm.description}
                  onChange={(e) => setCreateForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Describe the issue or request..."
                  rows={4}
                  maxLength={5000}
                  className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm text-black focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                />
                <p className="text-xs text-gray-400 text-right mt-0.5">{createForm.description.length}/5000</p>
              </div>
            </div>

            <div className="flex justify-end gap-2 p-5 border-t border-gray-200">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateTicket}
                disabled={creatingTicket || !createForm.description.trim()}
                className="px-5 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 flex items-center gap-2"
              >
                {creatingTicket && <Loader2 className="w-4 h-4 animate-spin" />}
                Create Ticket
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
