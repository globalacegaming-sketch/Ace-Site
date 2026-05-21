import * as SibApiV3Sdk from 'sib-api-v3-sdk';
import {
  buildPasswordResetEmail,
  buildVerificationCodeEmail,
  buildVerificationLinkEmail,
} from '../templates/email/emailLayout';
import { prepareHtmlWithInlineLogo } from '../templates/email/emailLogo';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private apiInstance: SibApiV3Sdk.TransactionalEmailsApi | null = null;
  private apiKey: string | null = null;
  private fromEmail: string | null = null;
  private fromName: string | null = null;

  constructor() {
    // Initialize Brevo API client
    const apiKey = process.env.BREVO_API_KEY;
    
    if (apiKey) {
      this.apiKey = apiKey;
      
      // Configure default client
      const defaultClient = SibApiV3Sdk.ApiClient.instance;
      const apiKeyAuth = defaultClient.authentications['api-key'];
      apiKeyAuth.apiKey = apiKey;
      
      // Initialize transactional emails API instance
      this.apiInstance = new SibApiV3Sdk.TransactionalEmailsApi();
      
      // Set sender email and name from environment variables
      if (!process.env.BREVO_FROM_EMAIL) {
        console.warn('⚠️  BREVO_FROM_EMAIL not set. Please configure it in your environment variables.');
      }
      this.fromEmail = process.env.BREVO_FROM_EMAIL || 'noreply@globalacegaming.com';
      this.fromName = process.env.BREVO_FROM_NAME || 'Global Ace Gaming';
      
      console.log('✅ Brevo email service initialized');
      console.log(`   From: ${this.fromName} <${this.fromEmail}>`);
    } else {
      console.warn('⚠️  Brevo email service not configured. BREVO_API_KEY environment variable is missing.');
    }
  }

  async sendEmail(options: EmailOptions, retries: number = 2): Promise<boolean> {
    if (!this.apiInstance || !this.apiKey) {
      console.warn('Email service not available. Email would have been sent:', {
        to: options.to,
        subject: options.subject
      });
      return false;
    }

    const sendSmtpEmail = new SibApiV3Sdk.SendSmtpEmail();

    // Set sender (must be verified in Brevo dashboard)
    // Use name only to avoid showing email address to recipients
    sendSmtpEmail.sender = {
      name: this.fromName || 'Global Ace Gaming',
      email: this.fromEmail || 'noreply@globalacegaming.com'
    };
    
    // Ensure the sender name is properly set to avoid showing email address
    if (!sendSmtpEmail.sender.name || sendSmtpEmail.sender.name === sendSmtpEmail.sender.email) {
      sendSmtpEmail.sender.name = 'Global Ace Gaming';
    }

    // Set recipient
    sendSmtpEmail.to = [{ email: options.to }];

    // Set email content (inline logo via CID — Gmail blocks data: URIs)
    sendSmtpEmail.subject = options.subject;
    const { html, attachment } = prepareHtmlWithInlineLogo(options.html);
    sendSmtpEmail.htmlContent = html;
    if (attachment) {
      sendSmtpEmail.attachment = [attachment];
    }

    // Set reply-to if configured
    if (process.env.BREVO_REPLY_TO) {
      sendSmtpEmail.replyTo = {
        email: process.env.BREVO_REPLY_TO
      };
    }

    // Add tags for tracking (optional)
    sendSmtpEmail.tags = ['transactional'];

    console.log('Attempting to send email via Brevo:', {
      to: options.to,
      subject: options.subject,
      from: `${sendSmtpEmail.sender.name} <${sendSmtpEmail.sender.email}>`
    });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const result = await this.apiInstance.sendTransacEmail(sendSmtpEmail);
        
        console.log('✅ Email sent successfully via Brevo:', {
          to: options.to,
          subject: options.subject,
          messageId: result.messageId
        });

        // Additional logging for debugging delivery issues
        if (process.env.NODE_ENV === 'development') {
          console.log('📧 Email details:', {
            from: `${sendSmtpEmail.sender.name} <${sendSmtpEmail.sender.email}>`,
            to: options.to,
            subject: options.subject,
            messageId: result.messageId,
            note: 'If email not received, check: 1) Sender email is verified in Brevo, 2) Check spam folder, 3) Check Brevo dashboard for delivery status'
          });
        }
        
        return true;

      } catch (error: any) {
        // Extract detailed error information from Brevo API
        const errorMessage = error.message || error.response?.body?.message || 'Unknown error';
        const errorStatus = error.status || error.statusCode;
        const errorBody = error.response?.body;
        const errorCode = error.body?.code || error.response?.body?.code;

        // Check for common Brevo API errors
        if (errorStatus === 401) {
          console.error('❌ Brevo API Authentication Error: Invalid API key');
          console.error('   Please check your BREVO_API_KEY environment variable');
        } else if (errorStatus === 400) {
          console.error('❌ Brevo API Request Error:', errorMessage);
          if (errorBody) {
            console.error('   Error details:', JSON.stringify(errorBody, null, 2));
          }
          // Don't retry on 400 errors (bad request)
          return false;
        } else if (errorStatus === 403) {
          console.error('❌ Brevo API Forbidden Error: Sender email not verified');
          console.error(`   Please verify "${this.fromEmail}" in Brevo dashboard:`);
          console.error('   https://app.brevo.com → Settings → Senders');
          // Don't retry on 403 errors (sender not verified)
          return false;
        }

        // Check for rate limit (429) - fail immediately, don't retry
        if (errorStatus === 429) {
          console.error('❌ Brevo API Rate Limit Error: Email quota exceeded');
          console.error('   Email failed to send. Please check your Brevo account limits.');
          console.error('   Rate limit details:', errorBody);
          // Fail immediately, don't retry
          return false;
        }

        const isRetryableError = 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNREFUSED' || 
          error.code === 'ESOCKETTIMEDOUT' ||
          errorStatus >= 500; // Server errors (but not rate limits)

        if (isRetryableError && attempt < retries) {
          const waitTime = (attempt + 1) * 2000; // Exponential backoff: 2s, 4s
          console.warn(
            `Email send attempt ${attempt + 1} failed. Retrying in ${waitTime}ms...`,
            errorMessage
          );
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Log error details for debugging
        console.error('❌ Error sending email via Brevo:', {
          to: options.to,
          subject: options.subject,
          error: errorMessage,
          status: errorStatus,
          code: errorCode,
          response: errorBody,
          attempt: attempt + 1,
          totalAttempts: retries + 1
        });
        
        return false;
      }
    }

    return false;
  }

  async sendVerificationEmail(email: string, token: string, firstName?: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;
    const html = buildVerificationLinkEmail(firstName, verificationUrl);

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Global Ace Gaming',
      html
    });
  }

  async sendVerificationCodeEmail(email: string, code: string, firstName?: string): Promise<boolean> {
    const html = buildVerificationCodeEmail(firstName, code);

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Global Ace Gaming',
      html
    });
  }

  async sendPasswordResetEmail(email: string, token: string, firstName?: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
    const html = buildPasswordResetEmail(firstName, resetUrl);

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - Global Ace Gaming',
      html
    });
  }
}

export default new EmailService();
