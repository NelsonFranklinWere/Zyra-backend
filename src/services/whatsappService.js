const twilio = require('twilio');
const { db } = require('../config/database');
const logger = require('../utils/logger');
const aiCoreService = require('./aiCoreService');

class WhatsAppService {
  constructor() {
    this.twilioClient = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.webhookUrl = process.env.WHATSAPP_WEBHOOK_URL;
  }

  // Send WhatsApp Message
  async sendMessage(to, message, mediaUrl = null) {
    try {
      const messageData = {
        body: message,
        from: process.env.TWILIO_WHATSAPP_NUMBER,
        to: `whatsapp:${to}`
      };

      if (mediaUrl) {
        messageData.mediaUrl = [mediaUrl];
      }

      const messageResponse = await this.twilioClient.messages.create(messageData);

      logger.info(`WhatsApp message sent: ${messageResponse.sid} to ${to}`);

      return {
        success: true,
        messageId: messageResponse.sid,
        status: messageResponse.status
      };
    } catch (error) {
      logger.error('WhatsApp send message error:', error);
      throw error;
    }
  }

  // Process Incoming Webhook
  async processWebhook(req, res) {
    try {
      const { Body, From, To, MediaUrl0, MessageSid } = req.body;

      if (!Body && !MediaUrl0) {
        return res.status(400).json({
          success: false,
          message: 'No message content received'
        });
      }

      const phoneNumber = From.replace('whatsapp:', '');
      const messageContent = Body || 'Media message';
      const mediaUrl = MediaUrl0;

      // Find user by phone number
      const user = await db('users')
        .where({ phone_number: phoneNumber })
        .first();

      if (!user) {
        // Send welcome message for new users
        await this.sendWelcomeMessage(phoneNumber);
        return res.json({ success: true, message: 'Welcome message sent' });
      }

      // Process with AI
      const aiResponse = await aiCoreService.processWhatsAppMessage(
        messageContent,
        {
          user_id: user.id,
          phone_number: phoneNumber,
          media_url: mediaUrl
        }
      );

      // Store interaction
      await db('whatsapp_interactions').insert({
        user_id: user.id,
        incoming_message: messageContent,
        context: JSON.stringify({
          phone_number: phoneNumber,
          media_url: mediaUrl,
          message_sid: MessageSid
        }),
        ai_response: aiResponse.data.response,
        intent: aiResponse.data.intent,
        confidence: aiResponse.data.confidence,
        created_at: new Date()
      });

      // Send AI response
      if (aiResponse.data.response) {
        await this.sendMessage(phoneNumber, aiResponse.data.response);
      }

      // Execute suggested actions
      if (aiResponse.data.suggested_actions) {
        await this.executeSuggestedActions(
          aiResponse.data.suggested_actions,
          user.id,
          phoneNumber
        );
      }

      res.json({
        success: true,
        message: 'Message processed successfully'
      });

    } catch (error) {
      logger.error('WhatsApp webhook processing error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to process message'
      });
    }
  }

  // Send Welcome Message
  async sendWelcomeMessage(phoneNumber) {
    const welcomeMessage = `👋 Welcome to Zyra AI!

I'm your intelligent automation assistant. I can help you with:

🤖 AI-powered responses
📊 Data insights and analytics
🔄 Workflow automation
💼 Business process optimization

Just send me a message and I'll assist you!`;

    try {
      await this.sendMessage(phoneNumber, welcomeMessage);
      logger.info(`Welcome message sent to ${phoneNumber}`);
    } catch (error) {
      logger.error('Welcome message error:', error);
    }
  }

  // Execute Suggested Actions
  async executeSuggestedActions(actions, userId, phoneNumber) {
    for (const action of actions) {
      try {
        switch (action) {
          case 'Send pricing information':
            await this.sendPricingInfo(phoneNumber);
            break;
          case 'Schedule a demo call':
            await this.scheduleDemo(userId, phoneNumber);
            break;
          case 'Create support ticket':
            await this.createSupportTicket(userId, phoneNumber);
            break;
          default:
            logger.info(`Unknown action: ${action}`);
        }
      } catch (error) {
        logger.error(`Action execution error: ${action}`, error);
      }
    }
  }

  // Send Pricing Information
  async sendPricingInfo(phoneNumber) {
    const pricingMessage = `💰 Zyra Pricing Plans:

🚀 Starter Plan - $29/month
• 100 AI generations
• Basic automations
• Email support

💼 Professional Plan - $79/month
• 500 AI generations
• Advanced automations
• WhatsApp integration
• Priority support

🏢 Enterprise Plan - $199/month
• Unlimited AI generations
• Custom automations
• API access
• Dedicated support

Reply with your preferred plan or ask for a demo!`;

    await this.sendMessage(phoneNumber, pricingMessage);
  }

  // Schedule Demo
  async scheduleDemo(userId, phoneNumber) {
    const demoMessage = `📅 Let's schedule your demo!

I'll help you set up a personalized demo of Zyra's capabilities. 

Please reply with:
• Your preferred date and time
• Your business type
• Specific features you'd like to see

I'll coordinate with our team to arrange the perfect demo for you!`;

    await this.sendMessage(phoneNumber, demoMessage);

    // Create demo request in database
    await db('demo_requests').insert({
      user_id: userId,
      phone_number: phoneNumber,
      status: 'pending',
      created_at: new Date()
    });
  }

  // Create Support Ticket
  async createSupportTicket(userId, phoneNumber) {
    const ticketId = `TKT-${Date.now()}`;
    
    const supportMessage = `🎫 Support ticket created: ${ticketId}

Your support request has been logged. Our team will respond within 24 hours.

In the meantime, you can:
• Check our FAQ
• Browse our knowledge base
• Continue chatting with me for immediate assistance

Is there anything else I can help you with?`;

    await this.sendMessage(phoneNumber, supportMessage);

    // Create support ticket in database
    await db('support_tickets').insert({
      user_id: userId,
      ticket_id: ticketId,
      phone_number: phoneNumber,
      status: 'open',
      priority: 'medium',
      created_at: new Date()
    });
  }

  // Get WhatsApp Analytics
  async getAnalytics(userId, dateRange = '7d') {
    try {
      const startDate = this.getDateRangeStart(dateRange);
      
      const analytics = await db.raw(`
        SELECT 
          DATE(created_at) as date,
          COUNT(*) as total_messages,
          COUNT(CASE WHEN intent = 'inquiry' THEN 1 END) as inquiries,
          COUNT(CASE WHEN intent = 'complaint' THEN 1 END) as complaints,
          COUNT(CASE WHEN intent = 'support' THEN 1 END) as support_requests,
          AVG(confidence) as avg_confidence
        FROM whatsapp_interactions 
        WHERE user_id = ? AND created_at >= ?
        GROUP BY DATE(created_at)
        ORDER BY date DESC
      `, [userId, startDate]);

      return {
        success: true,
        data: {
          analytics: analytics.rows,
          date_range: dateRange,
          total_interactions: analytics.rows.reduce((sum, row) => sum + row.total_messages, 0)
        }
      };
    } catch (error) {
      logger.error('WhatsApp analytics error:', error);
      throw error;
    }
  }

  // Get Recent Interactions
  async getRecentInteractions(userId, limit = 10) {
    try {
      const interactions = await db('whatsapp_interactions')
        .where({ user_id: userId })
        .orderBy('created_at', 'desc')
        .limit(limit);

      return {
        success: true,
        data: interactions
      };
    } catch (error) {
      logger.error('Get recent interactions error:', error);
      throw error;
    }
  }

  // Helper Methods
  getDateRangeStart(dateRange) {
    const now = new Date();
    switch (dateRange) {
      case '1d':
        return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d':
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d':
        return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default:
        return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }

  // Verify Webhook
  verifyWebhook(req, res) {
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (token === process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN) {
      res.status(200).send(challenge);
    } else {
      res.status(403).json({ success: false, message: 'Verification failed' });
    }
  }
}

module.exports = new WhatsAppService();