const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const integrationController = require('../controllers/integrationController');
const { webhookSignature } = require('../middleware/webhookSignature');

const router = express.Router();

// Public webhook endpoints (no auth required)
router.post('/email/inbound', webhookSignature, integrationController.emailInbound);

// Protected routes (require authentication)
router.use(authMiddleware);

// Integration Management
router.get('/status', integrationController.getIntegrationStatus);
router.post('/test-connection', integrationController.testConnection);

// Ownership Verification
router.post('/verify', integrationController.requestVerification);
router.post('/verify/confirm', integrationController.confirmVerification);
router.get('/verify/status', integrationController.getVerificationStatus);

module.exports = router;
