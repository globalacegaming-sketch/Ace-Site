import fs from 'fs';
import path from 'path';

/** CID must match attachment `name` for Brevo/Gmail inline images. */
export const EMAIL_LOGO_CID = 'logo-email.png';

const LOGO_FILE_PATHS = [
  path.join(__dirname, 'logo-email.png'),
  path.join(process.cwd(), 'src/templates/email/logo-email.png'),
  path.join(process.cwd(), 'dist/templates/email/logo-email.png'),
  path.join(process.cwd(), 'backend/src/templates/email/logo-email.png'),
];

let cachedLogoUrl: string | null = null;
let cachedLogoBuffer: Buffer | null = null;
let resolvedLogoPath: string | null = null;

function resolveLogoPath(): string | null {
  if (resolvedLogoPath && fs.existsSync(resolvedLogoPath)) {
    return resolvedLogoPath;
  }
  for (const logoPath of LOGO_FILE_PATHS) {
    if (fs.existsSync(logoPath)) {
      try {
        const stat = fs.statSync(logoPath);
        if (stat.size > 0 && stat.size <= 120_000) {
          resolvedLogoPath = logoPath;
          return logoPath;
        }
      } catch {
        continue;
      }
    }
  }
  return null;
}

function readLogoBuffer(): Buffer | null {
  if (cachedLogoBuffer) {
    return cachedLogoBuffer;
  }
  const logoPath = resolveLogoPath();
  if (!logoPath) {
    return null;
  }
  try {
    cachedLogoBuffer = fs.readFileSync(logoPath);
    return cachedLogoBuffer;
  } catch {
    return null;
  }
}

function getApiPublicBase(): string {
  const raw =
    process.env.API_PUBLIC_URL ||
    process.env.BACKEND_URL ||
    `http://localhost:${process.env.PORT || 3000}`;
  return raw.replace(/\/$/, '');
}

/** Absolute path to bundled logo file, if present. */
export function getEmailLogoFilePath(): string | null {
  return resolveLogoPath();
}

/**
 * URL used in HTML (previews + before CID swap on send).
 * Prefers API-hosted asset so admin preview works without frontend running.
 */
export function getEmailLogoUrl(): string {
  if (cachedLogoUrl) {
    return cachedLogoUrl;
  }

  if (process.env.EMAIL_LOGO_BASE_URL) {
    cachedLogoUrl = `${process.env.EMAIL_LOGO_BASE_URL.replace(/\/$/, '')}/logo-email.png`;
    return cachedLogoUrl;
  }

  if (resolveLogoPath()) {
    cachedLogoUrl = `${getApiPublicBase()}/api/email-promotions/assets/logo-email.png`;
    return cachedLogoUrl;
  }

  const frontend =
    process.env.FRONTEND_URL ||
    process.env.PRODUCTION_FRONTEND_URL ||
    'https://www.globalacegaming.com';
  cachedLogoUrl = `${frontend.replace(/\/$/, '')}/logo-email.png`;
  return cachedLogoUrl;
}

/** Use in HTML — URL for previews; replaced with cid: when sending via Brevo. */
export function getEmailLogoSrc(): string {
  return getEmailLogoUrl();
}

export function getEmailLogoCidSrc(): string {
  return `cid:${EMAIL_LOGO_CID}`;
}

export function getEmailLogoAttachment(): { name: string; content: string } | null {
  const buffer = readLogoBuffer();
  if (!buffer) {
    return null;
  }
  return {
    name: EMAIL_LOGO_CID,
    content: buffer.toString('base64'),
  };
}

/** Inline logo for Brevo + Gmail/Outlook (CID attachment). */
export function prepareHtmlWithInlineLogo(html: string): {
  html: string;
  attachment: { name: string; content: string } | null;
} {
  const attachment = getEmailLogoAttachment();
  const logoUrl = getEmailLogoUrl();

  if (!attachment) {
    return { html, attachment: null };
  }

  const cidSrc = getEmailLogoCidSrc();
  const htmlWithCid = html.split(logoUrl).join(cidSrc);

  return {
    html: htmlWithCid,
    attachment,
  };
}
