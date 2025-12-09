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
  Menu,
  Gift,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ChatMessage {
  id: string;
  userId: string;
  senderType: 'user' | 'admin' | 'system';
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
  metadata?: {
    type?: string;
    bonusId?: string;
    bonusTitle?: string;
    bonusType?: string;
    bonusValue?: string;
    isSystemMessage?: boolean;
  };
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
const INITIAL_MESSAGE_LIMIT = 50; // Increased initial load for better UX
const LOAD_MORE_LIMIT = 50; // Load more messages at once

const AdminChatPanel = ({ adminToken, apiBaseUrl, wsBaseUrl }: AdminChatPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [conversationSummaries, setConversationSummaries] = useState<ConversationSummary[]>([]);
  const [conversationMessages, setConversationMessages] = useState<Record<string, ChatMessage[]>>({});
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'resolved'>('all');
  const [messageInput, setMessageInput] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(true);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const loadMoreButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  const playNotificationSoundRef = useRef<() => void>(() => {});

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

  const formatFullTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Decode HTML entities (like &#x27; for apostrophe) for display
  // This safely decodes entities that were escaped by the backend sanitization
  const decodeHtmlEntities = (text: string): string => {
    if (!text) return text;
    // Create a temporary textarea to decode HTML entities safely
    // This is safe because we're only decoding text that came from our own sanitized backend
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    const decoded = textarea.value;
    // Clean up
    textarea.remove();
    return decoded;
  };

  const scrollToBottom = () => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  useEffect(() => {
    scrollToBottom();
  }, [selectedUserId, conversationMessages]);

  const fetchConversations = async () => {
    try {
      setLoading(true);
      // Use the new conversations endpoint that returns summaries directly
      const response = await axios.get(`${apiBaseUrl}/admin/messages/conversations`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        params: {
          ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
          ...(searchQuery ? { search: searchQuery } : {})
        }
      });

      if (response.data.success) {
        const summaries: ConversationSummary[] = response.data.data || [];
        setConversationSummaries(summaries);
      }
    } catch (error: any) {
      console.error('Failed to load conversations', error);
      // Only show error toast if it's not a 401 (unauthorized) or network error
      // 401 errors are handled by session management, network errors are usually temporary
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        toast.error('Unable to load conversations.', {
          id: 'chat-load-error',
          duration: 3000
        });
      }
    } finally {
      setLoading(false);
    }
  };

  const loadConversation = async (userId: string, loadOlder: boolean = false) => {
    if (!userId) return;
    
    try {
      const currentMessages = conversationMessages[userId] || [];
      const params: Record<string, any> = {
        userId,
        limit: loadOlder ? LOAD_MORE_LIMIT : INITIAL_MESSAGE_LIMIT
      };

      // If loading older messages, use the oldest message's createdAt as 'before' parameter
      if (loadOlder && currentMessages.length > 0) {
        const oldestMessage = currentMessages[0]; // Messages are sorted oldest first
        // Use ISO string format for the date
        params.before = new Date(oldestMessage.createdAt).toISOString();
      }

      setLoadingMore(loadOlder);
      const response = await axios.get(`${apiBaseUrl}/admin/messages`, {
        headers: {
          Authorization: `Bearer ${adminToken}`
        },
        params
      });

      if (response.data.success) {
        const data: ChatMessage[] = response.data.data || [];
        const sorted = data
          .slice()
          .sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );

        if (loadOlder) {
          // Prepend older messages to the beginning
          // Calculate hasMore inside setState callback to use actual merged count
          // This prevents stale closure issues if socket events add messages before state updates
          const totalMessages = response.data.pagination?.total || 0;
          setConversationMessages((prev) => {
            const prevMessages = prev[userId] || [];
            const updatedMessages = [...sorted, ...prevMessages];
            // Use the actual merged count from the state update, not the captured value
            const updatedMessagesCount = updatedMessages.length;
            const hasMore = sorted.length >= LOAD_MORE_LIMIT && 
                           (totalMessages === 0 || updatedMessagesCount < totalMessages);
            // Update hasMoreMessages state using the actual merged count
            setHasMoreMessages((prevHasMore) => ({
              ...prevHasMore,
              [userId]: hasMore
            }));
            return {
              ...prev,
              [userId]: updatedMessages
            };
          });
        } else {
          // Initial load - replace all messages
          setConversationMessages((prev) => ({
            ...prev,
            [userId]: sorted
          }));
          markMessagesAsRead(userId, sorted);
          // Check if there are more messages based on:
          // 1. Total count from pagination (most reliable)
          // 2. If we got exactly the limit, assume there might be more
          const totalMessages = response.data.pagination?.total || 0;
          const hasMore = totalMessages > 0 
            ? sorted.length < totalMessages 
            : sorted.length >= INITIAL_MESSAGE_LIMIT;
          
          setHasMoreMessages((prev) => ({
            ...prev,
            [userId]: hasMore
          }));
        }
        
        // Update conversation summary with user info from API response if available
        if (response.data.user && !loadOlder) {
          const userInfo = response.data.user;
          setConversationSummaries((prev) => {
            const existing = prev.find((c) => c.userId === userId);
            if (existing) {
              return prev.map((c) =>
                c.userId === userId
                  ? {
                      ...c,
                      name: userInfo.name || c.name,
                      email: userInfo.email || c.email
                    }
                  : c
              );
            } else {
              // If summary doesn't exist yet, create it
              return [
                ...prev,
                {
                  userId,
                  name: userInfo.name || 'User',
                  email: userInfo.email || '',
                  lastMessage: sorted[sorted.length - 1],
                  unreadCount: sorted.filter(
                    (msg) => msg.senderType === 'user' && msg.status === 'unread'
                  ).length
                }
              ];
            }
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to load conversation', error);
      // Only show error toast if it's not a 401 (unauthorized) or network error
      if (error.response?.status !== 401 && error.code !== 'ERR_NETWORK') {
        toast.error('Unable to load conversation.', {
          id: 'conversation-load-error',
          duration: 3000
        });
      }
    } finally {
      setLoadingMore(false);
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
      // Filter out invalid IDs and ensure they're strings
      const messageIds = unreadMessages
        .map((msg) => msg.id)
        .filter((id): id is string => {
          // Validate that ID exists and is a non-empty string
          if (!id || typeof id !== 'string' || id.trim() === '') {
            return false;
          }
          // Basic MongoDB ObjectId format check (24 hex characters)
          if (!/^[0-9a-fA-F]{24}$/.test(id)) {
            return false;
          }
          return true;
        });

      // If no valid IDs, try using userId approach instead
      if (messageIds.length === 0) {
        await axios.put(
          `${apiBaseUrl}/admin/messages/batch-status`,
          { userId: _userId, status: 'read' },
          {
            headers: {
              Authorization: `Bearer ${adminToken}`
            }
          }
        );
        return;
      }

      await axios.put(
        `${apiBaseUrl}/admin/messages/batch-status`,
        { messageIds, status: 'read' },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      );
    } catch (error: any) {
      // Don't show error toast for this - it's not critical if marking as read fails
      // The messages will still be visible, just not marked as read
      console.error('Failed to mark messages as read', error?.response?.data || error?.message || error);
    }
  };

  useEffect(() => {
    // Only fetch conversations if we have a valid admin token
    // This prevents errors when the component mounts but admin isn't logged in
    if (adminToken) {
      fetchConversations();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter, adminToken]);

  useEffect(() => {
    // Only fetch conversations if we have a valid admin token
    if (!adminToken) return;
    
    const delayDebounce = setTimeout(() => {
      void fetchConversations();
    }, 300);

    return () => clearTimeout(delayDebounce);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery, adminToken]);

  // Keep refs in sync with current values for socket event handlers
  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
    playNotificationSoundRef.current = playNotificationSound;
  }, [selectedUserId, playNotificationSound]);

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
        if (exists) {
          // Duplicate found - don't add to messages
          return prev;
        }
        
        // Not a duplicate - add message
        const updated = [...current, message].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        // Play notification sound if message is from user
        // Use ref to avoid socket reconnection when callback changes
        if (message.senderType === 'user') {
          setTimeout(() => {
            playNotificationSoundRef.current();
          }, 100);
        }
        
        return { ...prev, [message.userId]: updated };
      });

      // Only update summaries if this message is not a duplicate
      // Check if the message ID already exists in the conversation summary's lastMessage
      setConversationSummaries((prevSummaries) => {
        const existingSummary = prevSummaries.find(s => s.userId === message.userId);
        
        // If the last message has the same ID, it's a duplicate - don't update
        if (existingSummary?.lastMessage?.id === message.id) {
          return prevSummaries;
        }
        
        const map = new Map(prevSummaries.map((summary) => [summary.userId, summary] as const));
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

      // Auto-scroll to bottom if viewing this conversation
      // Use ref to get current selectedUserId without causing socket reconnection
      if (selectedUserIdRef.current === message.userId) {
        setTimeout(() => scrollToBottom(), 100);
      }
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
    // Only reconnect socket when wsBaseUrl or adminToken changes
    // selectedUserId and playNotificationSound don't require socket reconnection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsBaseUrl, adminToken]);

  const handleSelectConversation = (userId: string) => {
    setSelectedUserId(userId);
    // Close conversations sidebar on mobile when selecting a conversation
    setShowConversations(false);
    if (!conversationMessages[userId]) {
      // Initialize hasMoreMessages as undefined (unknown) when starting to load
      setHasMoreMessages((prev) => ({
        ...prev,
        [userId]: undefined as any
      }));
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
      setAttachmentPreview(null);
    } catch (error) {
      console.error('Failed to send admin message', error);
      toast.error('Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  // Handle Enter key to send message (Shift+Enter for new line)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
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
      // Use batch endpoint for better performance
      const messageIds = unresolved
        .map((msg) => msg.id)
        .filter((id): id is string => {
          if (!id || typeof id !== 'string' || id.trim() === '') {
            console.warn('Invalid message ID found:', id);
            return false;
          }
          if (!/^[0-9a-fA-F]{24}$/.test(id)) {
            console.warn('Message ID does not match ObjectId format:', id);
            return false;
          }
          return true;
        });

      if (messageIds.length === 0) {
        console.warn('No valid message IDs, trying userId approach instead');
        const response = await axios.put(
          `${apiBaseUrl}/admin/messages/batch-status`,
          { userId: selectedUserId, status: 'resolved' },
          {
            headers: {
              Authorization: `Bearer ${adminToken}`
            }
          }
        );

        if (response.data.success) {
          await loadConversation(selectedUserId);
          toast.success(`Marked conversation as resolved.`);
          return;
        } else {
          throw new Error(response.data.message || 'Failed to resolve messages');
        }
      }

      const response = await axios.put(
        `${apiBaseUrl}/admin/messages/batch-status`,
        { messageIds, status: 'resolved' },
        {
          headers: {
            Authorization: `Bearer ${adminToken}`
          }
        }
      );

      if (response.data.success) {
        // Update local state immediately
        setConversationMessages((prev) => {
          const current = prev[selectedUserId] || [];
          const updated = current.map((msg) =>
            messageIds.includes(msg.id) && msg.senderType === 'user'
              ? { ...msg, status: 'resolved' as const }
              : msg
          );
          return {
            ...prev,
            [selectedUserId]: updated
          };
        });

        // Update conversation summaries
        setConversationSummaries((prev) =>
          prev.map((summary) =>
            summary.userId === selectedUserId
              ? {
                  ...summary,
                  lastMessage:
                    summary.lastMessage && summary.lastMessage.senderType === 'user'
                      ? { ...summary.lastMessage, status: 'resolved' as const }
                      : summary.lastMessage
                }
              : summary
          )
        );

        toast.success(`Marked ${response.data.data.modifiedCount || unresolved.length} message(s) as resolved.`);
      } else {
        throw new Error(response.data.message || 'Failed to resolve messages');
      }
    } catch (error: any) {
      console.error('Failed to resolve messages', error);
      const errorMessage = error.response?.data?.message || error.message || 'Failed to update status.';
      
      if (errorMessage.includes('No valid message IDs')) {
        console.error('Message IDs that were sent:', unresolved.map(m => ({ id: m.id, status: m.status, senderType: m.senderType })));
        toast.error('Invalid message IDs. Please refresh the page and try again.');
      } else {
        toast.error(errorMessage);
      }
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
    
    // Create preview for image files
    if (file && file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setAttachmentPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    } else {
      setAttachmentPreview(null);
    }
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-4 lg:gap-6">
      {/* Conversations Sidebar */}
      <div className={`bg-white rounded-2xl border border-gray-200 shadow-lg flex flex-col transition-all duration-300 ${
        showConversations ? 'flex' : 'hidden'
      } lg:flex lg:w-1/3`}>
        <div className="p-4 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50">
          <div className="flex items-center gap-3 mb-4">
            <button
              onClick={() => void fetchConversations()}
              className="p-2 text-indigo-600 hover:bg-indigo-100 rounded-lg transition"
              title="Refresh conversations"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
            <button
              onClick={() => setShowConversations(false)}
              className="lg:hidden p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
              title="Close conversations"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="relative mb-3">
            <label htmlFor="conversation-search" className="sr-only">
              Search by user or email
            </label>
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="conversation-search"
              name="conversation-search"
              type="text"
              placeholder="Search by user or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-3 py-2.5 rounded-xl border border-gray-200 focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm bg-white text-gray-900 placeholder-gray-400"
            />
          </div>
          <div className="flex flex-wrap gap-2 mb-3">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              <Filter className="w-3 h-3" />
              All
            </button>
            <button
              onClick={() => setStatusFilter('unread')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === 'unread'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                statusFilter === 'resolved'
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 border border-gray-200'
              }`}
            >
              Resolved
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">
          {loading ? (
            <div className="flex justify-center items-center py-12 text-gray-500">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>Loading conversations...</span>
            </div>
          ) : filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
              <p className="font-medium text-gray-700">No conversations found</p>
              <p className="text-sm text-gray-500 mt-1">
                {searchQuery || statusFilter !== 'all' 
                  ? 'Try adjusting your search or filters.'
                  : 'Messages from players will appear here in real time.'}
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
                      className={`w-full text-left px-4 py-4 transition-all ${
                        isActive 
                          ? 'bg-indigo-50 border-l-4 border-indigo-600' 
                          : 'hover:bg-gray-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <p className="text-sm font-semibold text-gray-900 truncate">
                              {conversation.name || 'Unknown User'}
                            </p>
                            {conversation.unreadCount > 0 && (
                              <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white min-w-[20px]">
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500 truncate mb-1.5">{conversation.email}</p>
                          <p className="text-xs text-gray-600 leading-relaxed line-clamp-2">
                            {conversation.lastMessage?.message 
                              ? decodeHtmlEntities(conversation.lastMessage.message)
                              : conversation.lastMessage?.attachmentName 
                              ? conversation.lastMessage.attachmentName
                              : '(Attachment)'}
                          </p>
                        </div>
                        <div className="text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0">
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
      <div className="bg-white rounded-2xl border border-gray-200 shadow-lg flex flex-col flex-1 min-h-0 lg:w-2/3">
        {selectedUserId ? (
          <>
            <div className="p-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <button
                  onClick={() => setShowConversations(true)}
                  className="lg:hidden p-2 text-gray-500 hover:bg-white rounded-lg transition flex-shrink-0"
                  title="Show conversations"
                >
                  <Menu className="w-5 h-5" />
                </button>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg font-bold text-gray-900 truncate">
                    {conversationSummaries.find((c) => c.userId === selectedUserId)?.name || 'User'}
                  </h3>
                  <p className="text-sm text-gray-500 truncate">
                    {conversationSummaries.find((c) => c.userId === selectedUserId)?.email || 'No email on file'}
                  </p>
                </div>
              </div>
              <button
                onClick={handleResolveMessages}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 border border-green-200 rounded-lg transition"
              >
                <CheckCircle className="w-4 h-4" />
                <span className="hidden sm:inline">Mark Resolved</span>
                <span className="sm:hidden">Resolve</span>
              </button>
            </div>

            <div 
              ref={messagesContainerRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50 min-h-0 relative"
            >
              {selectedConversationMessages.length === 0 && !loadingMore ? (
                <div className="text-center text-gray-500 py-12">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No messages yet</p>
                  <p className="text-sm mt-1">Start the conversation...</p>
                </div>
              ) : (
                <>
                  {/* Load More Button - Sticky at top when there are more messages */}
                  {hasMoreMessages[selectedUserId] === true && (
                    <div className="sticky top-0 z-10 flex justify-center py-3 mb-4 bg-gray-50 -mx-4 px-4 border-b border-gray-200 shadow-sm">
                      <button
                        ref={loadMoreButtonRef}
                        onClick={() => loadConversation(selectedUserId, true)}
                        disabled={loadingMore}
                        className="flex items-center gap-2 px-6 py-2.5 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md hover:shadow-lg"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="w-4 h-4 animate-spin" />
                            <span>Loading older messages...</span>
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-4 h-4" />
                            <span>Load Older Messages</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                  {selectedConversationMessages.map((msg) => {
                    const isAdmin = msg.senderType === 'admin';
                    const isSystem = msg.senderType === 'system';
                    
                    // Special rendering for system messages (bonus claims, etc.)
                    if (isSystem) {
                      return (
                        <div key={msg.id} className="flex justify-center my-4">
                          <div className="max-w-[90%] px-4 py-3 rounded-xl shadow-md bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400">
                            <div className="flex items-center gap-2 mb-2">
                              <Gift className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                              <span className="text-xs font-semibold text-yellow-800">{msg.name || 'User'}</span>
                              <span className="text-[10px] text-yellow-600">•</span>
                              <span className="text-[10px] text-yellow-600" title={formatFullTime(msg.createdAt)}>
                                {formatTime(msg.createdAt)}
                              </span>
                            </div>
                            {msg.message && (
                              <p className="text-sm font-medium text-yellow-900 whitespace-pre-wrap break-words">
                                {decodeHtmlEntities(msg.message)}
                              </p>
                            )}
                            {msg.metadata?.bonusTitle && (
                              <div className="mt-2 pt-2 border-t border-yellow-300">
                                <p className="text-xs text-yellow-700">
                                  <span className="font-semibold">Bonus:</span> {msg.metadata.bonusTitle}
                                  {msg.metadata.bonusValue && (
                                    <span className="ml-2">({msg.metadata.bonusValue})</span>
                                  )}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={msg.id} className={`flex ${isAdmin ? 'justify-end' : 'justify-start'}`}>
                        <div
                          className={`max-w-[80%] sm:max-w-[70%] px-4 py-3 rounded-2xl shadow-sm ${
                            isAdmin
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                          }`}
                        >
                          <div className="flex items-center gap-2 text-xs mb-2 opacity-90 flex-wrap">
                            <CircleDot className="w-3 h-3 flex-shrink-0" />
                            <span className="font-medium truncate">
                              {isAdmin ? (msg.name || 'Support Team') : (msg.name || 'User')}
                            </span>
                            <span>•</span>
                            <span className="text-[11px]" title={formatFullTime(msg.createdAt)}>
                              {formatTime(msg.createdAt)}
                            </span>
                          </div>
                          {msg.message && (
                            <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${
                              isAdmin ? 'text-white' : 'text-gray-900'
                            }`}>
                              {decodeHtmlEntities(msg.message)}
                            </p>
                          )}
                          {msg.attachmentUrl && (
                            <a
                              href={`${httpBaseUrl}${msg.attachmentUrl}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className={`mt-3 inline-flex items-center gap-2 text-xs font-semibold underline transition ${
                                isAdmin ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'
                              }`}
                            >
                              <FileText className="w-4 h-4" />
                              <span>{msg.attachmentName || 'Download attachment'}</span>
                            </a>
                          )}
                          <div
                            className={`mt-2 text-[11px] capitalize ${
                              isAdmin ? 'text-indigo-100' : 'text-gray-500'
                            } flex items-center gap-2`}
                          >
                            <span>Status: {msg.status}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </>
              )}
              <div ref={messagesEndRef} />
            </div>

            <div className="border-t border-gray-200 bg-white p-4 space-y-3 flex-shrink-0">
              {attachment && (
                <div className="bg-indigo-50 rounded-xl p-3 border border-indigo-200">
                  {attachmentPreview ? (
                    <div className="space-y-2">
                      <div className="relative inline-block max-w-full">
                        <img
                          src={attachmentPreview}
                          alt="Preview"
                          className="max-h-48 max-w-full rounded-lg border border-indigo-300 object-contain"
                        />
                        <button
                          onClick={() => {
                            setAttachment(null);
                            setAttachmentPreview(null);
                          }}
                          className="absolute top-2 right-2 bg-red-500 text-white rounded-full p-1.5 hover:bg-red-600 transition shadow-lg"
                          title="Remove attachment"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-indigo-700">
                        <Paperclip className="w-4 h-4 flex-shrink-0" />
                        <span className="truncate">{attachment.name}</span>
                        <span className="text-indigo-500">
                          ({(attachment.size / 1024).toFixed(1)} KB)
                        </span>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <Paperclip className="w-4 h-4 flex-shrink-0 text-indigo-600" />
                        <div className="min-w-0 flex-1">
                          <span className="text-sm text-indigo-700 font-medium truncate block">
                            {attachment.name}
                          </span>
                          <span className="text-xs text-indigo-500">
                            {(attachment.size / 1024).toFixed(1)} KB
                          </span>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setAttachment(null);
                          setAttachmentPreview(null);
                        }}
                        className="text-indigo-600 hover:text-indigo-800 flex-shrink-0 ml-2 p-1 rounded hover:bg-indigo-100 transition"
                        title="Remove attachment"
                      >
                        <X className="w-5 h-5" />
                      </button>
                    </div>
                  )}
                </div>
              )}
              <div className="flex items-end gap-3">
                <label htmlFor="message-input" className="sr-only">
                  Type your message
                </label>
                <textarea
                  id="message-input"
                  name="message-input"
                  value={messageInput}
                  onChange={(e) => setMessageInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  rows={3}
                  placeholder="Type your message...."
                  className="flex-1 rounded-xl border border-gray-200 px-4 py-3 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-gray-50"
                />
                <div className="flex flex-col gap-2">
                  <label htmlFor="attachment-input" className="flex items-center justify-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-indigo-600 transition p-2 rounded-lg hover:bg-gray-100">
                    <Paperclip className="w-5 h-5" />
                    <input
                      id="attachment-input"
                      name="attachment-input"
                      type="file"
                      className="hidden"
                      accept=".jpg,.jpeg,.png,.gif,.webp,.pdf"
                      onChange={handleFileSelect}
                    />
                  </label>
                  <button
                    onClick={() => void handleSendMessage()}
                    disabled={sending || (!messageInput.trim() && !attachment)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                  >
                    {sending ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <Send className="w-5 h-5" />
                    )}
                    <span className="hidden sm:inline">Send</span>
                  </button>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-500 space-y-4 p-8">
            <div className="p-4 bg-indigo-100 rounded-full">
              <MessageCircle className="w-12 h-12 text-indigo-500" />
            </div>
            <div className="text-center">
              <p className="text-lg font-semibold text-gray-700">Select a conversation</p>
              <p className="text-sm text-gray-500 mt-2 max-w-sm">
                {showConversations 
                  ? 'Choose a player conversation from the left to start chatting.' 
                  : 'Tap the menu button to view conversations.'}
              </p>
            </div>
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
