const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const { aiService } = require('../services/aiService');

const prisma = new PrismaClient();

class AiController {
  // Analyze content with AI
  async analyze(req, res) {
    try {
      const { tenantId } = req.user;
      const { sourceType, sourceId, options = {} } = req.body;

      // Create analysis request
      const analysisRequest = await prisma.aiAnalysisRequest.create({
        data: {
          tenantId,
          sourceType,
          sourceId,
          payload: { sourceType, sourceId, options },
          modelUsed: options.model || 'gpt-4',
          params: options
        }
      });

      // Queue AI analysis
      const result = await aiService.analyzeContent(analysisRequest.id, {
        sourceType,
        sourceId,
        options
      });

      // Update with result
      await prisma.aiAnalysisRequest.update({
        where: { id: analysisRequest.id },
        data: {
          result: result.analysis,
          confidence: result.confidence
        }
      });

      logger.info('AI analysis completed', { 
        analysisId: analysisRequest.id, 
        tenantId,
        sourceType 
      });

      res.json({ 
        success: true, 
        data: { 
          id: analysisRequest.id,
          result: result.analysis,
          confidence: result.confidence
        }
      });
    } catch (error) {
      logger.error('Error in AI analysis:', error);
      res.status(500).json({ success: false, message: 'AI analysis failed' });
    }
  }

  // Get analysis result
  async getAnalysis(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;

      const analysis = await prisma.aiAnalysisRequest.findFirst({
        where: { id, tenantId }
      });

      if (!analysis) {
        return res.status(404).json({ success: false, message: 'Analysis not found' });
      }

      res.json({ success: true, data: analysis });
    } catch (error) {
      logger.error('Error getting AI analysis:', error);
      res.status(500).json({ success: false, message: 'Failed to get analysis' });
    }
  }

  // Generate CV
  async generateCV(req, res) {
    try {
      const { tenantId } = req.user;
      const { personalInfo, experience, education, skills, template = 'modern' } = req.body;

      const cvData = {
        personalInfo,
        experience,
        education,
        skills,
        template
      };

      const result = await aiService.generateCV(cvData);
      
      // Store generation history
      await prisma.aiGenerationHistory.create({
        data: {
          tenantId,
          prompt: JSON.stringify(cvData),
          response: JSON.stringify(result),
          model: 'gpt-4',
          tokens: result.tokens,
          cost: result.cost
        }
      });

      logger.info('CV generated', { tenantId, template });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error generating CV:', error);
      res.status(500).json({ success: false, message: 'CV generation failed' });
    }
  }

  // Generate social media content
  async generateSocialContent(req, res) {
    try {
      const { tenantId } = req.user;
      const { 
        platform, 
        topic, 
        tone, 
        targetAudience, 
        includeHashtags = true,
        includeCallToAction = true 
      } = req.body;

      const contentData = {
        platform,
        topic,
        tone,
        targetAudience,
        includeHashtags,
        includeCallToAction
      };

      const result = await aiService.generateSocialContent(contentData);
      
      // Store generation history
      await prisma.aiGenerationHistory.create({
        data: {
          tenantId,
          prompt: JSON.stringify(contentData),
          response: JSON.stringify(result),
          model: 'gpt-4',
          tokens: result.tokens,
          cost: result.cost
        }
      });

      logger.info('Social content generated', { tenantId, platform });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error generating social content:', error);
      res.status(500).json({ success: false, message: 'Content generation failed' });
    }
  }

  // Generate persona from data
  async generatePersona(req, res) {
    try {
      const { tenantId } = req.user;
      const { dataSource, sampleSize = 100, criteria = {} } = req.body;

      const personaData = {
        dataSource,
        sampleSize,
        criteria
      };

      const result = await aiService.generatePersona(personaData);
      
      // Store generation history
      await prisma.aiGenerationHistory.create({
        data: {
          tenantId,
          prompt: JSON.stringify(personaData),
          response: JSON.stringify(result),
          model: 'gpt-4',
          tokens: result.tokens,
          cost: result.cost
        }
      });

      logger.info('Persona generated', { tenantId, dataSource });
      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error generating persona:', error);
      res.status(500).json({ success: false, message: 'Persona generation failed' });
    }
  }

  // Provide feedback on AI generation
  async provideFeedback(req, res) {
    try {
      const { id } = req.params;
      const { feedback } = req.body; // 1 for thumbs up, -1 for thumbs down

      await prisma.aiGenerationHistory.update({
        where: { id },
        data: { feedback }
      });

      logger.info('AI feedback recorded', { generationId: id, feedback });
      res.json({ success: true, message: 'Feedback recorded' });
    } catch (error) {
      logger.error('Error recording feedback:', error);
      res.status(500).json({ success: false, message: 'Failed to record feedback' });
    }
  }

  // Get AI generation history
  async getGenerationHistory(req, res) {
    try {
      const { tenantId } = req.user;
      const { page = 1, limit = 10, model } = req.query;

      const where = { tenantId };
      if (model) {
        where.model = model;
      }

      const history = await prisma.aiGenerationHistory.findMany({
        where,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      });

      const total = await prisma.aiGenerationHistory.count({ where });

      res.json({
        success: true,
        data: history,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting generation history:', error);
      res.status(500).json({ success: false, message: 'Failed to get history' });
    }
  }
}

module.exports = new AiController();