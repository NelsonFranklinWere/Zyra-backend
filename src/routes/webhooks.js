const express = require('express');
const webhookController = require('../controllers/webhookController');

const router = express.Router();

// n8n webhooks
router.post('/n8n/:workflowId', webhookController.handleN8nWebhook);

// Platform webhooks
router.post('/whatsapp', webhookController.handleWhatsAppWebhook);
router.post('/instagram', webhookController.handleInstagramWebhook);
router.post('/tiktok', webhookController.handleTikTokWebhook);

// Webhook management
router.get('/logs', webhookController.getWebhookLogs);
router.post('/test', webhookController.testWebhook);

module.exports = router;
