import { Router, Request, Response } from 'express';
import { requireAgentAuth } from '../middleware/agentAuth';
import User from '../models/User';
import emailService from '../services/emailService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { buildSafeUploadFilename, isAllowedUpload } from '../config/uploadSafety';
import cloudinary, { isCloudinaryEnabled } from '../config/cloudinary';
import logger from '../utils/logger';
import * as SibApiV3Sdk from 'sib-api-v3-sdk';
import { buildPromotionalEmail } from '../templates/email/emailLayout';
import { sanitizePromotionalHtml } from '../templates/email/sanitizePromotionalHtml';
import { applyRecipientName, containsNameToken, displayFirstName, PREVIEW_FIRST_NAME } from '../templates/email/recipientName';
import { buildPromotionalAttachmentHtml } from '../templates/email/promotionalAttachment';
import { getEmailLogoFilePath, prepareHtmlWithInlineLogo, toAbsolutePublicUrl } from '../templates/email/emailLogo';

// connect-timeout stamps the request when the global limit (30s) is hit and
// answers the client with "Response timeout". clearTimeout() cancels that.
declare global {
  namespace Express {
    interface Request {
      timedout?: boolean;
      clearTimeout?: () => void;
    }
  }
}

// Get Brevo API instance (reuse the configured one from emailService)
const getBrevoApiInstance = (): { apiInstance: SibApiV3Sdk.TransactionalEmailsApi; apiKey: string | null } => {
  const apiKey = process.env.BREVO_API_KEY;
  
  if (!apiKey || apiKey === 'your-brevo-api-key' || apiKey.trim() === '') {
    logger.error('BREVO_API_KEY is not properly configured in environment variables');
    return { apiInstance: null as any, apiKey: null };
  }
  
  // The ApiClient.instance is a singleton, so it should already be configured
  // by emailService, but we'll ensure it's set
  const defaultClient = SibApiV3Sdk.ApiClient.instance;
  const apiKeyAuth = defaultClient.authentications['api-key'];
  
  // Only set if not already set or if different
  if (!apiKeyAuth.apiKey || apiKeyAuth.apiKey !== apiKey) {
    apiKeyAuth.apiKey = apiKey;
  }
  
  return {
    apiInstance: new SibApiV3Sdk.TransactionalEmailsApi(),
    apiKey
  };
};

