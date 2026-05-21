import User from '../models/User';

/**
 * Build a site username slug from first name (letters/numbers only, lowercase).
 */
export function baseUsernameFromFirstName(firstName: string): string {
  const normalized = (firstName || '')
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();

  let base = normalized;
  if (base.length < 3) {
    base = `user${base}`.replace(/[^a-z0-9]/g, '');
  }
  if (base.length < 3) {
    base = 'user';
  }
  return base.slice(0, 24);
}

/**
 * Unique username for User.username (3–30 chars, alphanumeric + underscore).
 */
export async function generateUniqueUsername(firstName: string): Promise<string> {
  const base = baseUsernameFromFirstName(firstName);
  let candidate = base;
  const maxAttempts = 40;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const existing = await User.findOne({ username: candidate }).select('_id').lean();
    if (!existing) {
      return candidate;
    }
    const suffix =
      attempt < 15 ? String(attempt + 2) : Math.random().toString(36).substring(2, 6);
    const trimmedBase = base.slice(0, Math.max(3, 30 - suffix.length - 1));
    candidate = `${trimmedBase}_${suffix}`;
  }

  return `${base.slice(0, 18)}_${Date.now().toString().slice(-8)}`;
}
