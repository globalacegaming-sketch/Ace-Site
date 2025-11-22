/**
 * Logger utility for environment-based logging
 * Only shows verbose logs in development mode
 */

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export const logger = {
  // Always log errors
  error: (...args: any[]) => {
    console.error(...args);
  },

  // Always log warnings
  warn: (...args: any[]) => {
    console.warn(...args);
  },

  // Info logs - only in development
  info: (...args: any[]) => {
    if (isDevelopment) {
      console.log(...args);
    }
  },

  // Debug logs - only in development
  debug: (...args: any[]) => {
    if (isDevelopment) {
      console.log('🔍 [DEBUG]', ...args);
    }
  },

  // Success logs - show in both dev and prod (important status)
  success: (...args: any[]) => {
    console.log(...args);
  },

  // Initialization logs - show in both dev and prod (important)
  init: (...args: any[]) => {
    console.log(...args);
  }
};

export default logger;

