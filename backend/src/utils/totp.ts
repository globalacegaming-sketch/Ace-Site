import crypto from 'crypto';
import User from '../models/User';

// ── Lightweight TOTP helpers (no heavy otplib dependency) ──
const BASE32_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function generateBase32Secret(bytes = 20): string {
  const buf = crypto.randomBytes(bytes);
  let out = '';
  let bits = 0;
  let value = 0;
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += BASE32_ALPHABET[(value >> (bits - 5)) & 0x1f];
      bits -= 5;
    }
  }
  if (bits > 0) out += BASE32_ALPHABET[(value << (5 - bits)) & 0x1f];
  return out;
}

function base32Decode(str: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const c of str.toUpperCase().replace(/=+$/, '')) {
    const idx = BASE32_ALPHABET.indexOf(c);
    if (idx < 0) continue;
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

function generateTOTP(secret: string, time?: number): string {
  const t = Math.floor((time ?? Date.now() / 1000) / 30);
  const buf = Buffer.alloc(8);
  buf.writeUInt32BE(0, 0);
  buf.writeUInt32BE(t, 4);
  const key = base32Decode(secret);
  const hmac = crypto.createHmac('sha1', key).update(buf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code =
    ((hmac[offset] & 0x7f) << 24) |
    ((hmac[offset + 1] & 0xff) << 16) |
    ((hmac[offset + 2] & 0xff) << 8) |
    (hmac[offset + 3] & 0xff);
  return (code % 1_000_000).toString().padStart(6, '0');
}

export function verifyTOTP(token: string, secret: string, window = 1): boolean {
  const now = Math.floor(Date.now() / 1000);
  for (let i = -window; i <= window; i++) {
    const expected = generateTOTP(secret, now + i * 30);
    if (token.length === expected.length && crypto.timingSafeEqual(Buffer.from(token), Buffer.from(expected))) {
      return true;
    }
  }
  return false;
}

export function buildOtpauthURI(email: string, secret: string): string {
  const issuer = encodeURIComponent('Global Ace Gaming');
  const account = encodeURIComponent(email);
  return `otpauth://totp/${issuer}:${account}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=6&period=30`;
}

/**
 * Checks a 6-digit TOTP code, or else a backup code (which is consumed atomically so it
 * can only be used once). The user document must include `twoFactorSecret`.
 */
export async function verifySecondFactor(
  user: { _id: unknown; twoFactorSecret?: string },
  rawCode: unknown
): Promise<boolean> {
  if (typeof rawCode !== 'string') return false;
  const code = rawCode.replace(/\s+/g, '');
  if (!code) return false;

  if (/^\d{6}$/.test(code)) {
    return !!user.twoFactorSecret && verifyTOTP(code, user.twoFactorSecret);
  }

  const backupCode = code.toUpperCase();
  if (!/^[0-9A-F]{8}$/.test(backupCode)) return false;
  const consumed = await User.updateOne(
    { _id: user._id, twoFactorBackupCodes: backupCode },
    { $pull: { twoFactorBackupCodes: backupCode } }
  );
  return consumed.modifiedCount === 1;
}
