const crypto = require('crypto');
const { logger } = require('../utils/logger');

class WebhookService {
  verifySignature(payload, signature, secret) {
    try {
      if (!signature || !secret) {
        return false;
      }

      const expectedSignature = crypto
        .createHmac('sha256', secret)
        .update(payload, 'utf8')
        .digest('hex');

      const providedSignature = signature.replace('sha256=', '');
      
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature, 'hex'),
        Buffer.from(providedSignature, 'hex')
      );
    } catch (error) {
      logger.error('Webhook signature verification error:', error);
      return false;
    }
  }

  generateSignature(payload, secret) {
    return crypto
      .createHmac('sha256', secret)
      .update(payload, 'utf8')
      .digest('hex');
  }

  validateEmailWebhook(payload, signature) {
    return this.verifySignature(
      JSON.stringify(payload),
      signature,
      process.env.EMAIL_WEBHOOK_SECRET
    );
  }

  validateWhatsAppWebhook(payload, signature) {
    return this.verifySignature(
      JSON.stringify(payload),
      signature,
      process.env.WHATSAPP_WEBHOOK_SECRET
    );
  }

  validateStripeWebhook(payload, signature) {
    return this.verifySignature(
      JSON.stringify(payload),
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  }
}

module.exports = { webhookService: new WebhookService() };
