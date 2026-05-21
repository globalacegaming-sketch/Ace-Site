import { Router, Request, Response } from 'express';
import { requireAgentAuth } from '../middleware/agentAuth';
import User from '../models/User';
import emailService from '../services/emailService';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import cloudinary, { isCloudinaryEnabled } from '../config/cloudinary';
import logger from '../utils/logger';
import * as SibApiV3Sdk from 'sib-api-v3-sdk';
import { buildPromotionalEmail } from '../templates/email/emailLayout';
import { buildPromotionalAttachmentHtml } from '../templates/email/promotionalAttachment';
import { getEmailLogoFilePath, prepareHtmlWithInlineLogo } from '../templates/email/emailLogo';

// Extend Express Request interface to include timedout property from connect-timeout middleware
declare global {
  namespace Express {
    interface Request {
      timedout?: boolean;
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
    const timestamp = Date.now();
    const sanitizedOriginalName = file.originalname.replace(/\s+/g, '-');
    cb(null, `${timestamp}-${sanitizedOriginalName}`);
  }
});

const emailAttachmentUpload = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${file.mimetype}. Allowed types: ${ALLOWED_MIME_TYPES.join(', ')}`));
    }
  }
});

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

      res.json({
        success: true,
        html: emailHtml
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
  emailAttachmentUpload.single('attachment'),
  async (req: Request, res: Response) => {
    // Check if request has timed out before processing
    if (req.timedout) {
      if (!res.headersSent) {
        return res.status(408).json({
          success: false,
          message: 'Request timeout. Email sending may still be processing in the background.'
        });
      }
      return;
    }

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

      if (!emailBody || !emailBody.trim()) {
        return res.status(400).json({
          success: false,
          message: 'Email body is required'
        });
      }

      // Get recipients
      let recipients: string[] = [];

      // Parse labelIds if provided (label-based recipient resolution)
      if (labelIds) {
        try {
          const ids = typeof labelIds === 'string' ? JSON.parse(labelIds) : labelIds;
          if (Array.isArray(ids) && ids.length > 0) {
            const labelFilter = labelMatch === 'all'
              ? { labels: { $all: ids } }
              : { labels: { $in: ids } };
            const labelUsers = await User.find(labelFilter).select('email');
            recipients = labelUsers.map(u => u.email).filter(Boolean);
          }
        } catch (error) {
          logger.error('Error parsing labelIds:', error);
        }
      }

      // Parse recipientIds if provided
      if (recipientIds) {
        try {
          const ids = typeof recipientIds === 'string' ? JSON.parse(recipientIds) : recipientIds;
          if (Array.isArray(ids) && ids.length > 0) {
            const users = await User.find({ _id: { $in: ids } }).select('email');
            recipients = users.map(u => u.email).filter(Boolean);
          }
        } catch (error) {
          logger.error('Error parsing recipientIds:', error);
        }
      }

      // Parse recipientEmails if provided
      if (recipientEmails) {
        try {
          const emails = typeof recipientEmails === 'string' ? JSON.parse(recipientEmails) : recipientEmails;
          if (Array.isArray(emails)) {
            recipients = [...recipients, ...emails.filter(e => e && typeof e === 'string')];
          }
        } catch (error) {
          logger.error('Error parsing recipientEmails:', error);
        }
      }

      // If no specific recipients, send to all contacts
      if (recipients.length === 0) {
        const allUsers = await User.find({}).select('email');
        recipients = allUsers.map(u => u.email).filter(Boolean);
      }

      // Remove duplicates
      recipients = [...new Set(recipients)];

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

      // Send emails using Brevo API
      const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

      sendSmtpEmail.sender = {
        name: process.env.BREVO_FROM_NAME || 'Global Ace Gaming',
        email: process.env.BREVO_FROM_EMAIL || 'noreply@globalacegaming.com'
      };
      
      // Ensure the sender name is properly set to avoid showing email address
      if (!sendSmtpEmail.sender.name || sendSmtpEmail.sender.name === sendSmtpEmail.sender.email) {
        sendSmtpEmail.sender.name = 'Global Ace Gaming';
      }

      sendSmtpEmail.subject = subject;
      const { html: sendHtml, attachment: logoAttachment } = prepareHtmlWithInlineLogo(emailHtml);
      sendSmtpEmail.htmlContent = sendHtml;
      if (logoAttachment) {
        sendSmtpEmail.attachment = [logoAttachment];
      }

      sendSmtpEmail.tags = ['promotional'];

      // Track results
      const results = {
        total: recipients.length,
        successful: 0,
        failed: 0,
        errors: [] as string[]
      };

      // Brevo has a limit of 99 recipients per email, so we need to batch them
      const MAX_RECIPIENTS_PER_BATCH = 99;
      const batches: string[][] = [];
      
      // Split recipients into batches of MAX_RECIPIENTS_PER_BATCH
      for (let i = 0; i < recipients.length; i += MAX_RECIPIENTS_PER_BATCH) {
        batches.push(recipients.slice(i, i + MAX_RECIPIENTS_PER_BATCH));
      }

      logger.info(`Sending email to ${recipients.length} recipients in ${batches.length} batch(es)`);

      // Send emails in batches
      for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        // Check for timeout periodically
        if (req.timedout) {
          logger.warn(`Request timed out while processing batch ${batchIndex + 1}/${batches.length}. Stopping email sending.`);
          break;
        }

        const batch = batches[batchIndex];
        
        try {
          // Create a copy of the email for this batch
          // Use BCC to hide recipient email addresses from each other
          const batchEmail = new SibApiV3Sdk.SendSmtpEmail();
          batchEmail.sender = sendSmtpEmail.sender;
          // Set a single "to" address (the sender's email) and use BCC for all recipients
          // This ensures recipients cannot see each other's email addresses
          batchEmail.to = [{ email: sendSmtpEmail.sender.email }];
          batchEmail.bcc = batch.map(email => ({ email }));
          batchEmail.subject = sendSmtpEmail.subject;
          batchEmail.htmlContent = sendSmtpEmail.htmlContent;
          batchEmail.attachment = sendSmtpEmail.attachment;
          batchEmail.tags = sendSmtpEmail.tags;
          
          // Set timeout for each email batch (10 seconds)
          const result = await Promise.race([
            apiInstance.sendTransacEmail(batchEmail),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Email batch send timeout')), 10000)
            )
          ]) as any;
          
          results.successful += batch.length;
          
          logger.info(`Batch ${batchIndex + 1}/${batches.length}: Successfully sent ${batch.length} emails`, {
            subject,
            messageId: result.messageId
          });
          
          // Add a small delay between batches to avoid rate limiting (except for the last batch)
          if (batchIndex < batches.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay between batches
          }
        } catch (error: any) {
          logger.error(`Error sending batch ${batchIndex + 1}:`, error);
          
          // Check if it's a "too many recipients" error
          const errorMessage = error.response?.body?.message || error.message || '';
          if (errorMessage.includes('Too many recipients')) {
            // If batch is too large, split and retry
            logger.warn(`Batch ${batchIndex + 1} had too many recipients, splitting into smaller batches`);
            const halfSize = Math.ceil(batch.length / 2);
            const firstHalf = batch.slice(0, halfSize);
            const secondHalf = batch.slice(halfSize);
            
            // Retry with first half
            if (firstHalf.length > 0 && firstHalf.length <= MAX_RECIPIENTS_PER_BATCH) {
              try {
                const splitEmail = new SibApiV3Sdk.SendSmtpEmail();
                splitEmail.sender = sendSmtpEmail.sender;
                splitEmail.to = [{ email: sendSmtpEmail.sender.email }];
                splitEmail.bcc = firstHalf.map(email => ({ email }));
                splitEmail.subject = sendSmtpEmail.subject;
                splitEmail.htmlContent = sendSmtpEmail.htmlContent;
                splitEmail.attachment = sendSmtpEmail.attachment;
                splitEmail.tags = sendSmtpEmail.tags;
                await apiInstance.sendTransacEmail(splitEmail);
                results.successful += firstHalf.length;
              } catch (err: any) {
                // If still fails, try individually
                for (const email of firstHalf) {
                  try {
                    const individualEmail = new SibApiV3Sdk.SendSmtpEmail();
                    individualEmail.sender = sendSmtpEmail.sender;
                    individualEmail.to = [{ email }];
                    individualEmail.subject = sendSmtpEmail.subject;
                    individualEmail.htmlContent = sendSmtpEmail.htmlContent;
                    individualEmail.attachment = sendSmtpEmail.attachment;
                    individualEmail.tags = sendSmtpEmail.tags;
                    await apiInstance.sendTransacEmail(individualEmail);
                    results.successful++;
                    await new Promise(resolve => setTimeout(resolve, 100));
                  } catch (e: any) {
                    results.failed++;
                    const emailForError = email; // Capture email in scope
                    results.errors.push(`${emailForError}: ${e.response?.body?.message || e.message || 'Unknown error'}`);
                  }
                }
              }
            }
            
            // Retry with second half
            if (secondHalf.length > 0 && secondHalf.length <= MAX_RECIPIENTS_PER_BATCH) {
              try {
                const splitEmail = new SibApiV3Sdk.SendSmtpEmail();
                splitEmail.sender = sendSmtpEmail.sender;
                splitEmail.to = [{ email: sendSmtpEmail.sender.email }];
                splitEmail.bcc = secondHalf.map(emailAddr => ({ email: emailAddr }));
                splitEmail.subject = sendSmtpEmail.subject;
                splitEmail.htmlContent = sendSmtpEmail.htmlContent;
                splitEmail.attachment = sendSmtpEmail.attachment;
                splitEmail.tags = sendSmtpEmail.tags;
                await apiInstance.sendTransacEmail(splitEmail);
                results.successful += secondHalf.length;
              } catch (err: any) {
                // If still fails, try individually
                for (const emailAddr of secondHalf) {
                  try {
                    const individualEmail = new SibApiV3Sdk.SendSmtpEmail();
                    individualEmail.sender = sendSmtpEmail.sender;
                    individualEmail.to = [{ email: emailAddr }];
                    individualEmail.subject = sendSmtpEmail.subject;
                    individualEmail.htmlContent = sendSmtpEmail.htmlContent;
                    individualEmail.attachment = sendSmtpEmail.attachment;
                    individualEmail.tags = sendSmtpEmail.tags;
                    await apiInstance.sendTransacEmail(individualEmail);
                    results.successful++;
                    await new Promise(resolve => setTimeout(resolve, 100));
                  } catch (e: any) {
                    results.failed++;
                    results.errors.push(`${emailAddr}: ${e.response?.body?.message || e.message || 'Unknown error'}`);
                  }
                }
              }
            }
          } else {
            // If batch fails for other reasons, try sending individually as fallback
            // For individual sends, use "to" since there's only one recipient
            for (const email of batch) {
              if (req.timedout) break; // Check timeout before each individual send
              
              try {
                const individualEmail = new SibApiV3Sdk.SendSmtpEmail();
                individualEmail.sender = sendSmtpEmail.sender;
                individualEmail.to = [{ email }];
                individualEmail.subject = sendSmtpEmail.subject;
                individualEmail.htmlContent = sendSmtpEmail.htmlContent;
                individualEmail.attachment = sendSmtpEmail.attachment;
                individualEmail.tags = sendSmtpEmail.tags;
                
                await Promise.race([
                  apiInstance.sendTransacEmail(individualEmail),
                  new Promise((_, reject) => 
                    setTimeout(() => reject(new Error('Individual email send timeout')), 5000)
                  )
                ]);
                results.successful++;
                
                // Small delay between individual sends to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 100));
              } catch (err: any) {
                results.failed++;
                const errorMsg = err.response?.body?.message || err.message || 'Unknown error';
                results.errors.push(`${email}: ${errorMsg}`);
                logger.error(`Failed to send email to ${email}:`, errorMsg);
              }
            }
          }
        }
      }

      // Clean up attachment file
      if (attachment && fs.existsSync(attachment.path)) {
        try {
          fs.unlinkSync(attachment.path);
        } catch (error) {
          logger.error('Error deleting attachment file:', error);
        }
      }

      // Only send response if headers haven't been sent yet
      if (!res.headersSent) {
        return res.json({
          success: true,
          message: `Email promotion sent. ${results.successful} successful, ${results.failed} failed.`,
          data: {
            total: results.total,
            successful: results.successful,
            failed: results.failed,
            errors: results.errors.length > 0 ? results.errors.slice(0, 10) : undefined // Limit error details to first 10
          }
        });
      }
    } catch (error: unknown) {
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

