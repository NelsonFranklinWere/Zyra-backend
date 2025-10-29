const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const emailAutomationController = require('../controllers/emailAutomationController');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Email Automation Routes
router.post('/', emailAutomationController.createAutomation);
router.get('/', emailAutomationController.listAutomations);
router.put('/:id', emailAutomationController.updateAutomation);
router.delete('/:id', emailAutomationController.deleteAutomation);
router.post('/:id/trigger', emailAutomationController.triggerAutomation);
router.get('/:id/runs', emailAutomationController.getAutomationRuns);

module.exports = router;