const brevoErrorMessage = (error: unknown): string => {
  if (error && typeof error === 'object') {
    const response = (error as { response?: { body?: { message?: string }; status?: number; statusCode?: number } }).response;
    const bodyMessage = response?.body?.message;
    if (typeof bodyMessage === 'string' && bodyMessage.trim()) return bodyMessage;
    const message = (error as { message?: string }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return 'Unknown error';
};

const isBrevoAuthFailure = (error: unknown): boolean => {
  const record = error && typeof error === 'object'
    ? error as { status?: number; response?: { status?: number; statusCode?: number } }
    : undefined;
  const status = record?.status || record?.response?.status || record?.response?.statusCode;
  const message = brevoErrorMessage(error).toLowerCase();
  return status === 401 || message.includes('api key') || message.includes('unauthorized');
};

const brevoStatus = (error: unknown): number => {
  const record = error && typeof error === 'object'
    ? error as { status?: number; response?: { status?: number; statusCode?: number } }
    : undefined;
  return record?.status || record?.response?.status || record?.response?.statusCode || 0;
};

const isRetryableBrevoError = (error: unknown): boolean => {
  const status = brevoStatus(error);
  if (status === 429 || status >= 500) return true;
  const code = error && typeof error === 'object' ? String((error as { code?: string }).code || '') : '';
  return ['ETIMEDOUT', 'ECONNRESET', 'ECONNREFUSED', 'ESOCKETTIMEDOUT', 'EAI_AGAIN'].includes(code);
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The global request timeout is 30s and it used to abort the send, so the
 * first recipients were delivered and everyone after that was skipped.
 * This route answers quickly and finishes delivery on its own.
 */
const releaseRequestTimeout = (req: Request) => {
  if (typeof req.clearTimeout === 'function') req.clearTimeout();
};

// Brevo allows 99 addresses across to + cc + bcc. One slot is the visible To
// (the sender), so members stay on Bcc and cannot see each other.
const MAX_BCC_PER_BATCH = 98;

type LogoAttachment = { name: string; content: string } | null;

type BatchOutcome = { status: 'ok' | 'auth' | 'fail'; sent: number };

async function sendBrevoBatch(
  apiInstance: SibApiV3Sdk.TransactionalEmailsApi,
  sender: { name: string; email: string },
  batch: string[],
  subject: string,
  html: string,
  attachment: LogoAttachment,
): Promise<BatchOutcome> {
  const batchEmail = new SibApiV3Sdk.SendSmtpEmail();
  batchEmail.sender = sender;
  batchEmail.to = [{ email: sender.email }];
  batchEmail.bcc = batch.map((email) => ({ email }));
  batchEmail.subject = subject;
  batchEmail.htmlContent = html;
  if (attachment) batchEmail.attachment = [attachment];
  batchEmail.tags = ['promotional'];

  const attempt = () => apiInstance.sendTransacEmail(batchEmail);

  try {
    await attempt();
    return { status: 'ok', sent: batch.length };
  } catch (error: unknown) {
    if (isBrevoAuthFailure(error)) return { status: 'auth', sent: 0 };

    const message = brevoErrorMessage(error);
    // One bad address makes Brevo reject the whole batch. Split to deliver the
    // valid ones. Content or sender errors are not recipient problems, so those
    // stay a single failure instead of fanning out into one request per person.
    const recipientProblem = brevoStatus(error) === 400
      && /recipient|email address|not valid|invalid email/i.test(message);
    if ((message.toLowerCase().includes('too many recipients') || recipientProblem) && batch.length > 1) {
      const mid = Math.ceil(batch.length / 2);
      const first = await sendBrevoBatch(apiInstance, sender, batch.slice(0, mid), subject, html, attachment);
      if (first.status === 'auth') return first;
      const second = await sendBrevoBatch(apiInstance, sender, batch.slice(mid), subject, html, attachment);
      const sent = first.sent + second.sent;
      if (second.status === 'auth') return { status: 'auth', sent };
      return { status: sent === batch.length ? 'ok' : 'fail', sent };
    }

    // Retry the same batch once. Do not fall back to one-by-one sends:
    // a slow Brevo response used to be treated as a failure and then resent
    // per person, which both duplicated mail and ran out the request timer.
    if (isRetryableBrevoError(error)) {
      logger.warn(`Promotional batch hit a retryable error (${message}). Retrying once.`);
      await delay(2000);
      try {
        await attempt();
        return { status: 'ok', sent: batch.length };
      } catch (retryError: unknown) {
        if (isBrevoAuthFailure(retryError)) return { status: 'auth', sent: 0 };
        logger.error(`Promotional batch failed after retry: ${brevoErrorMessage(retryError)}`);
        return { status: 'fail', sent: 0 };
      }
    }

    logger.error(`Promotional batch failed: ${message}`);
    return { status: 'fail', sent: 0 };
  }
}

function deliverPromotionalEmails(params: {
  apiInstance: SibApiV3Sdk.TransactionalEmailsApi;
  sender: { name: string; email: string };
  variants: Array<{ emails: string[]; subject: string; html: string }>;
  attachment: LogoAttachment;
  attachmentPath?: string;
  total: number;
  priorSuccessful?: number;
}): void {
  void (async () => {
    let successful = params.priorSuccessful ?? 0;
    let authStopped = false;
    try {
      for (const variant of params.variants) {
        if (authStopped) break;
        for (let offset = 0; offset < variant.emails.length; offset += MAX_BCC_PER_BATCH) {
          const batch = variant.emails.slice(offset, offset + MAX_BCC_PER_BATCH);
          const outcome = await sendBrevoBatch(
            params.apiInstance,
            params.sender,
            batch,
            variant.subject,
            variant.html,
            params.attachment,
          );
          successful += outcome.sent;
          logger.info(`Promotional batch sent ${outcome.sent}/${batch.length}`, {
            subject: variant.subject,
            status: outcome.status,
          });
          if (outcome.status === 'auth') {
            authStopped = true;
            break;
          }
          if (offset + MAX_BCC_PER_BATCH < variant.emails.length) await delay(400);
        }
        if (!authStopped) await delay(400);
      }

      logger.info('Promotional email delivery finished', {
        total: params.total,
        successful,
        failed: params.total - successful,
        authStopped,
      });
    } catch (error: unknown) {
      logger.error(`Promotional email delivery stopped: ${brevoErrorMessage(error)}`);
    } finally {
      if (params.attachmentPath && fs.existsSync(params.attachmentPath)) {
        try {
          fs.unlinkSync(params.attachmentPath);
        } catch (error) {
          logger.error('Error deleting attachment file:', error);
        }
      }
    }
  })();
}

const parseIdList = (value: unknown): string[] | null => {
  if (value == null || value === '') return [];
  try {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (!Array.isArray(parsed)) return null;
    return parsed.filter((id): id is string => typeof id === 'string' && id.trim().length > 0);
  } catch {
    return null;
  }
};

const router = Router();

/** Small logo for email HTML previews (public asset). */
router.get('/assets/logo-email.png', (_req: Request, res: Response) => {
  const logoPath = getEmailLogoFilePath();
  if (!logoPath) {
    return res.status(404).send('Logo not found');
  }
  res.type('png');
  return res.sendFile(logoPath);
});

// File upload configuration for email attachments
const MAX_FILE_SIZE_MB = 10;
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'application/pdf',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
];

const emailUploadsDir = path.resolve(__dirname, '../../uploads/email');
fs.mkdirSync(emailUploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, emailUploadsDir),
  filename: (_req, file, cb) => {
    cb(null, buildSafeUploadFilename(file.originalname, file.mimetype));
  }
});

const emailAttachmentUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file.mimetype, ALLOWED_MIME_TYPES)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  }
});

const INLINE_IMAGE_MIME_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

const emailImageUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (isAllowedUpload(file.mimetype, INLINE_IMAGE_MIME_TYPES)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, GIF, and WebP images can be placed in the email'));
    }
  }
});

function promotionalBodyHasContent(emailBody: string): boolean {
  const trimmed = String(emailBody || '').trim();
  if (!trimmed) return false;
  if (!/<\/?[a-z]/i.test(trimmed)) return true;
  return sanitizePromotionalHtml(trimmed).length > 0;
}

const getEmailTemplate = async (
  content: string,
  subject: string,
  headerTitle?: string,
  headerSubtitle?: string,
  attachment?: { path: string; mimetype: string; originalname: string }
): Promise<string> => {
  const attachmentHtml = attachment ? buildPromotionalAttachmentHtml(attachment) : undefined;

  return buildPromotionalEmail({
    content,
    subject,
    headerTitle,
    headerSubtitle,
    attachmentHtml,
  });
};

// Inline image for the promotional editor. Returns an absolute URL an inbox can load.
router.post('/images', requireAgentAuth, (req: Request, res: Response, next) => {
  emailImageUpload.single('image')(req, res, (err: unknown) => {
    if (err) {
      const message = err instanceof Error ? err.message : 'Upload failed';
      return res.status(400).json({ success: false, message });
    }
    return next();
  });
}, async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const filePath = req.file.path;
    let imageUrl: string;

    if (isCloudinaryEnabled()) {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'email-promotions',
        resource_type: 'image',
      });
      imageUrl = result.secure_url;
      fs.unlink(filePath, () => {});
    } else {
      imageUrl = toAbsolutePublicUrl(`/uploads/email/${req.file.filename}`);
    }

    return res.json({
      success: true,
      data: { url: imageUrl },
    });
  } catch (error) {
    if (req.file) fs.unlink(req.file.path, () => {});
    logger.error('Error uploading promotional image:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to upload image',
    });
  }
});

