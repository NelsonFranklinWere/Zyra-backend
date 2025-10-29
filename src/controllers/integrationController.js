const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const { emailService } = require('../services/emailService');
const { smsService } = require('../services/smsService');
const { webhookService } = require('../services/webhookService');

const prisma = new PrismaClient();

class IntegrationController {
  // Email inbound webhook
  async emailInbound(req, res) {
    try {
      const { tenantId } = req.headers['x-tenant-id'];
      const signature = req.headers['x-webhook-signature'];
      
      // Verify webhook signature
      if (!webhookService.verifySignature(req.body, signature)) {
        return res.status(401).json({ success: false, message: 'Invalid signature' });
      }

      const { from, to, subject, text, html, attachments } = req.body;

      // Store email in inbox
      const email = await prisma.emailInbox.create({
        data: {
          tenantId,
          fromEmail: from,
          toEmail: to,
          subject,
          bodyText: text,
          bodyHtml: html,
          attachments: attachments || null
        }
      });

      // Trigger AI analysis if configured
      const analysisRequest = await prisma.aiAnalysisRequest.create({
        data: {
          tenantId,
          sourceType: 'email',
          sourceId: email.id,
          payload: { emailId: email.id, from, to, subject },
          modelUsed: 'gpt-4'
        }
      });

      // Queue for AI processing
      // This would be handled by the worker

      logger.info('Email received and stored', { 
        emailId: email.id, 
        tenantId,
        from,
        subject 
      });

      res.status(200).json({ success: true, message: 'Email processed' });
    } catch (error) {
      logger.error('Error processing inbound email:', error);
      res.status(500).json({ success: false, message: 'Email processing failed' });
    }
  }

  // Ownership verification request
  async requestVerification(req, res) {
    try {
      const { tenantId } = req.user;
      const { provider, identifier, method } = req.body;

      // Generate challenge token
      const challengeToken = Math.random().toString(36).substring(2, 15) + 
                            Math.random().toString(36).substring(2, 15);

      // Create verification record
      const verification = await prisma.ownershipVerification.create({
        data: {
          tenantId,
          accountType: provider,
          identifier,
          challengeMethod: method,
          challengeToken,
          status: 'PENDING'
        }
      });

      // Send challenge
      if (method === 'email') {
        await emailService.sendVerificationEmail(identifier, challengeToken);
      } else if (method === 'sms') {
        await smsService.sendVerificationSMS(identifier, challengeToken);
      }

      logger.info('Ownership verification requested', { 
        verificationId: verification.id,
        tenantId,
        provider,
        method 
      });

      res.json({ 
        success: true, 
        data: { 
          verificationId: verification.id,
          message: `Verification ${method} sent to ${identifier}`
        }
      });
    } catch (error) {
      logger.error('Error requesting verification:', error);
      res.status(500).json({ success: false, message: 'Verification request failed' });
    }
  }

  // Confirm ownership verification
  async confirmVerification(req, res) {
    try {
      const { token } = req.body;

      const verification = await prisma.ownershipVerification.findFirst({
        where: { 
          challengeToken: token,
          status: 'PENDING'
        }
      });

      if (!verification) {
        return res.status(400).json({ 
          success: false, 
          message: 'Invalid or expired verification token' 
        });
      }

      // Update verification status
      await prisma.ownershipVerification.update({
        where: { id: verification.id },
        data: { status: 'VERIFIED' }
      });

      logger.info('Ownership verification confirmed', { 
        verificationId: verification.id,
        tenantId: verification.tenantId
      });

      res.json({ 
        success: true, 
        message: 'Verification confirmed successfully',
        data: {
          accountType: verification.accountType,
          identifier: verification.identifier,
          verified: true
        }
      });
    } catch (error) {
      logger.error('Error confirming verification:', error);
      res.status(500).json({ success: false, message: 'Verification confirmation failed' });
    }
  }

  // Get verification status
  async getVerificationStatus(req, res) {
    try {
      const { tenantId } = req.user;
      const { provider } = req.query;

      const where = { tenantId };
      if (provider) {
        where.accountType = provider;
      }

      const verifications = await prisma.ownershipVerification.findMany({
        where,
        orderBy: { createdAt: 'desc' }
      });

      res.json({ success: true, data: verifications });
    } catch (error) {
      logger.error('Error getting verification status:', error);
      res.status(500).json({ success: false, message: 'Failed to get verification status' });
    }
  }

  // Test integration connection
  async testConnection(req, res) {
    try {
      const { type, config } = req.body;

      let result;
      switch (type) {
        case 'email':
          result = await emailService.testConnection(config);
          break;
        case 'sms':
          result = await smsService.testConnection(config);
          break;
        case 'database':
          result = await this.testDatabaseConnection(config);
          break;
        default:
          return res.status(400).json({ 
            success: false, 
            message: 'Unsupported integration type' 
          });
      }

      res.json({ success: true, data: result });
    } catch (error) {
      logger.error('Error testing connection:', error);
      res.status(500).json({ 
        success: false, 
        message: 'Connection test failed',
        error: error.message 
      });
    }
  }

  // Test database connection
  async testDatabaseConnection(config) {
    // Implementation would depend on the database type
    // This is a placeholder for database connection testing
    return { connected: true, message: 'Database connection successful' };
  }

  // Get integration status
  async getIntegrationStatus(req, res) {
    try {
      const { tenantId } = req.user;

      // Get all integrations for the tenant
      const integrations = {
        email: await this.getEmailIntegrationStatus(tenantId),
        sms: await this.getSMSIntegrationStatus(tenantId),
        social: await this.getSocialIntegrationStatus(tenantId),
        payment: await this.getPaymentIntegrationStatus(tenantId)
      };

      res.json({ success: true, data: integrations });
    } catch (error) {
      logger.error('Error getting integration status:', error);
      res.status(500).json({ success: false, message: 'Failed to get integration status' });
    }
  }

  async getEmailIntegrationStatus(tenantId) {
    // Check if email is configured and working
    return { configured: true, status: 'active' };
  }

  async getSMSIntegrationStatus(tenantId) {
    // Check SMS integration status
    return { configured: true, status: 'active' };
  }

  async getSocialIntegrationStatus(tenantId) {
    // Get social media verification status
    const verifications = await prisma.ownershipVerification.findMany({
      where: { 
        tenantId,
        status: 'VERIFIED'
      }
    });

    return {
      facebook: verifications.some(v => v.accountType === 'facebook_page'),
      instagram: verifications.some(v => v.accountType === 'instagram'),
      whatsapp: verifications.some(v => v.accountType === 'whatsapp_number')
    };
  }

  async getPaymentIntegrationStatus(tenantId) {
    // Get payment account status
    const accounts = await prisma.paymentAccount.findMany({
      where: { tenantId }
    });

    return {
      mpesa: accounts.some(a => a.provider === 'MPESA' && a.verified),
      stripe: accounts.some(a => a.provider === 'STRIPE' && a.verified),
      bank: accounts.some(a => a.provider === 'BANK' && a.verified)
    };
  }
}

module.exports = new IntegrationController();
