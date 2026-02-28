import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, Loader2, FileText, MessageCircle, X, Reply, SmilePlus, ChevronDown, Check, CheckCheck } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl, getWsBaseUrl, getAttachmentUrl, isImageAttachment } from '../utils/api';
import { linkify } from '../utils/linkify';
import { oneSignalRequestPermission } from '../services/oneSignal';

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

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

/** Format a date for the divider between message groups */
const formatDateDivider = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return 'Today';
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

const Chat = () => {
  const { isAuthenticated, token, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [imageModal, setImageModal] = useState<{ url: string; name: string } | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [emojiPickerMsgId, setEmojiPickerMsgId] = useState<string | null>(null);
  const [emojiExpanded, setEmojiExpanded] = useState(false);
  const [closingReply, setClosingReply] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [showScrollBottom, setShowScrollBottom] = useState(false);
  const [newMsgCount, setNewMsgCount] = useState(0);
  const [isAdminTyping, setIsAdminTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingEmitRef = useRef(0);
  const initialLoadRef = useRef(true); // Track first message load to force-scroll

  const API_BASE_URL = useMemo(() => getApiBaseUrl(), []);
  const WS_BASE_URL = useMemo(() => getWsBaseUrl(), []);
  const audioContextRef = useRef<AudioContext | null>(null);

  // Check if mobile
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Request push permission when on Chat page (contextual; no-op if already granted)
  useEffect(() => {
    if (isAuthenticated) {
      oneSignalRequestPermission().catch(() => {});
    }
  }, [isAuthenticated]);

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
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }

      const audioContext = audioContextRef.current;
      
      if (audioContext.state === 'suspended') {
        audioContext.resume().catch(() => {
          console.log('Could not resume audio context');
        });
      }

      const playTone = (frequency: number, startTime: number, duration: number) => {
        const oscillator = audioContext.createOscillator();
        const gainNode = audioContext.createGain();
        
        oscillator.connect(gainNode);
        gainNode.connect(audioContext.destination);
        
        oscillator.frequency.value = frequency;
        oscillator.type = 'sine';
        
        gainNode.gain.setValueAtTime(0.3, startTime);
        gainNode.gain.exponentialRampToValueAtTime(0.01, startTime + duration);
        
        oscillator.start(startTime);
        oscillator.stop(startTime + duration);
      };

      const now = audioContext.currentTime;
      playTone(800, now, 0.1);
      playTone(1000, now + 0.1, 0.1);
    } catch (error) {
      console.log('Could not play notification sound:', error);
    }
  }, []);


  // Check if user is scrolled near the bottom
  const isNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 200;
  }, []);

  // Scroll to bottom of messages
  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    setNewMsgCount(0);
    setShowScrollBottom(false);
  }, []);

  // Track scroll position
  const handleScroll = useCallback(() => {
    setShowScrollBottom(!isNearBottom());
  }, [isNearBottom]);

  // Decode HTML entities (like &#x27; for apostrophe) for display
  // This safely decodes entities that were escaped by the backend sanitization
  const decodeHtmlEntities = useCallback((text: string): string => {
    if (!text) return text;
    // Create a temporary textarea to decode HTML entities safely
    // This is safe because we're only decoding text that came from our own sanitized backend
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    const decoded = textarea.value;
    // Clean up
    textarea.remove();
    return decoded;
  }, []);

  const handleReply = useCallback((msg: ChatMessage) => {
    setReplyingTo(msg);
    textareaRef.current?.focus();
  }, []);

  const scrollToMessage = useCallback((messageId: string) => {
    const el = messageRefs.current[messageId];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-2', 'ring-yellow-400', 'ring-opacity-80');
      setTimeout(() => {
        el.classList.remove('ring-2', 'ring-yellow-400', 'ring-opacity-80');
      }, 2000);
    }
  }, []);

  // Emit typing start/stop with debounce
  const emitTyping = useCallback(() => {
    const now = Date.now();
    if (now - lastTypingEmitRef.current < 2000) return; // throttle to 2s
    lastTypingEmitRef.current = now;
    socketRef.current?.emit('chat:typing:start');
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit('chat:typing:stop');
    }, 3000);
  }, []);

  const toggleReaction = useCallback(async (messageId: string, emoji: string) => {
    if (!token) return;
    try {
      await axios.post(`${API_BASE_URL}/chat/messages/${messageId}/reactions`, { emoji }, {
        headers: { Authorization: `Bearer ${token}` },
        withCredentials: true
      });
    } catch (err: any) {
      const msg = err?.response?.data?.message || 'Failed to react';
      console.error('Reaction error:', err?.response?.status, msg);
      toast.error(msg);
    }
    setEmojiPickerMsgId(null);
  }, [token, API_BASE_URL]);

  useEffect(() => {
    if (messages.length === 0) return;
    // On initial load, always jump to the latest message
    if (initialLoadRef.current) {
      initialLoadRef.current = false;
      // Use setTimeout to let the DOM render the messages first
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'auto' });
        setNewMsgCount(0);
        setShowScrollBottom(false);
      }, 50);
      return;
    }
    if (isNearBottom()) {
      scrollToBottom();
    } else {
      // If scrolled up and new messages come in, increment the badge
      setNewMsgCount((c) => c + 1);
    }
  }, [messages.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Socket connection
  useEffect(() => {
    if (!isAuthenticated || !token) {
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
      auth: {
        token
      },
      withCredentials: true,
      transports: ['websocket', 'polling']
    });

    socketRef.current = socket;

    socket.on('connect', () => {
      console.log('Chat socket connected');
    });

    socket.on('chat:message:new', (message: ChatMessage) => {
      setMessages((prev) => {
        const exists = prev.some((m) => m.id === message.id);
        if (exists) return prev;
        const updated = [...prev, message];
        return updated.sort(
          (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
        );
      });
      
      // Play sound if message is from admin
      if (message.senderType === 'admin') {
        playNotificationSound();
      }
    });

    socket.on('chat:reaction:update', (data: { messageId: string; reactions: ChatMessage['reactions'] }) => {
      setMessages((prev) => prev.map((m) => m.id === data.messageId ? { ...m, reactions: data.reactions } : m));
    });

    socket.on('chat:typing:start', (data: { senderType: string }) => {
      if (data.senderType === 'admin') setIsAdminTyping(true);
    });
    socket.on('chat:typing:stop', (data: { senderType: string }) => {
      if (data.senderType === 'admin') setIsAdminTyping(false);
    });

    socket.on('disconnect', () => {
      console.log('Chat socket disconnected');
    });

    socket.on('error', (error) => {
      console.error('Chat socket error:', error);
    });

    return () => {
      socket.disconnect();
    };
  }, [WS_BASE_URL, isAuthenticated, token, playNotificationSound]);

  const loadMessages = async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      const response = await axios.get(`${API_BASE_URL}/chat/messages`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          limit: 50,
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
    } catch (error) {
      console.error('Failed to load chat messages', error);
      toast.error('Unable to load chat history right now.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated && token && messages.length === 0 && !isLoading) {
      void loadMessages();
    }
  }, [isAuthenticated, token]);

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
          toast.success('Image pasted from clipboard');
        }
        break;
      }
    }
  }, []);

  const handleSendMessage = async () => {
    if (!token || sending) return;

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
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Failed to send chat message', error);
      toast.error('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 flex items-center justify-center" style={{ 
        background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)'
      }}>
        <div className="text-center px-4">
          <MessageCircle className="w-16 h-16 mx-auto mb-4 casino-text-secondary" />
          <h2 className="text-2xl font-bold casino-text-primary mb-2">Please Sign In</h2>
          <p className="casino-text-secondary">You need to be signed in to use the chat.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden" style={{ 
      background: 'linear-gradient(135deg, #1B1B2F 0%, #2C2C3A 50%, #1B1B2F 100%)',
      width: '100%',
      position: 'absolute',
      top: '50px',
      left: 0,
      right: 0,
      bottom: isMobile ? 'calc(56px + env(safe-area-inset-bottom, 0px))' : '0'
    }}>
      {/* Decorative glowing orbs - static to prevent blinking */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-8" style={{ backgroundColor: '#6A1B9A' }}></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-8" style={{ backgroundColor: '#00B0FF' }}></div>
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-6" style={{ backgroundColor: '#FFD700' }}></div>
      </div>

      {/* Scrollable Messages Container */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 relative min-h-0">
        <div className="max-w-4xl mx-auto">
          {isLoading ? (
            <div className="space-y-4 py-4">
              {/* Skeleton message placeholders */}
              {[...Array(5)].map((_, i) => (
                <div key={i} className={`flex items-end gap-2 ${i % 2 === 0 ? 'justify-start' : 'justify-end'}`}>
                  {i % 2 === 0 && <div className="w-8 h-8 rounded-full bg-gray-700/40 animate-pulse flex-shrink-0" />}
                  <div className={`rounded-2xl px-4 py-3 ${i % 2 === 0 ? 'rounded-bl-sm' : 'rounded-br-sm'}`}
                    style={{ backgroundColor: i % 2 === 0 ? '#1B1B2F' : 'rgba(255,215,0,0.2)' }}>
                    <div className="h-3 rounded bg-gray-600/40 animate-pulse mb-2" style={{ width: `${80 + (i % 3) * 40}px` }} />
                    <div className="h-3 rounded bg-gray-600/30 animate-pulse" style={{ width: `${60 + (i % 2) * 50}px` }} />
                  </div>
                  {i % 2 !== 0 && <div className="w-8 h-8 rounded-full bg-gray-700/40 animate-pulse flex-shrink-0" />}
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageCircle className="w-16 h-16 casino-text-secondary mb-4 opacity-50" />
              <p className="casino-text-secondary">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((message, index) => {
                const isUser = message.senderType === 'user';
                const isSystem = message.senderType === 'system';
                const displayName = isUser 
                  ? (user?.firstName || user?.username || 'You') 
                  : (message.name || 'Support');

                // Grouping logic
                const prev = index > 0 ? messages[index - 1] : null;
                const next = index < messages.length - 1 ? messages[index + 1] : null;
                const msgDate = new Date(message.createdAt);
                const prevDate = prev ? new Date(prev.createdAt) : null;
                const showDateDivider = !prev || msgDate.toDateString() !== prevDate?.toDateString();
                const isFirstInGroup = showDateDivider || !prev || prev.senderType !== message.senderType ||
                  (msgDate.getTime() - (prevDate?.getTime() || 0)) > 120000;
                const isLastInGroup = !next || next.senderType !== message.senderType ||
                  (new Date(next.createdAt).getTime() - msgDate.getTime()) > 120000 ||
                  msgDate.toDateString() !== new Date(next.createdAt).toDateString();

                if (isSystem) {
                  const metaType = message.metadata?.type || '';
                  const isLoan = metaType.startsWith('loan_');
                  return (
                    <div key={message.id}>
                      {showDateDivider && (
                        <div className="flex items-center justify-center my-4">
                          <div className="flex-1 border-t casino-border" />
                          <span className="px-3 text-[11px] font-medium casino-text-secondary">{formatDateDivider(msgDate)}</span>
                          <div className="flex-1 border-t casino-border" />
                        </div>
                      )}
                      <div ref={(el) => { messageRefs.current[message.id] = el; }} className="flex justify-center my-3">
                        <div className="max-w-[90%] sm:max-w-[80%] px-4 py-3 rounded-xl"
                          style={{
                            background: isLoan
                              ? 'linear-gradient(135deg, rgba(255,215,0,0.12) 0%, rgba(255,160,0,0.10) 100%)'
                              : 'rgba(255,255,255,0.05)',
                            border: isLoan ? '1px solid rgba(255,215,0,0.25)' : '1px solid rgba(255,255,255,0.08)',
                          }}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-semibold" style={{ color: isLoan ? '#FFD700' : '#00B0FF' }}>
                              {message.metadata?.source || 'System'}
                            </span>
                            <span className="text-[10px] casino-text-secondary">
                              {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                          {message.message && (
                            <p className="text-sm casino-text-primary whitespace-pre-wrap break-words leading-relaxed">
                              {linkify(decodeHtmlEntities(message.message), { linkClassName: 'underline text-yellow-600 hover:text-yellow-500 break-all' })}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                }
                
                return (
                  <div key={message.id}>
                    {showDateDivider && (
                      <div className="flex items-center justify-center my-4">
                        <div className="flex-1 border-t casino-border" />
                        <span className="px-3 text-[11px] font-medium casino-text-secondary">{formatDateDivider(msgDate)}</span>
                        <div className="flex-1 border-t casino-border" />
                      </div>
                    )}
                    <div
                      ref={(el) => { messageRefs.current[message.id] = el; }}
                      className={`group flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'} transition-all duration-500 rounded-lg animate-slide-up ${isFirstInGroup ? 'mt-4' : 'mt-1'}`}
                    >
                    {!isUser && (
                      isFirstInGroup ? (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ 
                            background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
                            boxShadow: '0 0 10px rgba(106, 27, 154, 0.3)'
                          }}
                        >
                          <span className="text-white text-xs font-semibold">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )
                    )}
                    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%] min-w-0`}>
                      {/* Reply & React buttons — visible on mobile, hover on desktop */}
                      <div className="opacity-60 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity flex items-center gap-2 mb-1 px-1">
                        <button
                          onClick={() => handleReply(message)}
                          className="text-xs casino-text-secondary hover:casino-text-primary flex items-center gap-1"
                          title="Reply"
                        >
                          <Reply className="w-3 h-3" />
                          <span>Reply</span>
                        </button>
                        <div className="relative">
                          <button
                            onClick={() => { setEmojiPickerMsgId(emojiPickerMsgId === message.id ? null : message.id); setEmojiExpanded(false); }}
                            className="text-xs casino-text-secondary hover:casino-text-primary flex items-center gap-1"
                            title="React"
                          >
                            <SmilePlus className="w-3 h-3" />
                          </button>
                          {emojiPickerMsgId === message.id && (
                            <div className={`absolute ${isUser ? 'right-0' : 'left-0'} bottom-full mb-1 rounded-xl shadow-lg z-[70] border p-1.5`} style={{ backgroundColor: '#1A1A2E', borderColor: '#2A2A3E' }}>
                              <div className="flex items-center gap-0.5">
                                {QUICK_EMOJIS.map((emoji) => (
                                  <button key={emoji} onClick={() => toggleReaction(message.id, emoji)} className="text-base hover:scale-110 active:scale-125 hover:bg-white/10 transition-all rounded p-1 text-center">
                                    {emoji}
                                  </button>
                                ))}
                                {!emojiExpanded && (
                                  <button onClick={() => setEmojiExpanded(true)} className="text-xs text-gray-400 hover:text-white hover:bg-white/10 rounded p-1 transition-all" title="More emojis">+</button>
                                )}
                              </div>
                              {emojiExpanded && (
                                <div className="flex items-center gap-0.5 mt-0.5">
                                  {MORE_EMOJIS.map((emoji) => (
                                    <button key={emoji} onClick={() => toggleReaction(message.id, emoji)} className="text-base hover:scale-110 active:scale-125 hover:bg-white/10 transition-all rounded p-1 text-center">
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
                        className={`rounded-2xl px-4 py-2 ${
                          isUser
                            ? 'rounded-br-sm'
                            : 'rounded-bl-sm'
                        }`}
                        style={isUser 
                          ? { 
                              background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                              color: '#0A0A0F',
                              boxShadow: '0 0 15px rgba(255, 215, 0, 0.3)'
                            }
                          : { 
                              backgroundColor: '#1B1B2F',
                              color: '#F5F5F5',
                              border: '1px solid #2C2C3A'
                            }
                        }
                      >
                        {/* Quoted reply preview */}
                        {message.replyTo && (
                          <div
                            onClick={() => scrollToMessage(message.replyTo!.messageId)}
                            className="mb-2 px-3 py-2 rounded-lg cursor-pointer hover:opacity-80 transition-opacity border-l-2"
                            style={isUser
                              ? { backgroundColor: 'rgba(0,0,0,0.1)', borderColor: '#0A0A0F' }
                              : { backgroundColor: 'rgba(255,255,255,0.05)', borderColor: '#FFD700' }
                            }
                          >
                            <p className="text-[11px] font-semibold mb-0.5" style={{ color: isUser ? '#0A0A0F' : '#FFD700' }}>
                              {message.replyTo.senderName || (message.replyTo.senderType === 'user' ? 'You' : 'Support')}
                            </p>
                            <p className={`text-xs line-clamp-2 ${isUser ? 'text-[#0A0A0F]/70' : 'casino-text-secondary'}`}>
                              {message.replyTo.message ? linkify(decodeHtmlEntities(message.replyTo.message), { linkClassName: `underline break-all ${isUser ? 'text-indigo-700 hover:text-indigo-900' : 'text-yellow-400 hover:text-yellow-300'}` }) : '(Attachment)'}
                            </p>
                          </div>
                        )}
                        {!isUser && isFirstInGroup && (
                          <span className="text-xs font-semibold mb-1 block casino-text-primary opacity-90">
                            {displayName}
                          </span>
                        )}
                        {message.message && (
                          <p className={`text-sm whitespace-pre-wrap break-words ${isUser ? 'text-[#0A0A0F]' : 'casino-text-primary'}`} style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>
                            {linkify(decodeHtmlEntities(message.message), { linkClassName: `underline break-all ${isUser ? 'text-indigo-700 hover:text-indigo-900' : 'text-yellow-400 hover:text-yellow-300'}` })}
                          </p>
                        )}
                        {message.attachmentUrl && (
                          <div className="mt-2">
                            {isImageAttachment(message.attachmentType, message.attachmentName) ? (
                              <div
                                onClick={() => setImageModal({ url: getAttachmentUrl(message.attachmentUrl!), name: message.attachmentName || 'Image' })}
                                className="rounded-lg overflow-hidden max-w-full sm:max-w-xs cursor-pointer"
                              >
                                <img
                                  src={getAttachmentUrl(message.attachmentUrl)}
                                  alt="attachment"
                                  className="w-full h-auto max-h-48 sm:max-h-64 object-cover rounded-lg opacity-0 transition-opacity duration-300"
                                  loading="lazy"
                                  onLoad={(e) => e.currentTarget.classList.replace('opacity-0', 'opacity-100')}
                                />
                              </div>
                            ) : (
                              <a
                                href={getAttachmentUrl(message.attachmentUrl)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm underline"
                                style={isUser ? { color: '#0A0A0F' } : { color: '#00B0FF' }}
                              >
                                <FileText className="w-4 h-4" />
                                {message.attachmentName || 'Attachment'}
                              </a>
                            )}
                          </div>
                        )}
                      </div>
                      {/* Reactions display */}
                      {message.reactions && message.reactions.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-1 px-1">
                          {Object.entries(
                            message.reactions.reduce<Record<string, { count: number; reactors: string[]; mine: boolean }>>((acc, r) => {
                              if (!acc[r.emoji]) acc[r.emoji] = { count: 0, reactors: [], mine: false };
                              acc[r.emoji].count++;
                              acc[r.emoji].reactors.push(r.reactorName || r.reactorType);
                              if (r.reactorId === user?.id && r.reactorType === 'user') acc[r.emoji].mine = true;
                              return acc;
                            }, {})
                          ).map(([emoji, info]) => (
                            <button
                              key={emoji}
                              onClick={() => toggleReaction(message.id, emoji)}
                              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs border transition-colors ${
                                info.mine
                                  ? 'border-yellow-500/60 bg-yellow-500/15'
                                  : 'border-gray-600 bg-white/5 hover:bg-white/10'
                              }`}
                              title={info.reactors.join(', ')}
                            >
                              <span>{emoji}</span>
                              <span className="casino-text-secondary text-[10px]">{info.count}</span>
                            </button>
                          ))}
                        </div>
                      )}
                      {isLastInGroup && (
                        <span className="text-xs casino-text-secondary mt-1 px-1 inline-flex items-center gap-1">
                          {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          {isUser && (
                            message.status === 'read'
                              ? <CheckCheck className="w-3.5 h-3.5 inline-block" style={{ color: '#FFD700' }} />
                              : <Check className="w-3.5 h-3.5 inline-block casino-text-secondary" />
                          )}
                        </span>
                      )}
                    </div>
                    {isUser && (
                      isFirstInGroup ? (
                        <div 
                          className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ 
                            background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
                            boxShadow: '0 0 10px rgba(106, 27, 154, 0.3)'
                          }}
                        >
                          <span className="text-white text-xs font-semibold">
                            {displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      ) : (
                        <div className="w-8 flex-shrink-0" />
                      )
                    )}
                  </div>
                  </div>
                );
              })}
              {/* Typing indicator */}
              {isAdminTyping && (
                <div className="flex items-end gap-2 justify-start mt-2">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)' }}>
                    <span className="text-white text-xs font-semibold">S</span>
                  </div>
                  <div className="rounded-2xl rounded-bl-sm px-4 py-3" style={{ backgroundColor: '#1B1B2F', border: '1px solid #2C2C3A' }}>
                    <div className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing-dot" style={{ animationDelay: '0ms' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing-dot" style={{ animationDelay: '0.2s' }} />
                      <span className="w-2 h-2 rounded-full bg-gray-400 animate-typing-dot" style={{ animationDelay: '0.4s' }} />
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
        {/* Scroll-to-bottom floating button */}
        <button
          onClick={scrollToBottom}
          className={`absolute bottom-4 right-4 z-10 flex items-center justify-center w-10 h-10 rounded-full shadow-lg transition-all duration-200 hover:opacity-100 hover:scale-105 active:scale-95 ${showScrollBottom ? 'opacity-90 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
          style={{ backgroundColor: '#1B1B2F', border: '1px solid #2C2C3A' }}
          title="Scroll to latest"
        >
          <ChevronDown className="w-5 h-5" style={{ color: '#FFD700' }} />
          {newMsgCount > 0 && (
            <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold animate-bounce-gentle">
              {newMsgCount > 9 ? '9+' : newMsgCount}
            </span>
          )}
        </button>
      </div>

      {/* Input Area at Bottom — stays in flex flow, no position:fixed needed */}
      <div className="casino-bg-secondary border-t casino-border px-4 py-3 flex-shrink-0" style={{ 
        zIndex: 55
      }}>
        {/* Reply preview bar */}
        {replyingTo && (
          <div className={`mb-2 flex items-center gap-2 p-2 rounded-lg border-l-2 ${closingReply ? 'animate-slide-out-right' : 'animate-slide-up'}`} style={{ backgroundColor: 'rgba(255,215,0,0.1)', borderColor: '#FFD700' }}>
            <Reply className="w-4 h-4 flex-shrink-0" style={{ color: '#FFD700' }} />
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold casino-text-primary">
                {replyingTo.senderType === 'user' ? (user?.firstName || user?.username || 'You') : (replyingTo.name || 'Support')}
              </p>
              <p className="text-xs casino-text-secondary truncate">
                {replyingTo.message ? linkify(decodeHtmlEntities(replyingTo.message), { linkClassName: 'underline text-indigo-500 hover:text-indigo-400 break-all' }) : '(Attachment)'}
              </p>
            </div>
            <button
              onClick={() => { setClosingReply(true); setTimeout(() => { setReplyingTo(null); setClosingReply(false); }, 200); }}
              className="flex-shrink-0 casino-text-secondary hover:casino-text-primary transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}
        {attachment && (
          <div className="mb-2 flex items-center justify-between p-2 rounded-lg casino-bg-primary casino-border border">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <FileText className="w-4 h-4 casino-text-secondary flex-shrink-0" />
              <span className="text-sm casino-text-primary truncate">{attachment.name}</span>
            </div>
            <button
              onClick={() => {
                setAttachment(null);
                if (fileInputRef.current) {
                  fileInputRef.current.value = '';
                }
              }}
              className="text-sm casino-text-secondary hover:casino-text-primary ml-2 flex-shrink-0"
            >
              Remove
            </button>
          </div>
        )}
        <div className="flex items-end gap-2">
          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-10 h-10 rounded-lg casino-bg-primary casino-border border hover:border-yellow-400 transition-all flex items-center justify-center flex-shrink-0 active:scale-95"
            style={{ boxShadow: '0 0 10px rgba(255, 215, 0, 0.1)' }}
          >
            <span className="text-xl casino-text-primary font-light">+</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            onChange={handleFileSelect}
            className="hidden"
          />
          <div className="flex-1 relative">
            <textarea
              ref={textareaRef}
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                emitTyping();
                // Auto-resize textarea
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onPaste={handlePaste}
              onKeyPress={handleKeyPress}
              placeholder={replyingTo ? 'Type your reply...' : 'Type your message...'}
              rows={1}
              className="input-casino w-full rounded-lg px-4 py-2.5 resize-none text-sm"
              style={{ minHeight: '44px', maxHeight: '120px' }}
              maxLength={2000}
            />
            {inputValue.length > 1500 && (
              <span className={`absolute bottom-1 right-2 text-[10px] ${
                inputValue.length > 1950 ? 'text-red-400' : inputValue.length > 1800 ? 'text-yellow-400' : 'casino-text-secondary'
              }`}>
                {inputValue.length}/2000
              </span>
            )}
          </div>
          <button
            onClick={handleSendMessage}
            disabled={sending || (!inputValue.trim() && !attachment)}
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all active:scale-90"
            style={(!inputValue.trim() && !attachment) 
              ? { 
                  backgroundColor: '#1B1B2F', 
                  color: '#B0B0B0',
                  border: '1px solid #2C2C3A'
                }
              : { 
                  background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
                  color: '#0A0A0F',
                  border: '2px solid #FFD700',
                  boxShadow: '0 0 20px rgba(255, 215, 0, 0.3)'
                }
            }
          >
            {sending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Send className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>

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
    </div>
  );
};

export default Chat;

