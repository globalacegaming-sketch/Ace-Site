// Environment Variables Test Component
import { getApiBaseUrl, getGamesApiUrl } from '../utils/api';

const EnvTest = () => {
  const apiBaseUrl = getApiBaseUrl();
  const gamesApiUrl = getGamesApiUrl();
  
  console.log('Environment Variables Test:');
  console.log('VITE_API_BASE_URL:', import.meta.env.VITE_API_BASE_URL);
  console.log('VITE_GAMES_API_URL:', import.meta.env.VITE_GAMES_API_URL);
  console.log('getApiBaseUrl():', apiBaseUrl);
  console.log('getGamesApiUrl():', gamesApiUrl);
  
  return (
    <div style={{ padding: '20px', background: '#f0f0f0', margin: '10px' }}>
      <h3>Environment Variables Test</h3>
      <p><strong>VITE_API_BASE_URL:</strong> {import.meta.env.VITE_API_BASE_URL || 'NOT SET'}</p>
      <p><strong>VITE_GAMES_API_URL:</strong> {import.meta.env.VITE_GAMES_API_URL || 'NOT SET'}</p>
      <p><strong>getApiBaseUrl():</strong> {apiBaseUrl || 'NOT SET'}</p>
      <p><strong>getGamesApiUrl():</strong> {gamesApiUrl || 'NOT SET'}</p>
    </div>
  );
};

export default EnvTest;
