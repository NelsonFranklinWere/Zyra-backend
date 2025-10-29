const twilio = require('twilio');
const { logger } = require('../utils/logger');

class SMSService {
  constructor() {
    this.client = null;
    this.initializeClient();
  }

  initializeClient() {
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
      this.client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
    }
  }

  async sendSMS({ to, message }) {
    try {
      if (!this.client) {
        logger.warn('SMS service not configured, skipping SMS send');
        return { success: false, message: 'SMS service not configured' };
      }

      const result = await this.client.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: to
      });

      logger.info('SMS sent successfully', { messageId: result.sid, to });
      return { success: true, messageId: result.sid };
    } catch (error) {
      logger.error('Error sending SMS:', error);
      return { success: false, error: error.message };
    }
  }

  async sendVerificationSMS(phone, token) {
    const message = `Your Zyra verification code is: ${token}. This code expires in 10 minutes.`;
    return await this.sendSMS({ to: phone, message });
  }

  async testConnection(config = {}) {
    try {
      if (!this.client) {
        return { connected: false, message: 'SMS service not configured' };
      }

      // Test by getting account info
      await this.client.api.accounts(process.env.TWILIO_ACCOUNT_SID).fetch();
      return { connected: true, message: 'SMS service connection successful' };
    } catch (error) {
      logger.error('SMS connection test failed:', error);
      return { connected: false, message: error.message };
    }
  }
}

module.exports = { smsService: new SMSService() };
