import { useState, useEffect } from 'react';
import { X, AlertCircle, AlertTriangle, CheckCircle, Info } from 'lucide-react';
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';
import { getApiBaseUrl } from '../utils/api';

interface Notice {
  _id: string;
  title: string;
  message: string;
  type: 'info' | 'warning' | 'success' | 'error';
  priority: number;
}

const NoticePopup: React.FC = () => {
  const API_BASE_URL = getApiBaseUrl();
  const { isAuthenticated } = useAuthStore();
  const [notices, setNotices] = useState<Notice[]>([]);
  const [dismissedNotices, setDismissedNotices] = useState<string[]>([]);

  useEffect(() => {
    if (isAuthenticated) {
      loadNotices();
    }
  }, [isAuthenticated]);

  const loadNotices = async () => {
    try {
      const response = await axios.get(`${API_BASE_URL}/notices/active`);
      if (response.data.success) {
        // Get dismissed notices from localStorage
        const dismissed = JSON.parse(localStorage.getItem('dismissed_notices') || '[]');
        setDismissedNotices(dismissed);
        
        // Filter out dismissed notices
        const activeNotices = (response.data.data || []).filter(
          (notice: Notice) => !dismissed.includes(notice._id)
        );
        setNotices(activeNotices);
      }
    } catch (error) {
      console.error('Failed to load notices:', error);
    }
  };

  const handleDismiss = (noticeId: string) => {
    const newDismissed = [...dismissedNotices, noticeId];
    setDismissedNotices(newDismissed);
    localStorage.setItem('dismissed_notices', JSON.stringify(newDismissed));
    setNotices(notices.filter(n => n._id !== noticeId));
  };

  const getIcon = (type: Notice['type']) => {
    switch (type) {
      case 'info':
        return <Info className="w-5 h-5" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5" />;
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Info className="w-5 h-5" />;
    }
  };

  const getBgColor = (type: Notice['type']) => {
    switch (type) {
      case 'info':
        return 'bg-blue-50 border-blue-200';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200';
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      default:
        return 'bg-blue-50 border-blue-200';
    }
  };

  const getTextColor = (type: Notice['type']) => {
    switch (type) {
      case 'info':
        return 'text-blue-800';
      case 'warning':
        return 'text-yellow-800';
      case 'success':
        return 'text-green-800';
      case 'error':
        return 'text-red-800';
      default:
        return 'text-blue-800';
    }
  };

  const getIconColor = (type: Notice['type']) => {
    switch (type) {
      case 'info':
        return 'text-blue-600';
      case 'warning':
        return 'text-yellow-600';
      case 'success':
        return 'text-green-600';
      case 'error':
        return 'text-red-600';
      default:
        return 'text-blue-600';
    }
  };

  if (!isAuthenticated || notices.length === 0) return null;

  return (
    <div className="fixed top-4 right-4 z-50 space-y-3 max-w-md">
      {notices.map((notice) => (
        <div
          key={notice._id}
          className={`${getBgColor(notice.type)} border-2 rounded-lg shadow-xl p-4 animate-slideUp`}
        >
          <div className="flex items-start gap-3">
            <div className={`flex-shrink-0 ${getIconColor(notice.type)}`}>
              {getIcon(notice.type)}
            </div>
            <div className="flex-1 min-w-0">
              <h4 className={`font-semibold ${getTextColor(notice.type)} mb-1`}>
                {notice.title}
              </h4>
              <p className={`text-sm ${getTextColor(notice.type)} opacity-90`}>
                {notice.message}
              </p>
            </div>
            <button
              onClick={() => handleDismiss(notice._id)}
              className={`flex-shrink-0 ${getTextColor(notice.type)} hover:opacity-70 transition-opacity`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};

export default NoticePopup;

