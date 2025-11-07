import { useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';

// Declare Tawk.to types for TypeScript
declare global {
  interface Window {
    Tawk_API?: {
      login?: (userData: {
        userId: string;
        name?: string;
        email?: string;
        hash: string;
      }, callback?: (error?: any) => void) => void;
      logout?: () => void;
      hideWidget?: () => void;
      showWidget?: () => void;
      onLoad?: () => void;
      onStatusChange?: (status: string) => void;
      isVisitorEngaged?: () => boolean;
      getStatus?: () => string;
      setAttributes?: (attributes: {
        name?: string;
        email?: string;
        [key: string]: any;
      }, callback?: (error?: any) => void) => void;
    };
    Tawk_LoadStart?: Date;
  }
}

const TAWK_TO_PROPERTY_ID = '6909f2f9d1c458194b8b9df2';
const TAWK_TO_WIDGET_ID = '1j97dq87a';

// Get Tawk.to secret key from environment (optional - for HMAC-SHA256)
const TAWK_TO_SECRET_KEY = import.meta.env.VITE_TAWK_TO_SECRET_KEY || '';

/**
 * Generates HMAC-SHA256 hash for Tawk.to authentication
 * This is the recommended method for production use
 */
const generateHMACHash = async (userId: string, secretKey: string): Promise<string> => {
  if (!secretKey) {
    // Fallback to base64 if no secret key is provided
    return btoa(userId);
  }

  try {
    // Use Web Crypto API for HMAC-SHA256
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secretKey);
    const messageData = encoder.encode(userId);

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const hashArray = Array.from(new Uint8Array(signature));
    const hashBase64 = btoa(String.fromCharCode(...hashArray));
    
    return hashBase64;
  } catch (error) {
    console.error('Error generating HMAC hash:', error);
    // Fallback to base64
    return btoa(userId);
  }
};

/**
 * Generates a hash for Tawk.to authentication
 * Uses HMAC-SHA256 if secret key is available, otherwise falls back to base64
 */
const generateHash = async (userId: string): Promise<string> => {
  if (TAWK_TO_SECRET_KEY) {
    return await generateHMACHash(userId, TAWK_TO_SECRET_KEY);
  }
  // Fallback to base64 encoding
  return btoa(userId);
};

