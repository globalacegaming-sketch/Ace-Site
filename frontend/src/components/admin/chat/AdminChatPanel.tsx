import { useEffect, useLayoutEffect, useRef, useState, useCallback, type MutableRefObject } from 'react';
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
  CircleDot,
  X,
  ArrowLeft,
  Gift,
  ChevronUp,
  ChevronDown,
  Reply,
  SmilePlus,
  StickyNote,
  Wallet,
  ArrowUp,
  Zap,
  UserPlus
} from 'lucide-react';
import toast from 'react-hot-toast';
import { getAttachmentUrl, isImageAttachment } from '../../../utils/api';
import { linkify } from '../../../utils/linkify';
import LabelBadge, { LabelSelector, LabelFilter, type LabelData } from '../LabelBadge';
import UserNotesPanel from '../UserNotesPanel';

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
  replyTo?: {
    messageId: string;
    message?: string;
    senderName?: string;
    senderType?: string;
  };
  reactions?: {
    emoji: string;
    reactorId: string;
    reactorType: 'user' | 'admin';
    reactorName?: string;
  }[];
  metadata?: {
    type?: string;
    bonusId?: string;
    bonusTitle?: string;
    bonusType?: string;
    bonusValue?: string;
    isSystemMessage?: boolean;
    adminAgentName?: string;
    recipientName?: string;
    source?: string;
  };
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '🔥', '😢'];
const MORE_EMOJIS  = ['😮', '🎉', '👏', '🙏', '😍', '💯', '👎', '😡', '🤔', '✅'];

/**
 * Canned replies for the money flows players start from the site
 * (Deposit / Withdraw / Bonus). Inserted into the composer; the agent edits and sends.
 */
/** Highlighted in the composer so the agent can type the dollar amount over it. */
const AMOUNT_PLACEHOLDER = '$[amount]';

const CANNED_REPLIES: { label: string; text: (name: string) => string }[] = [
  {
    label: 'Payment options',
    text: () =>
      'We currently have Chime, Cash App, Apple Pay, Google Pay, and debit and credit cards through Paydora.',
  },
  {
    label: 'Credit with bonus',
    text: () =>
      `${AMOUNT_PLACEHOLDER} Credits including a 20% Special VIP bonus is successfully added! 🤞 Good luck!`,
  },
  {
    label: 'Credit added',
    text: () =>
      `${AMOUNT_PLACEHOLDER} credits have been successfully added 🤞 Good luck!`,
  },
  {
    label: 'VIP/Post bonus',
    text: () =>
      'A $5 VIP Bonus has been successfully added to your account! 🎉🤞 Good luck!',
  },
  {
    label: 'Processing withdrawal',
    text: (name) =>
      `Congratulations ${name} 🥳🥳! Allow me a moment to proceed with your winnings real quick`,
  },
];

/** Max height the composer can grow to before it scrolls internally. */
const COMPOSER_MAX_HEIGHT = 140;
/** When the agent scrolls within this many px of the top, older messages auto-load. */
const AUTO_LOAD_OLDER_THRESHOLD = 80;

/** Format a date for the divider between message groups */
const formatDateDivider = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

interface ConversationSummary {
  userId: string;
  name?: string;
  email?: string;
  lastMessage?: ChatMessage;
  unreadCount: number;
  labels?: LabelData[];
  /** Player context returned with the conversation (FP account, balance, referral). */
  fortunePandaUsername?: string;
  fortunePandaBalance?: number | null;
  joinedViaReferral?: boolean;
}

interface AdminChatPanelProps {
  adminToken: string;
  apiBaseUrl: string;
  wsBaseUrl: string;
  initialUserId?: string | null;
  onInitialUserConsumed?: () => void;
  onUnreadChange?: (count: number) => void;
  onSessionExpired?: () => void;
  /**
   * Whether the panel is currently shown. The parent keeps the panel mounted
   * (display:none) on other tabs so the socket stays alive; scrolling while hidden
   * is a no-op, so we re-scroll when this flips to true.
   */
  isVisible?: boolean;
  /** Receives the "refresh conversations" function so the parent can wire a toolbar button. */
  refreshRef?: MutableRefObject<(() => void) | null>;
  /** When provided, the chat header shows a Deposit button that opens the parent's deposit flow. */
  onOpenDeposit?: (userId: string) => void;
}

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;
const INITIAL_MESSAGE_LIMIT = 50; // Increased initial load for better UX
const LOAD_MORE_LIMIT = 50; // Load more messages at once

