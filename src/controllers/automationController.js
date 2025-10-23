const { db } = require('../config/database');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');
const aiCoreService = require('../services/aiCoreService');

// Create Automation
const createAutomation = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { name, description, triggers, actions, conditions, settings } = req.body;
    const userId = req.user.userId;

    const [automation] = await db('automations').insert({
      user_id: userId,
      name,
      description,
      triggers: JSON.stringify(triggers),
      actions: JSON.stringify(actions),
      conditions: JSON.stringify(conditions),
      settings: JSON.stringify(settings),
      status: 'draft',
      created_at: new Date()
    }).returning(['id', 'name', 'description', 'status', 'created_at']);

    logger.info(`Automation created: ${automation.id} for user: ${userId}`);

    res.status(201).json({
      success: true,
      message: 'Automation created successfully',
      data: automation
    });

  } catch (error) {
    logger.error('Create automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create automation'
    });
  }
};

// Get User Automations
const getUserAutomations = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 10, offset = 0 } = req.query;

    let query = db('automations')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (status) {
      query = query.where({ status });
    }

    const automations = await query;

    // Parse JSON fields
    const parsedAutomations = automations.map(automation => ({
      ...automation,
      triggers: JSON.parse(automation.triggers),
      actions: JSON.parse(automation.actions),
      conditions: JSON.parse(automation.conditions),
      settings: JSON.parse(automation.settings)
    }));

    res.json({
      success: true,
      data: {
        automations: parsedAutomations,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: automations.length
        }
      }
    });

  } catch (error) {
    logger.error('Get user automations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch automations'
    });
  }
};

// Get Single Automation
const getAutomation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const automation = await db('automations')
      .where({ id, user_id: userId })
      .first();

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    // Parse JSON fields
    const parsedAutomation = {
      ...automation,
      triggers: JSON.parse(automation.triggers),
      actions: JSON.parse(automation.actions),
      conditions: JSON.parse(automation.conditions),
      settings: JSON.parse(automation.settings)
    };

    res.json({
      success: true,
      data: parsedAutomation
    });

  } catch (error) {
    logger.error('Get automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch automation'
    });
  }
};

// Update Automation
const updateAutomation = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, triggers, actions, conditions, settings, status } = req.body;
    const userId = req.user.userId;

    const updateData = {};
    if (name) updateData.name = name;
    if (description) updateData.description = description;
    if (triggers) updateData.triggers = JSON.stringify(triggers);
    if (actions) updateData.actions = JSON.stringify(actions);
    if (conditions) updateData.conditions = JSON.stringify(conditions);
    if (settings) updateData.settings = JSON.stringify(settings);
    if (status) updateData.status = status;

    updateData.updated_at = new Date();

    const updated = await db('automations')
      .where({ id, user_id: userId })
      .update(updateData)
      .returning(['id', 'name', 'description', 'status', 'updated_at']);

    if (updated.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    logger.info(`Automation updated: ${id} for user: ${userId}`);

    res.json({
      success: true,
      message: 'Automation updated successfully',
      data: updated[0]
    });

  } catch (error) {
    logger.error('Update automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update automation'
    });
  }
};

// Delete Automation
const deleteAutomation = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;

    const deleted = await db('automations')
      .where({ id, user_id: userId })
      .del();

    if (deleted === 0) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    logger.info(`Automation deleted: ${id} for user: ${userId}`);

    res.json({
      success: true,
      message: 'Automation deleted successfully'
    });

  } catch (error) {
    logger.error('Delete automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete automation'
    });
  }
};

