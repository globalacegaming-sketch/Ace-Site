import validator from 'validator';

/**
 * Sanitize string input to prevent XSS attacks
 * Removes HTML tags and escapes special characters
 */
export const sanitizeString = (input: string | undefined | null): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Remove HTML tags and escape special characters
  return validator.escape(validator.stripLow(input.trim()));
};

/**
 * Sanitize text input (allows newlines for multi-line text)
 */
export const sanitizeText = (input: string | undefined | null): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  // Strip low characters but keep newlines
  let sanitized = validator.stripLow(input.trim(), { keepNewLines: true });
  // Escape HTML but preserve newlines
  sanitized = validator.escape(sanitized);
  return sanitized;
};

/**
 * Sanitize email input
 */
export const sanitizeEmail = (input: string | undefined | null): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  const trimmed = input.trim().toLowerCase();
  // Validate and sanitize email
  if (validator.isEmail(trimmed)) {
    return validator.normalizeEmail(trimmed) || trimmed;
  }
  return trimmed;
};

/**
 * Sanitize URL input
 */
export const sanitizeUrl = (input: string | undefined | null): string => {
  if (!input || typeof input !== 'string') {
    return '';
  }
  
  const trimmed = input.trim();
  // Validate URL format
  if (validator.isURL(trimmed, { require_protocol: false })) {
    return validator.escape(trimmed);
  }
  return validator.escape(trimmed);
};

/**
 * Sanitize object with string properties recursively
 */
export const sanitizeObject = <T extends Record<string, any>>(obj: T): T => {
  const sanitized = { ...obj } as T;
  
  for (const key in sanitized) {
    if (typeof sanitized[key] === 'string') {
      (sanitized as any)[key] = sanitizeString(sanitized[key] as string);
    } else if (typeof sanitized[key] === 'object' && sanitized[key] !== null && !Array.isArray(sanitized[key])) {
      (sanitized as any)[key] = sanitizeObject(sanitized[key]);
    } else if (Array.isArray(sanitized[key])) {
      (sanitized as any)[key] = sanitized[key].map((item: any) => 
        typeof item === 'string' ? sanitizeString(item) : 
        typeof item === 'object' && item !== null ? sanitizeObject(item) : 
        item
      );
    }
  }
  
  return sanitized;
};