const AdminChatPanel = ({
  adminToken,
  apiBaseUrl,
  wsBaseUrl,
  initialUserId,
  onInitialUserConsumed,
  onUnreadChange,
  onSessionExpired,
  isVisible = true,
  refreshRef,
  onOpenDeposit,
}: AdminChatPanelProps) => {
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingConversation, setLoadingConversation] = useState(false);
  const [conversationSummaries, setConversationSummaries] = useState<ConversationSummary[]>([]);
  const [conversationMessages, setConversationMessages] = useState<Record<string, ChatMessage[]>>({});
  const [hasMoreMessages, setHasMoreMessages] = useState<Record<string, boolean>>({});
  const loadedConversationsRef = useRef<Set<string>>(new Set());
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'unread' | 'resolved'>('all');
  const [messageInput, setMessageInput] = useState('');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [showConversations, setShowConversations] = useState(true);
  const [imageModal, setImageModal] = useState<{ url: string; name: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [emojiExpanded, setEmojiExpanded] = useState(false);
  const [closingReply, setClosingReply] = useState(false);
  const [socketConnected, setSocketConnected] = useState(false);
  const [socketReconnecting, setSocketReconnecting] = useState(false);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [confirmResolve, setConfirmResolve] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, string>>({}); // userId -> name
  const [onlineAgents, setOnlineAgents] = useState<string[]>([]);
  // Labels & Notes state
  const [allLabels, setAllLabels] = useState<LabelData[]>([]);
  const [labelFilterIds, setLabelFilterIds] = useState<string[]>([]);
  const [notesUserId, setNotesUserId] = useState<string | null>(null);
  const [notesUserName, setNotesUserName] = useState('');
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);
  const initialConvoLoadRef = useRef<string | null>(null); // Track first load per conversation
  const sidebarScrollRef = useRef<HTMLDivElement | null>(null); // Sidebar conversation list scroll container
  const sidebarScrollTop = useRef<number>(0); // Continuously tracked sidebar scroll position
  const isRestoringScroll = useRef(false); // Guard: true while programmatically restoring scrollTop
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messagesContainerRef = useRef<HTMLDivElement | null>(null);
  const composerRef = useRef<HTMLTextAreaElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const loadMoreButtonRef = useRef<HTMLButtonElement | null>(null);
  const selectedUserIdRef = useRef<string | null>(null);
  /** Last message id rendered per conversation — lets the auto-scroll effect tell "appended" from "status/reaction/prepend". */
  const lastMsgIdRef = useRef<Record<string, string | null>>({});
  /** Scroll anchor captured before prepending older messages so the view doesn't jump. */
  const prependAnchorRef = useRef<{ userId: string; scrollHeight: number; scrollTop: number } | null>(null);
  /** Force a scroll to bottom on the next appended message (set after the agent sends). */
  const forceScrollNextRef = useRef(false);
  const handleSelectConversationRef = useRef<(userId: string) => void>(() => {});
  const resolveConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playNotificationSoundRef = useRef<() => void>(() => {});
  const showPushNotificationRef = useRef<(message: ChatMessage) => void>(() => {});
  const notificationPermissionRef = useRef<NotificationPermission>('default');
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptsRef = useRef(0);

  const audioCtxRef = useRef<AudioContext | null>(null);
  const onUnreadChangeRef = useRef(onUnreadChange);
  onUnreadChangeRef.current = onUnreadChange;
  const onSessionExpiredRef = useRef(onSessionExpired);
  onSessionExpiredRef.current = onSessionExpired;

  useEffect(() => {
    const total = conversationSummaries.reduce((sum, s) => sum + s.unreadCount, 0);
    onUnreadChangeRef.current?.(total);
  }, [conversationSummaries]);

  const getAudioContext = useCallback(() => {
    if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
      audioCtxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
    return audioCtxRef.current;
  }, []);

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close();
      }
    };
  }, []);

  const playNotificationSound = useCallback(() => {
    try {
      const ctx = getAudioContext();
      const now = ctx.currentTime;

      const playTone = (freq: number, start: number, duration: number, gain: number) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + start);
        g.gain.setValueAtTime(0, now + start);
        g.gain.linearRampToValueAtTime(gain, now + start + 0.01);
        g.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
        osc.connect(g);
        g.connect(ctx.destination);
        osc.start(now + start);
        osc.stop(now + start + duration);
      };

      playTone(880, 0, 0.15, 0.3);
      playTone(1175, 0.12, 0.15, 0.3);
      playTone(1320, 0.24, 0.2, 0.25);
    } catch {
      // Web Audio API not available — silent fallback
    }
  }, [getAudioContext]);

  // Request browser notification permission
  const requestNotificationPermission = useCallback(async () => {
    if (!('Notification' in window)) {
      console.log('This browser does not support notifications');
      return false;
    }

    if (Notification.permission === 'granted') {
      notificationPermissionRef.current = 'granted';
      return true;
    }

    if (Notification.permission !== 'denied') {
      try {
        const permission = await Notification.requestPermission();
        notificationPermissionRef.current = permission;
        if (permission === 'granted') {
          // Test notification to ensure Windows notifications work
          try {
            const testNotification = new Notification('Notifications enabled', {
              body: 'You will receive Windows notifications for new customer messages',
              icon: '/favicon.ico',
              tag: 'test-notification',
              silent: false
            });
            // Close test notification after 3 seconds
            setTimeout(() => testNotification.close(), 3000);
          } catch (e) {
            console.log('Could not show test notification:', e);
          }
          return true;
        } else if (permission === 'denied') {
          toast.error('Notification permission denied. Please enable notifications in your browser settings to receive Windows notifications.', {
            duration: 5000
          });
        }
      } catch (error) {
        console.log('Error requesting notification permission:', error);
        toast.error('Failed to request notification permission', {
          duration: 3000
        });
      }
    } else {
      toast.error('Notifications are blocked. Please enable them in your browser settings to receive Windows notifications.', {
        duration: 5000
      });
    }

    return false;
  }, []);

  // Show browser push notification
  const showPushNotification = useCallback((message: ChatMessage) => {
    if (!('Notification' in window)) {
      return;
    }

    // Only show notification if permission is granted
    if (notificationPermissionRef.current !== 'granted') {
      return;
    }

    // Don't show notification if viewing this conversation and tab is focused
    const isViewingConversation = selectedUserIdRef.current === message.userId;
    const isTabFocused = document.hasFocus();

    if (isViewingConversation && isTabFocused) {
      // User is actively viewing this conversation, no need for notification
      return;
    }

    try {
      const senderName = message.name || 'Customer';
      const messageText = message.message 
        ? (message.message.length > 100 ? message.message.substring(0, 100) + '...' : message.message)
        : message.attachmentName 
        ? `Sent an attachment: ${message.attachmentName}`
        : 'Sent a message';

      // Create notification with Windows-friendly options
      const notificationOptions: NotificationOptions = {
        body: messageText,
        icon: '/favicon.ico', // App icon for Windows
        badge: '/favicon.ico', // Badge icon
        tag: `chat-${message.userId}`, // Group notifications by conversation (replaces previous notification with same tag)
        requireInteraction: false, // Don't require user interaction to dismiss
        silent: false, // Allow system sound
        // Add data for notification handling
        data: {
          userId: message.userId,
          messageId: message.id,
          url: window.location.href
        }
      };

      const notification = new Notification(`New message from ${senderName}`, notificationOptions);

      // Handle notification click - focus the window and select the conversation
      notification.onclick = (event) => {
        event.preventDefault();
        window.focus();
        // Focus the admin dashboard tab
        if (window.parent !== window) {
          window.parent.focus();
        }
        if (selectedUserIdRef.current !== message.userId) {
          // Go through the normal select path so the conversation scrolls to the latest message
          handleSelectConversationRef.current(message.userId);
        }
        // Don't auto-close on click - let Windows handle it
      };

      // Handle notification close
      notification.onclose = () => {
        // Notification was closed (by user or system)
      };

      // Don't auto-close - let Windows handle notification persistence
      // Windows will automatically move it to Action Center if not dismissed
      // This ensures notifications appear in Windows notification center
    } catch (error) {
      console.log('Error showing push notification:', error);
    }
  }, []);

  // Initialize notification permission on mount
  useEffect(() => {
    if ('Notification' in window) {
      notificationPermissionRef.current = Notification.permission;
      
      // Request permission if not already granted or denied
      if (Notification.permission === 'default') {
        // Request permission after a short delay to allow user interaction
        const timer = setTimeout(() => {
          requestNotificationPermission().then((granted) => {
            if (granted) {
              toast.success('Push notifications enabled', {
                duration: 3000,
                icon: '🔔'
              });
            }
          });
        }, 2000);

        return () => clearTimeout(timer);
      }
    }
  }, [requestNotificationPermission]);

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

  const isNearBottom = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 200;
  }, []);

  /**
   * Scroll the message list (and only the message list) to the bottom.
   * Uses the container's scrollTop instead of scrollIntoView so the outer
   * dashboard scroller / page header never move. Double-rAF waits for the
   * freshly rendered messages to be laid out first.
   */
  const scrollMessagesToBottom = useCallback((behavior: ScrollBehavior = 'auto') => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        const el = messagesContainerRef.current;
        if (!el) return;
        if (behavior === 'smooth' && typeof el.scrollTo === 'function') {
          el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
        } else {
          el.scrollTop = el.scrollHeight;
        }
      });
    });
  }, []);

  const scrollToBottom = useCallback(() => {
    scrollMessagesToBottom('smooth');
    setNewMsgCount(0);
    setShowScrollBottom(false);
  }, [scrollMessagesToBottom]);

  /** Resize the composer to fit its content, up to COMPOSER_MAX_HEIGHT. */
  const resizeComposer = useCallback(() => {
    const el = composerRef.current;
    if (!el) return;
    el.style.height = 'auto';
    const next = Math.min(el.scrollHeight, COMPOSER_MAX_HEIGHT);
    el.style.height = `${next}px`;
    el.style.overflowY = el.scrollHeight > COMPOSER_MAX_HEIGHT ? 'auto' : 'hidden';
  }, []);

  /** Put text in the composer (canned reply / card shortcut) and focus it. */
  const insertIntoComposer = useCallback((text: string) => {
    setMessageInput((prev) => {
      const trimmed = prev.trim();
      return trimmed ? `${prev.replace(/\s+$/, '')}\n${text}` : text;
    });
    requestAnimationFrame(() => {
      const el = composerRef.current;
      if (!el) return;
      el.focus();
      // Select the amount placeholder so the agent can type the dollar amount straight away
      const amountAt = el.value.lastIndexOf(AMOUNT_PLACEHOLDER);
      if (amountAt !== -1) {
        el.setSelectionRange(amountAt, amountAt + AMOUNT_PLACEHOLDER.length);
      } else {
        const len = el.value.length;
        el.setSelectionRange(len, len);
      }
      resizeComposer();
    });
  }, [resizeComposer]);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyingTo(msg);
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-indigo-400');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-indigo-400');
      }, 2000);
    }
  }, []);

  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 2000) return;
    lastTypingEmitRef.current = now;
    socketRef.current?.emit('chat:typing:start', { userId: selectedUserId });
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing:stop', { userId: selectedUserId });
    }, 3000);
  }, [selectedUserId]);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!adminToken) return;
    try {
      await axios.post(`${apiBaseUrl}/admin/messages/${messageId}/reactions`, { emoji }, {
        headers: { Authorization: `Bearer ${adminToken}` },
        withCredentials: true
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to react';
      console.error('Reaction error:', err?.response?.status, msg);
      toast.error(msg);
    }
    setEmojiPickerMsgId(null);
  }, [adminToken, apiBaseUrl]);

  // Restore the scroll anchor right after older messages are prepended, before paint.
  useLayoutEffect(() => {
    const anchor = prependAnchorRef.current;
    if (!anchor || anchor.userId !== selectedUserId) return;
    const el = messagesContainerRef.current;
    if (el) {
      el.scrollTop = el.scrollHeight - anchor.scrollHeight + anchor.scrollTop;
    }
    prependAnchorRef.current = null;
  }, [conversationMessages, selectedUserId]);

  useEffect(() => {
    if (!selectedUserId) return;
    const msgs = conversationMessages[selectedUserId] || [];
    const lastId = msgs.length > 0 ? msgs[msgs.length - 1].id : null;
    const prevLastId = lastMsgIdRef.current[selectedUserId] ?? null;
    lastMsgIdRef.current[selectedUserId] = lastId;

    // Initial open of a conversation: jump to the latest message, but only once the
    // API batch has rendered. Socket leftovers from before the open must not consume
    // the flag — that is what left the view parked at the top.
    if (initialConvoLoadRef.current === selectedUserId) {
      if (loadingConversation) return;
      if (msgs.length === 0 && !loadedConversationsRef.current.has(selectedUserId)) return;
      initialConvoLoadRef.current = null;
      scrollMessagesToBottom('auto');
      setNewMsgCount(0);
      setShowScrollBottom(false);
      return;
    }

    // Nothing appended (status / reaction update, or older messages prepended) → leave the view alone.
    if (lastId === prevLastId) return;

    if (forceScrollNextRef.current || isNearBottom()) {
      forceScrollNextRef.current = false;
      scrollToBottom();
    } else {
      setNewMsgCount((c) => c + 1);
    }
  }, [selectedUserId, conversationMessages, loadingConversation]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-scroll when the panel becomes visible again (it is kept mounted with display:none on other tabs).
  useEffect(() => {
    if (!isVisible || !selectedUserId) return;
    if (!showScrollBottom) scrollMessagesToBottom('auto');
  }, [isVisible]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the composer height in sync with its content (also when cleared after send).
  useEffect(() => {
    resizeComposer();
  }, [messageInput, resizeComposer, selectedUserId]);

  useEffect(() => {
    return () => {
      if (resolveConfirmTimerRef.current) clearTimeout(resolveConfirmTimerRef.current);
    };
  }, []);

  const fetchConversations = useCallback(async () => {
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
  }, [adminToken, apiBaseUrl, statusFilter, searchQuery]);

  // Fetch all labels for filtering/display
  const fetchLabels = useCallback(async () => {
    try {
      const res = await axios.get(`${apiBaseUrl}/admin/labels`, {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.data.success) setAllLabels(res.data.data || []);
    } catch {
      // Labels are optional – fail silently
    }
  }, [adminToken, apiBaseUrl]);

  useEffect(() => {
    if (adminToken) fetchLabels();
  }, [adminToken, fetchLabels]);

  // Assign labels to a user and update local state
  const handleAssignLabels = useCallback(async (userId: string, labelIds: string[]) => {
    try {
      await axios.post(
        `${apiBaseUrl}/admin/labels/assign`,
        { userId, labelIds },
        { headers: { Authorization: `Bearer ${adminToken}` } }
      );
      // Update local conversation summary instantly
      setConversationSummaries(prev =>
        prev.map(c => c.userId === userId
          ? { ...c, labels: allLabels.filter(l => labelIds.includes(l._id)) }
          : c
        )
      );
    } catch (err) {
      console.error('Failed to assign labels:', err);
      toast.error('Failed to update labels');
    }
  }, [adminToken, apiBaseUrl, allLabels]);

  // Expose the refresh function to the parent through a ref (no window globals)
  useEffect(() => {
    if (!refreshRef) return;
    refreshRef.current = fetchConversations;
    return () => {
      refreshRef.current = null;
    };
  }, [fetchConversations, refreshRef]);

  const loadConversation = async (userId: string, loadOlder: boolean = false) => {
    if (!userId) return;
    
    // Show skeleton for initial conversation load
    if (!loadOlder) setLoadingConversation(true);

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

        loadedConversationsRef.current.add(userId);

        if (loadOlder) {
          const totalMessages = response.data.pagination?.total || 0;
          // Capture the scroll anchor so the layout effect can keep the same message in view
          const container = messagesContainerRef.current;
          if (container && sorted.length > 0) {
            prependAnchorRef.current = {
              userId,
              scrollHeight: container.scrollHeight,
              scrollTop: container.scrollTop
            };
          }
          setConversationMessages((prev) => {
            const prevMessages = prev[userId] || [];
            const updatedMessages = [...sorted, ...prevMessages];
            const updatedMessagesCount = updatedMessages.length;
            const hasMore = sorted.length >= LOAD_MORE_LIMIT && 
                           (totalMessages === 0 || updatedMessagesCount < totalMessages);
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
          // Initial load — merge with any socket-delivered messages already in state
          setConversationMessages((prev) => {
            const socketMessages = prev[userId] || [];
            const apiIds = new Set(sorted.map(m => m.id));
            const newFromSocket = socketMessages.filter(m => !apiIds.has(m.id));
            const merged = [...sorted, ...newFromSocket].sort(
              (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            );
            return { ...prev, [userId]: merged };
          });
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
          const playerContext = {
            fortunePandaUsername: userInfo.fortunePandaUsername || undefined,
            fortunePandaBalance:
              typeof userInfo.fortunePandaBalance === 'number' ? userInfo.fortunePandaBalance : null,
            joinedViaReferral: Boolean(userInfo.joinedViaReferral)
          };
          setConversationSummaries((prev) => {
            const existing = prev.find((c) => c.userId === userId);
            if (existing) {
              return prev.map((c) =>
                c.userId === userId
                  ? {
                      ...c,
                      name: userInfo.name || c.name,
                      email: userInfo.email || c.email,
                      ...playerContext
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
                  ...playerContext,
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
      setLoadingConversation(false);
    }
  };

  const handleAdminScroll = useCallback(() => {
    const el = messagesContainerRef.current;
    if (!el) return;
    setShowScrollBottom(!isNearBottom());
    // Auto-load older messages when the agent reaches the top (the pill stays as a fallback)
    if (
      selectedUserId &&
      el.scrollTop < AUTO_LOAD_OLDER_THRESHOLD &&
      hasMoreMessages[selectedUserId] === true &&
      !loadingMore &&
      !loadingConversation
    ) {
      void loadConversation(selectedUserId, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNearBottom, selectedUserId, hasMoreMessages, loadingMore, loadingConversation]);

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
    showPushNotificationRef.current = showPushNotification;
  }, [selectedUserId, playNotificationSound, showPushNotification]);

  // Stabilise sidebar scroll when the conversation list re-sorts.
  //
  // When a conversation gets a new message the list re-sorts (newest on top).
  // React reconciles the DOM, and the browser resets scrollTop to 0.
  // The onScroll handler below continuously tracks the user's scroll position.
  //
  // This layout effect runs synchronously *before* the browser paints.
  // It sets `isRestoringScroll` to prevent the onScroll handler from
  // overwriting the saved position with the browser's incorrect "0" value
  // that occurs during DOM reorder, then restores the real scroll position.
  useLayoutEffect(() => {
    const container = sidebarScrollRef.current;
    if (!container || sidebarScrollTop.current === 0) return;

    isRestoringScroll.current = true;
    container.scrollTop = sidebarScrollTop.current;

    // The scroll event from the programmatic assignment fires asynchronously.
    // Clear the guard on the next microtask so future user scrolls are tracked.
    queueMicrotask(() => {
      isRestoringScroll.current = false;
    });
  }, [conversationSummaries, selectedUserId]);

  useEffect(() => {
    // Cleanup any existing reconnection timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    reconnectAttemptsRef.current = 0;

    // withCredentials sends session cookie for shared session auth;
    // auth.adminToken kept as fallback for backward compatibility.
    const socket = io(wsBaseUrl, {
      transports: ['websocket', 'polling'],
      auth: { adminToken },
      withCredentials: true,
      autoConnect: true,
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 10,
      timeout: 20000
    });

    // Connection status handlers
    socket.on('connect', () => {
      console.log('✅ Socket connected');
      setSocketConnected(true);
      setSocketReconnecting(false);
      reconnectAttemptsRef.current = 0;
      // Refresh conversations whenever connection is established (initial + reconnect)
      // so admins see the latest messages without reloading the page
      fetchConversations();
      if (selectedUserIdRef.current) {
        loadConversation(selectedUserIdRef.current);
      }
    });

    socket.on('disconnect', (reason) => {
      console.log('❌ Socket disconnected:', reason);
      setSocketConnected(false);
      
      // If disconnect was not intentional, mark as reconnecting
      if (reason === 'io server disconnect' || reason === 'io client disconnect') {
        // Server or client initiated disconnect - don't reconnect automatically
        setSocketReconnecting(false);
      } else {
        // Network error or other issue - will attempt to reconnect
        setSocketReconnecting(true);
      }
    });

    socket.on('connect_error', (error) => {
      console.error('Socket connection error:', error.message);
      setSocketConnected(false);
      reconnectAttemptsRef.current++;

      if (error.message === 'Admin session expired') {
        socket.disconnect();
        setSocketReconnecting(false);
        onSessionExpiredRef.current?.();
        return;
      }
      setSocketReconnecting(true);
    });

    socket.on('reconnect', (attemptNumber) => {
      console.log(`✅ Socket reconnected after ${attemptNumber} attempts`);
      // Refresh is handled in 'connect' which also fires on reconnect
    });

    socket.on('reconnect_attempt', (attemptNumber) => {
      console.log(`🔄 Reconnection attempt ${attemptNumber}`);
      setSocketReconnecting(true);
    });

    socket.on('reconnect_error', (error) => {
      console.error('Reconnection error:', error);
      setSocketReconnecting(true);
    });

    socket.on('reconnect_failed', () => {
      console.error('❌ Socket reconnection failed');
      setSocketReconnecting(false);
      toast.error('Failed to reconnect to chat server. Please refresh the page.', {
        duration: 5000,
        id: 'socket-reconnect-failed'
      });
    });

    socket.on('chat:connected', (data) => {
      console.log('Chat connection confirmed:', data);
      setSocketConnected(true);
    });

    socket.on('chat:agents:online', (names: string[]) => {
      setOnlineAgents(names);
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
        
        // Play notification sound and show push notification if message is from user
        // Use ref to avoid socket reconnection when callback changes
        if (message.senderType === 'user') {
          setTimeout(() => {
            playNotificationSoundRef.current();
            // Show browser push notification
            showPushNotificationRef.current(message);
          }, 100);
        }
        
        return { ...prev, [message.userId]: updated };
      });

      // Update conversation summaries in real-time
      // Check if the message ID already exists in the conversation summary's lastMessage
      setConversationSummaries((prevSummaries) => {
        const existingSummary = prevSummaries.find(s => s.userId === message.userId);
        
        // If the last message has the same ID, it's a duplicate - don't update
        if (existingSummary?.lastMessage?.id === message.id) {
          return prevSummaries;
        }
        
        const map = new Map(prevSummaries.map((summary) => [summary.userId, summary] as const));
        const existing = map.get(message.userId);
        
        // Calculate unread count increment/decrement
        let unreadCountChange = 0;
        if (message.senderType === 'user') {
          if (message.status === 'unread') {
            unreadCountChange = 1;
          } else if (existing && existing.lastMessage?.id === message.id && existing.lastMessage?.status === 'unread') {
            // Message was marked as read/resolved, decrement unread count
            unreadCountChange = -1;
          }
        }

        // Only update the conversation display name from user-sent messages.
        // Admin messages carry the agent's name (e.g. "GAGame"), not the user's
        // name, so using them would overwrite the user's name in the sidebar.
        // For admin messages, fall back to metadata.recipientName if available.
        const nameFromMsg = message.senderType === 'user'
          ? message.name
          : message.metadata?.recipientName;

        const updatedSummary: ConversationSummary = existing
          ? {
              ...existing,
              lastMessage: message,
              unreadCount: Math.max(0, existing.unreadCount + unreadCountChange),
              name: nameFromMsg || existing.name,
              email: message.email || existing.email
            }
          : {
              userId: message.userId,
              name: nameFromMsg || undefined,
              email: message.email,
              lastMessage: message,
              unreadCount: message.senderType === 'user' && message.status === 'unread' ? 1 : 0
            };

        map.set(message.userId, updatedSummary);
        
        // Sort by last message timestamp (most recent first)
        const sorted = Array.from(map.values()).sort((a, b) => {
          const dateA = a.lastMessage ? new Date(a.lastMessage.createdAt).getTime() : 0;
          const dateB = b.lastMessage ? new Date(b.lastMessage.createdAt).getTime() : 0;
          return dateB - dateA;
        });
        return sorted;
      });

      // Scrolling is handled by the conversationMessages effect, which only scrolls
      // when the agent is already near the bottom (otherwise it bumps the badge).
    });

    socket.on('chat:message:status', (message: ChatMessage) => {
      // Update message status in conversation messages
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

      // Update conversation summaries with status change
      setConversationSummaries((prev) =>
        prev.map((summary) => {
          if (summary.userId !== message.userId) {
            return summary;
          }

          // Update last message status if it matches
          const updatedLastMessage =
            summary.lastMessage && summary.lastMessage.id === message.id
              ? { ...summary.lastMessage, status: message.status }
              : summary.lastMessage;

          // Calculate unread count change
          let unreadCount = summary.unreadCount;
          if (message.senderType === 'user') {
            if (message.status === 'unread' && summary.lastMessage?.id === message.id && summary.lastMessage?.status !== 'unread') {
              // Message was marked as unread (shouldn't happen often, but handle it)
              unreadCount = summary.unreadCount + 1;
            } else if (message.status !== 'unread' && summary.lastMessage?.id === message.id && summary.lastMessage?.status === 'unread') {
              // Message was marked as read/resolved, decrement unread count
              unreadCount = Math.max(0, summary.unreadCount - 1);
            }
          }

          return {
            ...summary,
            lastMessage: updatedLastMessage || summary.lastMessage,
            unreadCount
          };
        })
      );
    });

    socket.on('chat:reaction:update', (data: { messageId: string; userId: string; reactions: ChatMessage['reactions'] }) => {
      setConversationMessages((prev) => {
        const msgs = prev[data.userId];
        if (!msgs) return prev;
        return { ...prev, [data.userId]: msgs.map((m) => m.id === data.messageId ? { ...m, reactions: data.reactions } : m) };
      });
    });

    socket.on('chat:typing:start', (data: { senderType: string; userId?: string; name?: string }) => {
      if (data.senderType === 'user' && data.userId) {
        setTypingUsers((prev) => ({ ...prev, [data.userId!]: data.name || 'User' }));
      }
    });
    socket.on('chat:typing:stop', (data: { senderType: string; userId?: string }) => {
      if (data.senderType === 'user' && data.userId) {
        setTypingUsers((prev) => {
          const next = { ...prev };
          delete next[data.userId!];
          return next;
        });
      }
    });

    socketRef.current = socket;

    return () => {
      // Cleanup socket connection
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setSocketConnected(false);
      setSocketReconnecting(false);
      
      // Clear any pending reconnection timeouts
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
    };
    // Only reconnect socket when wsBaseUrl or adminToken changes
    // selectedUserId and playNotificationSound don't require socket reconnection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wsBaseUrl, adminToken]);

  const handleSelectConversation = (userId: string) => {
    setSelectedUserId(userId);
    setReplyingTo(null);
    setConfirmResolve(false);
    setNewMsgCount(0);
    setShowScrollBottom(false);
    // Mark this conversation for initial-load scroll (consumed once the API batch renders)
    initialConvoLoadRef.current = userId;
    // Hide conversations sidebar on mobile when selecting a conversation
    // This ensures chat area takes full width on mobile
    setShowConversations(false);
    if (!loadedConversationsRef.current.has(userId)) {
      setHasMoreMessages((prev) => ({
        ...prev,
        [userId]: undefined as any
      }));
      void loadConversation(userId);
    } else {
      // Already loaded via API — the conversationMessages effect sees the flag and scrolls
      void markMessagesAsRead(userId, conversationMessages[userId] || []);
    }
    setConversationSummaries((prev) =>
      prev.map((summary) =>
        summary.userId === userId ? { ...summary, unreadCount: 0 } : summary
      )
    );
  };
  handleSelectConversationRef.current = handleSelectConversation;

  useEffect(() => {
    if (initialUserId) {
      handleSelectConversation(initialUserId);
      onInitialUserConsumed?.();
    }
  }, [initialUserId]); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (replyingTo) {
        formData.append('replyToMessageId', replyingTo.id);
      }

      await axios.post(`${apiBaseUrl}/admin/messages`, formData, {
        headers: {
          Authorization: `Bearer ${adminToken}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      // The sent message comes back over the socket; always show it even if the agent had scrolled up
      forceScrollNextRef.current = true;
      setMessageInput('');
      setAttachment(null);
      setAttachmentPreview(null);
      setReplyingTo(null);
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

  /** First tap arms an inline confirm (auto-dismisses); second tap resolves. */
  const handleResolveClick = () => {
    if (confirmResolve) {
      setConfirmResolve(false);
      if (resolveConfirmTimerRef.current) clearTimeout(resolveConfirmTimerRef.current);
      void handleResolveMessages();
      return;
    }
    setConfirmResolve(true);
    if (resolveConfirmTimerRef.current) clearTimeout(resolveConfirmTimerRef.current);
    resolveConfirmTimerRef.current = setTimeout(() => setConfirmResolve(false), 4000);
  };

  const handleResolveMessages = async () => {
    if (!selectedUserId || resolving) return;
    const messages = conversationMessages[selectedUserId] || [];
    const unresolved = messages.filter(
      (msg) => msg.senderType === 'user' && msg.status !== 'resolved'
    );

    if (unresolved.length === 0) {
      toast.success('Conversation already resolved.');
      return;
    }

    setResolving(true);
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
    } finally {
      setResolving(false);
    }
  };

  /** Prefill the composer from a bonus / loan system card. */
  const handleSystemCardReply = (msg: ChatMessage) => {
    const playerName = msg.name || 'there';
    const metaType = msg.metadata?.type || '';
    let text: string;
    if (metaType.startsWith('loan_')) {
      text = `Hi ${playerName}, I'm reviewing your loan request now and will update you here shortly.`;
    } else if (msg.metadata?.bonusTitle) {
      text = `Hi ${playerName}, I'm adding your ${msg.metadata.bonusTitle} now — it'll show in your balance shortly.`;
    } else {
      text = `Hi ${playerName}, I'm looking into this for you now.`;
    }
    setReplyingTo(msg);
    insertIntoComposer(text);
  };

  const filteredConversations = conversationSummaries.filter((conversation) => {
    const matchesSearch =
      !searchQuery ||
      conversation.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      conversation.userId?.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    // Label filter
    if (labelFilterIds.length > 0) {
      const userLabelIds = (conversation.labels || []).map(l => l._id);
      const matchesLabels = labelFilterIds.some(id => userLabelIds.includes(id));
      if (!matchesLabels) return false;
    }

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

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (const item of Array.from(items)) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          if (file.size > MAX_ATTACHMENT_SIZE) {
            toast.error('Pasted image must be under 10MB.');
            return;
          }
          setAttachment(file);
          const reader = new FileReader();
          reader.onloadend = () => setAttachmentPreview(reader.result as string);
          reader.readAsDataURL(file);
          toast.success('Image pasted from clipboard');
        }
        break;
      }
    }
  }, []);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden lg:flex-row lg:gap-6">
      {/* Conversations Sidebar */}
      <div className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden border-0 bg-white shadow-lg transition-all duration-300 sm:rounded-2xl sm:border sm:border-gray-200 lg:w-1/3 lg:flex-none ${
        showConversations ? 'flex' : 'hidden'
      } lg:flex`}>
        <div className="p-3 sm:p-4 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50">
          {/* Socket Connection Status + Online Agents */}
          <div className="mb-2 sm:mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                socketConnected 
                  ? 'bg-green-500 animate-pulse' 
                  : socketReconnecting 
                    ? 'bg-yellow-500 animate-pulse' 
                    : 'bg-red-500'
              }`} title={socketConnected ? 'Connected' : socketReconnecting ? 'Reconnecting...' : 'Disconnected'} />
              {socketConnected ? (
                <span className="text-xs font-medium text-green-700 truncate" title={onlineAgents.length > 0 ? `Online: ${onlineAgents.join(', ')}` : 'Live'}>
                  {onlineAgents.length > 0 ? onlineAgents.join(', ') : 'Live'}
                </span>
              ) : (
                <span className={`text-xs font-medium ${socketReconnecting ? 'text-yellow-700' : 'text-red-700'}`}>
                  {socketReconnecting ? 'Reconnecting...' : 'Offline'}
                </span>
              )}
            </div>
            {!socketConnected && !socketReconnecting && (
              <button
                onClick={() => {
                  if (socketRef.current) {
                    socketRef.current.connect();
                  }
                }}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-medium flex-shrink-0"
              >
                Reconnect
              </button>
            )}
          </div>
          <div className="relative mb-2 sm:mb-3">
            <label htmlFor="conversation-search" className="sr-only">
              Search by user or email
            </label>
            <Search className="w-4 h-4 text-gray-400 absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2" />
            <input
              id="conversation-search"
              name="conversation-search"
              type="text"
              placeholder="Search by user or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-base text-gray-900 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-indigo-500 sm:rounded-xl sm:py-2.5 sm:pl-10 sm:text-sm"
            />
          </div>
          <div className="flex gap-2 mb-2 sm:mb-3 overflow-x-auto scrollbar-hide -mx-1 px-1">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 rounded-lg text-xs font-medium flex items-center gap-1.5 transition min-h-[36px] whitespace-nowrap flex-shrink-0 ${
                statusFilter === 'all'
                  ? 'bg-indigo-600 text-white shadow-md'
                  : 'bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100 border border-gray-200'
              }`}
            >
              <Filter className="w-3.5 h-3.5 flex-shrink-0" />
              <span>All</span>
            </button>
            <button
              onClick={() => setStatusFilter('unread')}
              className={`px-3 rounded-lg text-xs font-medium transition min-h-[36px] whitespace-nowrap flex-shrink-0 ${
                statusFilter === 'unread'
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100 border border-gray-200'
              }`}
            >
              Unread
            </button>
            <button
              onClick={() => setStatusFilter('resolved')}
              className={`px-3 rounded-lg text-xs font-medium transition min-h-[36px] whitespace-nowrap flex-shrink-0 ${
                statusFilter === 'resolved'
                  ? 'bg-green-100 text-green-700 border border-green-200'
                  : 'bg-white text-gray-600 hover:bg-gray-50 active:bg-gray-100 border border-gray-200'
              }`}
            >
              Resolved
            </button>
          </div>
          {/* Label filter */}
          {allLabels.length > 0 && (
            <div className="mb-2 sm:mb-3">
              <LabelFilter allLabels={allLabels} selectedIds={labelFilterIds} onChange={setLabelFilterIds} />
            </div>
          )}
        </div>
        <div
          ref={sidebarScrollRef}
          onScroll={() => {
            // Only track genuine user scrolls, not programmatic scroll restoration
            if (!isRestoringScroll.current && sidebarScrollRef.current) {
              sidebarScrollTop.current = sidebarScrollRef.current.scrollTop;
            }
          }}
          className="flex-1 overflow-y-auto min-h-0"
        >
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
                      className={`w-full text-left px-3 sm:px-4 py-3 sm:py-4 transition-all active:bg-gray-50 ${
                        isActive 
                          ? 'bg-indigo-50 border-l-4 border-indigo-600' 
                          : 'hover:bg-gray-50 border-l-4 border-transparent'
                      }`}
                    >
                      <div className="flex items-start gap-2 sm:gap-3">
                        {/* User avatar */}
                        <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center flex-shrink-0 text-white text-xs sm:text-sm font-semibold"
                          style={{ backgroundColor: `hsl(${(conversation.name || '').split('').reduce((a, c) => a + c.charCodeAt(0), 0) % 360}, 65%, 55%)` }}>
                          {(conversation.name || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1">
                            <p className="text-xs sm:text-sm font-semibold text-gray-900 truncate">
                              {conversation.name || 'Unknown User'}
                            </p>
                            {conversation.unreadCount > 0 && (
                              // key on the count so the badge bounces once per change, then sits still
                              <span
                                key={conversation.unreadCount}
                                className="inline-flex items-center justify-center px-1.5 sm:px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500 text-white min-w-[18px] sm:min-w-[20px] animate-bounce-once"
                              >
                                {conversation.unreadCount}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] sm:text-xs text-gray-500 truncate mb-0.5">{conversation.email}</p>
                          {conversation.labels && conversation.labels.length > 0 && (
                            <div className="flex flex-wrap gap-0.5 mb-0.5">
                              {conversation.labels.slice(0, 3).map(label => (
                                <LabelBadge key={label._id} label={label} size="sm" />
                              ))}
                              {conversation.labels.length > 3 && (
                                <span className="text-[9px] text-gray-400">+{conversation.labels.length - 3}</span>
                              )}
                            </div>
                          )}
                          <p className="text-[11px] sm:text-xs text-gray-600 leading-relaxed line-clamp-2">
                            {conversation.lastMessage?.message 
                              ? linkify(decodeHtmlEntities(conversation.lastMessage.message), { linkClassName: 'underline text-indigo-600 hover:text-indigo-800 break-all' })
                              : conversation.lastMessage?.attachmentName 
                              ? conversation.lastMessage.attachmentName
                              : '(Attachment)'}
                          </p>
                        </div>
                        <div className="text-[9px] sm:text-[10px] text-gray-400 whitespace-nowrap flex-shrink-0 pt-0.5">
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
      <div className={`flex min-h-0 w-full flex-1 flex-col overflow-hidden border-0 bg-white shadow-lg sm:rounded-2xl sm:border sm:border-gray-200 ${showConversations && !selectedUserId ? 'hidden' : 'flex'} lg:flex lg:w-2/3`}>
        {selectedUserId ? (
          <>
            {(() => {
              const conv = conversationSummaries.find((c) => c.userId === selectedUserId);
              const hasBalance = typeof conv?.fortunePandaBalance === 'number';
              return (
                <div className="p-2 sm:p-3 lg:p-4 border-b border-gray-200 flex-shrink-0 bg-gradient-to-r from-indigo-50 to-purple-50">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 sm:gap-3 flex-1 min-w-0">
                      <button
                        onClick={() => {
                          setShowConversations(true);
                          setSelectedUserId(null);
                        }}
                        className="lg:hidden flex items-center justify-center min-w-[40px] min-h-[40px] text-gray-600 hover:bg-white active:bg-gray-100 rounded-lg transition flex-shrink-0"
                        title="Back to conversations"
                        aria-label="Back to conversations"
                      >
                        <ArrowLeft className="w-5 h-5" />
                      </button>
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base lg:text-lg font-semibold sm:font-bold text-gray-900 truncate">
                          {conv?.name || 'User'}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">
                          {conv?.email || 'No email on file'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
                      {/* Label selector */}
                      <LabelSelector
                        allLabels={allLabels}
                        selectedIds={(conv?.labels || []).map((l) => l._id)}
                        onChange={(ids) => handleAssignLabels(selectedUserId!, ids)}
                      />
                      {/* Notes button */}
                      <button
                        onClick={() => {
                          setNotesUserId(selectedUserId);
                          setNotesUserName(conv?.name || 'User');
                        }}
                        className="flex items-center justify-center gap-1 px-2.5 min-h-[36px] text-xs rounded-lg bg-amber-50 hover:bg-amber-100 active:bg-amber-200 text-amber-700 border border-amber-200 transition-colors"
                        title="View notes"
                        aria-label="View notes"
                      >
                        <StickyNote className="w-4 h-4" />
                        <span className="hidden sm:inline">Notes</span>
                      </button>
                      {/* Resolve: first tap arms an inline confirm, second tap resolves */}
                      {confirmResolve ? (
                        <div className="flex items-center gap-1 rounded-lg border border-green-300 bg-green-50 p-0.5">
                          <span className="hidden sm:inline px-1.5 text-xs font-medium text-green-800">Resolve?</span>
                          <button
                            onClick={handleResolveClick}
                            disabled={resolving}
                            className="flex items-center gap-1 px-2.5 min-h-[32px] rounded-md bg-green-600 text-white text-xs font-semibold hover:bg-green-700 active:bg-green-800 disabled:opacity-60"
                          >
                            {resolving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Yes
                          </button>
                          <button
                            onClick={() => setConfirmResolve(false)}
                            className="px-2.5 min-h-[32px] rounded-md text-xs font-medium text-green-800 hover:bg-green-100"
                          >
                            No
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={handleResolveClick}
                          disabled={resolving}
                          className="flex items-center justify-center gap-1.5 px-2.5 sm:px-3 lg:px-4 min-h-[36px] text-xs sm:text-sm font-medium text-green-700 bg-green-50 hover:bg-green-100 active:bg-green-200 border border-green-200 rounded-lg transition disabled:opacity-60"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span className="hidden sm:inline">Mark Resolved</span>
                          <span className="sm:hidden">Resolve</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Player context: FP account, balance, referral flag, deposit shortcut */}
                  {(conv?.fortunePandaUsername || hasBalance || conv?.joinedViaReferral || onOpenDeposit) && (
                    <div className="mt-2 flex items-center gap-2 overflow-x-auto scrollbar-hide -mx-1 px-1">
                      {hasBalance && (
                        <span className="inline-flex items-center gap-1 rounded-lg bg-white border border-green-200 px-2 min-h-[30px] text-xs font-semibold text-green-700 whitespace-nowrap flex-shrink-0">
                          <Wallet className="w-3.5 h-3.5" />
                          ${(conv!.fortunePandaBalance as number).toFixed(2)}
                        </span>
                      )}
                      {conv?.fortunePandaUsername && (
                        <span
                          className="inline-flex items-center rounded-lg bg-white border border-gray-200 px-2 min-h-[30px] text-xs font-mono text-gray-700 whitespace-nowrap flex-shrink-0"
                          title="FortunePanda account"
                        >
                          {conv.fortunePandaUsername}
                        </span>
                      )}
                      {conv?.joinedViaReferral && (
                        <span
                          className="inline-flex items-center gap-1 rounded-lg bg-purple-50 border border-purple-200 px-2 min-h-[30px] text-xs font-medium text-purple-700 whitespace-nowrap flex-shrink-0"
                          title="Joined through a referral link — eligible for the 70% first-deposit bonus"
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                          Referred · 70% 1st deposit
                        </span>
                      )}
                      {onOpenDeposit && (
                        <button
                          onClick={() => onOpenDeposit(selectedUserId!)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg bg-indigo-600 text-white px-3 min-h-[32px] text-xs font-semibold hover:bg-indigo-700 active:bg-indigo-800 whitespace-nowrap flex-shrink-0 shadow-sm"
                        >
                          <ArrowUp className="w-3.5 h-3.5" />
                          Deposit
                        </button>
                      )}
                    </div>
                  )}
                </div>
              );
            })()}

            <div 
              ref={messagesContainerRef}
              onScroll={handleAdminScroll}
              className="relative min-h-0 flex-1 overflow-y-auto overscroll-contain bg-white p-3 sm:bg-gray-50 sm:p-4"
            >
              {loadingConversation ? (
                <div className="space-y-4 py-4">
                  {/* Skeleton message placeholders */}
                  {[...Array(6)].map((_, i) => (
                    <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                      {i % 2 === 0 && <div className="w-8 h-8 rounded-full bg-gray-200 animate-pulse flex-shrink-0" />}
                      <div className={`rounded-2xl px-4 py-3 max-w-[65%] ${
                        i % 2 === 0 
                          ? 'bg-white border border-gray-100 rounded-bl-sm' 
                          : 'bg-indigo-50 rounded-br-sm'
                      }`}>
                        <div className="h-2.5 rounded bg-gray-200 animate-pulse mb-2" style={{ width: `${80 + (i % 3) * 40}px` }} />
                        <div className="h-2.5 rounded bg-gray-200/60 animate-pulse" style={{ width: `${50 + (i % 2) * 50}px` }} />
                        {i % 3 === 0 && <div className="h-2.5 rounded bg-gray-200/40 animate-pulse mt-2" style={{ width: `${40 + (i % 2) * 30}px` }} />}
                      </div>
                      {i % 2 !== 0 && <div className="w-8 h-8 rounded-full bg-indigo-100 animate-pulse flex-shrink-0" />}
                    </div>
                  ))}
                </div>
              ) : selectedConversationMessages.length === 0 && !loadingMore ? (
                <div className="text-center text-gray-500 py-12">
                  <MessageCircle className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="font-medium">No messages yet</p>
                  <p className="text-sm mt-1">Start the conversation...</p>
                </div>
              ) : (
                <>
                  {/* Load More -- inline pill at the top of the conversation */}
                  {hasMoreMessages[selectedUserId] === true && (
                    <div className="flex items-center justify-center gap-3 py-2 mb-3">
                      <div className="flex-1 border-t border-gray-200" />
                      <button
                        ref={loadMoreButtonRef}
                        onClick={() => loadConversation(selectedUserId, true)}
                        disabled={loadingMore}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-medium text-gray-500 bg-white border border-gray-200 rounded-full hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="w-3 h-3 animate-spin" />
                            <span>Loading...</span>
                          </>
                        ) : (
                          <>
                            <ChevronUp className="w-3 h-3" />
                            <span>Older messages</span>
                          </>
                        )}
                      </button>
                      <div className="flex-1 border-t border-gray-200" />
                    </div>
                  )}
                  {selectedConversationMessages.map((msg, index) => {
                    const isAdmin = msg.senderType === 'admin';
                    const isSystem = msg.senderType === 'system';

                    // Grouping logic
                    const prev = index > 0 ? selectedConversationMessages[index - 1] : null;
                    const next = index < selectedConversationMessages.length - 1 ? selectedConversationMessages[index + 1] : null;
                    const msgDate = new Date(msg.createdAt);
                    const prevDate = prev ? new Date(prev.createdAt) : null;
                    const showDateDivider = !prev || msgDate.toDateString() !== prevDate?.toDateString();
                    const isFirstInGroup = showDateDivider || !prev || prev.senderType !== msg.senderType ||
                      (msgDate.getTime() - (prevDate?.getTime() || 0)) > 120000;
                    const isLastInGroup = !next || next.senderType !== msg.senderType ||
                      (new Date(next.createdAt).getTime() - msgDate.getTime()) > 120000 ||
                      msgDate.toDateString() !== new Date(next.createdAt).toDateString();
                    
                    // Special rendering for system messages (bonus claims, etc.)
                    if (isSystem) {
                      const metaType = msg.metadata?.type || '';
                      const isLoanMsg = metaType.startsWith('loan_');
                      const systemLabel = msg.metadata?.source || (isLoanMsg ? 'Loan System' : 'System');
                      return (
                        <div key={msg.id}>
                          {showDateDivider && (
                            <div className="flex items-center justify-center my-3">
                              <div className="flex-1 border-t border-gray-200" />
                              <span className="px-3 text-xs font-medium text-gray-400">{formatDateDivider(msgDate)}</span>
                              <div className="flex-1 border-t border-gray-200" />
                            </div>
                          )}
                          <div ref={(el) => { messageRefs.current[msg.id] = el; }} className="flex justify-center my-4">
                            <div className={`max-w-[90%] px-4 py-3 rounded-xl shadow-md ${
                              isLoanMsg
                                ? 'bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-400'
                                : 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400'
                            }`}>
                              <div className="flex items-center gap-2 mb-2 flex-wrap">
                                <Gift className={`w-4 h-4 flex-shrink-0 ${isLoanMsg ? 'text-green-600' : 'text-yellow-600'}`} />
                                <span className={`text-xs font-semibold ${isLoanMsg ? 'text-green-800' : 'text-yellow-800'}`}>{systemLabel}</span>
                                <span className={`text-xs ${isLoanMsg ? 'text-green-600' : 'text-yellow-600'}`}>•</span>
                                <span className={`text-xs ${isLoanMsg ? 'text-green-600' : 'text-yellow-600'}`}>
                                  {msg.name || 'User'}
                                </span>
                                <span className={`text-xs ${isLoanMsg ? 'text-green-600' : 'text-yellow-600'}`}>•</span>
                                <span className={`text-xs ${isLoanMsg ? 'text-green-600' : 'text-yellow-600'}`} title={formatFullTime(msg.createdAt)}>
                                  {formatTime(msg.createdAt)}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleSystemCardReply(msg)}
                                  className={`ml-auto inline-flex items-center gap-1 rounded-md px-2 min-h-[28px] text-xs font-semibold transition ${
                                    isLoanMsg
                                      ? 'bg-green-600 text-white hover:bg-green-700 active:bg-green-800'
                                      : 'bg-yellow-500 text-white hover:bg-yellow-600 active:bg-yellow-700'
                                  }`}
                                  title="Reply to this request"
                                >
                                  <Reply className="w-3.5 h-3.5" />
                                  Reply
                                </button>
                              </div>
                              {msg.message && (
                                <p className={`text-sm font-medium whitespace-pre-wrap break-words ${isLoanMsg ? 'text-green-900' : 'text-yellow-900'}`}>
                                  {linkify(decodeHtmlEntities(msg.message), { linkClassName: `underline break-all ${isLoanMsg ? 'text-green-800 hover:text-green-900' : 'text-yellow-800 hover:text-yellow-900'}` })}
                                </p>
                              )}
                              {msg.metadata?.bonusTitle && (
                                <div className={`mt-2 pt-2 border-t ${isLoanMsg ? 'border-green-300' : 'border-yellow-300'}`}>
                                  <p className={`text-xs ${isLoanMsg ? 'text-green-700' : 'text-yellow-700'}`}>
                                    <span className="font-semibold">Bonus:</span> {msg.metadata.bonusTitle}
                                    {msg.metadata.bonusValue && (
                                      <span className="ml-2">({msg.metadata.bonusValue})</span>
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    
                    return (
                      <div key={msg.id}>
                        {showDateDivider && (
                          <div className="flex items-center justify-center my-3">
                            <div className="flex-1 border-t border-gray-200" />
                            <span className="px-3 text-xs font-medium text-gray-400">{formatDateDivider(msgDate)}</span>
                            <div className="flex-1 border-t border-gray-200" />
                          </div>
                        )}
                        <div
                          ref={(el) => { messageRefs.current[msg.id] = el; }}
                          className={`group flex ${isAdmin ? 'justify-end' : 'justify-start'} transition-all duration-500 rounded-lg animate-slide-up ${isFirstInGroup ? 'mt-3' : 'mt-0.5'}`}
                        >
                          <div className={`flex flex-col ${isAdmin ? 'items-end' : 'items-start'} max-w-[85%] sm:max-w-[70%]`}>
                          {/* Reply & React buttons — always visible on touch devices, hover-reveal on desktop */}
                          <div className="opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-1 mb-0.5">
                            <button
                              onClick={() => handleReply(msg)}
                              className="inline-flex items-center gap-1 px-1.5 min-h-[28px] rounded-md text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100"
                              title="Reply"
                            >
                              <Reply className="w-3.5 h-3.5" />
                              <span>Reply</span>
                            </button>
                            <div className="relative">
                              <button
                                onClick={() => { setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id); setEmojiExpanded(false); }}
                                className="inline-flex items-center justify-center min-w-[28px] min-h-[28px] rounded-md text-xs text-gray-500 hover:text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100"
                                title="React"
                                aria-label="React"
                              >
                                <SmilePlus className="w-3.5 h-3.5" />
                              </button>
                              {emojiPickerMsgId === msg.id && (
                                <div className={`absolute ${isAdmin ? 'right-0' : 'left-0'} bottom-full mb-1 rounded-xl shadow-lg z-[70] bg-white border border-gray-200 p-1.5`}>
                                  <div className="flex items-center gap-0.5">
                                    {QUICK_EMOJIS.map((emoji) => (
                                      <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="text-base hover:scale-110 active:scale-125 hover:bg-gray-100 transition-all rounded min-w-[32px] min-h-[32px] text-center">
                                        {emoji}
                                      </button>
                                    ))}
                                    {!emojiExpanded && (
                                      <button onClick={() => setEmojiExpanded(true)} className="text-sm text-gray-400 hover:text-indigo-600 hover:bg-gray-100 rounded min-w-[32px] min-h-[32px] transition-all" title="More emojis">+</button>
                                    )}
                                  </div>
                                  {emojiExpanded && (
                                    <div className="flex items-center gap-0.5 mt-0.5">
                                      {MORE_EMOJIS.map((emoji) => (
                                        <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="text-base hover:scale-110 active:scale-125 hover:bg-gray-100 transition-all rounded min-w-[32px] min-h-[32px] text-center">
                                          {emoji}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                          <div
                            className={`w-full px-4 py-3 rounded-2xl shadow-sm ${
                              isAdmin
                                ? 'bg-indigo-600 text-white rounded-br-sm'
                                : 'bg-white text-gray-900 border border-gray-200 rounded-bl-sm'
                            }`}
                          >
                            {/* Quoted reply */}
                            {msg.replyTo && (
                              <div
                                onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                                className="mb-2 px-3 py-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity border-l-2"
                                style={isAdmin
                                  ? { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.5)' }
                                  : { backgroundColor: 'rgba(99,102,241,0.08)', borderColor: '#6366F1' }
                                }
                              >
                                <p className="text-xs font-semibold mb-0.5" style={{ color: isAdmin ? 'rgba(255,255,255,0.9)' : '#6366F1' }}>
                                  {msg.replyTo.senderName || (msg.replyTo.senderType === 'admin' ? 'Support Team' : 'User')}
                                </p>
                                <p className={`text-xs line-clamp-2 ${isAdmin ? 'text-indigo-100' : 'text-gray-500'}`}>
                                  {msg.replyTo.message ? linkify(decodeHtmlEntities(msg.replyTo.message), { linkClassName: `underline break-all ${isAdmin ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'}` }) : '(Attachment)'}
                                </p>
                              </div>
                            )}
                            {isFirstInGroup && (
                              <div className="flex items-center gap-2 text-xs mb-2 opacity-90 flex-wrap">
                                <CircleDot className="w-3 h-3 flex-shrink-0" />
                                <span className="font-medium truncate">
                                  {isAdmin ? (msg.name || 'Support Team') : (msg.name || 'User')}
                                </span>
                              </div>
                            )}
                            {msg.message && (
                              <p className={`text-sm whitespace-pre-wrap break-words leading-relaxed ${
                                isAdmin ? 'text-white' : 'text-gray-900'
                              }`}>
                                {linkify(decodeHtmlEntities(msg.message), { linkClassName: `underline break-all ${isAdmin ? 'text-indigo-200 hover:text-white' : 'text-indigo-600 hover:text-indigo-800'}` })}
                              </p>
                            )}
                            {msg.attachmentUrl && (
                              <div className="mt-3">
                                {isImageAttachment(msg.attachmentType, msg.attachmentName) ? (
                                  <div
                                    onClick={() => setImageModal({ url: getAttachmentUrl(msg.attachmentUrl!), name: msg.attachmentName || 'Image' })}
                                    className="rounded-lg overflow-hidden max-w-full sm:max-w-xs cursor-pointer"
                                  >
                                    <img
                                      src={getAttachmentUrl(msg.attachmentUrl)}
                                      alt="attachment"
                                      className="w-full h-auto max-h-48 sm:max-h-64 object-cover rounded-lg opacity-0 transition-opacity duration-300"
                                      loading="lazy"
                                      onLoad={(e) => e.currentTarget.classList.replace('opacity-0', 'opacity-100')}
                                    />
                                  </div>
                                ) : (
                                  <a
                                    href={getAttachmentUrl(msg.attachmentUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className={`inline-flex items-center gap-2 text-xs font-semibold underline transition ${
                                      isAdmin ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'
                                    }`}
                                  >
                                    <FileText className="w-4 h-4" />
                                    <span>{msg.attachmentName || 'Download attachment'}</span>
                                  </a>
                                )}
                              </div>
                            )}
                            {isLastInGroup && (
                              <div
                                className={`mt-2 text-xs capitalize ${
                                  isAdmin ? 'text-indigo-100' : 'text-gray-500'
                                } flex items-center gap-2`}
                              >
                                <span title={formatFullTime(msg.createdAt)}>{formatTime(msg.createdAt)}</span>
                                <span>•</span>
                                <span>{msg.status}</span>
                              </div>
                            )}
                          </div>
                          {/* Reactions display */}
                          {msg.reactions && msg.reactions.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {Object.entries(
                                msg.reactions.reduce<Record<string, { count: number; reactors: string[]; mine: boolean }>>((acc, r) => {
                                  if (!acc[r.emoji]) acc[r.emoji] = { count: 0, reactors: [], mine: false };
                                  acc[r.emoji].count++;
                                  acc[r.emoji].reactors.push(r.reactorName || r.reactorType);
                                  if (r.reactorType === 'admin') acc[r.emoji].mine = true;
                                  return acc;
                                }, {})
                              ).map(([emoji, info]) => (
                                <button
                                  key={emoji}
                                  onClick={() => toggleReaction(msg.id, emoji)}
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                    info.mine
                                      ? 'border-indigo-400 bg-indigo-50'
                                      : 'border-gray-200 bg-gray-50 hover:bg-gray-100'
                                  }`}
                                  title={info.reactors.join(', ')}
                                >
                                  <span className="text-xs">{emoji}</span>
                                  <span className="text-[10px] text-gray-500">{info.count}</span>
                                </button>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      </div>
                    );
                  })}
                </>
              )}
              {/* Typing indicator */}
              {selectedUserId && typingUsers[selectedUserId] && (
                <div className="flex justify-start mt-2">
                  <div className="rounded-2xl rounded-bl-sm bg-white border border-gray-200 px-4 py-2.5 shadow-sm">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-gray-500 mr-1">{typingUsers[selectedUserId]}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-dot" style={{ animationDelay: '0ms' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-dot" style={{ animationDelay: '0.2s' }} />
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-typing-dot" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
              {/* Scroll-to-bottom floating button */}
              <button
                onClick={scrollToBottom}
                className={`sticky bottom-2 left-1/2 -translate-x-1/2 z-10 flex items-center justify-center w-11 h-11 rounded-full bg-white shadow-lg border border-gray-200 transition-all duration-200 hover:scale-105 active:scale-95 mx-auto ${showScrollBottom ? 'opacity-90 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
                title="Scroll to latest"
                aria-label={newMsgCount > 0 ? `${newMsgCount} new messages — scroll to latest` : 'Scroll to latest'}
              >
                <ChevronDown className="w-5 h-5 text-indigo-600" />
                {newMsgCount > 0 && (
                  <span key={newMsgCount} className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-bounce-once">
                    {newMsgCount > 9 ? '9+' : newMsgCount}
                  </span>
                )}
              </button>
            </div>

            <div className="flex-shrink-0 space-y-1.5 border-t border-gray-200 bg-white p-2 sm:space-y-3 sm:p-4">
              {/* Reply preview */}
              {replyingTo && (
                <div className={`flex items-center gap-2 px-3 py-2 bg-indigo-50 rounded-xl border-l-2 border-indigo-500 ${closingReply ? 'animate-slide-out-right' : 'animate-slide-up'}`}>
                  <Reply className="w-4 h-4 text-indigo-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-indigo-700">
                      Replying to {replyingTo.senderType === 'admin' ? (replyingTo.name || 'Support Team') : (replyingTo.name || 'User')}
                    </p>
                    <p className="text-xs text-indigo-500 truncate">
                      {replyingTo.message ? linkify(decodeHtmlEntities(replyingTo.message), { linkClassName: 'underline text-indigo-600 hover:text-indigo-700 break-all' }) : '(Attachment)'}
                    </p>
                  </div>
                  <button
                    onClick={() => { setClosingReply(true); setTimeout(() => { setReplyingTo(null); setClosingReply(false); }, 200); }}
                    className="flex items-center justify-center min-w-[32px] min-h-[32px] rounded-md text-indigo-400 hover:text-indigo-700 hover:bg-indigo-100 flex-shrink-0"
                    aria-label="Cancel reply"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}
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
              {/* Canned replies for the deposit / withdraw / bonus flows */}
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1" aria-label="Quick replies">
                <Zap className="w-3.5 h-3.5 text-indigo-400 flex-shrink-0" aria-hidden />
                {CANNED_REPLIES.map((reply) => (
                  <button
                    key={reply.label}
                    type="button"
                    onClick={() => {
                      const conv = conversationSummaries.find((c) => c.userId === selectedUserId);
                      const firstName = (conv?.name || 'there').split(' ')[0];
                      insertIntoComposer(reply.text(firstName));
                    }}
                    className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-3 min-h-[32px] text-xs font-medium text-indigo-700 hover:bg-indigo-100 active:bg-indigo-200 whitespace-nowrap flex-shrink-0 transition"
                  >
                    {reply.label}
                  </button>
                ))}
              </div>
              <div className="flex items-end gap-2 sm:gap-3">
                <label htmlFor="message-input" className="sr-only">
                  Type your message
                </label>
                <div className="flex-1 min-w-0 relative">
                  <textarea
                    id="message-input"
                    name="message-input"
                    ref={composerRef}
                    value={messageInput}
                    onChange={(e) => { setMessageInput(e.target.value); emitTyping(); }}
                    onPaste={handlePaste}
                    onKeyDown={handleKeyDown}
                    onFocus={() => {
                      // iOS scrolls the page to reveal a focused field, which slides the
                      // player header off the top. The shell is already sized to the visible
                      // area, so put the page back.
                      window.scrollTo(0, 0);
                      requestAnimationFrame(() => window.scrollTo(0, 0));
                    }}
                    rows={1}
                    placeholder="Type your message…"
                    className="w-full min-h-[44px] rounded-xl border border-gray-200 px-3 sm:px-4 py-2.5 sm:py-3 text-base md:text-sm leading-snug text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none bg-white sm:bg-gray-50"
                    style={{ maxHeight: COMPOSER_MAX_HEIGHT }}
                    maxLength={2000}
                  />
                  {messageInput.length > 1500 && (
                    <span className={`absolute right-2 -top-4 text-[10px] ${
                      messageInput.length > 1950 ? 'text-red-500' : messageInput.length > 1800 ? 'text-yellow-500' : 'text-gray-400'
                    }`}>
                      {messageInput.length}/2000
                    </span>
                  )}
                </div>
                <div className="flex flex-row gap-1.5 sm:gap-2 flex-shrink-0">
                  <label
                    htmlFor="attachment-input"
                    className="flex items-center justify-center text-gray-600 cursor-pointer hover:text-indigo-600 transition-all rounded-xl hover:bg-gray-100 active:bg-gray-200 min-w-[44px] min-h-[44px] active:scale-95"
                    aria-label="Attach a file"
                    title="Attach a file"
                  >
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
                    className="inline-flex items-center justify-center gap-2 px-3 sm:px-4 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 active:bg-indigo-800 active:scale-95 transition disabled:opacity-50 disabled:cursor-not-allowed shadow-md min-w-[44px] min-h-[44px]"
                    aria-label="Send message"
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
                className="mt-2 lg:hidden flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 active:bg-indigo-800 transition"
              >
                <ArrowLeft className="w-4 h-4" />
                Show Conversations
              </button>
            )}
          </div>
        )}

        {/* Image Modal */}
        {imageModal && (
          <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black bg-opacity-90 p-2 sm:p-4"
            onClick={() => setImageModal(null)}
          >
            <div className="relative w-full h-full flex items-center justify-center">
              <button
                onClick={() => setImageModal(null)}
                className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white hover:text-gray-300 z-10 bg-black bg-opacity-70 rounded-full p-2 sm:p-3 touch-manipulation"
                aria-label="Close image"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
              <img
                src={imageModal.url}
                alt={imageModal.name}
                className="max-w-full max-h-[95vh] sm:max-h-[90vh] w-auto h-auto object-contain"
                onClick={(e) => e.stopPropagation()}
                style={{ touchAction: 'none' }}
              />
            </div>
          </div>
        )}

        {/* User Notes Panel */}
        <UserNotesPanel
          userId={notesUserId || ''}
          userName={notesUserName}
          isOpen={!!notesUserId}
          onClose={() => setNotesUserId(null)}
          authType="session"
        />
      </div>
    </div>
  );
};

export default AdminChatPanel;
