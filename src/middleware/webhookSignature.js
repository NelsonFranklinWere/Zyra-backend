const { webhookService } = require('../services/webhookService');
const { logger } = require('../utils/logger');

const webhookSignature = (req, res, next) => {
  try {
    const signature = req.headers['x-webhook-signature'] || req.headers['x-signature'];
    
    if (!signature) {
      return res.status(401).json({
        success: false,
        message: 'Missing webhook signature'
      });
    }

    // Determine webhook type based on path or headers
    const webhookType = req.headers['x-webhook-type'] || 
                       (req.path.includes('email') ? 'email' : 
                        req.path.includes('whatsapp') ? 'whatsapp' : 
                        req.path.includes('stripe') ? 'stripe' : 'general');

    let isValid = false;

    switch (webhookType) {
      case 'email':
        isValid = webhookService.validateEmailWebhook(req.body, signature);
        break;
      case 'whatsapp':
        isValid = webhookService.validateWhatsAppWebhook(req.body, signature);
        break;
      case 'stripe':
        isValid = webhookService.validateStripeWebhook(req.body, signature);
        break;
      default:
        isValid = webhookService.verifySignature(
          JSON.stringify(req.body),
          signature,
          process.env.WEBHOOK_SIGNATURE_SECRET
        );
    }

    if (!isValid) {
      logger.warn('Invalid webhook signature', {
        ip: req.ip,
        userAgent: req.get('User-Agent'),
        path: req.path
      });
      
      return res.status(401).json({
        success: false,
        message: 'Invalid webhook signature'
      });
    }

    next();
  } catch (error) {
    logger.error('Webhook signature validation error:', error);
    return res.status(500).json({
      success: false,
      message: 'Webhook signature validation failed'
    });
  }
};

module.exports = { webhookSignature };
