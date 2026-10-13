import { escape as escapeHtml } from 'validator';

/** Matches {Name}, {name}, and { Name }. */
export const NAME_TOKEN = /\{\s*name\s*\}/gi;

export const PREVIEW_FIRST_NAME = 'Alex';

export function containsNameToken(value: string | undefined | null): boolean {
  if (!value) return false;
  return /\{\s*name\s*\}/i.test(value);
}

/** First name as the reader should see it. Missing names stay readable in a sentence. */
export function displayFirstName(firstName?: string | null): string {
  const trimmed = (firstName || '').replace(/\s+/g, ' ').trim();
  return trimmed || 'there';
}

export function applyRecipientName(
  value: string,
  firstName: string | undefined | null,
  mode: 'html' | 'text'
): string {
  const name = displayFirstName(firstName);
  const replacement = mode === 'html' ? escapeHtml(name) : name;
  return (value || '').replace(/\{\s*name\s*\}/gi, replacement);
}
