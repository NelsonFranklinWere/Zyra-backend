const express = require('express');
const { body, validationResult } = require('express-validator');
const automationController = require('../controllers/automationController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Validation rules
const automationValidation = [
  body('name').notEmpty().withMessage('Automation name is required'),
  body('description').optional().isString(),
  body('triggers').isArray().withMessage('Triggers must be an array'),
  body('actions').isArray().withMessage('Actions must be an array'),
  body('conditions').optional().isArray(),
  body('settings').optional().isObject()
];

const executionValidation = [
  body('triggerData').isObject().withMessage('Trigger data is required')
];

// All routes require authentication
router.use(authMiddleware);

// Create automation
router.post('/', automationValidation, automationController.createAutomation);

// Get user automations
router.get('/', automationController.getUserAutomations);

// Get single automation
router.get('/:id', automationController.getAutomation);

// Update automation
router.put('/:id', automationValidation, automationController.updateAutomation);

// Delete automation
router.delete('/:id', automationController.deleteAutomation);

// Execute automation
router.post('/:id/execute', executionValidation, automationController.executeAutomation);

// Get automation executions
router.get('/:id/executions', automationController.getAutomationExecutions);

module.exports = router;