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
