const express = require('express');
const { body, validationResult } = require('express-validator');
const whatsappController = require('../controllers/whatsappController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const sendMessageValidation = [
  body('to').isMobilePhone().withMessage('Valid phone number is required'),
  body('message').notEmpty().withMessage('Message content is required'),
  body('mediaUrl').optional().isURL().withMessage('Valid media URL is required')
];

const settingsValidation = [
  body('autoReply').isBoolean().optional(),
  body('businessHours').isString().optional(),
  body('timezone').isString().optional(),
  body('welcomeMessage').isString().optional(),
  body('awayMessage').isString().optional()
];

const broadcastValidation = [
  body('name').notEmpty().withMessage('Broadcast name is required'),
  body('message').notEmpty().withMessage('Message content is required'),
  body('recipients').isArray().withMessage('Recipients must be an array'),
  body('scheduledAt').optional().isISO8601().withMessage('Valid date is required')
];

// Public webhook routes (no auth required)
router.post('/webhook', whatsappController.processWebhook);
router.get('/webhook', whatsappController.verifyWebhook);

// Protected routes (require authentication)
router.use(authMiddleware);

// Send message
router.post('/send', sendMessageValidation, whatsappController.sendMessage);

// Get analytics
router.get('/analytics', whatsappController.getAnalytics);

// Get recent interactions
router.get('/interactions', whatsappController.getRecentInteractions);

// Get message history
router.get('/messages', whatsappController.getMessageHistory);

// Get settings
router.get('/settings', whatsappController.getSettings);

// Update settings
router.put('/settings', settingsValidation, whatsappController.updateSettings);

// Get contacts
router.get('/contacts', whatsappController.getContacts);

// Create broadcast
router.post('/broadcasts', broadcastValidation, whatsappController.createBroadcast);

// Get broadcasts
router.get('/broadcasts', whatsappController.getBroadcasts);

module.exports = router;