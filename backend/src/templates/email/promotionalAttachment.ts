import fs from 'fs';
import { EMAIL_COLORS } from './emailLayout';

export function buildPromotionalAttachmentHtml(attachment: {
  path: string;
  mimetype: string;
  originalname: string;
}): string {
  if (!fs.existsSync(attachment.path)) {
    return '';
  }

  const c = EMAIL_COLORS;

  try {
    const buffer = fs.readFileSync(attachment.path);
    const base64 = buffer.toString('base64');
    const mime = attachment.mimetype || 'application/octet-stream';
    const dataUri = `data:${mime};base64,${base64}`;
    const name = attachment.originalname;

    if (mime.startsWith('image/')) {
      return `
          <tr>
            <td align="center" style="padding:0 32px 24px;font-family:Arial,Helvetica,sans-serif;">
              <p style="margin:0 0 12px;font-size:14px;color:${c.textSecondary};font-weight:bold;">Attachment</p>
              <img src="${dataUri}" alt="${name}" width="536" style="max-width:100%;width:100%;height:auto;border-radius:8px;border:1px solid ${c.border};" />
              <p style="margin:10px 0 0;font-size:12px;color:${c.textSecondary};">${name}</p>
            </td>
          </tr>`;
    }

    if (mime === 'application/pdf') {
      return `
          <tr>
            <td align="center" style="padding:0 32px 24px;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:${c.cardBg};border:1px solid ${c.border};border-radius:8px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <p style="margin:0 0 16px;font-size:16px;color:${c.textPrimary};font-weight:bold;">Attachment: ${name}</p>
                    <a href="${dataUri}" download="${name}" style="display:inline-block;padding:12px 24px;background-color:${c.highlightGold};color:${c.primaryDark};text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">Download PDF</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
    }

    return `
          <tr>
            <td align="center" style="padding:0 32px 24px;font-family:Arial,Helvetica,sans-serif;">
              <table role="presentation" width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:${c.cardBg};border:1px solid ${c.border};border-radius:8px;">
                <tr>
                  <td style="padding:20px;text-align:center;">
                    <p style="margin:0 0 16px;font-size:16px;color:${c.textPrimary};font-weight:bold;">Attachment: ${name}</p>
                    <a href="${dataUri}" download="${name}" style="display:inline-block;padding:12px 24px;background-color:${c.highlightGold};color:${c.primaryDark};text-decoration:none;border-radius:6px;font-weight:bold;font-size:14px;">Download File</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>`;
  } catch {
    return '';
  }
}
