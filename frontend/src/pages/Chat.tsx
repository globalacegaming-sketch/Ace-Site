import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { io, Socket } from 'socket.io-client';
import { Send, Loader2, FileText, MessageCircle, Image as ImageIcon, X } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl, getWsBaseUrl, getAttachmentUrl, isImageAttachment } from '../utils/api';

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

const MAX_ATTACHMENT_SIZE = 10 * 1024 * 1024; // 10MB

const Chat = () => {
  const { isAuthenticated, token, user } = useAuthStore();
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [sending, setSending] = useState(false);
  const [attachment, setAttachment] = useState<File | null>(null);
  const [isMobile, setIsMobile] = useState(false);
  const [imageModal, setImageModal] = useState<{ url: string; name: string } | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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


  // Scroll to bottom of messages
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

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

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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

    const socket = io(WS_BASE_URL, {
      auth: {
        token
      },
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
          limit: 1000,
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
      height: isMobile ? 'calc(100vh - 80px - 64px)' : 'calc(100vh - 80px)',
      width: '100%',
      position: 'absolute',
      top: '50px',
      left: 0,
      right: 0,
      bottom: isMobile ? '64px' : '0'
    }}>
      {/* Decorative glowing orbs - static to prevent blinking */}
      <div className="absolute inset-0 pointer-events-none" style={{ zIndex: 0 }}>
        <div className="absolute top-20 left-10 w-64 h-64 rounded-full blur-3xl opacity-8" style={{ backgroundColor: '#6A1B9A' }}></div>
        <div className="absolute bottom-20 right-10 w-72 h-72 rounded-full blur-3xl opacity-8" style={{ backgroundColor: '#00B0FF' }}></div>
        <div className="absolute top-1/2 left-1/4 w-48 h-48 rounded-full blur-3xl opacity-6" style={{ backgroundColor: '#FFD700' }}></div>
      </div>

      {/* Fixed Header - Show on all screens */}
      <div className="casino-bg-secondary border-b casino-border px-4 py-3 flex items-center gap-3 flex-shrink-0 relative" style={{ zIndex: 60 }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center" style={{ 
          background: 'linear-gradient(135deg, #6A1B9A 0%, #00B0FF 100%)',
          boxShadow: '0 0 20px rgba(106, 27, 154, 0.3)'
        }}>
          <MessageCircle className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold casino-text-primary">Support Chat</h1>
          <p className="text-xs casino-text-secondary">We're here to help you 24/7</p>
        </div>
      </div>

      {/* Scrollable Messages Container */}
      <div className="flex-1 overflow-y-auto px-4 py-4 relative" style={{ 
        paddingBottom: isMobile ? '140px' : '0'
      }}>
        <div className="max-w-4xl mx-auto space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin casino-text-secondary" />
            </div>
          ) : messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <MessageCircle className="w-16 h-16 casino-text-secondary mb-4 opacity-50" />
              <p className="casino-text-secondary">No messages yet. Start a conversation!</p>
            </div>
          ) : (
            <>
              {messages.map((message) => {
                const isUser = message.senderType === 'user';
                const displayName = isUser 
                  ? (user?.firstName || user?.username || 'You') 
                  : (message.name || 'Support');
                
                return (
                  <div
                    key={message.id}
                    className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}
                  >
                    {!isUser && (
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
                    )}
                    <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[75%]`}>
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
                        {!isUser && (
                          <span className="text-xs font-semibold mb-1 block casino-text-primary opacity-90">
                            {displayName}
                          </span>
                        )}
                        {message.message && (
                          <p className={`text-sm whitespace-pre-wrap break-words ${isUser ? 'text-[#0A0A0F]' : 'casino-text-primary'}`}>
                            {decodeHtmlEntities(message.message)}
                          </p>
                        )}
                        {message.attachmentUrl && (
                          <div className="mt-2">
                            {isImageAttachment(message.attachmentType, message.attachmentName) ? (
                              <div className="space-y-2">
                                <div
                                  onClick={() => setImageModal({ url: getAttachmentUrl(message.attachmentUrl!), name: message.attachmentName || 'Image' })}
                                  className="block rounded-lg overflow-hidden border-2 border-opacity-20 hover:border-opacity-40 active:border-opacity-60 transition-all max-w-full sm:max-w-md cursor-pointer touch-manipulation"
                                  style={isUser ? { borderColor: 'rgba(10, 10, 15, 0.2)' } : { borderColor: 'rgba(0, 176, 255, 0.2)' }}
                                >
                                  <img
                                    src={getAttachmentUrl(message.attachmentUrl)}
                                    alt={message.attachmentName || 'Image attachment'}
                                    className="w-full h-auto max-h-48 sm:max-h-64 object-contain"
                                    loading="lazy"
                                  />
                                </div>
                                <a
                                  href={getAttachmentUrl(message.attachmentUrl)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  download={message.attachmentName}
                                  className="inline-flex items-center gap-2 text-xs underline"
                                  style={isUser ? { color: '#0A0A0F' } : { color: '#00B0FF' }}
                                >
                                  <ImageIcon className="w-3 h-3" />
                                  <span>{message.attachmentName || 'Download image'}</span>
                                </a>
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
                      <span className="text-xs casino-text-secondary mt-1 px-1">
                        {new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    {isUser && (
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
                    )}
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>
      </div>

      {/* Fixed Input Area at Bottom - Positioned directly above mobile nav with no gap */}
      <div className="casino-bg-secondary border-t casino-border px-4 py-3 flex-shrink-0" style={{ 
        zIndex: 55,
        position: isMobile ? 'fixed' : 'relative',
        bottom: isMobile ? '64px' : 'auto',
        left: isMobile ? '0' : 'auto',
        right: isMobile ? '0' : 'auto',
        width: isMobile ? '100%' : 'auto',
        marginBottom: '0',
        borderBottom: isMobile ? 'none' : undefined
      }}>
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
            className="w-10 h-10 rounded-lg casino-bg-primary casino-border border hover:border-yellow-400 transition-colors flex items-center justify-center flex-shrink-0"
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
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                // Auto-resize textarea
                e.target.style.height = 'auto';
                e.target.style.height = `${Math.min(e.target.scrollHeight, 120)}px`;
              }}
              onKeyPress={handleKeyPress}
              placeholder="type here"
              rows={1}
              className="input-casino w-full rounded-lg px-4 py-2.5 resize-none text-sm"
              style={{ minHeight: '44px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={sending || (!inputValue.trim() && !attachment)}
            className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
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
          className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-90 p-2 sm:p-4"
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

