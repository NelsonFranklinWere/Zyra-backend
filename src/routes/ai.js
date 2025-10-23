const express = require('express');
const { body, validationResult } = require('express-validator');
const aiController = require('../controllers/aiController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Validation rules
const cvValidation = [
  body('personalInfo').isObject().withMessage('Personal information is required'),
  body('personalInfo.firstName').notEmpty().withMessage('First name is required'),
  body('personalInfo.lastName').notEmpty().withMessage('Last name is required'),
  body('personalInfo.email').isEmail().withMessage('Valid email is required'),
  body('experience').isArray().withMessage('Experience must be an array'),
  body('education').isArray().withMessage('Education must be an array'),
  body('skills').isArray().withMessage('Skills must be an array')
];

const socialPostValidation = [
  body('content').isObject().withMessage('Content is required'),
  body('content.theme').notEmpty().withMessage('Content theme is required'),
  body('platform').isIn(['linkedin', 'twitter', 'instagram', 'facebook']).withMessage('Valid platform is required')
];

const whatsappValidation = [
  body('message').notEmpty().withMessage('Message is required'),
  body('context').isObject().optional()
];

const insightsValidation = [
  body('data').isObject().withMessage('Data is required'),
  body('analysisType').isString().optional()
];

const audienceValidation = [
  body('criteria').isObject().withMessage('Targeting criteria is required'),
  body('criteria.age_range').isObject().optional(),
  body('criteria.interests').isArray().optional(),
  body('criteria.location').isString().optional()
];

// AI Routes - All require authentication
router.use(authMiddleware);

// CV Builder
router.post('/cv', cvValidation, aiController.generateCV);

// Social Media Generator
router.post('/social', socialPostValidation, aiController.generateSocialPost);

// WhatsApp Automation
router.post('/whatsapp', whatsappValidation, aiController.processWhatsAppMessage);

// Data Insights
router.post('/insights', insightsValidation, aiController.generateInsights);

// Audience Targeting
router.post('/audience', audienceValidation, aiController.generateAudienceSegments);

// AI Generations History
router.get('/generations', aiController.getAIGenerations);

// AI Performance Stats
router.get('/performance', aiController.getAIPerformance);

// Update AI Preferences
router.put('/preferences', aiController.updateAIPreferences);

module.exports = router;