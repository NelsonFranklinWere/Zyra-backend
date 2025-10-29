const nodemailer = require('nodemailer');
const { logger } = require('../utils/logger');

class EmailService {
  constructor() {
    this.transporter = null;
    this.initializeTransporter();
  }

  initializeTransporter() {
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
      this.transporter = nodemailer.createTransporter({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT || 587,
        secure: process.env.SMTP_PORT == 465,
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });
    }
  }

  async sendEmail({ to, subject, text, html, attachments = [] }) {
    try {
      if (!this.transporter) {
        logger.warn('Email service not configured, skipping email send');
        return { success: false, message: 'Email service not configured' };
      }

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html,
        attachments
      };

      const result = await this.transporter.sendMail(mailOptions);
      logger.info('Email sent successfully', { messageId: result.messageId, to });
      
      return { success: true, messageId: result.messageId };
    } catch (error) {
      logger.error('Error sending email:', error);
      return { success: false, error: error.message };
    }
  }

  async sendVerificationEmail(email, token) {
    const subject = 'Zyra Account Verification';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #00d4ff;">Verify Your Zyra Account</h2>
        <p>Please use the following verification code to complete your account setup:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; font-weight: bold; letter-spacing: 2px;">
          ${token}
        </div>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this verification, please ignore this email.</p>
      </div>
    `;

    return await this.sendEmail({
      to: email,
      subject,
      html,
      text: `Your verification code is: ${token}`
    });
  }

  async testConnection(config = {}) {
    try {
      if (!this.transporter) {
        return { connected: false, message: 'Email service not configured' };
      }

      await this.transporter.verify();
      return { connected: true, message: 'Email service connection successful' };
    } catch (error) {
      logger.error('Email connection test failed:', error);
      return { connected: false, message: error.message };
    }
  }
}

module.exports = { emailService: new EmailService() };
