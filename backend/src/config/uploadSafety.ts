import path from 'path';
import crypto from 'crypto';

/** Extension written to disk for each accepted MIME type. Anything not listed is rejected. */
export const SAFE_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
  'text/plain': '.txt',
  'application/msword': '.doc',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'application/vnd.ms-excel': '.xls',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx'
};

/** Extensions served inline from /uploads; everything else is forced to download. */
export const INLINE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp']);

export const isAllowedUpload = (mimetype: string, allowed: readonly string[]): boolean =>
  allowed.includes(mimetype) && mimetype in SAFE_EXTENSIONS;

/**
 * Builds a disk filename whose extension is derived from the (already validated) MIME type,
 * so a client cannot store e.g. `evil.html` labelled as `image/png`.
 */
export const buildSafeUploadFilename = (originalname: string, mimetype: string): string => {
  const ext = SAFE_EXTENSIONS[mimetype] ?? '.bin';
  const base = path
    .basename(originalname, path.extname(originalname))
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60) || 'file';
  return `${Date.now()}-${crypto.randomBytes(4).toString('hex')}-${base}${ext}`;
};
