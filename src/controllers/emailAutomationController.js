const { PrismaClient } = require('@prisma/client');
const { logger } = require('../utils/logger');
const { emailAutomationService } = require('../services/emailAutomationService');
const { authMiddleware } = require('../middleware/auth');

const prisma = new PrismaClient();

class EmailAutomationController {
  // Create email automation
  async createAutomation(req, res) {
    try {
      const { tenantId } = req.user;
      const { name, description, triggers, conditions, actions, schedule, settings } = req.body;

      const automation = await prisma.emailAutomation.create({
        data: {
          tenantId,
          name,
          description,
          triggers,
          conditions,
          actions,
          schedule,
          settings,
          isActive: true
        }
      });

      logger.info('Email automation created', { automationId: automation.id, tenantId });
      res.status(201).json({ success: true, data: automation });
    } catch (error) {
      logger.error('Error creating email automation:', error);
      res.status(500).json({ success: false, message: 'Failed to create automation' });
    }
  }

  // Update email automation
  async updateAutomation(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const updateData = req.body;

      const automation = await prisma.emailAutomation.updateMany({
        where: { id, tenantId },
        data: updateData
      });

      if (automation.count === 0) {
        return res.status(404).json({ success: false, message: 'Automation not found' });
      }

      logger.info('Email automation updated', { automationId: id, tenantId });
      res.json({ success: true, message: 'Automation updated successfully' });
    } catch (error) {
      logger.error('Error updating email automation:', error);
      res.status(500).json({ success: false, message: 'Failed to update automation' });
    }
  }

  // List email automations
  async listAutomations(req, res) {
    try {
      const { tenantId } = req.user;
      const { page = 1, limit = 10, isActive } = req.query;

      const where = { tenantId };
      if (isActive !== undefined) {
        where.isActive = isActive === 'true';
      }

      const automations = await prisma.emailAutomation.findMany({
        where,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { createdAt: 'desc' }
      });

      const total = await prisma.emailAutomation.count({ where });

      res.json({
        success: true,
        data: automations,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error listing email automations:', error);
      res.status(500).json({ success: false, message: 'Failed to list automations' });
    }
  }

  // Trigger automation manually
  async triggerAutomation(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const { triggerPayload } = req.body;

      const automation = await prisma.emailAutomation.findFirst({
        where: { id, tenantId }
      });

      if (!automation) {
        return res.status(404).json({ success: false, message: 'Automation not found' });
      }

      // Create automation run
      const run = await prisma.emailAutomationRun.create({
        data: {
          automationId: id,
          tenantId,
          triggerPayload,
          status: 'PENDING'
        }
      });

      // Queue the automation for processing
      await emailAutomationService.processAutomation(run.id);

      logger.info('Email automation triggered', { automationId: id, runId: run.id, tenantId });
      res.json({ success: true, data: { runId: run.id } });
    } catch (error) {
      logger.error('Error triggering email automation:', error);
      res.status(500).json({ success: false, message: 'Failed to trigger automation' });
    }
  }

  // Get automation runs history
  async getAutomationRuns(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;
      const { page = 1, limit = 10, status } = req.query;

      const where = { automationId: id, tenantId };
      if (status) {
        where.status = status;
      }

      const runs = await prisma.emailAutomationRun.findMany({
        where,
        skip: (page - 1) * limit,
        take: parseInt(limit),
        orderBy: { startedAt: 'desc' }
      });

      const total = await prisma.emailAutomationRun.count({ where });

      res.json({
        success: true,
        data: runs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      });
    } catch (error) {
      logger.error('Error getting automation runs:', error);
      res.status(500).json({ success: false, message: 'Failed to get automation runs' });
    }
  }

  // Delete automation
  async deleteAutomation(req, res) {
    try {
      const { tenantId } = req.user;
      const { id } = req.params;

      const deleted = await prisma.emailAutomation.deleteMany({
        where: { id, tenantId }
      });

      if (deleted.count === 0) {
        return res.status(404).json({ success: false, message: 'Automation not found' });
      }

      logger.info('Email automation deleted', { automationId: id, tenantId });
      res.json({ success: true, message: 'Automation deleted successfully' });
    } catch (error) {
      logger.error('Error deleting email automation:', error);
      res.status(500).json({ success: false, message: 'Failed to delete automation' });
    }
  }
}

module.exports = new EmailAutomationController();
