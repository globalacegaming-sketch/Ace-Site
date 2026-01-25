import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, Trash2, X, Save, Loader2, LogOut, Gamepad2, Gift,
  Settings, Users, Mail, HelpCircle, Bell, Menu, Search, User,
  ChevronDown, CheckCircle, Ticket, FileText, Clock, CheckCircle2, XCircle,
  Send, Upload} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { getApiBaseUrl } from '../utils/api';
import { useMusic } from '../contexts/MusicContext';
import WheelManagementPanel from '../components/wheel/WheelManagementPanel';

// Types
interface Platform {
  _id: string;
  name: string;
  description: string;
  image: string;
  gameLink: string;
  isActive: boolean;
  order: number;
}

interface Bonus {
  _id: string;
  title: string;
  description: string;
  image: string;
  bonusType: 'welcome' | 'deposit' | 'free_spins' | 'cashback' | 'other';
  bonusValue?: string;
  termsAndConditions?: string;
  isActive: boolean;
  order: number;
  validFrom?: string;
  validUntil?: string;
  claimedBy?: string[];
}

interface Contact {
  _id: string;
  username: string;
  fpName: string;
  email: string;
  phone: string;
  referralCode: string;
  referredBy?: string;
  firstName?: string;
  lastName?: string;
  createdAt: string;
}

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  order: number;
  isActive: boolean;
}

interface Notice {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  isActive: boolean;
  priority: number;
  expiresAt?: string;
}

type ActiveSection = 'dashboard' | 'gamecards' | 'contacts' | 'email-promotions' | 'faqs' | 'bonuses' | 'notifications' | 'support-tickets' | 'wheel';

