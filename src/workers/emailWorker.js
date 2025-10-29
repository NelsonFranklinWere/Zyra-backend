const { Worker } = require('bullmq');
const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const { emailService } = require('../services/emailService');
const { aiService } = require('../services/aiService');

const prisma = new PrismaClient();

class EmailWorker {
  constructor() {
    this.worker = new Worker('email-queue', this.processEmailJob.bind(this), {
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD
      },
      concurrency: parseInt(process.env.WORKER_CONCURRENCY) || 5
    });

    this.worker.on('completed', (job) => {
      logger.info('Email job completed', { jobId: job.id });
    });

    this.worker.on('failed', (job, err) => {
      logger.error('Email job failed', { jobId: job.id, error: err.message });
    });
  }

  async processEmailJob(job) {
    const { type, data } = job.data;
    
    try {
      switch (type) {
        case 'process_inbound_email':
          return await this.processInboundEmail(data);
        case 'send_automated_email':
          return await this.sendAutomatedEmail(data);
        case 'ai_analysis':
          return await this.processAIAnalysis(data);
        default:
          throw new Error(`Unknown email job type: ${type}`);
      }
    } catch (error) {
      logger.error('Email worker error:', error);
      throw error;
    }
  }

  async processInboundEmail(data) {
    const { emailId, tenantId } = data;
    
    try {
      // Get email from inbox
      const email = await prisma.emailInbox.findFirst({
        where: { id: emailId, tenantId }
      });

      if (!email) {
        throw new Error('Email not found');
      }

      // Mark as processed
      await prisma.emailInbox.update({
        where: { id: emailId },
        data: { processed: true }
      });

      // Create AI analysis request
      const analysisRequest = await prisma.aiAnalysisRequest.create({
        data: {
          tenantId,
          sourceType: 'email',
          sourceId: emailId,
          payload: {
            from: email.fromEmail,
            to: email.toEmail,
            subject: email.subject,
            body: email.bodyText
          },
          modelUsed: 'gpt-4'
        }
      });

      // Queue AI analysis
      await this.queueAIAnalysis(analysisRequest.id, {
        sourceType: 'email',
        sourceId: emailId,
        content: email.bodyText,
        subject: email.subject
      });

      logger.info('Inbound email processed', { emailId, tenantId });
      return { success: true, analysisRequestId: analysisRequest.id };
    } catch (error) {
      logger.error('Error processing inbound email:', error);
      throw error;
    }
  }

  async sendAutomatedEmail(data) {
    const { automationId, tenantId, recipientEmail, template, variables } = data;
    
    try {
      // Get automation details
      const automation = await prisma.emailAutomation.findFirst({
        where: { id: automationId, tenantId }
      });

      if (!automation) {
        throw new Error('Automation not found');
      }

      // Generate email content using AI if needed
      let emailContent = template;
      if (automation.actions.generateContent) {
        const aiResponse = await aiService.generateEmailContent({
          template,
          variables,
          recipientEmail
        });
        emailContent = aiResponse.content;
      }

      // Send email
      const result = await emailService.sendEmail({
        to: recipientEmail,
        subject: variables.subject || 'Automated Email',
        html: emailContent,
        text: emailContent.replace(/<[^>]*>/g, '') // Strip HTML for text version
      });

      // Update automation run status
      await prisma.emailAutomationRun.updateMany({
        where: { automationId, tenantId },
        data: {
          status: result.success ? 'SUCCESS' : 'FAILED',
          result: { emailResult: result },
          finishedAt: new Date(),
          error: result.success ? null : result.error
        }
      });

      logger.info('Automated email sent', { automationId, recipientEmail });
      return { success: true, result };
    } catch (error) {
      logger.error('Error sending automated email:', error);
      
      // Update automation run with error
      await prisma.emailAutomationRun.updateMany({
        where: { automationId: data.automationId, tenantId: data.tenantId },
        data: {
          status: 'FAILED',
          error: error.message,
          finishedAt: new Date()
        }
      });
      
      throw error;
    }
  }

  async processAIAnalysis(data) {
    const { analysisId, sourceType, sourceId, content } = data;
    
    try {
      // Perform AI analysis
      const analysis = await aiService.analyzeContent(analysisId, {
        sourceType,
        sourceId,
        content,
        options: { model: 'gpt-4' }
      });

      // Update analysis request with results
      await prisma.aiAnalysisRequest.update({
        where: { id: analysisId },
        data: {
          result: analysis.analysis,
          confidence: analysis.confidence
        }
      });

      // Check if we should trigger automated responses
      if (analysis.analysis.shouldAutoRespond) {
        await this.queueAutomatedResponse(analysisId, analysis.analysis);
      }

      logger.info('AI analysis completed', { analysisId });
      return { success: true, analysis };
    } catch (error) {
      logger.error('Error processing AI analysis:', error);
      throw error;
    }
  }

  async queueAIAnalysis(analysisId, data) {
    // This would queue the AI analysis job
    // Implementation depends on your job queue system
    logger.info('AI analysis queued', { analysisId });
  }

  async queueAutomatedResponse(analysisId, analysis) {
    // Queue automated response based on analysis
    logger.info('Automated response queued', { analysisId });
  }
}

module.exports = EmailWorker;
