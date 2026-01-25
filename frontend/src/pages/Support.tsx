import { useState, useEffect, useRef } from 'react';
import { HelpCircle, ChevronDown, ChevronUp, Upload, X, FileText, CheckCircle } from 'lucide-react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { PageMeta } from '../components/PageMeta';

interface FAQ {
  _id: string;
  question: string;
  answer: string;
  category?: string;
  order: number;
}

type TicketCategory = 
  | 'payment_related_queries'
  | 'game_issue'
  | 'complaint'
  | 'feedback'
  | 'business_queries';

const Support = () => {
  const API_BASE_URL = getApiBaseUrl();
  const { isAuthenticated, user, token } = useAuthStore();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Support form state
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({
    category: '' as TicketCategory | '',
    description: '',
    name: '',
    email: '',
    phone: ''
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load FAQs only once on mount
  useEffect(() => {
    loadFAQs();
  }, []);

  // Auto-fill form for logged-in users
  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData(prev => ({
        ...prev,
        name: user.firstName && user.lastName 
          ? `${user.firstName} ${user.lastName}`.trim()
          : user.username || '',
        email: user.email || '',
        phone: user.phone || ''
      }));
    }
  }, [isAuthenticated, user]);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const response = await axios.get(`${API_BASE_URL}/faqs`);
      if (response.data.success) {
        setFaqs(response.data.data || []);
      }
    } catch (error) {
      console.error('Failed to load FAQs:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] || null;
    if (file) {
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be under 10MB');
        return;
      }
      setAttachment(file);
      
      // Create preview for images
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setAttachmentPreview(reader.result as string);
        };
        reader.readAsDataURL(file);
      } else {
        setAttachmentPreview(null);
      }
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.category) {
      toast.error('Please select a category');
      return;
    }
    
    if (!formData.description.trim()) {
      toast.error('Please describe your problem');
      return;
    }
    
    if (!isAuthenticated) {
      if (!formData.name.trim()) {
        toast.error('Please enter your name');
        return;
      }
      if (!formData.email.trim()) {
        toast.error('Please enter your email');
        return;
      }
    }

    setSubmitting(true);
    
    try {
      const submitData = new FormData();
      submitData.append('category', formData.category);
      submitData.append('description', formData.description);
      
      if (!isAuthenticated) {
        submitData.append('name', formData.name);
        submitData.append('email', formData.email);
        if (formData.phone) {
          submitData.append('phone', formData.phone);
        }
      }
      
      if (attachment) {
        submitData.append('attachment', attachment);
      }

      const headers: any = {};
      
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      // Don't set Content-Type manually - axios will automatically set it with boundary for FormData
      const response = await axios.post(
        `${API_BASE_URL}/support-tickets`,
        submitData,
        { headers }
      );

      if (response.data.success) {
        setSubmitted(true);
        toast.success(response.data.message || 'Your ticket has been created with Global Ace Management. We will try to reach you soon.');
        
        // Reset form
        setFormData({
          category: '' as TicketCategory | '',
          description: '',
          name: isAuthenticated && user ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.username || '') : '',
          email: isAuthenticated && user ? (user.email || '') : '',
          phone: isAuthenticated && user ? (user.phone || '') : ''
        });
        removeAttachment();
        
        // Hide form after 3 seconds
        setTimeout(() => {
          setShowForm(false);
          setSubmitted(false);
        }, 3000);
      }
    } catch (error: any) {
      console.error('Error submitting ticket:', error);
      
      // Show detailed validation errors if available
      if (error.response?.data?.errors) {
        const errors = error.response.data.errors;
        const errorMessages = Object.values(errors);
        if (errorMessages.length > 0) {
          toast.error(Array.isArray(errorMessages) ? errorMessages[0] as string : errorMessages[0] as string);
        } else {
          toast.error(error.response?.data?.message || 'Failed to submit ticket. Please try again.');
        }
      } else if (error.response?.data?.errorDetails && Array.isArray(error.response.data.errorDetails)) {
        toast.error(error.response.data.errorDetails[0] || 'Failed to submit ticket. Please try again.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to submit ticket. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categoryOptions: { value: TicketCategory; label: string }[] = [
    { value: 'payment_related_queries', label: 'Payment Related Queries' },
    { value: 'game_issue', label: 'Game Issue' },
    { value: 'complaint', label: 'Complaint' },
    { value: 'feedback', label: 'Feedback' },
    { value: 'business_queries', label: 'Business Queries' }
  ];

  const categories = ['all', ...Array.from(new Set(faqs.map(faq => faq.category || 'general')))];
  const filteredFAQs = selectedCategory === 'all' 
    ? faqs 
    : faqs.filter(faq => (faq.category || 'general') === selectedCategory);

  return (
    <div className="min-h-screen py-8 pt-16 bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <PageMeta title="Help & Support | Global Ace Gaming" description="Get help with your account, games, and redemptions. FAQs, contact options, and responsible gaming." />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-12">
          <div className="mx-auto w-16 h-16 bg-gradient-to-r from-blue-400 to-blue-500 rounded-full flex items-center justify-center mb-4">
            <HelpCircle className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-4xl font-bold text-white mb-4">
            Support & Help Center
          </h1>
          <p className="text-gray-300 text-lg">
            Find answers to frequently asked questions
          </p>
        </div>

        {/* Support Form */}
        <div className="max-w-3xl mx-auto mb-12">
          {!showForm && !submitted ? (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/20 text-center">
              <h2 className="text-2xl font-bold text-white mb-4">Submit a Support Ticket</h2>
              <p className="text-gray-300 mb-6">
                Need help? Fill out our support form and we'll get back to you soon.
              </p>
              <button
                onClick={() => setShowForm(true)}
                className="px-8 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl"
              >
                Submit Ticket
              </button>
            </div>
          ) : submitted ? (
            <div className="bg-green-500/20 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-green-500/50 text-center">
              <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
              <h2 className="text-2xl font-bold text-white mb-4">Ticket Submitted Successfully!</h2>
              <p className="text-gray-200 text-lg">
                Your ticket has been created with Global Ace Management. We will try to reach you soon.
              </p>
            </div>
          ) : (
            <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/20">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-white">Submit Support Ticket</h2>
                <button
                  onClick={() => {
                    setShowForm(false);
                    setFormData({
                      category: '' as TicketCategory | '',
                      description: '',
                      name: isAuthenticated && user ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.username || '') : '',
                      email: isAuthenticated && user ? (user.email || '') : '',
                      phone: isAuthenticated && user ? (user.phone || '') : ''
                    });
                    removeAttachment();
                  }}
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* User Info - Only for non-logged-in users - Show at top */}
                {!isAuthenticated && (
                  <>
                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your name"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Email <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your email"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-white font-semibold mb-2">
                        Phone (Optional)
                      </label>
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Enter your phone number"
                      />
                    </div>
                  </>
                )}

                {/* Category */}
                <div>
                  <label className="block text-white font-semibold mb-2">
                    Category <span className="text-red-400">*</span>
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value as TicketCategory })}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  >
                    <option value="">Select a category</option>
                    {categoryOptions.map((option) => (
                      <option key={option.value} value={option.value} className="bg-gray-800">
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-white font-semibold mb-2">
                    Describe your problem <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    rows={6}
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="Please provide details about your issue..."
                    required
                    maxLength={5000}
                  />
                  <p className="text-gray-400 text-sm mt-1">
                    {formData.description.length}/5000 characters
                  </p>
                </div>

                {/* Attachment */}
                <div>
                  <label className="block text-white font-semibold mb-2">
                    Upload Attachment (Optional)
                  </label>
                  <div className="space-y-3">
                    <input
                      ref={fileInputRef}
                      type="file"
                      onChange={handleFileSelect}
                      accept="image/*,.pdf,.doc,.docx,.txt"
                      className="hidden"
                      id="attachment-input"
                    />
                    <label
                      htmlFor="attachment-input"
                      className="flex items-center justify-center gap-2 px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white cursor-pointer hover:bg-white/20 transition-colors"
                    >
                      <Upload className="w-5 h-5" />
                      <span>Choose File</span>
                    </label>
                    {attachment && (
                      <div className="flex items-center gap-3 p-3 bg-white/5 border border-white/10 rounded-lg">
                        {attachmentPreview ? (
                          <img
                            src={attachmentPreview}
                            alt="Preview"
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <FileText className="w-8 h-8 text-blue-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-white text-sm font-medium truncate">
                            {attachment.name}
                          </p>
                          <p className="text-gray-400 text-xs">
                            {(attachment.size / 1024 / 1024).toFixed(2)} MB
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={removeAttachment}
                          className="text-red-400 hover:text-red-300 transition-colors"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    )}
                    <p className="text-gray-400 text-xs">
                      Supported formats: Images, PDF, DOC, DOCX, TXT (Max 10MB)
                    </p>
                  </div>
                </div>

                {/* Submit Button */}
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={submitting}
                    className="flex-1 px-6 py-3 bg-gradient-to-r from-blue-600 to-purple-600 text-white rounded-lg font-semibold hover:from-blue-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {submitting ? 'Submitting...' : 'Submit Ticket'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowForm(false);
                      setFormData({
                        category: '' as TicketCategory | '',
                        description: '',
                        name: isAuthenticated && user ? (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : user.username || '') : '',
                        email: isAuthenticated && user ? (user.email || '') : '',
                        phone: isAuthenticated && user ? (user.phone || '') : ''
                      });
                      removeAttachment();
                    }}
                    className="px-6 py-3 bg-white/10 text-white rounded-lg font-semibold hover:bg-white/20 transition-all"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>

        {/* Category Filter */}
        {categories.length > 1 && (
          <div className="flex flex-wrap gap-2 justify-center mb-8">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => setSelectedCategory(category)}
                className={`px-4 py-2 rounded-lg font-medium transition-all ${
                  selectedCategory === category
                    ? 'bg-blue-600 text-white'
                    : 'bg-white/10 text-gray-300 hover:bg-white/20'
                }`}
              >
                {category.charAt(0).toUpperCase() + category.slice(1)}
              </button>
            ))}
          </div>
        )}

        {/* FAQs List */}
        {loading ? (
          <div className="flex justify-center items-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white"></div>
          </div>
        ) : filteredFAQs.length === 0 ? (
          <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-8 border border-white/20 text-center">
            <p className="text-gray-300">No FAQs available at the moment.</p>
          </div>
        ) : (
          <div className="space-y-4 max-w-4xl mx-auto">
            {filteredFAQs.map((faq) => (
              <div
                key={faq._id}
                className="bg-white/10 backdrop-blur-sm rounded-xl border border-white/20 overflow-hidden transition-all hover:bg-white/15"
              >
                <button
                  onClick={() => setExpandedFAQ(expandedFAQ === faq._id ? null : faq._id)}
                  className="w-full px-6 py-4 flex items-center justify-between text-left"
                >
                  <h3 className="text-lg font-semibold text-white pr-4">
                    {faq.question}
                  </h3>
                  {expandedFAQ === faq._id ? (
                    <ChevronUp className="w-5 h-5 text-white flex-shrink-0" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-white flex-shrink-0" />
                  )}
                </button>
                {expandedFAQ === faq._id && (
                  <div className="px-6 pb-4">
                    <div className="pt-4 border-t border-white/20">
                      <p className="text-gray-200 leading-relaxed whitespace-pre-line">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    </div>
  );
};

export default Support;
