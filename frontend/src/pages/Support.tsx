import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown, ChevronUp, Upload, X, FileText, CheckCircle, MessageCircle } from 'lucide-react';
import axios from 'axios';
import { getApiBaseUrl } from '../utils/api';
import { useAuthStore } from '../stores/authStore';
import toast from 'react-hot-toast';
import { trackFeature } from '../services/analyticsTracker';
import { PageMeta } from '../components/PageMeta';
import { CosmicCard, PageShell, Section } from '../components/cosmic';

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

const categoryOptions: { value: TicketCategory; label: string }[] = [
  { value: 'payment_related_queries', label: 'Payment' },
  { value: 'game_issue', label: 'Game issue' },
  { value: 'complaint', label: 'Complaint' },
  { value: 'feedback', label: 'Feedback' },
  { value: 'business_queries', label: 'Business' },
];

const inputClass =
  'w-full rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white placeholder-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-[color:var(--casino-highlight-gold)]/50';

const Support = () => {
  const API_BASE_URL = getApiBaseUrl();
  const { isAuthenticated, user, token } = useAuthStore();
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFAQ, setExpandedFAQ] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const [formData, setFormData] = useState({
    category: '' as TicketCategory | '',
    description: '',
    name: '',
    email: '',
    phone: '',
  });
  const [attachment, setAttachment] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    loadFAQs();
    trackFeature('support_ticket', 'feature_opened');
  }, []);

  useEffect(() => {
    if (isAuthenticated && user) {
      setFormData((prev) => ({
        ...prev,
        name:
          user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.username || '',
        email: user.email || '',
        phone: user.phone || '',
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

  const resetForm = () => {
    setFormData({
      category: '' as TicketCategory | '',
      description: '',
      name:
        isAuthenticated && user
          ? user.firstName && user.lastName
            ? `${user.firstName} ${user.lastName}`.trim()
            : user.username || ''
          : '',
      email: isAuthenticated && user ? user.email || '' : '',
      phone: isAuthenticated && user ? user.phone || '' : '',
    });
    setAttachment(null);
    setAttachmentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
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
    setSubmitted(false);

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

      const headers: Record<string, string> = {};
      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      const response = await axios.post(`${API_BASE_URL}/support-tickets`, submitData, {
        headers,
      });

      if (response.data.success) {
        trackFeature('support_ticket', 'feature_used', { category: formData.category });
        setSubmitted(true);
        toast.success(
          response.data.message ||
            'Your ticket has been created. We will try to reach you soon.',
        );
        resetForm();
      }
    } catch (error: unknown) {
      const err = error as {
        response?: { data?: { errors?: Record<string, string>; message?: string; errorDetails?: string[] } };
        message?: string;
      };
      trackFeature('support_ticket', 'feature_failed', {
        error: err.response?.data?.message || err.message,
      });

      if (err.response?.data?.errors) {
        const errorMessages = Object.values(err.response.data.errors);
        toast.error(
          errorMessages.length > 0 ? String(errorMessages[0]) : 'Failed to submit ticket.',
        );
      } else if (err.response?.data?.errorDetails?.length) {
        toast.error(err.response.data.errorDetails[0]);
      } else {
        toast.error(err.response?.data?.message || 'Failed to submit ticket. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const categories = ['all', ...Array.from(new Set(faqs.map((faq) => faq.category || 'general')))];
  const filteredFAQs =
    selectedCategory === 'all'
      ? faqs
      : faqs.filter((faq) => (faq.category || 'general') === selectedCategory);

  return (
    <>
      <PageMeta
        title="Help & Support | Global Ace Gaming"
        description="Submit a support ticket or browse FAQs. Live chat available outside 12pm–6pm CST."
      />
      <PageShell
        title="Support"
        subtitle="Submit a ticket below. For faster help, use live chat when we're online."
        width="3xl"
        background="subtle"
        contentClassName="space-y-6 sm:space-y-8"
      >
        <CosmicCard variant="glass" padding="md" className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="cosmic-body text-sm sm:text-base">
            Live chat: closed <strong className="text-[color:var(--casino-text-primary)]">12pm–6pm CST</strong>
            , available outside those hours.
          </p>
          <Link
            to="/chat"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition active:scale-[0.98]"
            style={{
              background: 'linear-gradient(135deg, #FFD700 0%, #FFA000 100%)',
              color: '#0A0A0F',
            }}
          >
            <MessageCircle className="h-4 w-4" />
            Open chat
          </Link>
        </CosmicCard>

        {submitted && (
          <CosmicCard variant="glass" padding="md" className="flex items-start gap-3 border border-green-500/40">
            <CheckCircle className="h-6 w-6 shrink-0 text-green-400" />
            <div>
              <p className="font-semibold casino-text-primary">Ticket submitted</p>
              <p className="cosmic-body mt-1 text-sm">
                We received your request and will follow up by email when possible.
              </p>
            </div>
          </CosmicCard>
        )}

        <CosmicCard variant="glass" padding="lg" glow>
          <h2 className="cosmic-h3 mb-4">Submit a ticket</h2>

          <form onSubmit={handleSubmit} className="space-y-5">
            {!isAuthenticated && (
              <>
                <div>
                  <label className="cosmic-label mb-2 block">
                    Name <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className={inputClass}
                    placeholder="Your name"
                    required
                  />
                </div>
                <div>
                  <label className="cosmic-label mb-2 block">
                    Email <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className={inputClass}
                    placeholder="your@email.com"
                    required
                  />
                </div>
                <div>
                  <label className="cosmic-label mb-2 block">Phone (optional)</label>
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className={inputClass}
                    placeholder="Phone number"
                  />
                </div>
              </>
            )}

            <div>
              <label className="cosmic-label mb-2 block">
                Category <span className="text-red-400">*</span>
              </label>
              <select
                value={formData.category}
                onChange={(e) =>
                  setFormData({ ...formData, category: e.target.value as TicketCategory })
                }
                className={inputClass}
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

            <div>
              <label className="cosmic-label mb-2 block">
                Describe your issue <span className="text-red-400">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={5}
                className={`${inputClass} resize-none`}
                placeholder="What happened? Include game name, time, and any error messages."
                required
                maxLength={5000}
              />
              <p className="mt-1 text-xs casino-text-secondary">
                {formData.description.length}/5000
              </p>
            </div>

            <div>
              <label className="cosmic-label mb-2 block">Attachment (optional)</label>
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
                className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-white/20 bg-white/10 px-4 py-3 text-white transition-colors hover:bg-white/20"
              >
                <Upload className="h-5 w-5" />
                <span>Choose file</span>
              </label>
              {attachment && (
                <div className="mt-3 flex items-center gap-3 rounded-lg border border-white/10 bg-white/5 p-3">
                  {attachmentPreview ? (
                    <img
                      src={attachmentPreview}
                      alt="Preview"
                      className="h-14 w-14 rounded object-cover"
                    />
                  ) : (
                    <FileText className="h-8 w-8 text-blue-400" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-white">{attachment.name}</p>
                    <p className="text-xs text-gray-400">
                      {(attachment.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={removeAttachment}
                    className="text-red-400 transition-colors hover:text-red-300"
                    aria-label="Remove attachment"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              )}
              <p className="mt-1 text-xs casino-text-secondary">Images, PDF, DOC, TXT — max 10MB</p>
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn-casino-primary w-full rounded-xl px-6 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
            >
              {submitting ? 'Submitting…' : 'Submit ticket'}
            </button>
          </form>
        </CosmicCard>

        {faqs.length > 0 && (
          <Section
            title="Common questions"
            description="Quick answers — still need help? Use the form above or live chat."
            className="py-0"
          >
            {categories.length > 1 && (
              <div className="mb-4 flex flex-wrap justify-center gap-2">
                {categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => setSelectedCategory(category)}
                    className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all ${
                      selectedCategory === category
                        ? 'bg-[color:var(--casino-highlight-gold)]/15 text-[color:var(--casino-highlight-gold)]'
                        : 'cosmic-card-solid cosmic-body hover:bg-white/[0.06]'
                    }`}
                  >
                    {category.charAt(0).toUpperCase() + category.slice(1)}
                  </button>
                ))}
              </div>
            )}

            {loading ? (
              <div className="flex justify-center py-12">
                <div className="h-10 w-10 animate-spin rounded-full border-b-2 border-white" />
              </div>
            ) : filteredFAQs.length === 0 ? (
              <p className="cosmic-body text-center">No questions in this category.</p>
            ) : (
              <div className="space-y-3">
                {filteredFAQs.map((faq) => (
                  <CosmicCard
                    key={faq._id}
                    variant="solid"
                    padding="none"
                    className="overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedFAQ(expandedFAQ === faq._id ? null : faq._id)
                      }
                      className="flex w-full items-center justify-between px-4 py-3 text-left sm:px-5 sm:py-4"
                    >
                      <span className="pr-4 text-sm font-semibold casino-text-primary sm:text-base">
                        {faq.question}
                      </span>
                      {expandedFAQ === faq._id ? (
                        <ChevronUp className="h-5 w-5 shrink-0 casino-text-secondary" />
                      ) : (
                        <ChevronDown className="h-5 w-5 shrink-0 casino-text-secondary" />
                      )}
                    </button>
                    {expandedFAQ === faq._id && (
                      <div className="border-t border-white/10 px-4 pb-4 pt-3 sm:px-5">
                        <p className="cosmic-body whitespace-pre-line">{faq.answer}</p>
                      </div>
                    )}
                  </CosmicCard>
                ))}
              </div>
            )}
          </Section>
        )}
      </PageShell>
    </>
  );
};

export default Support;
