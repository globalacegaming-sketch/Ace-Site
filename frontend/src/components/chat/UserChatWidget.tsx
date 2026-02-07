import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, Send, Paperclip, X, Loader2, FileText, Gift, Image as ImageIcon, Download, Reply, SmilePlus } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getApiBaseUrl, getWsBaseUrl, getAttachmentUrl, isImageAttachment } from '../../utils/api';
import { oneSignalRequestPermission } from '../../services/oneSignal';

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
  };
}

const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🎉'];

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const UserChatWidget = () => {
  const { isAuthenticated, token, user, checkSession, logout } = useAuthStore();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const [isMobile, setIsMobile] = useState(false);
  const [imageModal, setImageModal] = useState<{ url: string; name: string } | null>(null);

  // Hide widget on admin/agent pages
  const isAdminOrAgentPage = useMemo(() => {
    return location.pathname.startsWith('/aceadmin') || 
           location.pathname.startsWith('/aceagent');
  }, [location.pathname]);

  // Check if user has admin role (agents use separate session, so they won't be in user store)
  const isAdminUser = useMemo(() => {
    return user?.role === 'admin' || user?.role === 'moderator';
  }, [user?.role]);

  // Check if on mobile (hide widget on mobile)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024); // lg breakpoint
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const API_BASE_URL = useMemo(() => getApiBaseUrl(), []);
  const WS_BASE_URL = useMemo(() => getWsBaseUrl(), []);
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

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!token) return;
    try {
      await axios.post(`${API_BASE_URL}/chat/messages/${messageId}/reactions`, { emoji }, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch {
      toast.error('Failed to react');
    }
    setEmojiPickerMsgId(null);
  }, [token, API_BASE_URL]);

  useEffect(() => {
    if (!isOpen) return;
    scrollToBottom();
  }, [messages, isOpen]);

  useEffect(() => {
    // Disconnect if not authenticated, on admin/agent pages, or if user is admin
    if (!isAuthenticated || !token || isAdminOrAgentPage || isAdminUser) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      setMessages([]);
      return;
    }

    // withCredentials sends session cookie for shared session auth;
    // auth.token kept as fallback for backward compatibility.
    const socket = io(WS_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
      withCredentials: true,
      autoConnect: true
    });

    socket.on('connect_error', (err) => {
      console.error('Chat socket connection error', err);
    });

    socket.on('chat:message:new', (message: ChatMessage) => {
      setMessages((prev) => {
        const exists = prev.some((item) => item.id === message.id);
        if (exists) return prev;
        const updated = [...prev, message].sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
        
        // Play notification sound if message is from admin
        if (message.senderType === 'admin') {
          playNotificationSound();
        }
        
        return updated;
      });
    });

    socket.on('chat:message:status', (message: ChatMessage) => {
      setMessages((prev) =>
        prev.map((item) => (item.id === message.id ? { ...item, status: message.status } : item))
      );
    });

    socket.on('chat:reaction:update', (data: { messageId: string; reactions: ChatMessage['reactions'] }) => {
      setMessages((prev) => prev.map((m) => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
    // NOTE: isOpen is intentionally NOT in this dependency array.
    // Previously it was, which caused the socket to disconnect and reconnect
    // every time the widget was opened/closed (~500ms-1s overhead per toggle).
    // The socket should stay connected regardless of widget visibility so
    // real-time messages arrive even when the widget is closed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [WS_BASE_URL, isAuthenticated, token, isAdminOrAgentPage, isAdminUser]);

  const loadMessages = async () => {
    if (!token) return;

    // Check if session is still valid before making request
    if (!checkSession()) {
      // Session expired, don't try to load messages
      return;
    }

    try {
      setIsLoading(true);
      // Load all messages with a high limit
      const response = await axios.get(`${API_BASE_URL}/chat/messages`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          limit: 50, // Load recent messages (not all 1000)
          page: 1
        }
      });

      if (response.data.success) {
        const data: ChatMessage[] = response.data.data || [];
        const sorted = data
          .slice()
          .sort(
            (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
          );
        setMessages(sorted);
      }
    } catch (error: any) {
      console.error('Failed to load chat messages', error);
      
      // Handle 401 (unauthorized) - session expired
      if (error.response?.status === 401) {
        // Don't show toast for 401, session manager will handle it
        // Just silently fail
        return;
      } else {
        // Only show error if widget is open or user is on chat page
        // Don't spam errors on every page
        if (isOpen || location.pathname === '/chat') {
          toast.error('Unable to load chat history right now.', {
            duration: 3000,
            position: 'bottom-right' // Move to bottom-right to avoid blocking header
          });
        }
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Lazy-load messages only when the widget is OPENED (not on every page mount).
  // Previously this loaded 1000 messages on every page navigation, which was
  // the single biggest source of slowness for authenticated users.
  useEffect(() => {
    if (
      isOpen && // Only fetch when the user actually opens the chat
      isAuthenticated && 
      token && 
      !isAdminOrAgentPage && 
      !isAdminUser &&
      messages.length === 0 && 
      !isLoading &&
      checkSession()
    ) {
      void loadMessages();
    }
  }, [isOpen, isAuthenticated, token, isAdminOrAgentPage, isAdminUser]);

  const handleToggle = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to contact support.');
      return;
    }
    const opening = !isOpen;
    setIsOpen((prev) => !prev);
    // Request push permission when opening chat (contextual, non-blocking)
    if (opening) {
      oneSignalRequestPermission().catch(() => {});
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      setAttachment(null);
      return;
    }

    if (file.size > MAX_ATTACHMENT_SIZE) {
      toast.error('File size must be under 10MB.');
      event.target.value = '';
      return;
    }

    setAttachment(file);
  };

  const handleSendMessage = async () => {
    if (!token || sending) return;

    // Check if session is still valid before sending
    if (!checkSession()) {
      logout();
      toast.error('Your session has expired. Please login again to send messages.');
      return;
    }

    if (!inputValue.trim() && !attachment) {
      toast.error('Please enter a message or attach a file.');
      return;
    }

    try {
      setSending(true);
      const formData = new FormData();

      if (inputValue.trim()) {
        formData.append('message', inputValue.trim());
      }
      if (attachment) {
        formData.append('attachment', attachment);
      }
      if (replyingTo) {
        formData.append('replyToMessageId', replyingTo.id);
      }

      await axios.post(`${API_BASE_URL}/chat/messages`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setInputValue('');
      setAttachment(null);
      setReplyingTo(null);
      toast.success('Message sent');
    } catch (error: any) {
      console.error('Failed to send chat message', error);
      
      // Handle 401 (unauthorized) - session expired
      if (error.response?.status === 401) {
        logout();
        // Don't show toast here, session manager will handle it
        return;
      } else {
        // Only show error if widget is open or user is on chat page
        if (isOpen || location.pathname === '/chat') {
          toast.error('Failed to send message. Please try again.', {
            duration: 3000,
            position: 'bottom-right' // Move to bottom-right to avoid blocking header
          });
        }
      }
    } finally {
      setSending(false);
    }
  };

  // Don't show widget if not authenticated, on admin/agent pages, if user is admin, or on mobile
  if (!isAuthenticated || isAdminOrAgentPage || isAdminUser || isMobile) {
    return null;
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 hidden lg:block">
      {isOpen && (
        <div className="mb-4 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          <div className="bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-4 py-3 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium opacity-80">Support Chat</p>
              <p className="text-lg font-semibold">Global Ace Gaming</p>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="flex-1 max-h-96 overflow-y-auto p-4 space-y-4 bg-gray-50">
            {isLoading ? (
              <div className="flex items-center justify-center py-10 text-gray-500">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                Loading conversation...
              </div>
            ) : messages.length === 0 ? (
              <div className="rounded-xl bg-white shadow-sm p-6 text-center text-gray-500">
                <MessageCircle className="w-8 h-8 mx-auto mb-2 text-indigo-500" />
                <p className="font-medium">No messages yet</p>
                <p className="text-sm">Start the conversation and our support team will respond.</p>
              </div>
            ) : (
              <>
                {messages.map((msg) => {
                  const isUser = msg.senderType === 'user';
                  const isSystem = msg.senderType === 'system';
                  const timestamp = formatTime(msg.createdAt);
                  const displayName = isUser 
                    ? (user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`.trim() 
                        : user?.username || 'You') 
                    : (msg.name || 'Support Team');

                  // Special rendering for system messages (bonus claims, etc.)
                  if (isSystem) {
                    const systemDisplayName = isUser 
                      ? (user?.firstName && user?.lastName 
                          ? `${user.firstName} ${user.lastName}`.trim() 
                          : user?.username || 'You') 
                      : (msg.name || 'User');
                    
                    return (
                      <div key={msg.id} className="flex justify-center my-3">
                        <div className="max-w-[90%] px-4 py-3 rounded-xl shadow-lg bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400">
                          <div className="flex items-center gap-2 mb-1">
                            <Gift className="w-4 h-4 text-yellow-600 flex-shrink-0" />
                            <span className="text-xs font-semibold text-yellow-800">{systemDisplayName}</span>
                            <span className="text-[10px] text-yellow-600">•</span>
                            <span className="text-[10px] text-yellow-600">{timestamp}</span>
                          </div>
                          {msg.message && (
                            <p className="text-sm font-medium text-yellow-900 whitespace-pre-wrap break-words">{decodeHtmlEntities(msg.message)}</p>
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
                    <div
                      key={msg.id}
                      ref={(el) => { messageRefs.current[msg.id] = el; }}
                      className={`group flex ${isUser ? 'justify-end' : 'justify-start'} transition-all duration-500 rounded-lg`}
                    >
                      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[80%]`}>
                        {/* Reply & React buttons */}
                        <div className="opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-2 mb-0.5 px-1">
                          <button
                            onClick={() => handleReply(msg)}
                            className="text-xs text-gray-400 hover:text-indigo-600 flex items-center gap-1"
                            title="Reply"
                          >
                            <Reply className="w-3 h-3" />
                            <span>Reply</span>
                          </button>
                          <div className="relative">
                            <button
                              onClick={() => setEmojiPickerMsgId(emojiPickerMsgId === msg.id ? null : msg.id)}
                              className="text-xs text-gray-400 hover:text-indigo-600 flex items-center"
                              title="React"
                            >
                              <SmilePlus className="w-3 h-3" />
                            </button>
                            {emojiPickerMsgId === msg.id && (
                              <div className={`absolute ${isUser ? 'right-0' : 'left-0'} bottom-full mb-1 flex gap-1 px-2 py-1.5 rounded-full shadow-lg z-50 bg-white border border-gray-200`}>
                                {QUICK_EMOJIS.map((emoji) => (
                                  <button key={emoji} onClick={() => toggleReaction(msg.id, emoji)} className="text-sm hover:scale-125 transition-transform px-0.5">
                                    {emoji}
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        </div>
                        <div
                          className={`rounded-2xl px-4 py-3 shadow-sm ${
                            isUser
                              ? 'bg-indigo-600 text-white rounded-br-sm'
                              : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm'
                          }`}
                        >
                          {/* Quoted reply */}
                          {msg.replyTo && (
                            <div
                              onClick={() => scrollToMessage(msg.replyTo!.messageId)}
                              className="mb-2 px-2.5 py-1.5 rounded-md cursor-pointer hover:opacity-80 transition-opacity border-l-2"
                              style={isUser
                                ? { backgroundColor: 'rgba(255,255,255,0.15)', borderColor: 'rgba(255,255,255,0.5)' }
                                : { backgroundColor: 'rgba(99,102,241,0.08)', borderColor: '#6366F1' }
                              }
                            >
                              <p className="text-[10px] font-semibold mb-0.5" style={{ color: isUser ? 'rgba(255,255,255,0.9)' : '#6366F1' }}>
                                {msg.replyTo.senderName || (msg.replyTo.senderType === 'user' ? 'You' : 'Support')}
                              </p>
                              <p className={`text-[11px] line-clamp-2 ${isUser ? 'text-indigo-100' : 'text-gray-500'}`}>
                                {msg.replyTo.message ? decodeHtmlEntities(msg.replyTo.message) : '(Attachment)'}
                              </p>
                            </div>
                          )}
                          <p className="text-xs font-semibold mb-1 opacity-90">
                            {displayName}
                          </p>
                          {msg.message && (
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {decodeHtmlEntities(msg.message)}
                            </p>
                          )}
                          {msg.attachmentUrl && (
                            <div className="mt-3">
                              {isImageAttachment(msg.attachmentType, msg.attachmentName) ? (
                                <div className="space-y-2">
                                  <div
                                    onClick={() => setImageModal({ url: getAttachmentUrl(msg.attachmentUrl!), name: msg.attachmentName || 'Image' })}
                                    className="block rounded-lg overflow-hidden border-2 border-opacity-20 hover:border-opacity-40 active:border-opacity-60 transition-all max-w-full sm:max-w-md cursor-pointer touch-manipulation"
                                  >
                                    <img
                                      src={getAttachmentUrl(msg.attachmentUrl)}
                                      alt={msg.attachmentName || 'Image attachment'}
                                      className="w-full h-auto max-h-48 sm:max-h-64 object-contain"
                                      loading="lazy"
                                    />
                                  </div>
                                  <a
                                    href={getAttachmentUrl(msg.attachmentUrl)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={msg.attachmentName}
                                    className={`inline-flex items-center gap-2 text-xs font-medium underline ${
                                      isUser ? 'text-indigo-200 hover:text-indigo-100' : 'text-indigo-600 hover:text-indigo-700'
                                    }`}
                                  >
                                    <ImageIcon className="w-3 h-3" />
                                    <span>{msg.attachmentName || 'Download image'}</span>
                                  </a>
                                </div>
                              ) : (
                                <a
                                  href={getAttachmentUrl(msg.attachmentUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className={`flex items-center gap-2 text-sm font-medium underline ${
                                    isUser ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'
                                  }`}
                                >
                                  <FileText className="w-4 h-4" />
                                  {msg.attachmentName || 'Download attachment'}
                                </a>
                              )}
                            </div>
                          )}
                          <div
                            className={`mt-2 text-[11px] ${
                              isUser ? 'text-indigo-100' : 'text-gray-500'
                            } flex items-center justify-between gap-2`}
                          >
                            <span>{timestamp}</span>
                            {!isUser && <span className="capitalize">{msg.status}</span>}
                          </div>
                        </div>
                        {/* Reactions display */}
                        {msg.reactions && msg.reactions.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-0.5">
                            {Object.entries(
                              msg.reactions.reduce<Record<string, { count: number; reactors: string[]; mine: boolean }>>((acc, r) => {
                                if (!acc[r.emoji]) acc[r.emoji] = { count: 0, reactors: [], mine: false };
                                acc[r.emoji].count++;
                                acc[r.emoji].reactors.push(r.reactorName || r.reactorType);
                                if (r.reactorId === user?.id && r.reactorType === 'user') acc[r.emoji].mine = true;
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
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white p-4 space-y-3">
            {/* Reply preview */}
            {replyingTo && (
              <div className="flex items-center gap-2 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl border-l-2 border-indigo-500">
                <Reply className="w-4 h-4 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold">
                    {replyingTo.senderType === 'user'
                      ? (user?.firstName || user?.username || 'You')
                      : (replyingTo.name || 'Support')}
                  </p>
                  <p className="text-xs text-indigo-500 truncate">
                    {replyingTo.message ? decodeHtmlEntities(replyingTo.message) : '(Attachment)'}
                  </p>
                </div>
                <button
                  onClick={() => setReplyingTo(null)}
                  className="text-indigo-400 hover:text-indigo-700 flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            {attachment && (
              <div className="flex items-center justify-between text-sm px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl">
                <div className="flex items-center gap-2">
                  <Paperclip className="w-4 h-4" />
                  <span className="truncate max-w-[180px]">{attachment.name}</span>
                </div>
                <button
                  onClick={() => setAttachment(null)}
                  className="text-indigo-600 hover:text-indigo-800"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
            <textarea
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent resize-none"
              placeholder="Type your message..."
            />
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer hover:text-indigo-600">
                <Paperclip className="w-4 h-4" />
                <span>Attach file</span>
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
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Send
              </button>
            </div>
          </div>
        </div>
      )}

      <button
        onClick={handleToggle}
        className="flex items-center justify-center w-14 h-14 rounded-full shadow-lg bg-gradient-to-r from-indigo-600 to-blue-600 text-white hover:scale-105 transition-transform"
      >
        <MessageCircle className="w-6 h-6" />
      </button>

      {/* Image Modal */}
      {imageModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-2 sm:p-4"
          onClick={() => setImageModal(null)}
        >
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Close Button */}
            <button
              onClick={() => setImageModal(null)}
              className="absolute top-2 right-2 sm:top-4 sm:right-4 text-white hover:text-gray-300 z-10 bg-black bg-opacity-70 hover:bg-opacity-90 rounded-full p-2 sm:p-3 touch-manipulation transition-all"
              aria-label="Close image"
            >
              <X className="w-5 h-5 sm:w-6 sm:h-6" />
            </button>
            
            {/* Download Button */}
            <a
              href={imageModal.url}
              download={imageModal.name}
              onClick={(e) => e.stopPropagation()}
              className="absolute bottom-4 right-4 sm:bottom-6 sm:right-6 text-white hover:text-gray-300 z-10 bg-black bg-opacity-70 hover:bg-opacity-90 rounded-full p-2 sm:p-3 touch-manipulation transition-all"
              aria-label="Download image"
            >
              <Download className="w-5 h-5 sm:w-6 sm:h-6" />
            </a>
            
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
    </div>
  );
};

export default UserChatWidget;