const AgentDashboard: React.FC = () => {
  const navigate = useNavigate();
  const API_BASE_URL = getApiBaseUrl();
  const { stopMusic } = useMusic();
  
  const [activeSection, setActiveSection] = useState<ActiveSection>('dashboard');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [loading, setLoading] = useState(false);
  
  // Data states
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [bonuses, setBonuses] = useState<Bonus[]>([]);
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [recentActions, setRecentActions] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(false);
  const [ticketStatusFilter, setTicketStatusFilter] = useState<string>('all');
  const [ticketCategoryFilter, setTicketCategoryFilter] = useState<string>('all');
  
  // Email promotions states
  const [emailForm, setEmailForm] = useState({
    subject: '',
    headerTitle: '',
    headerSubtitle: '',
    emailBody: '',
    recipientOption: 'all' as 'all' | 'selected',
    selectedRecipients: [] as string[]
  });
  const [emailAttachment, setEmailAttachment] = useState<File | null>(null);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailPreview, setEmailPreview] = useState(false);
  const [emailPreviewHtml, setEmailPreviewHtml] = useState<string>('');
  const [loadingPreview, setLoadingPreview] = useState(false);

  // Fetch email preview function (must be at component level for hooks)
  const fetchEmailPreview = useCallback(async () => {
    if (!emailForm.emailBody.trim()) {
      setEmailPreviewHtml('');
      return;
    }

    try {
      setLoadingPreview(true);
      const token = getAgentToken();
      
      // Use FormData if there's an attachment, otherwise use JSON
      const formData = new FormData();
      formData.append('subject', emailForm.subject || 'Email Preview');
      formData.append('headerTitle', emailForm.headerTitle || 'Important Message');
      formData.append('headerSubtitle', emailForm.headerSubtitle || '');
      formData.append('emailBody', emailForm.emailBody);
      
      if (emailAttachment) {
        formData.append('attachment', emailAttachment);
      }
      
      const response = await axios.post(
        `${API_BASE_URL}/email-promotions/preview`,
        formData,
        {
          headers: {
            'Authorization': `Bearer ${token}`
            // Don't set Content-Type - axios will set it automatically with correct boundary for FormData
          }
        }
      );

      if (response.data.success && response.data.html) {
        setEmailPreviewHtml(response.data.html);
      }
    } catch (error: any) {
      console.error('Error fetching email preview:', error);
      toast.error('Failed to load email preview');
    } finally {
      setLoadingPreview(false);
    }
  }, [emailForm.subject, emailForm.headerTitle, emailForm.headerSubtitle, emailForm.emailBody, emailAttachment, API_BASE_URL]);

  // Fetch preview when form changes (must be at component level)
  useEffect(() => {
    if (emailPreview && emailForm.emailBody.trim()) {
      const timeoutId = setTimeout(() => {
        fetchEmailPreview();
      }, 500); // Debounce by 500ms

      return () => clearTimeout(timeoutId);
    }
  }, [emailForm.subject, emailForm.headerTitle, emailForm.headerSubtitle, emailForm.emailBody, emailPreview, emailAttachment, API_BASE_URL, fetchEmailPreview]);

  // Modal states
  const [showPlatformModal, setShowPlatformModal] = useState(false);
  const [showBonusModal, setShowBonusModal] = useState(false);
  const [showFAQModal, setShowFAQModal] = useState(false);
  const [showNoticeModal, setShowNoticeModal] = useState(false);
  
  const [editingPlatform, setEditingPlatform] = useState<Platform | null>(null);
  const [editingBonus, setEditingBonus] = useState<Bonus | null>(null);
  const [editingFAQ, setEditingFAQ] = useState<FAQ | null>(null);
  const [editingNotice, setEditingNotice] = useState<Notice | null>(null);

  // Form states
  const [platformForm, setPlatformForm] = useState({
    name: '', description: '', image: '', gameLink: '', order: 0, isActive: true
  });
  const [bonusForm, setBonusForm] = useState({
    title: '', description: '', image: '', bonusType: 'other' as Bonus['bonusType'],
    bonusValue: '', termsAndConditions: '', order: 0, isActive: true,
    validFrom: '', validUntil: ''
  });
  const [faqForm, setFaqForm] = useState({
    question: '', answer: '', category: 'general', order: 0, isActive: true
  });
  const [noticeForm, setNoticeForm] = useState({
    title: '', message: '', type: 'info' as Notice['type'], isActive: true, priority: 1, expiresAt: ''
  });

  // Stop music when agent dashboard loads
  useEffect(() => {
    stopMusic();
  }, [stopMusic]);

  // Handle mobile/desktop responsiveness
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 1024;
      setIsMobile(mobile);
      if (mobile) {
        setSidebarOpen(false); // Close sidebar on mobile by default
      } else {
        setSidebarOpen(true); // Open sidebar on desktop by default
      }
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const session = localStorage.getItem('agent_session');
    if (!session) {
      toast.error('Please login to access agent dashboard');
      navigate('/agent-login');
      return;
    }

    try {
      const parsedSession = JSON.parse(session);
      if (parsedSession.expiresAt && Date.now() > parsedSession.expiresAt) {
        localStorage.removeItem('agent_session');
        toast.error('Session expired. Please login again.');
        navigate('/agent-login');
        return;
      }
    } catch (error) {
      localStorage.removeItem('agent_session');
      navigate('/agent-login');
    }

    loadAllData();
  }, [navigate]);

  useEffect(() => {
    if (activeSection === 'support-tickets') {
      loadSupportTickets();
    }
  }, [activeSection, ticketStatusFilter, ticketCategoryFilter]);

  const getAgentToken = () => {
    const session = localStorage.getItem('agent_session');
    if (session) {
      const parsed = JSON.parse(session);
      return parsed.token;
    }
    return null;
  };

  const loadAllData = async () => {
    await Promise.all([
      loadPlatforms(),
      loadBonuses(),
      loadContacts(),
      loadFAQs(),
      loadNotices()
    ]);
  };

  const loadPlatforms = async () => {
    try {
      const token = getAgentToken();
      const response = await axios.get(`${API_BASE_URL}/platforms/all`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.data.success) setPlatforms(response.data.data || []);
    } catch (error) {
      console.error('Failed to load platforms');
    }
  };

  const loadBonuses = async () => {
    try {
      const token = getAgentToken();
      const response = await axios.get(`${API_BASE_URL}/bonuses/all`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.data.success) setBonuses(response.data.data || []);
    } catch (error) {
      console.error('Failed to load bonuses');
    }
  };

  const loadContacts = async () => {
    try {
      const token = getAgentToken();
      const response = await axios.get(`${API_BASE_URL}/contacts`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.data.success) setContacts(response.data.data || []);
    } catch (error) {
      console.error('Failed to load contacts');
    }
  };

  const loadFAQs = async () => {
    try {
      const token = getAgentToken();
      const response = await axios.get(`${API_BASE_URL}/faqs/all`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.data.success) setFaqs(response.data.data || []);
    } catch (error) {
      console.error('Failed to load FAQs');
    }
  };

  const loadNotices = async () => {
    try {
      const token = getAgentToken();
      const response = await axios.get(`${API_BASE_URL}/notices/all`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (response.data.success) setNotices(response.data.data || []);
    } catch (error) {
      console.error('Failed to load notices');
    }
  };

  const loadSupportTickets = async () => {
    try {
      setTicketsLoading(true);
      const token = getAgentToken();
      const params: any = {};
      if (ticketStatusFilter !== 'all') params.status = ticketStatusFilter;
      if (ticketCategoryFilter !== 'all') params.category = ticketCategoryFilter;
      
      const response = await axios.get(`${API_BASE_URL}/support-tickets`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        params
      });
      if (response.data.success) {
        setSupportTickets(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load support tickets');
      toast.error('Failed to load support tickets');
    } finally {
      setTicketsLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('agent_session');
    toast.success('Logged out successfully');
    navigate('/agent-login');
  };

  // Render Dashboard Section
  const renderDashboard = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900 mb-6">Dashboard</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Game Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Game</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Gamepad2 className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">Game cards</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveSection('gamecards');
                    setShowPlatformModal(true);
                    setEditingPlatform(null);
                    setPlatformForm({ name: '', description: '', image: '', gameLink: '', order: 0, isActive: true });
                  }}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Add
                </button>
                <button
                  onClick={() => setActiveSection('gamecards')}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* User Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">User</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Users className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">Users</span>
              </div>
              <button
                onClick={() => setActiveSection('contacts')}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Change
              </button>
            </div>
          </div>
        </div>

        {/* Home Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Home</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <HelpCircle className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">Faqs</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveSection('faqs');
                    setShowFAQModal(true);
                    setEditingFAQ(null);
                    setFaqForm({ question: '', answer: '', category: 'general', order: 0, isActive: true });
                  }}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Add
                </button>
                <button
                  onClick={() => setActiveSection('faqs')}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Change
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Bell className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">Notifications</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveSection('notifications');
                    setShowNoticeModal(true);
                    setEditingNotice(null);
                    setNoticeForm({ title: '', message: '', type: 'info', isActive: true, priority: 1, expiresAt: '' });
                  }}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Add
                </button>
                <button
                  onClick={() => setActiveSection('notifications')}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Change
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">Email promotions</span>
              </div>
              <button
                onClick={() => setActiveSection('email-promotions')}
                className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
              >
                Change
              </button>
            </div>
          </div>
        </div>

        {/* Bonus Section */}
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4 pb-4 border-b">
            <h3 className="text-lg font-semibold text-gray-900">Bonus</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center gap-3">
                <Gift className="w-5 h-5 text-gray-600" />
                <span className="text-gray-700">Bonuses</span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setActiveSection('bonuses');
                    setShowBonusModal(true);
                    setEditingBonus(null);
                    setBonusForm({
                      title: '', description: '', image: '', bonusType: 'other',
                  bonusValue: '', termsAndConditions: '', order: 0, isActive: true,
                      validFrom: '', validUntil: ''
                    });
                  }}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                >
                  Add
                </button>
                <button
                  onClick={() => setActiveSection('bonuses')}
                  className="px-3 py-1 bg-blue-500 text-white text-sm rounded hover:bg-blue-600"
                >
                  Change
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  // Render Gamecards Section
  const renderGamecards = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Gamecards</h2>
        <button
          onClick={() => {
            setShowPlatformModal(true);
            setEditingPlatform(null);
            setPlatformForm({ name: '', description: '', image: '', gameLink: '', order: 0, isActive: true });
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Platform
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {platforms.map((platform) => (
          <div key={platform._id} className="bg-white rounded-lg border border-gray-200 p-4">
            <img src={platform.image} alt={platform.name} className="w-full h-48 object-cover rounded-lg mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">{platform.name}</h3>
            <p className="text-sm text-gray-600 mb-4 line-clamp-2">{platform.description}</p>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingPlatform(platform);
                  setPlatformForm({
                    name: platform.name,
                    description: platform.description,
                    image: platform.image,
                    gameLink: platform.gameLink,
                    order: platform.order,
                    isActive: platform.isActive
                  });
                  setShowPlatformModal(true);
                }}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm('Delete this platform?')) return;
                  try {
                    setLoading(true);
                    const token = getAgentToken();
                    await axios.delete(`${API_BASE_URL}/platforms/${platform._id}`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    toast.success('Platform deleted');
                    loadPlatforms();
                  } catch (error) {
                    toast.error('Failed to delete');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render Contacts Section
  const renderContacts = () => (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Contacts</h2>
      
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Username</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">FP Name</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Email</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Phone</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Referral Code</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Referred By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {contacts.map((contact) => (
                <tr key={contact._id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm text-gray-900">{contact.username}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.fpName}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.email}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.phone}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.referralCode}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{contact.referredBy || 'N/A'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );

  // Render Email Promotions Section
  const renderEmailPromotions = () => {
    const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files[0]) {
        setEmailAttachment(e.target.files[0]);
      }
    };

    const handleSendEmail = async () => {
      if (!emailForm.subject.trim()) {
        toast.error('Subject is required');
        return;
      }
      if (!emailForm.emailBody.trim()) {
        toast.error('Email body is required');
        return;
      }

      try {
        setSendingEmail(true);
        const token = getAgentToken();
        
        const formData = new FormData();
        formData.append('subject', emailForm.subject);
        formData.append('headerTitle', emailForm.headerTitle || 'Important Message');
        formData.append('headerSubtitle', emailForm.headerSubtitle || 'Stay Updated With Us');
        formData.append('emailBody', emailForm.emailBody);
        
        if (emailForm.recipientOption === 'selected' && emailForm.selectedRecipients.length > 0) {
          formData.append('recipientIds', JSON.stringify(emailForm.selectedRecipients));
        }
        
        if (emailAttachment) {
          formData.append('attachment', emailAttachment);
        }

        const response = await axios.post(
          `${API_BASE_URL}/email-promotions/send`,
          formData,
          {
            headers: {
              'Authorization': `Bearer ${token}`
              // Don't set Content-Type - axios will set it automatically with correct boundary for FormData
            }
          }
        );

        if (response.data.success) {
          toast.success(response.data.message || 'Emails sent successfully!');
          // Reset form
          setEmailForm({
            subject: '',
            headerTitle: '',
            headerSubtitle: '',
            emailBody: '',
            recipientOption: 'all',
            selectedRecipients: []
          });
          setEmailAttachment(null);
          // Reset file input
          const fileInput = document.getElementById('email-attachment') as HTMLInputElement;
          if (fileInput) fileInput.value = '';
          
          // Add to recent actions
          setRecentActions(prev => [{
            title: `Sent ${response.data.data?.successful || 0} promotional emails`,
            description: `Subject: ${emailForm.subject}`,
            timestamp: 'Just now'
          }, ...prev.slice(0, 9)]);
        } else {
          toast.error(response.data.message || 'Failed to send emails');
        }
      } catch (error: any) {
        console.error('Error sending email:', error);
        toast.error(error.response?.data?.message || 'Failed to send promotional emails');
      } finally {
        setSendingEmail(false);
      }
    };

    return (
    <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Email Promotions</h2>
          <button
            onClick={() => {
              setEmailPreview(!emailPreview);
              if (!emailPreview && emailForm.emailBody.trim()) {
                fetchEmailPreview();
              }
            }}
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 flex items-center gap-2"
          >
            {emailPreview ? 'Hide' : 'Show'} Preview
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Form */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-6">
              {/* Email Subject */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Subject *
                </label>
                <input
                  type="text"
                  value={emailForm.subject}
                  onChange={(e) => setEmailForm({...emailForm, subject: e.target.value})}
                  placeholder="Enter email subject (appears in inbox)"
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>

              {/* Header Section */}
              <div className="border-t border-gray-200 pt-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Header Section</h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Header Title
                    </label>
                    <input
                      type="text"
                      value={emailForm.headerTitle}
                      onChange={(e) => setEmailForm({...emailForm, headerTitle: e.target.value})}
                      placeholder="e.g., Important Announcement, Special Offer, etc."
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    />
                    <p className="text-xs text-gray-500 mt-1">Large title displayed at the top of the email</p>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">
                      Header Subtitle (Optional)
                    </label>
                    <input
                      type="text"
                      value={emailForm.headerSubtitle}
                      onChange={(e) => setEmailForm({...emailForm, headerSubtitle: e.target.value})}
                      placeholder="e.g., Stay Updated With Us, Limited Time Only, etc."
                      className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                    />
                    <p className="text-xs text-gray-500 mt-1">Optional subtitle shown below the main title. Note: "Americas Ace Gaming" tagline always appears above.</p>
                  </div>
                </div>
              </div>

              {/* Email Content */}
              <div className="border-t border-gray-200 pt-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Email Content / Body *
                </label>
                <textarea
                  value={emailForm.emailBody}
                  onChange={(e) => setEmailForm({...emailForm, emailBody: e.target.value})}
                  placeholder="Enter your email content here..."
                  rows={12}
                  className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-black"
                />
                <p className="text-xs text-gray-500 mt-1">Main email content. Use line breaks to separate paragraphs</p>
              </div>

              {/* Attachment */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Attachment (Optional)
                </label>
                <div className="flex items-center gap-4">
                  <label className="flex-1 cursor-pointer">
                    <input
                      id="email-attachment"
                      type="file"
                      onChange={handleAttachmentChange}
                      className="hidden"
                      accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx"
                    />
                    <div className="flex items-center gap-3 px-4 py-3 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors">
                      <Upload className="w-5 h-5 text-gray-400" />
                      <span className="text-sm text-gray-600">
                        {emailAttachment ? emailAttachment.name : 'Click to upload attachment'}
                      </span>
                    </div>
                  </label>
                  {emailAttachment && (
                    <button
                      onClick={() => {
                        setEmailAttachment(null);
                        const fileInput = document.getElementById('email-attachment') as HTMLInputElement;
                        if (fileInput) fileInput.value = '';
                      }}
                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Supported: Images, PDF, Word, Excel (Max 10MB)
                </p>
              </div>

              {/* Recipient Selection */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Recipients
                </label>
                <div className="space-y-3">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={emailForm.recipientOption === 'all'}
                      onChange={() => setEmailForm({...emailForm, recipientOption: 'all'})}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">All contacts ({contacts.length})</span>
                  </label>
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="radio"
                      checked={emailForm.recipientOption === 'selected'}
                      onChange={() => setEmailForm({...emailForm, recipientOption: 'selected'})}
                      className="w-4 h-4 text-blue-600"
                    />
                    <span className="text-sm text-gray-700">Selected contacts</span>
                  </label>
                  {emailForm.recipientOption === 'selected' && (
                    <div className="ml-7 mt-2 max-h-40 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
                      {contacts.map((contact) => (
                        <label key={contact._id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={emailForm.selectedRecipients.includes(contact._id)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setEmailForm({
                                  ...emailForm,
                                  selectedRecipients: [...emailForm.selectedRecipients, contact._id]
                                });
                              } else {
                                setEmailForm({
                                  ...emailForm,
                                  selectedRecipients: emailForm.selectedRecipients.filter(id => id !== contact._id)
                                });
                              }
                            }}
                            className="w-4 h-4 text-blue-600"
                          />
                          <span className="text-sm text-gray-700">{contact.email}</span>
                        </label>
                      ))}
                      {contacts.length === 0 && (
                        <p className="text-sm text-gray-500 text-center py-2">No contacts available</p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Send Button */}
              <div className="flex gap-3 pt-4">
                <button
                  onClick={handleSendEmail}
                  disabled={sendingEmail || !emailForm.subject.trim() || !emailForm.emailBody.trim()}
                  className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {sendingEmail ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Sending...
                    </>
                  ) : (
                    <>
                      <Send className="w-5 h-5" />
                      Send Promotional Email
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Preview */}
          <div className="lg:col-span-1">
            {emailPreview && (
              <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-gray-900">Email Preview</h3>
                  {loadingPreview && (
                    <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                  )}
                </div>
                {emailPreviewHtml ? (
                  <div className="border border-gray-200 rounded-xl overflow-hidden shadow-lg">
                    <iframe
                      srcDoc={emailPreviewHtml}
                      className="w-full"
                      style={{ 
                        minHeight: '600px',
                        border: 'none',
                        width: '100%'
                      }}
                      title="Email Preview"
                    />
                  </div>
                ) : emailForm.emailBody.trim() ? (
                  <div className="border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-gray-400" />
                    <p className="text-sm">Loading preview...</p>
                  </div>
                ) : (
                  <div className="border border-gray-200 rounded-xl p-8 text-center text-gray-500">
                    <Mail className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                    <p className="text-sm">Enter email content to see preview</p>
                  </div>
                )}
                {emailAttachment && emailPreviewHtml && (
                  <div className="mt-4 bg-blue-50 border border-blue-200 rounded-lg p-3">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-blue-600" />
                      <span className="text-xs text-blue-700 font-medium">
                        Attachment: {emailAttachment.name}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  // Render FAQs Section
  const renderFAQs = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">FAQs</h2>
        <button
          onClick={() => {
            setShowFAQModal(true);
            setEditingFAQ(null);
            setFaqForm({ question: '', answer: '', category: 'general', order: 0, isActive: true });
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add FAQ
        </button>
      </div>

      <div className="space-y-4">
        {faqs.map((faq) => (
          <div key={faq._id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-2">{faq.question}</h3>
                <p className="text-sm text-gray-600">{faq.answer}</p>
                <span className="inline-block mt-2 px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                  {faq.category}
                </span>
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => {
                    setEditingFAQ(faq);
                    setFaqForm({
                      question: faq.question,
                      answer: faq.answer,
                      category: faq.category || 'general',
                      order: faq.order,
                      isActive: faq.isActive
                    });
                    setShowFAQModal(true);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete this FAQ?')) return;
                    try {
                      setLoading(true);
                      const token = getAgentToken();
                      await axios.delete(`${API_BASE_URL}/faqs/${faq._id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      toast.success('FAQ deleted');
                      loadFAQs();
                    } catch (error) {
                      toast.error('Failed to delete');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render Bonuses Section
  const renderBonuses = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Bonuses</h2>
        <button
          onClick={() => {
            setShowBonusModal(true);
            setEditingBonus(null);
            setBonusForm({
              title: '', description: '', image: '', bonusType: 'other',
              bonusValue: '', termsAndConditions: '', order: 0, isActive: true,
              validFrom: '', validUntil: ''
            });
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Bonus
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bonuses.map((bonus) => (
          <div key={bonus._id} className="bg-white rounded-lg border border-gray-200 p-4">
            <img src={bonus.image} alt={bonus.title} className="w-full h-48 object-cover rounded-lg mb-4" />
            <h3 className="font-semibold text-gray-900 mb-2">{bonus.title}</h3>
            <p className="text-sm text-gray-600 mb-2">{bonus.description}</p>
            <div className="flex items-center justify-between mb-4">
              <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                {bonus.bonusType}
              </span>
              <span className="text-sm text-gray-500">
                {bonus.claimedBy?.length || 0} claimed
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setEditingBonus(bonus);
                  setBonusForm({
                    title: bonus.title,
                    description: bonus.description,
                    image: bonus.image,
                    bonusType: bonus.bonusType,
                    bonusValue: bonus.bonusValue || '',
                    termsAndConditions: bonus.termsAndConditions || '',
                    order: bonus.order,
                    isActive: bonus.isActive,
                    validFrom: bonus.validFrom ? bonus.validFrom.split('T')[0] : '',
                    validUntil: bonus.validUntil ? bonus.validUntil.split('T')[0] : ''
                  });
                  setShowBonusModal(true);
                }}
                className="flex-1 px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
              >
                Edit
              </button>
              <button
                onClick={async () => {
                  if (!window.confirm('Delete this bonus?')) return;
                  try {
                    setLoading(true);
                    const token = getAgentToken();
                    await axios.delete(`${API_BASE_URL}/bonuses/${bonus._id}`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    });
                    toast.success('Bonus deleted');
                    loadBonuses();
                  } catch (error) {
                    toast.error('Failed to delete');
                  } finally {
                    setLoading(false);
                  }
                }}
                className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // Render Support Tickets Section
  const renderSupportTickets = () => {
    const getStatusColor = (status: string) => {
      switch (status) {
        case 'pending': return 'bg-yellow-100 text-yellow-800';
        case 'in_progress': return 'bg-blue-100 text-blue-800';
        case 'resolved': return 'bg-green-100 text-green-800';
        case 'closed': return 'bg-gray-100 text-gray-800';
        default: return 'bg-gray-100 text-gray-800';
      }
    };

    const getStatusIcon = (status: string) => {
      switch (status) {
        case 'pending': return <Clock className="w-4 h-4" />;
        case 'in_progress': return <Loader2 className="w-4 h-4 animate-spin" />;
        case 'resolved': return <CheckCircle2 className="w-4 h-4" />;
        case 'closed': return <XCircle className="w-4 h-4" />;
        default: return <Clock className="w-4 h-4" />;
      }
    };

    const getCategoryLabel = (category: string) => {
      const labels: { [key: string]: string } = {
        'payment_related_queries': 'Payment Related Queries',
        'game_issue': 'Game Issue',
        'complaint': 'Complaint',
        'feedback': 'Feedback',
        'business_queries': 'Business Queries'
      };
      return labels[category] || category;
    };

    const updateTicketStatus = async (ticketId: string, newStatus: string) => {
      try {
        setLoading(true);
        const token = getAgentToken();
        await axios.put(
          `${API_BASE_URL}/support-tickets/${ticketId}/status`,
          { status: newStatus },
          { headers: token ? { 'Authorization': `Bearer ${token}` } : {} }
        );
        toast.success('Ticket status updated');
        loadSupportTickets();
      } catch (error: any) {
        toast.error(error.response?.data?.message || 'Failed to update ticket status');
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-gray-900">Support Tickets</h2>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={ticketStatusFilter}
              onChange={(e) => setTicketStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="in_progress">In Progress</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={ticketCategoryFilter}
              onChange={(e) => setTicketCategoryFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
            >
              <option value="all">All Categories</option>
              <option value="payment_related_queries">Payment Related Queries</option>
              <option value="game_issue">Game Issue</option>
              <option value="complaint">Complaint</option>
              <option value="feedback">Feedback</option>
              <option value="business_queries">Business Queries</option>
            </select>
          </div>
        </div>

        {/* Tickets List */}
        {ticketsLoading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : supportTickets.length === 0 ? (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center">
            <Ticket className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500">No support tickets found</p>
          </div>
        ) : (
          <div className="space-y-4">
            {supportTickets.map((ticket: any) => (
              <div key={ticket._id} className="bg-white rounded-lg border border-gray-200 p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {ticket.ticketNumber}
                      </h3>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getStatusColor(ticket.status)}`}>
                        {getStatusIcon(ticket.status)}
                        {ticket.status.replace('_', ' ').toUpperCase()}
                      </span>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                        {getCategoryLabel(ticket.category)}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-gray-600">
                      <p><span className="font-medium">Name:</span> {ticket.name}</p>
                      <p><span className="font-medium">Email:</span> {ticket.email}</p>
                      {ticket.phone && <p><span className="font-medium">Phone:</span> {ticket.phone}</p>}
                      {ticket.userId && (
                        <p><span className="font-medium">User:</span> {ticket.userId?.username || ticket.userId?.email || 'N/A'}</p>
                      )}
                    </div>
                  </div>
                  <div className="text-right text-sm text-gray-500">
                    <p>{new Date(ticket.createdAt).toLocaleDateString()}</p>
                    <p className="text-xs">{new Date(ticket.createdAt).toLocaleTimeString()}</p>
                  </div>
                </div>

                <div className="mb-4">
                  <p className="text-sm text-gray-700 whitespace-pre-wrap">{ticket.description}</p>
                </div>

                {ticket.attachmentUrl && (
                  <div className="mb-4">
                    <a
                      href={`${API_BASE_URL}${ticket.attachmentUrl}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-2 text-blue-600 hover:text-blue-800 text-sm"
                    >
                      <FileText className="w-4 h-4" />
                      {ticket.attachmentName || 'View Attachment'}
                    </a>
                  </div>
                )}

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex gap-2">
                    {ticket.status !== 'pending' && (
                      <button
                        onClick={() => updateTicketStatus(ticket._id, 'pending')}
                        className="px-3 py-1.5 bg-yellow-100 text-yellow-800 rounded text-sm hover:bg-yellow-200"
                      >
                        Mark Pending
                      </button>
                    )}
                    {ticket.status !== 'in_progress' && (
                      <button
                        onClick={() => updateTicketStatus(ticket._id, 'in_progress')}
                        className="px-3 py-1.5 bg-blue-100 text-blue-800 rounded text-sm hover:bg-blue-200"
                      >
                        Mark In Progress
                      </button>
                    )}
                    {ticket.status !== 'resolved' && (
                      <button
                        onClick={() => updateTicketStatus(ticket._id, 'resolved')}
                        className="px-3 py-1.5 bg-green-100 text-green-800 rounded text-sm hover:bg-green-200"
                      >
                        Mark Resolved
                      </button>
                    )}
                    {ticket.status !== 'closed' && (
                      <button
                        onClick={() => updateTicketStatus(ticket._id, 'closed')}
                        className="px-3 py-1.5 bg-gray-100 text-gray-800 rounded text-sm hover:bg-gray-200"
                      >
                        Close Ticket
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  // Render Notifications Section
  const renderNotifications = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
        <button
          onClick={() => {
            setShowNoticeModal(true);
            setEditingNotice(null);
            setNoticeForm({ title: '', message: '', type: 'info', isActive: true, priority: 1, expiresAt: '' });
          }}
          className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Add Notice
        </button>
      </div>

      <div className="space-y-4">
        {notices.map((notice) => (
          <div key={notice._id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex justify-between items-start">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h3 className="font-semibold text-gray-900">{notice.title}</h3>
                  <span className={`px-2 py-1 text-xs rounded ${
                    notice.type === 'info' ? 'bg-blue-100 text-blue-800' :
                    notice.type === 'warning' ? 'bg-yellow-100 text-yellow-800' :
                    notice.type === 'success' ? 'bg-green-100 text-green-800' :
                    'bg-red-100 text-red-800'
                  }`}>
                    {notice.type}
                  </span>
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded">
                    Priority: {notice.priority}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mb-2">{notice.message}</p>
                {notice.expiresAt && (
                  <p className="text-xs text-gray-500">
                    Expires: {new Date(notice.expiresAt).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex gap-2 ml-4">
                <button
                  onClick={() => {
                    setEditingNotice(notice);
                    setNoticeForm({
                      title: notice.title,
                      message: notice.message,
                      type: notice.type,
                      isActive: notice.isActive,
                      priority: notice.priority,
                      expiresAt: notice.expiresAt ? notice.expiresAt.split('T')[0] : ''
                    });
                    setShowNoticeModal(true);
                  }}
                  className="px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm"
                >
                  Edit
                </button>
                <button
                  onClick={async () => {
                    if (!window.confirm('Delete this notice?')) return;
                    try {
                      setLoading(true);
                      const token = getAgentToken();
                      await axios.delete(`${API_BASE_URL}/notices/${notice._id}`, {
                        headers: { 'Authorization': `Bearer ${token}` }
                      });
                      toast.success('Notice deleted');
                      loadNotices();
                    } catch (error) {
                      toast.error('Failed to delete');
                    } finally {
                      setLoading(false);
                    }
                  }}
                  className="px-3 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeSection) {
      case 'dashboard':
        return renderDashboard();
      case 'gamecards':
        return renderGamecards();
      case 'contacts':
        return renderContacts();
      case 'email-promotions':
        return renderEmailPromotions();
      case 'faqs':
        return renderFAQs();
      case 'bonuses':
        return renderBonuses();
      case 'wheel':
        return <WheelManagementPanel />;
      case 'notifications':
        return renderNotifications();
      case 'support-tickets':
        return renderSupportTickets();
      default:
        return renderDashboard();
    }
  };

  // Get agent username from session
  const getAgentUsername = () => {
    const session = localStorage.getItem('agent_session');
    if (session) {
      try {
        const parsed = JSON.parse(session);
        return parsed.username || 'Agent';
      } catch {
        return 'Agent';
      }
    }
    return 'Agent';
  };

  return (
    <div className="min-h-screen bg-gray-100 flex relative">
      {/* Overlay for mobile when sidebar is open */}
      {sidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}
      
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-64' : 'w-0 lg:w-20'} bg-gray-800 text-white transition-all duration-300 flex flex-col fixed h-screen z-50 overflow-hidden`}>
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className={`${sidebarOpen ? 'block' : 'hidden'} font-bold text-lg whitespace-nowrap`}>Zenith Rise G.</h2>
          </div>
        </div>

        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <User className="w-5 h-5 flex-shrink-0" />
            <span className={`${sidebarOpen ? 'block' : 'hidden'} text-sm truncate whitespace-nowrap`}>
              {getAgentUsername()}
            </span>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button
            onClick={() => {
              setActiveSection('dashboard');
              if (isMobile) setSidebarOpen(false);
            }}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
              activeSection === 'dashboard' ? 'bg-blue-600' : 'hover:bg-gray-700'
            }`}
          >
            <Settings className="w-5 h-5 flex-shrink-0" />
            <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Dashboard</span>
          </button>

          <div className="space-y-1">
            <div className={`${sidebarOpen ? 'block' : 'hidden'} text-xs text-gray-400 uppercase px-3 py-2`}>
              Game
            </div>
            <button
              onClick={() => {
                setActiveSection('gamecards');
                if (isMobile) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === 'gamecards' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <Gamepad2 className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Game cards</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className={`${sidebarOpen ? 'block' : 'hidden'} text-xs text-gray-400 uppercase px-3 py-2`}>
              Home
            </div>
            <button
              onClick={() => {
                setActiveSection('faqs');
                if (isMobile) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === 'faqs' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <HelpCircle className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Faqs</span>
            </button>
            <button
              onClick={() => {
                setActiveSection('notifications');
                if (isMobile) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === 'notifications' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <Bell className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Notifications</span>
            </button>
            <button
              onClick={() => {
                setActiveSection('support-tickets');
                if (isMobile) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === 'support-tickets' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <Ticket className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Support Tickets</span>
            </button>
            <button
              onClick={() => {
                setActiveSection('email-promotions');
                if (isMobile) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === 'email-promotions' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <Mail className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Email promotions</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className={`${sidebarOpen ? 'block' : 'hidden'} text-xs text-gray-400 uppercase px-3 py-2`}>
              User
            </div>
            <button
              onClick={() => {
                setActiveSection('contacts');
                if (isMobile) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === 'contacts' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <Users className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Users</span>
            </button>
          </div>

          <div className="space-y-1">
            <div className={`${sidebarOpen ? 'block' : 'hidden'} text-xs text-gray-400 uppercase px-3 py-2`}>
              Bonus
            </div>
            <button
              onClick={() => {
                setActiveSection('bonuses');
                if (isMobile) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === 'bonuses' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <Gift className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Bonuses</span>
            </button>
            <button
              onClick={() => {
                setActiveSection('wheel');
                if (isMobile) setSidebarOpen(false);
              }}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                activeSection === 'wheel' ? 'bg-blue-600' : 'hover:bg-gray-700'
              }`}
            >
              <Gift className="w-5 h-5 flex-shrink-0" />
              <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Wheel Management</span>
            </button>
          </div>
        </nav>

        <div className="p-4 border-t border-gray-700">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-gray-700 transition-colors"
          >
            <LogOut className="w-5 h-5 flex-shrink-0" />
            <span className={`${sidebarOpen ? 'block' : 'hidden'} whitespace-nowrap`}>Logout</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 flex flex-col ml-0 ${sidebarOpen ? 'lg:ml-64' : 'lg:ml-20'} transition-all duration-300`}>
        {/* Header */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4 sticky top-0 z-50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 sm:gap-4">
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                aria-label="Toggle sidebar"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <span className="text-gray-700 font-medium hidden sm:block">Home</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="relative hidden sm:block">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search Contact Details..."
                  className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 w-48 lg:w-64 text-black"
                />
              </div>
              <div className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded-lg p-2 transition-colors">
                <User className="w-5 h-5 text-gray-600" />
                <ChevronDown className="w-4 h-4 text-gray-600 hidden sm:block" />
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto">
          <div className="max-w-7xl mx-auto">
            <div className={`grid grid-cols-1 gap-4 sm:gap-6 ${activeSection === 'dashboard' ? 'lg:grid-cols-3' : 'lg:grid-cols-1'}`}>
              {/* Main Content */}
              <div className={activeSection === 'dashboard' ? 'lg:col-span-2' : 'lg:col-span-1'}>
                {loading && (
                  <div className="flex justify-center items-center py-20">
                    <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
                  </div>
                )}
                {!loading && renderContent()}
              </div>

              {/* Recent Actions Sidebar - Only show on dashboard */}
              {activeSection === 'dashboard' && (
              <div className="lg:col-span-1">
                <div className="bg-white rounded-lg border border-gray-200 p-6 sticky top-6">
                  <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent actions</h3>
                  <div className="space-y-4">
                    {recentActions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-8">No recent actions</p>
                    ) : (
                      recentActions.map((action, index) => (
                        <div key={index} className="flex gap-3">
                          <div className="flex-shrink-0">
                            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                              <CheckCircle className="w-4 h-4 text-green-600" />
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-blue-600 truncate">{action.title}</p>
                            <p className="text-xs text-gray-500 mt-1">{action.description}</p>
                            <p className="text-xs text-gray-400 mt-1">{action.timestamp}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
              )}
            </div>
          </div>
        </main>
      </div>

      {/* Platform Modal - Similar structure to before but simplified */}
      {showPlatformModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold">
                {editingPlatform ? 'Edit Platform' : 'Add New Platform'}
              </h3>
              <button onClick={() => { setShowPlatformModal(false); setEditingPlatform(null); }} className="text-white hover:text-gray-200">
                <X className="w-6 h-6" />
              </button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const token = getAgentToken();
                if (editingPlatform) {
                  await axios.put(`${API_BASE_URL}/platforms/${editingPlatform._id}`, platformForm, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  toast.success('Platform updated');
                } else {
                  await axios.post(`${API_BASE_URL}/platforms`, platformForm, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  toast.success('Platform created');
                  // Add to recent actions
                  setRecentActions(prev => [{
                    title: `Added "${platformForm.name}"`,
                    description: `Platform "${platformForm.name}" was added`,
                    timestamp: 'Just now'
                  }, ...prev.slice(0, 9)]);
                }
                setShowPlatformModal(false);
                setEditingPlatform(null);
                loadPlatforms();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to save');
              } finally {
                setLoading(false);
              }
            }} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Name *</label>
                <input type="text" value={platformForm.name} onChange={(e) => setPlatformForm({...platformForm, name: e.target.value})} required className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                <textarea value={platformForm.description} onChange={(e) => setPlatformForm({...platformForm, description: e.target.value})} required rows={3} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Image URL *</label>
                <input type="url" value={platformForm.image} onChange={(e) => setPlatformForm({...platformForm, image: e.target.value})} required className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Game Link *</label>
                <input type="url" value={platformForm.gameLink} onChange={(e) => setPlatformForm({...platformForm, gameLink: e.target.value})} required className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Order</label>
                  <input type="number" value={platformForm.order} onChange={(e) => setPlatformForm({...platformForm, order: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
                </div>
                <div className="flex items-center pt-8">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={platformForm.isActive} onChange={(e) => setPlatformForm({...platformForm, isActive: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                    <span className="text-sm font-semibold text-gray-700">Active</span>
                  </label>
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={loading} className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />{editingPlatform ? 'Update' : 'Create'} Platform</>}
                </button>
                <button type="button" onClick={() => { setShowPlatformModal(false); setEditingPlatform(null); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Bonus Modal */}
      {showBonusModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingBonus ? 'Edit Bonus' : 'Add New Bonus'}</h3>
              <button onClick={() => { setShowBonusModal(false); setEditingBonus(null); }} className="text-white hover:text-gray-200"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const token = getAgentToken();
                if (editingBonus) {
                  await axios.put(`${API_BASE_URL}/bonuses/${editingBonus._id}`, bonusForm, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  toast.success('Bonus updated');
                } else {
                  await axios.post(`${API_BASE_URL}/bonuses`, bonusForm, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  toast.success('Bonus created');
                  setRecentActions(prev => [{
                    title: `Added "${bonusForm.title}"`,
                    description: `Bonus "${bonusForm.title}" was added`,
                    timestamp: 'Just now'
                  }, ...prev.slice(0, 9)]);
                }
                setShowBonusModal(false);
                setEditingBonus(null);
                loadBonuses();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to save');
              } finally {
                setLoading(false);
              }
            }} className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                <input type="text" value={bonusForm.title} onChange={(e) => setBonusForm({...bonusForm, title: e.target.value})} required className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Description *</label>
                <textarea value={bonusForm.description} onChange={(e) => setBonusForm({...bonusForm, description: e.target.value})} required rows={3} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Image URL *</label>
                <input type="url" value={bonusForm.image} onChange={(e) => setBonusForm({...bonusForm, image: e.target.value})} required className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Bonus Type</label>
                  <select value={bonusForm.bonusType} onChange={(e) => setBonusForm({...bonusForm, bonusType: e.target.value as Bonus['bonusType']})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black">
                    <option value="welcome">Welcome</option>
                    <option value="deposit">Deposit</option>
                    <option value="free_spins">Free Spins</option>
                    <option value="cashback">Cashback</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Bonus Value</label>
                  <input type="text" value={bonusForm.bonusValue} onChange={(e) => setBonusForm({...bonusForm, bonusValue: e.target.value})} placeholder="e.g., 100%, $50" className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
                </div>
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Terms and Conditions</label>
                <textarea value={bonusForm.termsAndConditions} onChange={(e) => setBonusForm({...bonusForm, termsAndConditions: e.target.value})} rows={3} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Order</label>
                  <input type="number" value={bonusForm.order} onChange={(e) => setBonusForm({...bonusForm, order: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Valid From</label>
                  <input type="date" value={bonusForm.validFrom} onChange={(e) => setBonusForm({...bonusForm, validFrom: e.target.value})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Valid Until</label>
                  <input type="date" value={bonusForm.validUntil} onChange={(e) => setBonusForm({...bonusForm, validUntil: e.target.value})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
                </div>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={bonusForm.isActive} onChange={(e) => setBonusForm({...bonusForm, isActive: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                  <span className="text-sm font-semibold text-gray-700">Active</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={loading} className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />{editingBonus ? 'Update' : 'Create'} Bonus</>}
                </button>
                <button type="button" onClick={() => { setShowBonusModal(false); setEditingBonus(null); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* FAQ Modal */}
      {showFAQModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingFAQ ? 'Edit FAQ' : 'Add New FAQ'}</h3>
              <button onClick={() => { setShowFAQModal(false); setEditingFAQ(null); }} className="text-white hover:text-gray-200"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const token = getAgentToken();
                if (editingFAQ) {
                  await axios.put(`${API_BASE_URL}/faqs/${editingFAQ._id}`, faqForm, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  toast.success('FAQ updated');
                } else {
                  await axios.post(`${API_BASE_URL}/faqs`, faqForm, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  toast.success('FAQ created');
                  setRecentActions(prev => [{
                    title: `Added "${faqForm.question}"`,
                    description: `FAQ "${faqForm.question}" was added`,
                    timestamp: 'Just now'
                  }, ...prev.slice(0, 9)]);
                }
                setShowFAQModal(false);
                setEditingFAQ(null);
                loadFAQs();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to save');
              } finally {
                setLoading(false);
              }
            }} className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Question *</label>
                <input type="text" value={faqForm.question} onChange={(e) => setFaqForm({...faqForm, question: e.target.value})} required className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Answer *</label>
                <textarea value={faqForm.answer} onChange={(e) => setFaqForm({...faqForm, answer: e.target.value})} required rows={5} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
                  <input type="text" value={faqForm.category} onChange={(e) => setFaqForm({...faqForm, category: e.target.value})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Order</label>
                  <input type="number" value={faqForm.order} onChange={(e) => setFaqForm({...faqForm, order: parseInt(e.target.value) || 0})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
                </div>
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={faqForm.isActive} onChange={(e) => setFaqForm({...faqForm, isActive: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                  <span className="text-sm font-semibold text-gray-700">Active</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={loading} className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />{editingFAQ ? 'Update' : 'Create'} FAQ</>}
                </button>
                <button type="button" onClick={() => { setShowFAQModal(false); setEditingFAQ(null); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Notice Modal */}
      {showNoticeModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-indigo-600 to-blue-600 text-white px-6 py-4 rounded-t-2xl flex items-center justify-between">
              <h3 className="text-xl font-bold">{editingNotice ? 'Edit Notice' : 'Add New Notice'}</h3>
              <button onClick={() => { setShowNoticeModal(false); setEditingNotice(null); }} className="text-white hover:text-gray-200"><X className="w-6 h-6" /></button>
            </div>
            <form onSubmit={async (e) => {
              e.preventDefault();
              try {
                setLoading(true);
                const token = getAgentToken();
                if (editingNotice) {
                  await axios.put(`${API_BASE_URL}/notices/${editingNotice._id}`, noticeForm, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  toast.success('Notice updated');
                } else {
                  await axios.post(`${API_BASE_URL}/notices`, noticeForm, {
                    headers: { 'Authorization': `Bearer ${token}` }
                  });
                  toast.success('Notice created');
                  setRecentActions(prev => [{
                    title: `Added "${noticeForm.title}"`,
                    description: `Notice "${noticeForm.title}" was added`,
                    timestamp: 'Just now'
                  }, ...prev.slice(0, 9)]);
                }
                setShowNoticeModal(false);
                setEditingNotice(null);
                loadNotices();
              } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to save');
              } finally {
                setLoading(false);
              }
            }} className="p-6 space-y-4">
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Title *</label>
                <input type="text" value={noticeForm.title} onChange={(e) => setNoticeForm({...noticeForm, title: e.target.value})} required className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Message *</label>
                <textarea value={noticeForm.message} onChange={(e) => setNoticeForm({...noticeForm, message: e.target.value})} required rows={4} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Type</label>
                  <select value={noticeForm.type} onChange={(e) => setNoticeForm({...noticeForm, type: e.target.value as Notice['type']})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black">
                    <option value="info">Info</option>
                    <option value="warning">Warning</option>
                    <option value="success">Success</option>
                    <option value="error">Error</option>
                  </select>
                </div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-2">Priority (1-3, only top 3 shown)</label>
                  <input type="number" min="1" max="3" value={noticeForm.priority} onChange={(e) => setNoticeForm({...noticeForm, priority: Math.max(1, Math.min(3, parseInt(e.target.value) || 1))})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
                </div>
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-2">Expires At (Optional)</label>
                <input type="date" value={noticeForm.expiresAt} onChange={(e) => setNoticeForm({...noticeForm, expiresAt: e.target.value})} className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-black" />
              </div>
              <div className="flex items-center">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={noticeForm.isActive} onChange={(e) => setNoticeForm({...noticeForm, isActive: e.target.checked})} className="w-5 h-5 text-indigo-600 rounded" />
                  <span className="text-sm font-semibold text-gray-700">Active</span>
                </label>
              </div>
              <div className="flex gap-3 pt-4">
                <button type="submit" disabled={loading} className="flex-1 py-3 px-4 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-semibold hover:from-indigo-700 hover:to-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <><Save className="w-5 h-5" />{editingNotice ? 'Update' : 'Create'} Notice</>}
                </button>
                <button type="button" onClick={() => { setShowNoticeModal(false); setEditingNotice(null); }} className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg font-semibold hover:bg-gray-300 transition-all">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AgentDashboard;

