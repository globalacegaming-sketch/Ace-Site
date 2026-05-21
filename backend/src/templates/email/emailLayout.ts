import { escape as escapeHtml } from 'validator';
import { getEmailLogoSrc } from './emailLogo';
export const SITE_NAME = 'Global Ace Gaming';
export const TAGLINE = "America's Ace Gaming";
export const SUPPORT_EMAIL = 'support@globalacegaming.com';

export const EMAIL_COLORS = {
  primaryDark: '#0A0A0F',
  secondaryDark: '#1B1B2F',
  cardBg: '#14141F',
  highlightGold: '#FFD700',
  goldDark: '#FFA000',
  accentPurple: '#9C27B0',
  accentMagenta: '#E91E8C',
  accentCyan: '#00E5FF',
  accentBlue: '#00B0FF',
  textPrimary: '#F5F5F5',
  textSecondary: '#B0B0B0',
  border: '#2C2C3A',
  success: '#22C55E',
  danger: '#EF4444',
  warning: '#F59E0B',
  info: '#3B82F6',
} as const;

export type AccentTone = 'gold' | 'purple' | 'success' | 'danger' | 'warning' | 'info';

function accentFor(tone: AccentTone): string {
  const map: Record<AccentTone, string> = {
    gold: EMAIL_COLORS.highlightGold,
    purple: EMAIL_COLORS.accentMagenta,
    success: EMAIL_COLORS.success,
    danger: EMAIL_COLORS.danger,
    warning: EMAIL_COLORS.warning,
    info: EMAIL_COLORS.info,
  };
  return map[tone];
}

export function getFrontendUrl(): string {
  const url = process.env.FRONTEND_URL || process.env.PRODUCTION_FRONTEND_URL || 'https://globalacegaming.com';
  return url.replace(/\/$/, '');
}

export function textToHtmlLines(text: string): string {
  return escapeHtml(text).replace(/\n/g, '<br />');
}

export function buildCtaButton(href: string, label: string, tone: AccentTone = 'gold'): string {
  const bg = accentFor(tone);
  const textColor = tone === 'gold' ? EMAIL_COLORS.primaryDark : '#FFFFFF';
  const safeHref = escapeHtml(href);
  const safeLabel = escapeHtml(label);

  return `
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
  <tr>
    <td align="center" style="border-radius:8px;background-color:${bg};">
      <!--[if mso]>
      <v:roundrect xmlns:v="urn:schemas-microsoft-com:vml" xmlns:w="urn:schemas-microsoft-com:office:word" href="${safeHref}" style="height:48px;v-text-anchor:middle;width:240px;" arcsize="12%" strokecolor="${bg}" fillcolor="${bg}">
        <w:anchorlock/>
        <center style="color:${textColor};font-family:Arial,sans-serif;font-size:16px;font-weight:bold;">${safeLabel}</center>
      </v:roundrect>
      <![endif]-->
      <!--[if !mso]><!-->
      <a href="${safeHref}" target="_blank" style="display:inline-block;padding:14px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;font-weight:bold;color:${textColor};text-decoration:none;border-radius:8px;background-color:${bg};mso-padding-alt:0;">
        ${safeLabel}
      </a>
      <!--<![endif]-->
    </td>
  </tr>
</table>`.trim();
}

export function buildDetailBox(
  rows: Array<{ label: string; value: string }>,
  tone: AccentTone = 'gold'
): string {
  const accent = accentFor(tone);
  const rowHtml = rows
    .map(
      (r) => `
        <tr>
          <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${EMAIL_COLORS.textSecondary};width:42%;vertical-align:top;">
            ${escapeHtml(r.label)}
          </td>
          <td style="padding:8px 0;font-family:Arial,Helvetica,sans-serif;font-size:15px;color:${EMAIL_COLORS.textPrimary};font-weight:bold;vertical-align:top;">
            ${escapeHtml(r.value)}
          </td>
        </tr>`
    )
    .join('');

  return `
<table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:24px 0;">
  <tr>
    <td style="background-color:${EMAIL_COLORS.cardBg};border:1px solid ${EMAIL_COLORS.border};border-left:4px solid ${accent};border-radius:8px;padding:20px 24px;">
      <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0">
        ${rowHtml}
      </table>
    </td>
  </tr>
</table>`.trim();
}

