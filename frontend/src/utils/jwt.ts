// JWT utility functions for client-side token validation

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
  exp?: number;
  iat?: number;
}

/**
 * Decode JWT token without verification (client-side only)
 * Note: This does NOT verify the signature, only decodes the payload
 */
export const decodeToken = (token: string): JWTPayload | null => {
  try {
    const base64Url = token.split('.')[1];
    if (!base64Url) return null;
    
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map((c) => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    
    return JSON.parse(jsonPayload) as JWTPayload;
  } catch (error) {
    console.error('Error decoding token:', error);
    return null;
  }
};

/**
 * Check if token is expired
 */
export const isTokenExpired = (token: string): boolean => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return true;
  
  // exp is in seconds, Date.now() is in milliseconds
  const expirationTime = decoded.exp * 1000;
  const currentTime = Date.now();
  
  // Add 5 minute buffer to account for clock skew
  return currentTime >= (expirationTime - 5 * 60 * 1000);
};

/**
 * Get token expiration time in milliseconds
 */
export const getTokenExpirationTime = (token: string): number | null => {
  const decoded = decodeToken(token);
  if (!decoded || !decoded.exp) return null;
  
  return decoded.exp * 1000;
};

