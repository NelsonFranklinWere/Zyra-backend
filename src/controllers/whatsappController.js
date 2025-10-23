const whatsappService = require('../services/whatsappService');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const { validationResult } = require('express-validator');

// Send WhatsApp Message
const sendMessage = async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: errors.array()
      });
    }

    const { to, message, mediaUrl } = req.body;
    const userId = req.user.userId;

    const result = await whatsappService.sendMessage(to, message, mediaUrl);

    // Store outgoing message
    await db('whatsapp_messages').insert({
      user_id: userId,
      to_number: to,
      message_content: message,
      media_url: mediaUrl,
      direction: 'outbound',
      status: result.status,
      message_id: result.messageId,
      created_at: new Date()
    });

    logger.info(`WhatsApp message sent by user: ${userId} to ${to}`);

    res.json({
      success: true,
      message: 'Message sent successfully',
      data: result
    });

  } catch (error) {
    logger.error('Send WhatsApp message error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to send message'
    });
  }
};

// Process Webhook
const processWebhook = async (req, res) => {
  try {
    await whatsappService.processWebhook(req, res);
  } catch (error) {
    logger.error('WhatsApp webhook error:', error);
    res.status(500).json({
      success: false,
      message: 'Webhook processing failed'
    });
  }
};

// Verify Webhook
const verifyWebhook = (req, res) => {
  whatsappService.verifyWebhook(req, res);
};

// Get Analytics
const getAnalytics = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { dateRange = '7d' } = req.query;

    const result = await whatsappService.getAnalytics(userId, dateRange);

    res.json(result);
  } catch (error) {
    logger.error('WhatsApp analytics error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch analytics'
    });
  }
};

// Get Recent Interactions
const getRecentInteractions = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 10 } = req.query;

    const result = await whatsappService.getRecentInteractions(userId, limit);

    res.json(result);
  } catch (error) {
    logger.error('Get recent interactions error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch interactions'
    });
  }
};

// Get Message History
const getMessageHistory = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { phoneNumber, limit = 50, offset = 0 } = req.query;

    let query = db('whatsapp_messages')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (phoneNumber) {
      query = query.where({ to_number: phoneNumber });
    }

    const messages = await query;

    res.json({
      success: true,
      data: {
        messages,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: messages.length
        }
      }
    });

  } catch (error) {
    logger.error('Get message history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch message history'
    });
  }
};

// Get WhatsApp Settings
const getSettings = async (req, res) => {
  try {
    const userId = req.user.userId;

    const settings = await db('whatsapp_settings')
      .where({ user_id: userId })
      .first();

    res.json({
      success: true,
      data: settings || {
        auto_reply: false,
        business_hours: '9:00-17:00',
        timezone: 'UTC',
        welcome_message: 'Hello! How can I help you today?',
        away_message: 'Sorry, I\'m currently away. I\'ll get back to you soon!'
      }
    });

  } catch (error) {
    logger.error('Get WhatsApp settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings'
    });
  }
};

// Update WhatsApp Settings
const updateSettings = async (req, res) => {
  try {
    const { autoReply, businessHours, timezone, welcomeMessage, awayMessage } = req.body;
    const userId = req.user.userId;

    const settingsData = {
      user_id: userId,
      auto_reply: autoReply,
      business_hours: businessHours,
      timezone: timezone,
      welcome_message: welcomeMessage,
      away_message: awayMessage,
      updated_at: new Date()
    };

    const existing = await db('whatsapp_settings')
      .where({ user_id: userId })
      .first();

    if (existing) {
      await db('whatsapp_settings')
        .where({ user_id: userId })
        .update(settingsData);
    } else {
      await db('whatsapp_settings').insert(settingsData);
    }

    logger.info(`WhatsApp settings updated for user: ${userId}`);

    res.json({
      success: true,
      message: 'Settings updated successfully'
    });

  } catch (error) {
    logger.error('Update WhatsApp settings error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update settings'
    });
  }
};

// Get Contact List
const getContacts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { limit = 50, offset = 0 } = req.query;

    const contacts = await db.raw(`
      SELECT 
        to_number as phone_number,
        COUNT(*) as message_count,
        MAX(created_at) as last_message,
        AVG(CASE WHEN direction = 'inbound' THEN 1 ELSE 0 END) as response_rate
      FROM whatsapp_messages 
      WHERE user_id = ?
      GROUP BY to_number
      ORDER BY last_message DESC
      LIMIT ? OFFSET ?
    `, [userId, parseInt(limit), parseInt(offset)]);

    res.json({
      success: true,
      data: {
        contacts: contacts.rows,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: contacts.rows.length
        }
      }
    });

  } catch (error) {
    logger.error('Get contacts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts'
    });
  }
};

// Create Broadcast
const createBroadcast = async (req, res) => {
  try {
    const { name, message, recipients, scheduledAt } = req.body;
    const userId = req.user.userId;

    const broadcast = await db('whatsapp_broadcasts').insert({
      user_id: userId,
      name,
      message,
      recipients: JSON.stringify(recipients),
      scheduled_at: scheduledAt ? new Date(scheduledAt) : null,
      status: scheduledAt ? 'scheduled' : 'pending',
      created_at: new Date()
    }).returning(['id', 'name', 'status', 'created_at']);

    logger.info(`Broadcast created: ${broadcast[0].id} for user: ${userId}`);

    res.json({
      success: true,
      message: 'Broadcast created successfully',
      data: broadcast[0]
    });

  } catch (error) {
    logger.error('Create broadcast error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create broadcast'
    });
  }
};

// Get Broadcasts
const getBroadcasts = async (req, res) => {
  try {
    const userId = req.user.userId;
    const { status, limit = 10, offset = 0 } = req.query;

    let query = db('whatsapp_broadcasts')
      .where({ user_id: userId })
      .orderBy('created_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (status) {
      query = query.where({ status });
    }

    const broadcasts = await query;

    res.json({
      success: true,
      data: {
        broadcasts,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset),
          total: broadcasts.length
        }
      }
    });

  } catch (error) {
    logger.error('Get broadcasts error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch broadcasts'
    });
  }
};

module.exports = {
  sendMessage,
  processWebhook,
  verifyWebhook,
  getAnalytics,
  getRecentInteractions,
  getMessageHistory,
  getSettings,
  updateSettings,
  getContacts,
  createBroadcast,
  getBroadcasts
};