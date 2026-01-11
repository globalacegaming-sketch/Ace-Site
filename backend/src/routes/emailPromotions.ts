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

// Email template generators - Clean, Gmail-compatible template
const getEmailTemplate = async (
  content: string, 
  subject: string, 
  headerTitle?: string, 
  headerSubtitle?: string,
  attachment?: { path: string; mimetype: string; originalname: string }
): Promise<string> => {
  // Use custom values or defaults
  const mainTitle = headerTitle || 'Important Message';
  const emailSubtitle = headerSubtitle || ''; // Optional email-specific subtitle
  const siteName = 'Global Ace Gaming';
  const tagline = 'Americas Ace Gaming'; // Always shown tagline
  const frontendUrl = process.env.FRONTEND_URL || 'https://globalacegaming.com';
  const siteDomain = frontendUrl.replace(/^https?:\/\//, '');
  const currentYear = new Date().getFullYear();
  
  // Load and convert logo to base64 for email embedding
  let logoDataUri = '';
  try {
    // Try multiple possible logo paths
    const possiblePaths = [
      path.resolve(__dirname, '../logo.png'),
      path.resolve(__dirname, '../../logo.png'),
      path.resolve(__dirname, '../../../logo.png'),
      path.resolve(process.cwd(), 'logo.png'),
      path.resolve(process.cwd(), 'backend/logo.png'),
      path.resolve(process.cwd(), 'backend/src/logo.png')
    ];
    
    let logoFound = false;
    for (const logoPath of possiblePaths) {
      if (fs.existsSync(logoPath)) {
        const logoBuffer = fs.readFileSync(logoPath);
        const logoBase64 = logoBuffer.toString('base64');
        logoDataUri = `data:image/png;base64,${logoBase64}`;
        logoFound = true;
        break;
      }
    }
    
    if (!logoFound) {
      logger.warn('Could not find logo.png in any of the expected locations, using placeholder');
    }
  } catch (error) {
    logger.warn('Could not load logo.png, using placeholder:', error);
    // Fallback to placeholder if logo not found
    logoDataUri = '';
  }
  
  // Website colors for Gmail compatibility
  const colors = {
    primaryDark: '#0A0A0F',
    secondaryDark: '#1B1B2F',
    highlightGold: '#FFD700',
    accentPurple: '#6A1B9A',
    accentBlue: '#00B0FF',
    textPrimary: '#F5F5F5',
    textSecondary: '#B0B0B0',
    border: '#2C2C3A'
  };
  
  // Convert content line breaks to HTML
  const htmlContent = content.replace(/\n/g, '<br>');
  
  // Process attachment if provided - convert to base64 for inline display
  let attachmentHtml = '';
  if (attachment && fs.existsSync(attachment.path)) {
    try {
      const attachmentBuffer = fs.readFileSync(attachment.path);
      const attachmentBase64 = attachmentBuffer.toString('base64');
      const attachmentMimeType = attachment.mimetype || 'application/octet-stream';
      const attachmentDataUri = `data:${attachmentMimeType};base64,${attachmentBase64}`;
      
      // Determine how to display based on file type
      if (attachmentMimeType.startsWith('image/')) {
        // Display image inline
        attachmentHtml = `
            <tr>
              <td class="content" style="padding:20px 32px;text-align:center;">
                <div style="margin:20px 0;">
                  <p style="margin:0 0 10px;color:${colors.textSecondary};font-size:14px;font-weight:bold;">Attachment:</p>
                  <img src="${attachmentDataUri}" alt="${attachment.originalname}" style="max-width:100%;height:auto;border-radius:8px;box-shadow:0 4px 12px rgba(0,0,0,0.3);" />
                  <p style="margin:10px 0 0;color:${colors.textSecondary};font-size:12px;">${attachment.originalname}</p>
                </div>
              </td>
            </tr>`;
      } else if (attachmentMimeType === 'application/pdf') {
        // For PDF, embed as iframe or provide download link
        attachmentHtml = `
            <tr>
              <td class="content" style="padding:20px 32px;text-align:center;">
                <div style="margin:20px 0;padding:20px;background-color:${colors.secondaryDark};border-radius:8px;border:1px solid ${colors.border};">
                  <p style="margin:0 0 15px;color:${colors.textPrimary};font-size:16px;font-weight:bold;">📎 Attachment: ${attachment.originalname}</p>
                  <iframe src="${attachmentDataUri}" style="width:100%;height:600px;border:1px solid ${colors.border};border-radius:4px;" frameborder="0"></iframe>
                  <p style="margin:15px 0 0;">
                    <a href="${attachmentDataUri}" download="${attachment.originalname}" style="display:inline-block;padding:10px 20px;background-color:${colors.highlightGold};color:${colors.primaryDark};text-decoration:none;border-radius:4px;font-weight:bold;">Download PDF</a>
                  </p>
                </div>
              </td>
            </tr>`;
      } else {
        // For other file types, provide download link
        attachmentHtml = `
            <tr>
              <td class="content" style="padding:20px 32px;text-align:center;">
                <div style="margin:20px 0;padding:20px;background-color:${colors.secondaryDark};border-radius:8px;border:1px solid ${colors.border};">
                  <p style="margin:0 0 15px;color:${colors.textPrimary};font-size:16px;font-weight:bold;">📎 Attachment: ${attachment.originalname}</p>
                  <a href="${attachmentDataUri}" download="${attachment.originalname}" style="display:inline-block;padding:12px 24px;background-color:${colors.highlightGold};color:${colors.primaryDark};text-decoration:none;border-radius:4px;font-weight:bold;">Download File</a>
                </div>
              </td>
            </tr>`;
      }
    } catch (error) {
      logger.error('Error processing attachment for inline display:', error);
      // If error, don't include attachment HTML
    }
  }
  
  // Build a clean, Gmail-compatible HTML email template
  const template = `<!DOCTYPE html>
  <html xmlns="http://www.w3.org/1999/xhtml">
  <head>
    <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="x-apple-disable-message-reformatting" />
    <title>${subject || mainTitle} - Global Ace Gaming</title>
  
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
      body {
        margin: 0;
        padding: 0;
        -webkit-text-size-adjust: 100%;
        -ms-text-size-adjust: 100%;
        background-color: ${colors.primaryDark};
        font-family: Arial, sans-serif;
      }
  
      table {
        border-collapse: collapse;
        mso-table-lspace: 0pt;
        mso-table-rspace: 0pt;
      }
  
      img {
        border: 0;
        height: auto;
        line-height: 100%;
        outline: none;
        text-decoration: none;
        -ms-interpolation-mode: bicubic;
      }
  
      a {
        color: ${colors.highlightGold};
        text-decoration: none;
      }
  
      a:hover {
        color: ${colors.accentBlue};
      }
  
      .container {
        box-shadow: 0 10px 30px rgba(0,0,0,0.35);
        border-radius: 8px;
        overflow: hidden;
      }
  
      .divider {
        height: 1px;
        background-color: ${colors.border};
        margin: 25px 0;
      }
  
      @media only screen and (max-width: 600px) {
        .container {
          width: 100% !important;
          max-width: 100% !important;
          border-radius: 0 !important;
        }
        .content {
          padding: 24px !important;
        }
      }
    </style>
  </head>
  
  <body>
    <table role="presentation" width="100%">
      <tr>
        <td align="center" style="padding: 24px 12px;">
  
          <!-- Main Container -->
          <table role="presentation" class="container" width="600" style="max-width:600px; background-color:${colors.secondaryDark};">
  
            <!-- Header -->
            <tr>
              <td style="padding: 36px 24px; text-align:center; background: linear-gradient(180deg, ${colors.secondaryDark} 0%, ${colors.primaryDark} 100%); border-top: 4px solid ${colors.highlightGold};">
                
                ${logoDataUri 
                  ? `<img src="${logoDataUri}" alt="Global Ace Gaming Logo" width="120" style="display:block;margin:0 auto 16px;" />`
                  : `<div style="width:64px;height:64px;margin:0 auto 16px;background:linear-gradient(135deg, ${colors.accentPurple}, ${colors.accentBlue});border-radius:12px;line-height:64px;font-size:26px;font-weight:bold;color:${colors.textPrimary};">GA</div>`
                }
  
                <h2 style="margin:0 0 6px;font-size:24px;letter-spacing:0.6px;color:${colors.highlightGold};">
                  ${siteName}
                </h2>
  
                <p style="margin:0 0 18px;font-size:15px;color:${colors.textSecondary};font-style:italic;">
                  ${tagline}
                </p>
  
                <h1 style="margin:0;font-size:32px;line-height:1.25;color:${colors.textPrimary};">
                  ${mainTitle}
                </h1>
  
                ${emailSubtitle ? `
                <p style="margin:10px 0 0;font-size:18px;color:${colors.textSecondary};">
                  ${emailSubtitle}
                </p>` : ``}
  
              </td>
            </tr>
  
            <!-- Content -->
            <tr>
              <td class="content" style="padding:40px 32px;color:${colors.textPrimary};font-size:16px;line-height:1.7;">
                ${htmlContent}
              </td>
            </tr>
            
            ${attachmentHtml}
  
            <!-- Footer -->
            <tr>
              <td style="padding:32px 20px;background-color:${colors.primaryDark};border-top:1px solid ${colors.border};border-bottom:4px solid ${colors.highlightGold};">
  
                <!-- Footer Links -->
                <p style="text-align:center;font-size:14px;margin:0 0 16px;color:${colors.textSecondary};">
                  <a href="${frontendUrl}/">Home</a> &nbsp;|&nbsp;
                  <a href="${frontendUrl}/games">Games</a> &nbsp;|&nbsp;
                  <a href="${frontendUrl}/about-us">About Us</a> &nbsp;|&nbsp;
                  <a href="${frontendUrl}/contact">Contact</a>
                </p>
  
                <div class="divider"></div>
  
                <!-- Contact -->
                <p style="text-align:center;font-size:14px;margin:0 0 12px;color:${colors.textSecondary};">
                  <strong style="color:${colors.textPrimary};display:block;margin-bottom:4px;">Contact Us</strong>
                  <a href="mailto:support@globalacegaming.com">${'support@globalacegaming.com'}</a>
                </p>
  
                <p style="text-align:center;margin:0 0 18px;">
                  <a href="${frontendUrl}" style="font-weight:bold;">${siteDomain}</a>
                </p>
  
                <!-- Social -->
                <table role="presentation" align="center" style="margin-bottom:18px;">
                  <tr>
                    <td style="padding:0 10px;">
                      <a href="https://www.facebook.com/globalacegaming">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/b/b8/2021_Facebook_icon.svg/2048px-2021_Facebook_icon.svg.png" width="30" />
                      </a>
                    </td>
                    <td style="padding:0 10px;">
                      <a href="https://t.me/teamglobalace">
                        <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/8/83/Telegram_2019_Logo.svg/1024px-Telegram_2019_Logo.svg.png" width="30" />
                      </a>
                    </td>
                  </tr>
                </table>
  
                <!-- Copyright -->
                <p style="text-align:center;font-size:12px;color:${colors.textSecondary};line-height:1.6;margin:0;">
                  © ${currentYear} Global Ace Gaming. All rights reserved.<br/>
                  Intended for users 18 years and older.
                </p>
  
              </td>
            </tr>
  
          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>`;
  
  return template;
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
      const { subject, emailBody, headerTitle, headerSubtitle, recipientIds, recipientEmails } = req.body;
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

      sendSmtpEmail.subject = subject;
      sendSmtpEmail.htmlContent = emailHtml;

      // Attachment is now embedded in the HTML template, so we don't attach it separately

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
          const batchEmail = new SibApiV3Sdk.SendSmtpEmail();
          batchEmail.sender = sendSmtpEmail.sender;
          batchEmail.to = batch.map(email => ({ email }));
          batchEmail.subject = sendSmtpEmail.subject;
          batchEmail.htmlContent = sendSmtpEmail.htmlContent;
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
                splitEmail.to = firstHalf.map(email => ({ email }));
                splitEmail.subject = sendSmtpEmail.subject;
                splitEmail.htmlContent = sendSmtpEmail.htmlContent;
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
                splitEmail.to = secondHalf.map(emailAddr => ({ email: emailAddr }));
                splitEmail.subject = sendSmtpEmail.subject;
                splitEmail.htmlContent = sendSmtpEmail.htmlContent;
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
            for (const email of batch) {
              if (req.timedout) break; // Check timeout before each individual send
              
              try {
                const individualEmail = new SibApiV3Sdk.SendSmtpEmail();
                individualEmail.sender = sendSmtpEmail.sender;
                individualEmail.to = [{ email }];
                individualEmail.subject = sendSmtpEmail.subject;
                individualEmail.htmlContent = sendSmtpEmail.htmlContent;
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

