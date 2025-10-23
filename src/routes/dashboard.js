const express = require('express');
const dashboardController = require('../controllers/dashboardController');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authMiddleware);

// Dashboard overview
router.get('/overview', dashboardController.getOverview);
router.get('/stats', dashboardController.getStats);
router.get('/activity', dashboardController.getRecentActivity);

// Analytics
router.get('/analytics/automations', dashboardController.getAutomationAnalytics);
router.get('/analytics/data', dashboardController.getDataAnalytics);
router.get('/analytics/ai', dashboardController.getAIAnalytics);

// Performance metrics
router.get('/performance', dashboardController.getPerformanceMetrics);
router.get('/performance/trends', dashboardController.getPerformanceTrends);

// System status
router.get('/status', dashboardController.getSystemStatus);
router.get('/health', dashboardController.getHealthCheck);

module.exports = router;

