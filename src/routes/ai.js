const express = require('express');
const { authMiddleware } = require('../middleware/auth');
const aiController = require('../controllers/aiController');
const { rateLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Apply authentication middleware to all routes
router.use(authMiddleware);

// Apply rate limiting for AI endpoints
router.use(rateLimiter);

// AI Analysis Routes
router.post('/analyze', aiController.analyze);
router.get('/analysis/:id', aiController.getAnalysis);

// AI Generation Routes
router.post('/generate/cv', aiController.generateCV);
router.post('/generate/social', aiController.generateSocialContent);
router.post('/generate/persona', aiController.generatePersona);

// Feedback and History
router.post('/feedback/:id', aiController.provideFeedback);
router.get('/history', aiController.getGenerationHistory);

// AI Chat endpoint
router.post('/chat', async (req, res) => {
  try {
    const { message, context, mode } = req.body;
    const { tenantId } = req.user;

    // This would integrate with the AI service
    const response = await aiService.processChatMessage({
      message,
      context,
      mode,
      tenantId
    });

    res.json({
      success: true,
      response: {
        content: response.content,
        type: response.type,
        metadata: response.metadata
      }
    });
  } catch (error) {
    console.error('AI chat error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Chat processing failed' 
    });
  }
});

module.exports = router;