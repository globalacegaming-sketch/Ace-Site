import * as nodemailer from 'nodemailer';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  constructor() {
    // Initialize transporter based on environment
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      const port = parseInt(process.env.SMTP_PORT || '587');
      // Port 465 requires SSL/TLS (secure: true), port 587 uses STARTTLS (secure: false)
      const secure = port === 465 || process.env.SMTP_SECURE === 'true';
      
      this.transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: port,
        secure: secure,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        },
        // Connection timeout settings for Render/cloud environments
        connectionTimeout: 30000, // 30 seconds
        greetingTimeout: 30000, // 30 seconds
        socketTimeout: 30000, // 30 seconds
        // Retry connection on failure
        pool: false,
        // Additional options for better compatibility
        tls: {
          // Do not fail on invalid certificates (useful for some SMTP servers)
          rejectUnauthorized: false,
          // Additional TLS options for better connection
          minVersion: 'TLSv1.2'
        },
        // Debug mode (set to true for troubleshooting)
        debug: process.env.NODE_ENV === 'development',
        logger: process.env.NODE_ENV === 'development'
      } as any);
    } else {
      console.warn('Email service not configured. SMTP credentials missing.');
    }
  }

  async sendEmail(options: EmailOptions, retries: number = 2): Promise<boolean> {
    if (!this.transporter) {
      console.warn('Email service not available. Email would have been sent:', options);
      return false;
    }

    const fromAddress = process.env.SMTP_FROM || process.env.SMTP_USER;
    const mailOptions = {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      html: options.html
    };

    console.log('Attempting to send email:', {
      from: fromAddress,
      to: options.to,
      subject: options.subject,
      smtpHost: process.env.SMTP_HOST,
      smtpUser: process.env.SMTP_USER,
      smtpFrom: process.env.SMTP_FROM
    });

    // Warning if sender email might not be verified
    if (fromAddress && fromAddress !== process.env.SMTP_USER) {
      console.warn('⚠️  Using custom FROM address. Ensure this email is verified in Brevo:');
      console.warn(`   - Go to https://app.brevo.com → Settings → Senders`);
      console.warn(`   - Verify that "${fromAddress}" is added and verified`);
      console.warn(`   - Unverified senders may cause emails to be queued but not delivered`);
    }

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        // Send email and capture response
        const info = await this.transporter.sendMail(mailOptions);
        
        // Log detailed response from SMTP server
        console.log('Email send response:', {
          messageId: info.messageId,
          response: info.response,
          accepted: info.accepted,
          rejected: info.rejected,
          pending: info.pending,
          to: options.to,
          from: fromAddress
        });

        // Check if email was actually accepted by SMTP server
        if (info.rejected && info.rejected.length > 0) {
          console.error('Email was rejected by SMTP server:', {
            to: options.to,
            rejected: info.rejected,
            response: info.response
          });
          return false;
        }

        if (info.accepted && info.accepted.length > 0) {
          console.log(`✅ Email accepted by SMTP server for ${options.to}. Message ID: ${info.messageId}`);
          console.log(`📧 SMTP Response: ${info.response}`);
          return true;
        }

        // If neither accepted nor rejected, something is wrong
        console.warn('Email send returned unexpected response:', info);
        return false;

      } catch (error: any) {
        const isConnectionError = 
          error.code === 'ETIMEDOUT' || 
          error.code === 'ECONNREFUSED' || 
          error.code === 'ESOCKETTIMEDOUT' ||
          error.message?.includes('timeout') ||
          error.message?.includes('Connection timeout');

        if (isConnectionError && attempt < retries) {
          const waitTime = (attempt + 1) * 2000; // Exponential backoff: 2s, 4s
          console.warn(
            `Email send attempt ${attempt + 1} failed (connection timeout). Retrying in ${waitTime}ms...`,
            error.message
          );
          await new Promise(resolve => setTimeout(resolve, waitTime));
          continue;
        }

        // Log error details for debugging
        console.error('❌ Error sending email:', {
          to: options.to,
          subject: options.subject,
          from: fromAddress,
          error: error.message,
          code: error.code,
          response: error.response,
          command: error.command,
          attempt: attempt + 1,
          totalAttempts: retries + 1,
          stack: error.stack
        });
        
        return false;
      }
    }

    return false;
  }

  async sendVerificationEmail(email: string, token: string, firstName?: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
    const verificationUrl = `${frontendUrl}/verify-email?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Verify Your Email Address</h2>
            <p>Hello ${firstName || 'there'},</p>
            <p>Thank you for signing up with Global Ace Gaming! Please verify your email address by clicking the button below:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${verificationUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Verify Email</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${verificationUrl}</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">This link will expire in 24 hours. If you didn't create an account, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Global Ace Gaming',
      html
    });
  }

  async sendVerificationCodeEmail(email: string, code: string, firstName?: string): Promise<boolean> {
    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Verify Your Email</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Verify Your Email Address</h2>
            <p>Hello ${firstName || 'there'},</p>
            <p>Thank you for signing up with Global Ace Gaming! Please enter the verification code below to verify your email address:</p>
            <div style="text-align: center; margin: 30px 0;">
              <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 20px 40px; border-radius: 10px; display: inline-block;">
                <p style="font-size: 36px; font-weight: bold; letter-spacing: 8px; margin: 0; font-family: 'Courier New', monospace;">${code}</p>
              </div>
            </div>
            <p style="color: #666; font-size: 12px; margin-top: 30px; text-align: center;">This code will expire in 10 minutes. If you didn't create an account, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Verify Your Email - Global Ace Gaming',
      html
    });
  }

  async sendPasswordResetEmail(email: string, token: string, firstName?: string): Promise<boolean> {
    const frontendUrl = process.env.FRONTEND_URL || process.env.VITE_FRONTEND_URL || 'http://localhost:5173';
    const resetUrl = `${frontendUrl}/reset-password?token=${token}`;

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Reset Your Password</title>
        </head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #333;">Reset Your Password</h2>
            <p>Hello ${firstName || 'there'},</p>
            <p>We received a request to reset your password. Click the button below to reset it:</p>
            <div style="text-align: center; margin: 30px 0;">
              <a href="${resetUrl}" style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #667eea;">${resetUrl}</p>
            <p style="color: #666; font-size: 12px; margin-top: 30px;">This link will expire in 1 hour. If you didn't request a password reset, please ignore this email.</p>
          </div>
        </body>
      </html>
    `;

    return this.sendEmail({
      to: email,
      subject: 'Reset Your Password - Global Ace Gaming',
      html
    });
  }
}

export default new EmailService();