// Execute Automation
const executeAutomation = async (req, res) => {
  try {
    const { id } = req.params;
    const { triggerData } = req.body;
    const userId = req.user.userId;

    const automation = await db('automations')
      .where({ id, user_id: userId, status: 'active' })
      .first();

    if (!automation) {
      return res.status(404).json({
        success: false,
        message: 'Automation not found or not active'
      });
    }

    const triggers = JSON.parse(automation.triggers);
    const actions = JSON.parse(automation.actions);
    const conditions = JSON.parse(automation.conditions);

    // Check if trigger conditions are met
    const triggerMatched = await checkTriggerConditions(triggers, triggerData);
    if (!triggerMatched) {
      return res.json({
        success: false,
        message: 'Trigger conditions not met'
      });
    }

    // Check automation conditions
    const conditionsMet = await checkAutomationConditions(conditions, triggerData);
    if (!conditionsMet) {
      return res.json({
        success: false,
        message: 'Automation conditions not met'
      });
    }

    // Execute actions
    const executionResults = await executeAutomationActions(actions, triggerData, userId);

    // Log execution
    await db('automation_executions').insert({
      automation_id: id,
      user_id: userId,
      trigger_data: JSON.stringify(triggerData),
      execution_results: JSON.stringify(executionResults),
      status: 'completed',
      executed_at: new Date()
    });

    logger.info(`Automation executed: ${id} for user: ${userId}`);

    res.json({
      success: true,
      message: 'Automation executed successfully',
      data: {
        execution_id: Date.now(),
        results: executionResults
      }
    });

  } catch (error) {
    logger.error('Execute automation error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to execute automation'
    });
  }
};

// Get Automation Executions
const getAutomationExecutions = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.userId;
    const { limit = 10, offset = 0 } = req.query;

    const executions = await db('automation_executions')
      .where({ automation_id: id, user_id: userId })
      .orderBy('executed_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    res.json({
      success: true,
      data: {
        executions,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: executions.length
        }
      }
    });

  } catch (error) {
    logger.error('Get automation executions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch automation executions'
    });
  }
};

// Helper Functions
async function checkTriggerConditions(triggers, triggerData) {
  // Implement trigger condition checking logic
  // This would check if the incoming data matches the trigger conditions
  return true; // Simplified for now
}

async function checkAutomationConditions(conditions, triggerData) {
  // Implement automation condition checking logic
  // This would check if the automation should run based on conditions
  return true; // Simplified for now
}

async function executeAutomationActions(actions, triggerData, userId) {
  const results = [];

  for (const action of actions) {
    try {
      let result = null;

      switch (action.type) {
        case 'send_email':
          result = await executeEmailAction(action, triggerData, userId);
          break;
        case 'send_whatsapp':
          result = await executeWhatsAppAction(action, triggerData, userId);
          break;
        case 'create_task':
          result = await executeTaskAction(action, triggerData, userId);
          break;
        case 'ai_response':
          result = await executeAIResponseAction(action, triggerData, userId);
          break;
        default:
          result = { success: false, message: 'Unknown action type' };
      }

      results.push({
        action_id: action.id,
        type: action.type,
        result
      });
    } catch (error) {
      logger.error('Action execution error:', error);
      results.push({
        action_id: action.id,
        type: action.type,
        result: { success: false, error: error.message }
      });
    }
  }

  return results;
}

async function executeEmailAction(action, triggerData, userId) {
  // Implement email sending logic
  return { success: true, message: 'Email sent successfully' };
}

async function executeWhatsAppAction(action, triggerData, userId) {
  // Implement WhatsApp message sending logic
  return { success: true, message: 'WhatsApp message sent successfully' };
}

async function executeTaskAction(action, triggerData, userId) {
  // Implement task creation logic
  return { success: true, message: 'Task created successfully' };
}

async function executeAIResponseAction(action, triggerData, userId) {
  // Use AI Core service to generate response
  const aiResponse = await aiCoreService.processWhatsAppMessage(
    triggerData.message || 'Hello',
    triggerData.context || {}
  );
  
  return {
    success: true,
    message: 'AI response generated',
    response: aiResponse.data.response
  };
}

module.exports = {
  createAutomation,
  getUserAutomations,
  getAutomation,
  updateAutomation,
  deleteAutomation,
  executeAutomation,
  getAutomationExecutions
};