export function buildVerificationCodeBlock(code: string): string {
  const safeCode = escapeHtml(code);
  return `
<table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:28px auto;">
  <tr>
    <td align="center" style="background-color:${EMAIL_COLORS.cardBg};border:2px solid ${EMAIL_COLORS.highlightGold};border-radius:12px;padding:24px 40px;">
      <p style="margin:0 0 8px;font-family:Arial,Helvetica,sans-serif;font-size:13px;color:${EMAIL_COLORS.textSecondary};text-transform:uppercase;letter-spacing:1px;">Verification Code</p>
      <p style="margin:0;font-family:'Courier New',Courier,monospace;font-size:36px;font-weight:bold;letter-spacing:10px;color:${EMAIL_COLORS.highlightGold};">${safeCode}</p>
    </td>
  </tr>
</table>`.trim();
}

export interface EmailShellOptions {
  pageTitle: string;
  headline: string;
  subtitle?: string;
  bodyHtml: string;
  accentTone?: AccentTone;
  /** Extra rows inside content area (e.g. attachment block) */
  extraContentHtml?: string;
  /** Include full footer with nav links & social — default true for promo, false for transactional */
  fullFooter?: boolean;
}

function buildFooter(fullFooter: boolean): string {
  const c = EMAIL_COLORS;
  const frontendUrl = getFrontendUrl();
  const siteDomain = frontendUrl.replace(/^https?:\/\//, '');
  const year = new Date().getFullYear();

  const navLinks = fullFooter
    ? `
    <p style="text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:0 0 16px;color:${c.textSecondary};line-height:1.6;">
      <a href="${frontendUrl}/" style="color:${c.highlightGold};text-decoration:none;">Home</a>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <a href="${frontendUrl}/games" style="color:${c.highlightGold};text-decoration:none;">Games</a>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <a href="${frontendUrl}/about-us" style="color:${c.highlightGold};text-decoration:none;">About Us</a>
      &nbsp;&nbsp;|&nbsp;&nbsp;
      <a href="${frontendUrl}/support" style="color:${c.highlightGold};text-decoration:none;">Support</a>
    </p>
    <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="margin:0 0 18px;">
      <tr><td style="height:1px;background-color:${c.border};font-size:0;line-height:0;">&nbsp;</td></tr>
    </table>`
    : '';

  const social = fullFooter
    ? `
    <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 18px;">
      <tr>
        <td style="padding:0 10px;">
          <a href="https://www.facebook.com/globalacegaming" target="_blank" style="color:${c.accentCyan};font-family:Arial,Helvetica,sans-serif;font-size:13px;text-decoration:none;">Facebook</a>
        </td>
        <td style="padding:0 10px;color:${c.border};">|</td>
        <td style="padding:0 10px;">
          <a href="https://t.me/teamglobalace" target="_blank" style="color:${c.accentCyan};font-family:Arial,Helvetica,sans-serif;font-size:13px;text-decoration:none;">Telegram</a>
        </td>
      </tr>
    </table>`
    : '';

  return `
    ${navLinks}
    <p style="text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:0 0 12px;color:${c.textSecondary};line-height:1.5;">
      <strong style="color:${c.textPrimary};display:block;margin-bottom:4px;">Questions?</strong>
      <a href="mailto:${SUPPORT_EMAIL}" style="color:${c.highlightGold};text-decoration:none;">${SUPPORT_EMAIL}</a>
    </p>
    <p style="text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:14px;margin:0 0 18px;">
      <a href="${frontendUrl}" style="color:${c.accentCyan};text-decoration:none;font-weight:bold;">${escapeHtml(siteDomain)}</a>
    </p>
    ${social}
    <p style="text-align:center;font-family:Arial,Helvetica,sans-serif;font-size:12px;color:${c.textSecondary};line-height:1.6;margin:0;">
      &copy; ${year} ${SITE_NAME}. All rights reserved.<br />
      Intended for users 18 years and older.
    </p>`;
}

/** Table-based shell — Gmail & Outlook safe. */
export function buildEmailShell(opts: EmailShellOptions): string {
  const c = EMAIL_COLORS;
  const accent = accentFor(opts.accentTone ?? 'gold');
  const subtitle = opts.subtitle
    ? `<p style="margin:6px 0 0;font-family:Arial,Helvetica,sans-serif;font-size:16px;color:${c.textSecondary};line-height:1.35;">${escapeHtml(opts.subtitle)}</p>`
    : '';
  const extra = opts.extraContentHtml ?? '';
  const footer = buildFooter(opts.fullFooter !== false);
  const pageTitle = escapeHtml(opts.pageTitle);
  const headline = escapeHtml(opts.headline);
  const logoSrc = getEmailLogoSrc();

  return `<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:o="urn:schemas-microsoft-com:office:office">
<head>
  <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="dark" />
  <meta name="supported-color-schemes" content="dark" />
  <title>${pageTitle} - ${SITE_NAME}</title>
  <!--[if mso]>
  <noscript>
    <xml>
      <o:OfficeDocumentSettings>
        <o:PixelsPerInch>96</o:PixelsPerInch>
      </o:OfficeDocumentSettings>
    </xml>
  </noscript>
  <![endif]-->
  <style type="text/css">
    body { margin:0 !important; padding:0 !important; width:100% !important; -webkit-text-size-adjust:100%; -ms-text-size-adjust:100%; }
    table { border-collapse:collapse; mso-table-lspace:0pt; mso-table-rspace:0pt; }
    img { border:0; height:auto; line-height:100%; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; display:block; }
    a { color:${c.highlightGold}; }
    @media only screen and (max-width:600px) {
      .email-container { width:100% !important; max-width:100% !important; }
      .email-content { padding:24px 20px !important; }
      .email-header { padding:18px 16px !important; }
    }
  </style>
</head>
<body style="margin:0;padding:0;background-color:${c.primaryDark};font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:${c.primaryDark};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" class="email-container" width="600" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;width:100%;background-color:${c.secondaryDark};border:1px solid ${c.border};">
          <!-- Header -->
          <tr>
            <td class="email-header" align="center" style="padding:20px 24px 18px;text-align:center;background-color:${c.secondaryDark};border-top:4px solid ${accent};">
              <img src="${logoSrc}" alt="${SITE_NAME}" width="160" height="160" style="width:160px;max-width:160px;height:auto;margin:0 auto 8px;display:block;line-height:0;font-size:0;" />
              <table role="presentation" border="0" cellspacing="0" cellpadding="0" align="center" style="margin:0 auto 8px;">
                <tr>
                  <td align="center" style="padding:5px 16px;background-color:#14120A;border:1px solid #665928;border-radius:50px;line-height:1.2;">
                    <p style="margin:0;font-family:Arial,Helvetica,sans-serif;font-size:12px;font-weight:600;letter-spacing:0.12em;text-transform:uppercase;color:${c.highlightGold};line-height:1.2;">${TAGLINE}</p>
                  </td>
                </tr>
              </table>
              <h1 style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;font-size:24px;line-height:1.25;color:${c.textPrimary};font-weight:bold;">${headline}</h1>
              ${subtitle}
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td class="email-content" align="left" style="padding:24px 32px 32px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:${c.textPrimary};">
              ${opts.bodyHtml}
            </td>
          </tr>
          ${extra}
          <!-- Footer -->
          <tr>
            <td style="padding:28px 24px;background-color:${c.primaryDark};border-top:1px solid ${c.border};border-bottom:4px solid ${c.highlightGold};">
              ${footer}
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// --- Promotional ---

export function buildPromotionalEmail(options: {
  content: string;
  subject: string;
  headerTitle?: string;
  headerSubtitle?: string;
  attachmentHtml?: string;
}): string {
  const headline = options.headerTitle || 'Important Message';
  const htmlContent = textToHtmlLines(options.content);

  const bodyHtml = `
<p style="margin:0 0 16px;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:1.7;color:${EMAIL_COLORS.textPrimary};">
  ${htmlContent}
</p>`;

  return buildEmailShell({
    pageTitle: options.subject || headline,
    headline,
    subtitle: options.headerSubtitle,
    bodyHtml,
    accentTone: 'gold',
    extraContentHtml: options.attachmentHtml,
    fullFooter: true,
  });
}

// --- Auth / account ---

export function buildVerificationLinkEmail(firstName: string | undefined, verificationUrl: string): string {
  const greeting = escapeHtml(firstName || 'there');
  const safeUrl = escapeHtml(verificationUrl);

  const bodyHtml = `
<p style="margin:0 0 16px;">Hello ${greeting},</p>
<p style="margin:0 0 16px;">Thank you for joining <strong style="color:${EMAIL_COLORS.highlightGold};">${SITE_NAME}</strong>. Please verify your email address to activate your account.</p>
${buildCtaButton(verificationUrl, 'Verify Email Address')}
<p style="margin:0 0 8px;font-size:14px;color:${EMAIL_COLORS.textSecondary};">Or copy and paste this link into your browser:</p>
<p style="margin:0;word-break:break-all;font-size:13px;color:${EMAIL_COLORS.accentCyan};"><a href="${safeUrl}" style="color:${EMAIL_COLORS.accentCyan};">${safeUrl}</a></p>
<p style="margin:24px 0 0;font-size:13px;color:${EMAIL_COLORS.textSecondary};">This link expires in 24 hours. If you did not create an account, you can safely ignore this email.</p>`;

  return buildEmailShell({
    pageTitle: 'Verify Your Email',
    headline: 'Verify Your Email',
    subtitle: 'One step to complete registration',
    bodyHtml,
    accentTone: 'purple',
    fullFooter: false,
  });
}

export function buildVerificationCodeEmail(firstName: string | undefined, code: string): string {
  const greeting = escapeHtml(firstName || 'there');

  const bodyHtml = `
<p style="margin:0 0 16px;">Hello ${greeting},</p>
<p style="margin:0 0 16px;">Thank you for signing up with <strong style="color:${EMAIL_COLORS.highlightGold};">${SITE_NAME}</strong>. Enter the verification code below on the registration page:</p>
${buildVerificationCodeBlock(code)}
<p style="margin:0;font-size:13px;color:${EMAIL_COLORS.textSecondary};text-align:center;">This code expires in 10 minutes. If you did not create an account, please ignore this email.</p>`;

  return buildEmailShell({
    pageTitle: 'Verification Code',
    headline: 'Your Verification Code',
    subtitle: 'Complete your registration',
    bodyHtml,
    accentTone: 'purple',
    fullFooter: false,
  });
}

export function buildPasswordResetEmail(firstName: string | undefined, resetUrl: string): string {
  const greeting = escapeHtml(firstName || 'there');
  const safeUrl = escapeHtml(resetUrl);

  const bodyHtml = `
<p style="margin:0 0 16px;">Hello ${greeting},</p>
<p style="margin:0 0 16px;">We received a request to reset your password. Click the button below to choose a new password.</p>
${buildCtaButton(resetUrl, 'Reset Password')}
<p style="margin:0 0 8px;font-size:14px;color:${EMAIL_COLORS.textSecondary};">Or copy and paste this link into your browser:</p>
<p style="margin:0;word-break:break-all;font-size:13px;color:${EMAIL_COLORS.accentCyan};"><a href="${safeUrl}" style="color:${EMAIL_COLORS.accentCyan};">${safeUrl}</a></p>
<p style="margin:24px 0 0;font-size:13px;color:${EMAIL_COLORS.textSecondary};">This link expires in 1 hour. If you did not request a password reset, you can safely ignore this email.</p>`;

  return buildEmailShell({
    pageTitle: 'Reset Password',
    headline: 'Reset Your Password',
    subtitle: 'Secure your account',
    bodyHtml,
    accentTone: 'gold',
    fullFooter: false,
  });
}

// --- Loans ---

export type LoanEmailVariant =
  | 'approved'
  | 'rejected'
  | 'payment'
  | 'due_soon'
  | 'overdue'
  | 'overdue_reminder';

export function buildLoanEmail(options: {
  variant: LoanEmailVariant;
  firstName?: string;
  detailRows: Array<{ label: string; value: string }>;
  introHtml: string;
  footerNoteHtml?: string;
}): string {
  const config: Record<
    LoanEmailVariant,
    { headline: string; subtitle: string; tone: AccentTone }
  > = {
    approved: {
      headline: 'Loan Approved',
      subtitle: 'Your request has been approved',
      tone: 'success',
    },
    rejected: {
      headline: 'Loan Not Approved',
      subtitle: 'Update on your loan request',
      tone: 'danger',
    },
    payment: {
      headline: 'Payment Received',
      subtitle: 'Thank you for your payment',
      tone: 'info',
    },
    due_soon: {
      headline: 'Payment Due Tomorrow',
      subtitle: 'Friendly reminder',
      tone: 'warning',
    },
    overdue: {
      headline: 'Loan Overdue',
      subtitle: 'Immediate action required',
      tone: 'danger',
    },
    overdue_reminder: {
      headline: 'Overdue Loan Reminder',
      subtitle: 'Your balance is still outstanding',
      tone: 'danger',
    },
  };

  const { headline, subtitle, tone } = config[options.variant];
  const greeting = escapeHtml(options.firstName || 'there');

  const bodyHtml = `
<p style="margin:0 0 16px;">Hello ${greeting},</p>
<p style="margin:0 0 16px;">${options.introHtml}</p>
${buildDetailBox(options.detailRows, tone)}
${options.footerNoteHtml ? `<p style="margin:16px 0 0;font-size:14px;color:${EMAIL_COLORS.textSecondary};">${escapeHtml(options.footerNoteHtml)}</p>` : ''}`;

  const loansUrl = `${getFrontendUrl()}/loans`;
  const cta =
    options.variant === 'approved' || options.variant === 'payment'
      ? ''
      : buildCtaButton(loansUrl, 'View Loan Account', tone);

  return buildEmailShell({
    pageTitle: headline,
    headline,
    subtitle,
    bodyHtml: bodyHtml + cta,
    accentTone: tone,
    fullFooter: false,
  });
}