// Preview email template
router.post(
  '/preview',
  requireAgentAuth,
  emailAttachmentUpload.single('attachment'),
  async (req: Request, res: Response) => {
    try {
      const { subject, emailBody, headerTitle, headerSubtitle } = req.body;
      const attachment = req.file;

      if (!emailBody) {
        return res.status(400).json({
          success: false,
          message: 'Email body is required'
        });
      }

      // Generate email HTML preview with attachment if provided
      const emailHtml = await getEmailTemplate(
        emailBody || 'Enter your email content here...',
        subject || 'Email Preview',
        headerTitle,
        headerSubtitle,
        attachment ? {
          path: attachment.path,
          mimetype: attachment.mimetype,
          originalname: attachment.originalname
        } : undefined
      );

      // Clean up preview attachment file if it exists
      if (attachment && fs.existsSync(attachment.path)) {
        try {
          fs.unlinkSync(attachment.path);
        } catch (error) {
          logger.warn('Error deleting preview attachment file:', error);
        }
      }

      const previewHtml = applyRecipientName(emailHtml, PREVIEW_FIRST_NAME, 'html');
      const previewSubject = applyRecipientName(subject || 'Email Preview', PREVIEW_FIRST_NAME, 'text');

      res.json({
        success: true,
        html: previewHtml,
        subject: previewSubject,
        previewName: PREVIEW_FIRST_NAME,
      });
    } catch (error) {
      logger.error('Error generating email preview:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to generate email preview',
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    }
  }
);

// Send promotional emails
router.post(
  '/send',
  requireAgentAuth,
  (req, _res, next) => {
    // Cancel the 30s "Response timeout" before upload and delivery work starts.
    releaseRequestTimeout(req);
    next();
  },
  emailAttachmentUpload.single('attachment'),
  async (req: Request, res: Response) => {
    try {
      const { subject, emailBody, headerTitle, headerSubtitle, recipientIds, recipientEmails, labelIds, labelMatch } = req.body;
      const attachment = req.file;

      // Validate required fields
      if (!subject || !subject.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Subject is required'
        });
      }

      if (!promotionalBodyHasContent(emailBody)) {
        return res.status(400).json({
          success: false,
          message: 'Email body is required'
        });
      }

      // Get recipients. An empty selection never falls through to every member.
      let recipients: Array<{ email: string; firstName: string }> = [];

      const asRecipients = (users: Array<{ email?: string; firstName?: string }>) =>
        users
          .filter((user) => Boolean(user.email))
          .map((user) => ({ email: user.email as string, firstName: user.firstName || '' }));

      const audience = typeof req.body.audience === 'string' ? req.body.audience.trim() : '';
      const wantsSelected = audience === 'selected' || (Boolean(recipientIds) && audience !== 'all' && audience !== 'labels');
      const wantsLabels = !wantsSelected && (audience === 'labels' || (Boolean(labelIds) && audience !== 'all'));

      if (wantsSelected) {
        const ids = parseIdList(recipientIds);
        if (!ids || ids.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Select at least one contact'
          });
        }
        const users = await User.find({ _id: { $in: ids } }).select('email firstName');
        recipients = asRecipients(users);
        if (recipients.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'None of the selected contacts have an email address'
          });
        }
      } else if (wantsLabels) {
        const ids = parseIdList(labelIds);
        if (!ids || ids.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Select at least one label'
          });
        }
        const labelFilter = labelMatch === 'all'
          ? { labels: { $all: ids } }
          : { labels: { $in: ids } };
        const labelUsers = await User.find(labelFilter).select('email firstName');
        recipients = asRecipients(labelUsers);
        if (recipients.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'No members with those labels have an email address'
          });
        }
      } else if (recipientEmails) {
        const emails = parseIdList(recipientEmails);
        if (!emails) {
          return res.status(400).json({
            success: false,
            message: 'Recipient emails could not be read'
          });
        }
        recipients = emails.map((email) => ({ email, firstName: '' }));
      } else if (audience === 'all') {
        const allUsers = await User.find({}).select('email firstName');
        recipients = asRecipients(allUsers);
      } else {
        return res.status(400).json({
          success: false,
          message: 'Choose who should receive this email'
        });
      }

      // Remove duplicates
      const seenEmails = new Set<string>();
      recipients = recipients.filter((recipient) => {
        const key = recipient.email.toLowerCase();
        if (seenEmails.has(key)) return false;
        seenEmails.add(key);
        return true;
      });

      if (recipients.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid recipients found'
        });
      }

      // Generate email HTML with attachment embedded inline if provided
      const emailHtml = await getEmailTemplate(
        emailBody, 
        subject, 
        headerTitle, 
        headerSubtitle,
        attachment ? {
          path: attachment.path,
          mimetype: attachment.mimetype,
          originalname: attachment.originalname
        } : undefined
      );

      // Get Brevo API instance
      const { apiInstance, apiKey } = getBrevoApiInstance();
      
      if (!apiInstance || !apiKey) {
        logger.error('Brevo API is not properly configured. Please check BREVO_API_KEY in environment variables.');
        return res.status(500).json({
          success: false,
          message: 'Email service is not configured. Please contact administrator to set up BREVO_API_KEY in environment variables.'
        });
      }

      const sender = {
        name: process.env.BREVO_FROM_NAME || 'Global Ace Gaming',
        email: process.env.BREVO_FROM_EMAIL || 'noreply@globalacegaming.com'
      };
      if (!sender.name || sender.name === sender.email) {
        sender.name = 'Global Ace Gaming';
      }

      const { html: brandedHtml, attachment: logoAttachment } = prepareHtmlWithInlineLogo(emailHtml);

      const personalized = [subject, headerTitle, headerSubtitle, emailBody].some((value) => containsNameToken(value));
      const variants: Array<{ emails: string[]; subject: string; html: string }> = [];
      if (!personalized) {
        variants.push({
          emails: recipients.map((recipient) => recipient.email),
          subject,
          html: brandedHtml,
        });
      } else {
        const groups = new Map<string, string[]>();
        for (const recipient of recipients) {
          const name = displayFirstName(recipient.firstName);
          const list = groups.get(name) ?? [];
          list.push(recipient.email);
          groups.set(name, list);
        }
        for (const [name, emails] of groups) {
          variants.push({
            emails,
            subject: applyRecipientName(subject, name, 'text'),
            html: applyRecipientName(brandedHtml, name, 'html'),
          });
        }
      }

      logger.info(`Sending email to ${recipients.length} recipients in ${variants.length} version(s)`);

      const removeUpload = () => {
        if (attachment?.path && fs.existsSync(attachment.path)) {
          try {
            fs.unlinkSync(attachment.path);
          } catch (unlinkError) {
            logger.error('Error deleting attachment file:', unlinkError);
          }
        }
      };

      // The first batch is sent on this request so a bad API key or sender
      // comes back as an error. Everyone after that is delivered in the
      // background, where the 30s response timeout cannot stop the list.
      const firstVariant = variants[0];
      const firstBatch = firstVariant.emails.slice(0, MAX_BCC_PER_BATCH);
      const firstOutcome = await sendBrevoBatch(
        apiInstance,
        sender,
        firstBatch,
        firstVariant.subject,
        firstVariant.html,
        logoAttachment,
      );

      if (firstOutcome.status === 'auth' || (firstOutcome.status === 'fail' && firstOutcome.sent === 0)) {
        removeUpload();
        return res.status(502).json({
          success: false,
          message: firstOutcome.status === 'auth'
            ? 'Brevo rejected the API key, so the email was not delivered. Enable the transactional email key in Brevo, or replace BREVO_API_KEY, then send again.'
            : 'The email provider did not accept this message, so nothing was delivered. Check the sender address in Brevo, then send again.',
        });
      }

      const remainingFirst = firstVariant.emails.slice(MAX_BCC_PER_BATCH);
      const remainingVariants = [
        ...(remainingFirst.length > 0 ? [{ ...firstVariant, emails: remainingFirst }] : []),
        ...variants.slice(1),
      ];

      if (remainingVariants.length === 0) {
        removeUpload();
        const failed = recipients.length - firstOutcome.sent;
        return res.json({
          success: true,
          message: failed === 0
            ? `Email sent to ${firstOutcome.sent} ${firstOutcome.sent === 1 ? 'person' : 'people'}.`
            : `Email sent to ${firstOutcome.sent} of ${recipients.length} people. The email provider rejected the rest.`,
          data: {
            total: recipients.length,
            successful: firstOutcome.sent,
            failed,
            status: 'sent',
          },
        });
      }

      deliverPromotionalEmails({
        apiInstance,
        sender,
        variants: remainingVariants,
        attachment: logoAttachment,
        attachmentPath: attachment?.path,
        total: recipients.length,
        priorSuccessful: firstOutcome.sent,
      });

      return res.status(202).json({
        success: true,
        message: `Sending to ${recipients.length} people. The first group is on its way, and the rest continue in the background.`,
        data: {
          total: recipients.length,
          status: 'sending',
        },
      });
    } catch (error: unknown) {
      if (req.file?.path && fs.existsSync(req.file.path)) {
        try {
          fs.unlinkSync(req.file.path);
        } catch (unlinkError) {
          logger.error('Error deleting attachment file:', unlinkError);
        }
      }
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      logger.error('Error sending promotional emails:', errorMessage);
      
      // Only send response if headers haven't been sent yet
      if (!res.headersSent) {
        return res.status(500).json({
          success: false,
          message: 'Failed to send promotional emails',
          error: errorMessage
        });
      } else {
        // If headers already sent, just log the error
        logger.error('Error after response sent:', errorMessage);
      }
    }
  }
);

export default router;

