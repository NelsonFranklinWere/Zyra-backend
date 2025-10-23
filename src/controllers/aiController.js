const aiCoreService = require('../services/aiCoreService');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

// CV Builder Controller
const generateCV = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { personalInfo, experience, education, skills, preferences } = req.body;
    const userId = req.user.userId;

    const userData = {
      personalInfo,
      experience,
      education,
      skills,
      userId
    };

    const result = await aiCoreService.generateCV(userData, preferences);

    // Store user's CV generation
    await db('user_cvs').insert({
      user_id: userId,
      cv_data: JSON.stringify(userData),
      preferences: JSON.stringify(preferences),
      generated_cv: result.data.cv,
      created_at: new Date()
    });

    logger.info(`CV generated for user: ${userId}`);

    res.json({
      success: true,
      message: 'CV generated successfully',
      data: result.data
    });

  } catch (error) {
    logger.error('CV generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate CV'
    });
  }
};

// Social Media Generator Controller
const generateSocialPost = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { content, platform, preferences } = req.body;
    const userId = req.user.userId;

    const result = await aiCoreService.generateSocialPost(content, platform, preferences);

    // Store user's social post generation
    await db('user_social_posts').insert({
      user_id: userId,
      content: JSON.stringify(content),
      platform,
      preferences: JSON.stringify(preferences),
      generated_post: result.data.post,
      engagement_score: result.data.engagement_score,
      created_at: new Date()
    });

    logger.info(`Social post generated for user: ${userId}`);

    res.json({
      success: true,
      message: 'Social post generated successfully',
      data: result.data
    });

  } catch (error) {
    logger.error('Social post generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate social post'
    });
  }
};

// WhatsApp Automation Controller
const processWhatsAppMessage = async (req, res) => {
  try {
    const { message, context } = req.body;
    const userId = req.user.userId;

    if (!message) {
      return res.status(400).json({
        success: false,
        message: 'Message is required'
      });
    }

    const result = await aiCoreService.processWhatsAppMessage(message, context);

    // Store WhatsApp interaction
    await db('whatsapp_interactions').insert({
      user_id: userId,
      incoming_message: message,
      context: JSON.stringify(context),
      ai_response: result.data.response,
      intent: result.data.intent,
      confidence: result.data.confidence,
      created_at: new Date()
    });

    logger.info(`WhatsApp message processed for user: ${userId}`);

    res.json({
      success: true,
      message: 'WhatsApp message processed successfully',
      data: result.data
    });

  } catch (error) {
    logger.error('WhatsApp processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process WhatsApp message'
    });
  }
};

// Data Insights Controller
const generateInsights = async (req, res) => {
  try {
    const { data, analysisType } = req.body;
    const userId = req.user.userId;

    if (!data) {
      return res.status(400).json({
        success: false,
        message: 'Data is required'
      });
    }

    const result = await aiCoreService.generateInsights(data, analysisType);

    // Store insights generation
    await db('user_insights').insert({
      user_id: userId,
      input_data: JSON.stringify(data),
      analysis_type: analysisType,
      insights: result.data.insights,
      key_metrics: JSON.stringify(result.data.key_metrics),
      recommendations: JSON.stringify(result.data.recommendations),
      confidence_score: result.data.confidence_score,
      created_at: new Date()
    });

    logger.info(`Insights generated for user: ${userId}`);

    res.json({
      success: true,
      message: 'Insights generated successfully',
      data: result.data
    });

  } catch (error) {
    logger.error('Insights generation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate insights'
    });
  }
};

// Audience Targeting Controller
const generateAudienceSegments = async (req, res) => {
  try {
    const { criteria, preferences } = req.body;
    const userId = req.user.userId;

    if (!criteria) {
      return res.status(400).json({
        success: false,
        message: 'Targeting criteria is required'
      });
    }

    const result = await aiCoreService.generateAudienceSegments(criteria, preferences);

    // Store audience targeting generation
    await db('user_audience_segments').insert({
      user_id: userId,
      criteria: JSON.stringify(criteria),
      preferences: JSON.stringify(preferences),
      segments: result.data.segments,
      targeting_strategies: JSON.stringify(result.data.targeting_strategies),
      engagement_tips: JSON.stringify(result.data.engagement_tips),
      market_potential: result.data.market_potential,
      created_at: new Date()
    });

    logger.info(`Audience segments generated for user: ${userId}`);

    res.json({
      success: true,
      message: 'Audience segments generated successfully',
      data: result.data
    });

  } catch (error) {
    logger.error('Audience targeting error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate audience segments'
    });
  }
};

// Get AI Generations History
const getAIGenerations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { module, limit = 10, offset = 0 } = req.query;

    let query = db('ai_generations')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (module) {
      query = query.where({ module });
    }

    const generations = await query;

    res.json({
      success: true,
      data: {
        generations,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: generations.length
        }
      }
    });

  } catch (error) {
    logger.error('Get AI generations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI generations'
    });
  }
};

// Get AI Performance Stats
const getAIPerformance = async (req, res) => {
  try {
    const userId = req.user.userId;

    // Get performance stats for the user
    const stats = await db.raw(`
      SELECT 
        module,
        COUNT(*) as total_generations,
        AVG(CAST(metadata->>'confidence' AS FLOAT)) as avg_confidence,
        MAX(created_at) as last_used
      FROM ai_generations 
      WHERE user_id = ? 
      GROUP BY module
    `, [userId]);

    // Get recent activity
    const recentActivity = await db('ai_generations')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(5);

    res.json({
      success: true,
      data: {
        performance_stats: stats.rows,
        recent_activity: recentActivity
      }
    });

  } catch (error) {
    logger.error('Get AI performance error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch AI performance data'
    });
  }
};

// Update AI Preferences
const updateAIPreferences = async (req, res) => {
  try {
    const { preferences } = req.body;
    const userId = req.user.userId;

    await db('user_ai_preferences')
      .where({ user_id: userId })
      .update({
        preferences: JSON.stringify(preferences),
        updated_at: new Date()
      });

    logger.info(`AI preferences updated for user: ${userId}`);

    res.json({
      success: true,
      message: 'AI preferences updated successfully'
    });

  } catch (error) {
    logger.error('Update AI preferences error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update AI preferences'
    });
  }
};

module.exports = {
  generateCV,
  generateSocialPost,
  processWhatsAppMessage,
  generateInsights,
  generateAudienceSegments,
  getAIGenerations,
  getAIPerformance,
  updateAIPreferences
};