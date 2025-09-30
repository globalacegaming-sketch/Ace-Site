// API utility functions
export const getApiBaseUrl = (): string => {
  return import.meta.env.VITE_API_BASE_URL;
};

export const getGamesApiUrl = (): string => {
  return import.meta.env.VITE_GAMES_API_URL;
};
