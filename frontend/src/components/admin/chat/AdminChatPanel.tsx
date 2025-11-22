import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import {
  CheckCircle,
  FileText,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Filter,
  Paperclip,
  RefreshCw,
  CircleDot,
  X,
  Menu
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  userId: string;
  senderType: 'user' | 'admin';
  message?: string;
  attachmentUrl?: string;
  attachmentName?: string;
  attachmentType?: string;
  attachmentSize?: number;
  status: 'unread' | 'read' | 'resolved';
  createdAt: string;
  updatedAt: string;
  name?: string;
  email?: string;
}

interface ConversationSummary {
  userId: string;
  name?: string;
  email?: string;
  lastMessage?: ChatMessage;
  unreadCount: number;
}

interface AdminChatPanelProps {
  adminToken: string;
  apiBaseUrl: string;
  wsBaseUrl: string;
}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const AdminChatPanel = ({ adminToken, apiBaseUrl, wsBaseUrl }: AdminChatPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [conversationSummaries, setConversationSummaries] = useState<ConversationSummary[]>([]);
  const [conversationMessages, setConversationMessages] = useState<Record<string, ChatMessage[]>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'resolved'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [messageInput, setMessageInput] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [showConversations, setShowConversations] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const httpBaseUrl = useMemo(() => apiBaseUrl.replace(/\/api$/, ''), [apiBaseUrl]);

  const audioContextRef = useRef<AudioContext | null>(null);

  // Initialize audio context on user interaction
  useEffect(() => {
    const initAudio = () => {
      if (!audioContextRef.current) {
        try {
          audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
        } catch (e) {
          console.log('Web Audio API not supported');
        }
      }
    };

    // Initialize on any user interaction
    document.addEventListener('click', initAudio, { once: true });
    document.addEventListener('keydown', initAudio, { once: true });
    document.addEventListener('touchstart', initAudio, { once: true });

    return () => {
      document.removeEventListener('click', initAudio);
      document.removeEventListener('keydown', initAudio);
      document.removeEventListener('touchstart', initAudio);
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      // Ensure audio context is initialized
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      
      // Resume audio context if suspended (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
          console.log('Could not resume audio context');
        });
      }

      // Create a pleasant notification sound (two-tone beep)
      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.4, startTime + 0.01);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };
      
      // Play two-tone notification
      const now = audioContext.currentTime;
      playTone(800, now, 0.15);
      playTone(1000, now + 0.15, 0.15);
    } catch (error) {
      console.log('Notification sound error:', error);
    }
  }, []);

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedUserId, conversationMessages]);

  const fetchMessages = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${apiBaseUrl}/admin/messages`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        params: {
          limit: 500,
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(startDate ? { startDate } : {}),
          ...(endDate ? { endDate } : {}),
          ...(searchQuery ? { search: searchQuery } : {})
        }
      });

      if (response.data.success) {
        const messages: ChatMessage[] = response.data.data || [];
        buildConversationSummaries(messages);
      }
    } catch (error) {
      console.error('Failed to load chat messages', error);
      toast.error('Unable to load chat messages.');
    } finally {
      setLoading(false);
    }
  };

  const buildConversationSummaries = (messages: ChatMessage[]) => {
    const grouped = new Map<string, ChatMessage[]>();
    messages.forEach((message) => {
      const list = grouped.get(message.userId) || [];
      list.push(message);
      grouped.set(message.userId, list);
    });

    const summaries: ConversationSummary[] = Array.from(grouped.entries()).map(
      ([userId, msgs]) => {
        msgs.sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        );
        const lastMessage = msgs[0];
        const unreadCount = msgs.filter(
          (msg) => msg.senderType === 'user' && msg.status === 'unread'
        ).length;
        return {
          userId,
          name: lastMessage?.name,
          email: lastMessage?.email,
          lastMessage,
          unreadCount
        };
      }
    );

    summaries.sort((a, b) => {
      const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
      const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
      return dateB - dateA;
    });

    setConversationSummaries(summaries);
  };

  const loadConversation = async (userId: string) => {
    if (!userId) return;
    try {
      const response = await axios.get(`${apiBaseUrl}/admin/messages`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        params: {
          userId,
          limit: 200
        }
      });

      if (response.data.success) {
        const data: ChatMessage[] = response.data.data || [];
        const sorted = data
          .slice()
          .sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        setConversationMessages((prev) => ({
          ...prev,
          [userId]: sorted
        }));
        markMessagesAsRead(userId, sorted);
      }
    } catch (error) {
      console.error('Failed to load conversation', error);
      toast.error('Unable to load conversation.');
    }
  };

  const markMessagesAsRead = async (_userId: string, messages: ChatMessage[]) => {
    const unreadMessages = messages.filter(
      (msg) => msg.senderType === 'user' && msg.status === 'unread'
    );

    if (unreadMessages.length === 0) {
      return;
    }

    try {
      // Use batch update for better performance
      const messageIds = unreadMessages.map((msg) => msg.id);
      await axios.put(
        `${apiBaseUrl}/admin/messages/batch-status`,
        { messageIds, status: 'read' },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      );
    } catch (error) {
      console.error('Failed to mark messages as read', error);
    }
  };

  useEffect(() => {
    fetchMessages();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, startDate, endDate]);

  useEffect(() => {
    const delayDebounce = setTimeout(() => {
      void fetchMessages();
    }, 300);

    return () => clearTimeout(delayDebounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  useEffect(() => {
    const socket = io(wsBaseUrl, {
      transports: ['websocket'],
      auth: { adminToken },
      autoConnect: true
    });

    socket.on('chat:message:new', (message: ChatMessage) => {
      setConversationMessages((prev) => {
        const current = prev[message.userId] || [];
        const exists = current.some((item) => item.id === message.id);
        const updated = exists ? current : [...current, message].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        // Play notification sound if message is from user
        if (message.senderType === 'user') {
          // Use setTimeout to ensure sound plays after state update
          setTimeout(() => {
            playNotificationSound();
          }, 100);
        }
        
        return { ...prev, [message.userId]: updated };
      });

      setConversationSummaries((prev) => {
        const map = new Map(prev.map((summary) => [summary.userId, summary] as const));
        const existing = map.get(message.userId);
        const unreadIncrement =
          message.senderType === 'user' && message.status === 'unread' ? 1 : 0;

        const updatedSummary: ConversationSummary = existing
          ? {
              ...existing,
              lastMessage: message,
              unreadCount: existing.unreadCount + unreadIncrement
            }
          : {
              userId: message.userId,
              name: message.name,
              email: message.email,
              lastMessage: message,
              unreadCount: unreadIncrement
            };

        map.set(message.userId, updatedSummary);
        const sorted = Array.from(map.values()).sort((a, b) => {
          const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        return sorted;
      });
    });

    socket.on('chat:message:status', (message: ChatMessage) => {
      setConversationMessages((prev) => {
        const current = prev[message.userId] || [];
        const updated = current.map((item) =>
          item.id === message.id ? { ...item, status: message.status } : item
        );
        return {
          ...prev,
          [message.userId]: updated
        };
      });

      setConversationSummaries((prev) =>
        prev.map((summary) =>
          summary.userId === message.userId
            ? {
                ...summary,
                lastMessage:
                  summary.lastMessage && summary.lastMessage.id === message.id
                    ? { ...summary.lastMessage, status: message.status }
                    : summary.lastMessage,
                unreadCount:
                  message.senderType === 'user' && message.status !== 'unread'
                    ? Math.max(0, summary.unreadCount - 1)
                    : summary.unreadCount
              }
            : summary
        )
      );
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [wsBaseUrl, adminToken]);

  const handleSelectConversation = (userId: string) => {
    setSelectedUserId(userId);
    // Close conversations sidebar on mobile when selecting a conversation
    setShowConversations(false);
    if (!conversationMessages[userId]) {
      void loadConversation(userId);
    } else {
      void markMessagesAsRead(userId, conversationMessages[userId]);
    }
    setConversationSummaries((prev) =>
      prev.map((summary) =>
        summary.userId === userId ? { ...summary, unreadCount: 0 } : summary
      )
    );
  };

  const handleSendMessage = async () => {
    if (!selectedUserId || sending) return;
    if (!messageInput.trim() && !attachment) {
      toast.error('Enter a message or attach a file.');
      return;
    }

    try {
      setSending(true);
      const formData = new FormData();
      formData.append('userId', selectedUserId);
      if (messageInput.trim()) {
        formData.append('message', messageInput.trim());
      }
      if (attachment) {
        formData.append('attachment', attachment);
      }

      await axios.post(`${apiBaseUrl}/admin/messages`, formData, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setMessageInput('');
      setAttachment(null);
    } catch (error) {
      console.error('Failed to send admin message', error);
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const handleResolveMessages = async () => {
    if (!selectedUserId) return;
    const messages = conversationMessages[selectedUserId] || [];
    const unresolved = messages.filter(
      (msg) => msg.senderType === 'user' && msg.status !== 'resolved'
    );

    if (unresolved.length === 0) {
      toast.success('Conversation already resolved.');
      return;
    }

    try {
      await Promise.all(
        unresolved.map((msg) =>
          axios.put(
            `${apiBaseUrl}/admin/messages/${msg.id}/status`,
            { status: 'resolved' },
            {
              headers: {
                Authorization: `Bearer ${adminToken}`
              }
            }
          )
        )
      );
      toast.success('Conversation marked as resolved.');
    } catch (error) {
      console.error('Failed to resolve messages', error);
      toast.error('Failed to update status.');
    }
  };

  const filteredConversations = conversationSummaries.filter((conversation) => {
    const matchesSearch =
      !searchQuery ||
      conversation.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.userId?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (statusFilter === 'unread') {
      return conversation.unreadCount > 0;
    }

    if (statusFilter === 'resolved') {
      return conversation.lastMessage?.status === 'resolved';
    }

    return true;
  });

  const selectedConversationMessages = selectedUserId
    ? conversationMessages[selectedUserId] || []
    : [];

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file && file.size > MAX_ATTACHMENT_SIZE) {
      toast.error('Attachment must be under 10MB.');
      event.target.value = '';
      return;
    }
    setAttachment(file);
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Conversations Sidebar */}
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-md flex flex-col transition-all duration-300 ${
        showConversations ? 'flex' : 'hidden'
      } lg:flex lg:w-1/3`}>
        <div className="p-3 sm:p-4 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2 mb-3 sm:mb-4">
            <MessageCircle className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Conversations</h2>
            <button
              onClick={() => void fetchMessages()}
              className="ml-auto text-indigo-600 hover:text-indigo-800 p-1"
              title="Refresh conversations"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowConversations(false)}
              className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
              title="Close conversations"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative mb-3">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by user or email"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
            />
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              <Filter className="w-3 h-3" />
              All
            </button>
            <button
              onClick={() => setStatusFilter('unread')}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusFilter === 'unread'
                  ? 'bg-red-100 text-red-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1 rounded-full text-xs font-medium ${
                statusFilter === 'resolved'
                  ? 'bg-green-100 text-green-600'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              Resolved
            </button>
          </div>
          <div className="hidden sm:flex gap-2 text-xs text-gray-500">
            <div className="flex-1">
              <label className="block mb-1">From</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs"
              />
            </div>
            <div className="flex-1">
              <label className="block mb-1">To</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full px-2 py-1 rounded-lg border border-gray-200 text-xs"
              />
            </div>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex justify-center items-center py-10 text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin mr-2" />
              Loading...
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-6 text-center text-gray-500">
              <p className="font-medium">No conversations yet.</p>
              <p className="text-sm">
                Messages from players will appear here in real time.
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filteredConversations.map((conversation) => {
                const isActive = selectedUserId === conversation.userId;
                return (
                  <li key={conversation.userId}>
                    <button
                      onClick={() => handleSelectConversation(conversation.userId)}
                      className={`w-full text-left px-4 py-3 transition ${
                        isActive ? 'bg-indigo-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-gray-900">
                              {conversation.name || 'Unknown User'}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-semibold bg-red-100 text-red-600">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{conversation.email}</p>
                          <p className="text-xs text-gray-600 line-clamp-2 mt-1">
                            {conversation.lastMessage?.message ||
                              conversation.lastMessage?.attachmentName ||
                              '(Attachment)'}
                          </p>
                        </div>
                        <div className="text-[10px] text-gray-400">
                          {conversation.lastMessage
                            ? formatTime(conversation.lastMessage.createdAt)
                            : ''}
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-md flex flex-col flex-1 min-h-0 lg:w-2/3">
        {selectedUserId ? (
          <>
            <div className="p-3 sm:p-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => setShowConversations(true)}
                  className="lg:hidden text-gray-500 hover:text-gray-700 p-1 flex-shrink-0"
                  title="Show conversations"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                    {conversationSummaries.find((c) => c.userId === selectedUserId)?.name || 'User'}
                  </h3>
                  <p className="text-xs sm:text-sm text-gray-500 truncate">
                    {conversationSummaries.find((c) => c.userId === selectedUserId)?.email || 'No email on file'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button
                  onClick={handleResolveMessages}
                  className="flex items-center gap-1 sm:gap-2 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm font-medium text-green-600 bg-green-50 hover:bg-green-100 rounded-lg sm:rounded-xl transition"
                >
                  <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Mark Resolved</span>
                  <span className="sm:hidden">Resolve</span>
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 sm:space-y-4 bg-gray-50 min-h-0">
              {selectedConversationMessages.length === 0 ? (
                <div className="text-center text-gray-500 py-10">
                  <p>No messages in this conversation yet.</p>
                </div>
              ) : (
                selectedConversationMessages.map((msg) => {
                  const isAdmin = msg.senderType === 'admin';
                  return (
                    <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[85%] sm:max-w-[75%] px-3 sm:px-4 py-2 sm:py-3 rounded-2xl shadow ${
                          isAdmin
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs mb-1 opacity-80 flex-wrap">
                          <CircleDot className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                          <span className="truncate">{isAdmin ? (msg.name || 'Support Team') : (msg.name || 'User')}</span>
                          <span className="hidden sm:inline">•</span>
                          <span className="text-[10px] sm:text-xs">{formatTime(msg.createdAt)}</span>
                        </div>
                        {msg.message && (
                          <p className="text-xs sm:text-sm whitespace-pre-wrap break-words">{msg.message}</p>
                        )}
                        {msg.attachmentUrl && (
                          <a
                            href={`${httpBaseUrl}${msg.attachmentUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`mt-2 sm:mt-3 inline-flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs font-semibold underline ${
                              isAdmin ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'
                            }`}
                          >
                            <FileText className="w-3 h-3 sm:w-4 sm:h-4" />
                            <span className="truncate max-w-[120px] sm:max-w-none">{msg.attachmentName || 'Download attachment'}</span>
                          </a>
                        )}
                        <div
                          className={`mt-1.5 sm:mt-2 text-[10px] sm:text-[11px] ${
                            isAdmin ? 'text-indigo-100' : 'text-gray-500'
                          } flex items-center gap-2`}
                        >
                          <span>Status: {msg.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-gray-200 bg-white p-3 sm:p-4 space-y-2 sm:space-y-3 flex-shrink-0">
              {attachment && (
                <div className="flex items-center justify-between text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2 bg-indigo-50 text-indigo-700 rounded-lg sm:rounded-xl">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0 flex-1">
                    <Paperclip className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{attachment.name}</span>
                  </div>
                  <button
                    onClick={() => setAttachment(null)}
                    className="text-indigo-600 hover:text-indigo-800 flex-shrink-0 ml-2 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
              <textarea
                value={messageInput}
                onChange={(e) => setMessageInput(e.target.value)}
                rows={2}
                placeholder="Write a reply..."
                className="w-full rounded-lg sm:rounded-xl border border-gray-200 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              />
              <div className="flex items-center justify-between gap-2">
                <label className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600 cursor-pointer hover:text-indigo-600 flex-shrink-0">
                  <Paperclip className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <span className="hidden sm:inline">Attach file</span>
                  <input
                    type="file"
                    className="hidden"
                    accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                    onChange={handleFileSelect}
                  />
                </label>
                <button
                  onClick={() => void handleSendMessage()}
                  disabled={sending}
                  className="inline-flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg sm:rounded-xl bg-indigo-600 text-white text-xs sm:text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed flex-shrink-0"
                >
                  {sending ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  <span className="hidden sm:inline">Send Reply</span>
                  <span className="sm:hidden">Send</span>
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-3 p-4">
            <MessageCircle className="w-10 h-10 sm:w-12 sm:h-12 text-indigo-500" />
            <p className="text-base sm:text-lg font-semibold text-center">Select a conversation</p>
            <p className="text-xs sm:text-sm text-center max-w-sm">
              {showConversations ? 'Choose a player conversation from the left to start chatting.' : 'Tap the menu button to view conversations.'}
            </p>
            {!showConversations && (
              <button
                onClick={() => setShowConversations(true)}
                className="mt-2 lg:hidden flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 transition"
              >
                <Menu className="w-4 h-4" />
                Show Conversations
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminChatPanel;