const TawkToWidget = () => {
  const { isAuthenticated, user } = useAuthStore();
  const loginAttemptedRef = useRef(false);
  const scriptLoadedRef = useRef(false);

  useEffect(() => {
    // Only load Tawk.to for authenticated users
    if (!isAuthenticated || !user) {
      // Hide widget if user logs out
      if (window.Tawk_API) {
        window.Tawk_API.hideWidget?.();
        window.Tawk_API.logout?.();
      }
      loginAttemptedRef.current = false;
      return;
    }

    // Initialize Tawk_API if not already initialized
    window.Tawk_API = window.Tawk_API || {};
    window.Tawk_LoadStart = new Date();

    // Function to login user to Tawk.to
    const loginUser = async () => {
      if (!window.Tawk_API || !user || loginAttemptedRef.current) {
        return;
      }

      // Check if Tawk.to is ready
      if (!window.Tawk_API.login) {
        console.warn('Tawk.to API not ready yet, retrying...');
        setTimeout(() => loginUser(), 1000);
        return;
      }

      loginAttemptedRef.current = true;

      try {
        const userId = user.id;
        const userHash = await generateHash(userId);

        // Prepare user info for attributes
        let userName: string | undefined;
        if (user.firstName || user.lastName) {
          userName = [user.firstName, user.lastName].filter(Boolean).join(' ');
          if (!userName.trim()) userName = undefined;
        } else if (user.username && user.username.trim()) {
          userName = user.username;
        }

        const userEmail = user.email && user.email.trim() && user.email.includes('@') 
          ? user.email 
          : undefined;

        console.log('Attempting Tawk.to login with:', {
          userId,
          hashLength: userHash.length,
          userName,
          userEmail
        });

        // Step 1: Login with ONLY required fields (userId and hash)
        // This is the most reliable method based on Tawk.to documentation
        window.Tawk_API.login(
          {
            userId: userId,
            hash: userHash,
          },
          (loginError) => {
            if (loginError) {
              console.error('❌ Tawk.to login failed:', loginError);
              loginAttemptedRef.current = false; // Allow retry
            } else {
              console.log('✅ Tawk.to user logged in successfully');
              
              // Step 2: Set visitor attributes separately using setAttributes
              // This is more reliable than passing name/email in login()
              if ((userName || userEmail) && window.Tawk_API?.setAttributes) {
                const attributes: { name?: string; email?: string } = {};
                if (userName) attributes.name = userName;
                if (userEmail) attributes.email = userEmail;

                console.log('Setting Tawk.to visitor attributes:', attributes);
                
                window.Tawk_API.setAttributes(
                  attributes,
                  (attrError) => {
                    if (attrError) {
                      console.error('❌ Failed to set Tawk.to attributes:', attrError);
                    } else {
                      console.log('✅ Tawk.to visitor attributes set successfully');
                    }
                    // Show widget regardless of attribute setting result
                    setTimeout(() => {
                      window.Tawk_API?.showWidget?.();
                    }, 500);
                  }
                );
              } else {
                // No attributes to set or setAttributes not available
                console.log('ℹ️ Skipping attribute setting (no name/email or setAttributes unavailable)');
                setTimeout(() => {
                  window.Tawk_API?.showWidget?.();
                }, 500);
              }
            }
          }
        );
      } catch (error) {
        console.error('❌ Error during Tawk.to login:', error);
        loginAttemptedRef.current = false; // Allow retry
      }
    };

    // Check if script is already loaded
    const existingScript = document.querySelector(
      `script[src*="embed.tawk.to/${TAWK_TO_PROPERTY_ID}"]`
    );

    if (!existingScript && !scriptLoadedRef.current) {
      scriptLoadedRef.current = true;
      
      // Set up onLoad callback BEFORE loading script
      window.Tawk_API.onLoad = () => {
        console.log('✅ Tawk.to script loaded, attempting login...');
        // Wait a moment for Tawk.to to fully initialize
        setTimeout(() => {
          loginUser();
        }, 1500);
      };

      // Load Tawk.to script
      const script = document.createElement('script');
      script.async = true;
      script.src = `https://embed.tawk.to/${TAWK_TO_PROPERTY_ID}/${TAWK_TO_WIDGET_ID}`;
      script.charset = 'UTF-8';
      script.setAttribute('crossorigin', '*');

      script.onload = () => {
        console.log('📦 Tawk.to script loaded');
        // The onLoad callback will handle the login
      };

      script.onerror = () => {
        console.error('❌ Failed to load Tawk.to script');
        scriptLoadedRef.current = false;
      };

      const firstScript = document.getElementsByTagName('script')[0];
      if (firstScript && firstScript.parentNode) {
        firstScript.parentNode.insertBefore(script, firstScript);
      }
    } else if (existingScript && window.Tawk_API?.login) {
      // Script already loaded and API is ready
      console.log('🔄 Tawk.to already loaded, attempting login...');
      setTimeout(() => {
        loginUser();
      }, 500);
    } else if (existingScript) {
      // Script loaded but API not ready yet
      console.log('⏳ Tawk.to script loaded but API not ready, waiting...');
      window.Tawk_API.onLoad = () => {
        setTimeout(() => {
          loginUser();
        }, 1000);
      };
    }

    // Cleanup function
    return () => {
      // Don't logout on unmount, only when user actually logs out
      // This prevents widget from disappearing during navigation
    };
  }, [isAuthenticated, user]);

  // Handle logout - hide widget when user logs out
  useEffect(() => {
    if (!isAuthenticated && window.Tawk_API) {
      console.log('👋 User logged out, hiding Tawk.to widget');
      window.Tawk_API.hideWidget?.();
      window.Tawk_API.logout?.();
      loginAttemptedRef.current = false;
    }
  }, [isAuthenticated]);

  // This component doesn't render anything
  return null;
};

export default TawkToWidget;

