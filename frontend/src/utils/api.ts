// API utility functions
export const getApiBaseUrl = (): string => {
  const baseUrl = import.meta.env.VITE_API_BASE_URL;
  if (!baseUrl) {
    // Fallback for production if env var is not set
    return 'https://global-ace-gaming-backend.onrender.com/api';
  }
  return baseUrl;
};

export const getGamesApiUrl = (): string => {
  const gamesUrl = import.meta.env.VITE_GAMES_API_URL;
  if (!gamesUrl) {
    // Fallback for production if env var is not set
    return 'https://global-ace-gaming-backend.onrender.com/api/games/fortune-panda';
  }
  return gamesUrl;
};

export const getWsBaseUrl = (): string => {
  const wsUrl = import.meta.env.VITE_WS_URL;
  if (wsUrl) {
    return wsUrl;
  }

  const apiUrl = getApiBaseUrl();
  if (apiUrl.startsWith('http')) {
    return apiUrl.replace(/^http/, 'ws').replace(/\/api$/, '');
  }

  return 'ws://localhost:3001';
};

// Get attachment URL - handles both Cloudinary URLs (full URLs) and local paths
export const getAttachmentUrl = (attachmentUrl: string): string => {
  // If it's already a full URL (Cloudinary), return as-is
  if (attachmentUrl.startsWith('http://') || attachmentUrl.startsWith('https://')) {
    return attachmentUrl;
  }
  // Otherwise, prepend the API base URL for local paths (backward compatibility)
  const apiBaseUrl = getApiBaseUrl();
  // Remove /api suffix if present, as local paths already include /uploads
  const baseUrl = apiBaseUrl.replace(/\/api$/, '');
  return `${baseUrl}${attachmentUrl}`;
};

// Check if attachment is an image based on MIME type or file extension
export const isImageAttachment = (attachmentType?: string, attachmentName?: string): boolean => {
  if (attachmentType) {
    return attachmentType.startsWith('image/');
  }
  if (attachmentName) {
    const extension = attachmentName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'svg'].includes(extension || '');
  }
  return false;
};