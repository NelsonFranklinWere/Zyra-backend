const nodemailer = require('nodemailer');
const twilio = require('twilio');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const crypto = require('crypto');

class OTPService {
  constructor() {
    // Email transporter setup - only if credentials are provided
    if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && 
        process.env.SMTP_USER !== 'your_email@gmail.com') {
      try {
        this.emailTransporter = nodemailer.createTransport({
          host: process.env.SMTP_HOST,
          port: parseInt(process.env.SMTP_PORT) || 587,
          secure: process.env.SMTP_PORT == 465,
          auth: {
            user: process.env.SMTP_USER,
            pass: process.env.SMTP_PASS
          }
        });
      } catch (error) {
        logger.warn('Failed to create email transporter:', error.message);
        this.emailTransporter = null;
      }
    } else {
      this.emailTransporter = null;
    }

    // Twilio client setup - only if credentials are provided
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      try {
        this.twilioClient = twilio(
          process.env.TWILIO_ACCOUNT_SID,
          process.env.TWILIO_AUTH_TOKEN
        );
      } catch (error) {
        logger.warn('Failed to create Twilio client:', error.message);
        this.twilioClient = null;
      }
    } else {
      this.twilioClient = null;
    }
  }

  // Generate OTP code
  generateOTP(length = 6) {
    const digits = '0123456789';
    let otp = '';
    for (let i = 0; i < length; i++) {
      otp += digits[Math.floor(Math.random() * digits.length)];
    }
    return otp;
  }

  // Send OTP via email
  async sendOTPEmail(email, otpCode, userName = 'User') {
    try {
      // Check if email service is configured
      if (!process.env.SMTP_USER || !process.env.SMTP_PASS || process.env.SMTP_USER === 'your_email@gmail.com') {
        logger.error('Email service not configured properly. Please set SMTP_USER and SMTP_PASS in .env file');
        
        // In development, log the OTP to console instead of failing
        if (process.env.NODE_ENV !== 'production') {
          logger.warn(`⚠️  DEVELOPMENT MODE: Email not configured. OTP for ${email} is: ${otpCode}`);
          logger.warn(`⚠️  To enable email sending, configure SMTP settings in backend/.env file`);
          return true; // Return success in dev mode so OTP is still stored
        }
        
        throw new Error('Email service not configured. Please contact administrator.');
      }

      // Get user's first name if available
      const displayName = userName !== 'User' ? userName.split(' ')[0] : 'User';

      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: email,
        subject: 'Zyra - Email Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center;">
              <h1 style="color: white; margin: 0;">Zyra AI Platform</h1>
            </div>
            <div style="padding: 30px; background: #f8f9fa;">
              <h2 style="color: #333; margin-bottom: 20px;">Email Verification</h2>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Hello ${displayName},
              </p>
              <p style="color: #666; font-size: 16px; line-height: 1.6;">
                Thank you for signing up with Zyra! Please use the following verification code to complete your registration:
              </p>
              <div style="background: #fff; border: 2px solid #667eea; border-radius: 8px; padding: 20px; text-align: center; margin: 20px 0;">
                <h1 style="color: #667eea; font-size: 32px; letter-spacing: 5px; margin: 0;">${otpCode}</h1>
              </div>
              <p style="color: #666; font-size: 14px;">
                This code will expire in 3 minutes. If you didn't request this verification, please ignore this email.
              </p>
            </div>
            <div style="background: #333; color: white; padding: 20px; text-align: center; font-size: 14px;">
              <p style="margin: 0;">© 2024 Zyra AI Platform. All rights reserved.</p>
            </div>
          </div>
        `,
        text: `Your Zyra verification code is: ${otpCode}. This code expires in 3 minutes.`
      };

      await this.emailTransporter.sendMail(mailOptions);
      logger.info(`OTP email sent successfully to: ${email}`);
      return true;
    } catch (error) {
      logger.error('Failed to send OTP email:', error);
      
      // In development, log the OTP even if email fails
      if (process.env.NODE_ENV !== 'production') {
        logger.warn(`⚠️  DEVELOPMENT MODE: Email send failed. OTP for ${email} is: ${otpCode}`);
      }
      
      throw error;
    }
  }

  // Send OTP via SMS
  async sendOTPSMS(phoneNumber, otpCode) {
    try {
      if (!this.twilioClient) {
        throw new Error('SMS service not configured. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN in .env file');
      }

      const message = await this.twilioClient.messages.create({
        body: `Your Zyra verification code is: ${otpCode}. This code expires in 3 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: phoneNumber
      });

      logger.info(`OTP SMS sent to: ${phoneNumber}, SID: ${message.sid}`);
      return true;
    } catch (error) {
      logger.error('Failed to send OTP SMS:', error);
      throw error;
    }
  }

  // Store OTP in database
  async storeOTP(userId, email, phoneNumber, otpCode, verificationType) {
    try {
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

      await db('otp_verifications').insert({
        user_id: userId,
        email,
        phone_number: phoneNumber,
        otp_code: otpCode,
        verification_type: verificationType,
        expires_at: expiresAt
      });

      logger.info(`OTP stored for user: ${userId}, type: ${verificationType}`);
      return true;
    } catch (error) {
      logger.error('Failed to store OTP:', error);
      throw error;
    }
  }

  // Verify OTP
  async verifyOTP(userId, otpCode, verificationType) {
    try {
      const otpRecord = await db('otp_verifications')
        .where({
          user_id: userId,
          otp_code: otpCode,
          verification_type: verificationType,
          is_verified: false
        })
        .where('expires_at', '>', new Date())
        .first();

      if (!otpRecord) {
        return {
          success: false,
          message: 'Invalid or expired OTP code'
        };
      }

      // Check attempts
      if (otpRecord.attempts >= 3) {
        return {
          success: false,
          message: 'Too many failed attempts. Please request a new OTP.'
        };
      }

      // Mark as verified
      await db('otp_verifications')
        .where({ id: otpRecord.id })
        .update({
          is_verified: true,
          verified_at: new Date()
        });

      // Update user verification status
      if (verificationType === 'email') {
        await db('users')
          .where({ id: userId })
          .update({ is_verified: true });
      } else if (verificationType === 'sms') {
        await db('users')
          .where({ id: userId })
          .update({ 
            phone_verified: true,
            phone_verified_at: new Date()
          });
      }

      logger.info(`OTP verified for user: ${userId}, type: ${verificationType}`);
      return {
        success: true,
        message: 'OTP verified successfully'
      };
    } catch (error) {
      logger.error('Failed to verify OTP:', error);
      throw error;
    }
  }

  // Increment OTP attempts
  async incrementOTPAttempts(userId, otpCode, verificationType) {
    try {
      await db('otp_verifications')
        .where({
          user_id: userId,
          otp_code: otpCode,
          verification_type: verificationType
        })
        .increment('attempts', 1);

      logger.info(`OTP attempts incremented for user: ${userId}`);
    } catch (error) {
      logger.error('Failed to increment OTP attempts:', error);
      throw error;
    }
  }

  // Clean expired OTPs
  async cleanExpiredOTPs() {
    try {
      const deleted = await db('otp_verifications')
        .where('expires_at', '<', new Date())
        .del();

      logger.info(`Cleaned ${deleted} expired OTPs`);
      return deleted;
    } catch (error) {
      logger.error('Failed to clean expired OTPs:', error);
      throw error;
    }
  }

  // Send OTP and store it
  async sendAndStoreOTP(userId, email, phoneNumber, verificationType) {
    try {
      const otpCode = this.generateOTP();
      const expiresAt = new Date(Date.now() + 3 * 60 * 1000); // 3 minutes

      // Store OTP first
      await db('otp_verifications').insert({
        user_id: userId,
        email,
        phone_number: phoneNumber,
        otp_code: otpCode,
        verification_type: verificationType,
        expires_at: expiresAt
      });

      // Send OTP
      if (verificationType === 'email' && email) {
        // Get user name for email
        const user = await db('users').where({ id: userId }).first();
        const userName = user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email : 'User';
        
        await this.sendOTPEmail(email, otpCode, userName);
      } else if (verificationType === 'sms' && phoneNumber) {
        await this.sendOTPSMS(phoneNumber, otpCode);
      }

      logger.info(`OTP sent successfully to ${verificationType === 'email' ? email : phoneNumber}`);

      return {
        success: true,
        message: `OTP sent to your ${verificationType}`,
        expiresIn: 180 // 3 minutes in seconds
      };
    } catch (error) {
      logger.error('Failed to send and store OTP:', error);
      throw error;
    }
  }
}

// Always export the service - it will handle missing credentials gracefully
module.exports = new OTPService();
