import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { MessageCircle, Send, Paperclip, X, Loader2, FileText } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import { getApiBaseUrl, getWsBaseUrl } from '../../utils/api';

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

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024;

const UserChatWidget = () => {
  const { isAuthenticated, token, user } = useAuthStore();
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  // Hide widget on admin/agent pages
  const isAdminOrAgentPage = useMemo(() => {
    return location.pathname.startsWith('/adminacers') || 
           location.pathname.startsWith('/agent-login') || 
           location.pathname.startsWith('/agent-dashboard');
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
  const httpBaseUrl = useMemo(() => API_BASE_URL.replace(/\/api$/, ''), [API_BASE_URL]);
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

    const socket = io(WS_BASE_URL, {
      transports: ['websocket'],
      auth: { token },
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

    socketRef.current = socket;

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [WS_BASE_URL, isAuthenticated, token, isOpen, isAdminOrAgentPage, isAdminUser]);

  const loadMessages = async () => {
    if (!token) return;

    try {
      setIsLoading(true);
      // Load all messages with a high limit
      const response = await axios.get(`${API_BASE_URL}/chat/messages`, {
        headers: {
          Authorization: `Bearer ${token}`
        },
        params: {
          limit: 1000, // Load all previous messages
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

  // Load messages when authenticated, not just when widget opens
  useEffect(() => {
    if (isAuthenticated && token && messages.length === 0 && !isLoading) {
      void loadMessages();
    }
  }, [isAuthenticated, token]);

  const handleToggle = () => {
    if (!isAuthenticated) {
      toast.error('Please sign in to contact support.');
      return;
    }
    setIsOpen((prev) => !prev);
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

      await axios.post(`${API_BASE_URL}/chat/messages`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      setInputValue('');
      setAttachment(null);
      toast.success('Message sent');
    } catch (error) {
      console.error('Failed to send chat message', error);
      toast.error('Failed to send message. Please try again.');
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
                  const timestamp = formatTime(msg.createdAt);
                  const displayName = isUser 
                    ? (user?.firstName && user?.lastName 
                        ? `${user.firstName} ${user.lastName}`.trim() 
                        : user?.username || 'You') 
                    : (msg.name || 'Support Team');

                  return (
                    <div
                      key={msg.id}
                      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`max-w-[80%] rounded-2xl px-4 py-3 shadow-sm ${
                          isUser
                            ? 'bg-indigo-600 text-white rounded-br-sm'
                            : 'bg-white text-gray-900 border border-gray-100 rounded-bl-sm'
                        }`}
                      >
                        <p className="text-xs font-semibold mb-1 opacity-90">
                          {displayName}
                        </p>
                        {msg.message && (
                          <p className="text-sm whitespace-pre-wrap break-words">
                            {msg.message}
                          </p>
                        )}
                        {msg.attachmentUrl && (
                          <a
                            href={`${httpBaseUrl}${msg.attachmentUrl}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`mt-3 flex items-center gap-2 text-sm font-medium underline ${
                              isUser ? 'text-indigo-100 hover:text-white' : 'text-indigo-600 hover:text-indigo-700'
                            }`}
                          >
                            <FileText className="w-4 h-4" />
                            {msg.attachmentName || 'Download attachment'}
                          </a>
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
                    </div>
                  );
                })}
                <div ref={messagesEndRef} />
              </>
            )}
          </div>

          <div className="border-t border-gray-200 bg-white p-4 space-y-3">
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
    </div>
  );
};

export default UserChatWidget;

