const { db } = require('../config/database');
const logger = require('../utils/logger');

/**
 * Handle n8n webhook notifications
 */
const handleN8nWebhook = async (req, res) => {
  try {
    const { workflowId, executionId, status, data } = req.body;
    
    logger.info(`Received n8n webhook for workflow ${workflowId}, execution ${executionId}, status: ${status}`);

    // Find the automation record
    const automation = await db('automations')
      .where('workflow_config->n8n_workflow_id', workflowId)
      .first();

    if (!automation) {
      logger.warn(`No automation found for n8n workflow ${workflowId}`);
      return res.status(404).json({
        success: false,
        message: 'Automation not found'
      });
    }

    // Update automation status based on execution result
    const updates = {
      last_executed: new Date(),
      updated_at: new Date()
    };

    if (status === 'success') {
      updates.success_count = db.raw('success_count + 1');
      updates.status = 'completed';
    } else if (status === 'error') {
      updates.error_count = db.raw('error_count + 1');
      updates.status = 'error';
    } else if (status === 'running') {
      updates.status = 'running';
    }

    await db('automations')
      .where({ id: automation.id })
      .update(updates);

    // Log execution details
    await db('execution_logs').insert({
      automation_id: automation.id,
      execution_id: executionId,
      status: status,
      data: data || {},
      executed_at: new Date()
    });

    // If this is a campaign execution, update campaign analytics
    if (automation.workflow_config?.campaign_id && status === 'success') {
      await updateCampaignAnalytics(automation.workflow_config.campaign_id, data);
    }

    res.json({
      success: true,
      message: 'Webhook processed successfully'
    });

  } catch (error) {
    logger.error('Error processing n8n webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process webhook'
    });
  }
};

/**
 * Handle WhatsApp webhook notifications
 */
const handleWhatsAppWebhook = async (req, res) => {
  try {
    const { entry } = req.body;
    
    if (!entry || !entry[0]?.changes) {
      return res.status(400).json({
        success: false,
        message: 'Invalid webhook data'
      });
    }

    const change = entry[0].changes[0];
    const { field, value } = change;

    if (field === 'messages') {
      const messages = value.messages || [];
      
      for (const message of messages) {
        await processWhatsAppMessage(message, value.metadata);
      }
    }

    res.json({
      success: true,
      message: 'WhatsApp webhook processed successfully'
    });

  } catch (error) {
    logger.error('Error processing WhatsApp webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process WhatsApp webhook'
    });
  }
};

/**
 * Handle Instagram webhook notifications
 */
const handleInstagramWebhook = async (req, res) => {
  try {
    const { object, entry } = req.body;
    
    if (object === 'instagram') {
      for (const item of entry) {
        await processInstagramEvent(item);
      }
    }

    res.json({
      success: true,
      message: 'Instagram webhook processed successfully'
    });

  } catch (error) {
    logger.error('Error processing Instagram webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process Instagram webhook'
    });
  }
};

/**
 * Handle TikTok webhook notifications
 */
const handleTikTokWebhook = async (req, res) => {
  try {
    const { event, data } = req.body;
    
    if (event === 'video.publish') {
      await processTikTokVideoPublish(data);
    }

    res.json({
      success: true,
      message: 'TikTok webhook processed successfully'
    });

  } catch (error) {
    logger.error('Error processing TikTok webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to process TikTok webhook'
    });
  }
};

/**
 * Process WhatsApp message
 */
const processWhatsAppMessage = async (message, metadata) => {
  try {
    const { from, id, timestamp, type, text } = message;
    
    // Log the message
    await db('message_logs').insert({
      platform: 'whatsapp',
      message_id: id,
      from_number: from,
      message_type: type,
      content: text?.body || '',
      timestamp: new Date(parseInt(timestamp) * 1000),
      metadata: metadata
    });

    // Update campaign analytics if this is a campaign message
    if (text?.body) {
      await updateMessageAnalytics('whatsapp', id, 'sent');
    }

  } catch (error) {
    logger.error('Error processing WhatsApp message:', error);
  }
};

/**
 * Process Instagram event
 */
const processInstagramEvent = async (event) => {
  try {
    const { id, time, changes } = event;
    
    for (const change of changes) {
      const { field, value } = change;
      
      if (field === 'comments') {
        await processInstagramComment(value);
      } else if (field === 'mentions') {
        await processInstagramMention(value);
      }
    }

  } catch (error) {
    logger.error('Error processing Instagram event:', error);
  }
};

/**
 * Process Instagram comment
 */
const processInstagramComment = async (commentData) => {
  try {
    await db('engagement_logs').insert({
      platform: 'instagram',
      engagement_type: 'comment',
      post_id: commentData.media_id,
      user_id: commentData.from?.id,
      content: commentData.text,
      timestamp: new Date(parseInt(commentData.timestamp) * 1000),
      metadata: commentData
    });

    // Update post analytics
    await updatePostAnalytics('instagram', commentData.media_id, 'comment');

  } catch (error) {
    logger.error('Error processing Instagram comment:', error);
  }
};

/**
 * Process Instagram mention
 */
const processInstagramMention = async (mentionData) => {
  try {
    await db('engagement_logs').insert({
      platform: 'instagram',
      engagement_type: 'mention',
      post_id: mentionData.media_id,
      user_id: mentionData.from?.id,
      content: mentionData.text,
      timestamp: new Date(parseInt(mentionData.timestamp) * 1000),
      metadata: mentionData
    });

  } catch (error) {
    logger.error('Error processing Instagram mention:', error);
  }
};

/**
 * Process TikTok video publish
 */
const processTikTokVideoPublish = async (videoData) => {
  try {
    await db('content_logs').insert({
      platform: 'tiktok',
      content_type: 'video',
      content_id: videoData.video_id,
      title: videoData.title,
      description: videoData.description,
      published_at: new Date(),
      metadata: videoData
    });

    // Update campaign analytics
    await updateContentAnalytics('tiktok', videoData.video_id, 'published');

  } catch (error) {
    logger.error('Error processing TikTok video publish:', error);
  }
};

/**
 * Update campaign analytics
 */
const updateCampaignAnalytics = async (campaignId, data) => {
  try {
    const analytics = {
      messages_sent: data.messages_sent || 0,
      channels_used: data.channels || [],
      execution_time: data.execution_time || 0,
      success_rate: data.success_rate || 0,
      updated_at: new Date()
    };

    await db('campaign_analytics')
      .where({ campaign_id: campaignId })
      .update(analytics);

  } catch (error) {
    logger.error('Error updating campaign analytics:', error);
  }
};

/**
 * Update message analytics
 */
const updateMessageAnalytics = async (platform, messageId, status) => {
  try {
    await db('message_analytics').insert({
      platform,
      message_id: messageId,
      status,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error updating message analytics:', error);
  }
};

/**
 * Update post analytics
 */
const updatePostAnalytics = async (platform, postId, engagementType) => {
  try {
    await db('post_analytics')
      .where({ platform, post_id: postId })
      .increment(engagementType, 1);

  } catch (error) {
    logger.error('Error updating post analytics:', error);
  }
};

/**
 * Update content analytics
 */
const updateContentAnalytics = async (platform, contentId, status) => {
  try {
    await db('content_analytics').insert({
      platform,
      content_id: contentId,
      status,
      timestamp: new Date()
    });

  } catch (error) {
    logger.error('Error updating content analytics:', error);
  }
};

/**
 * Get webhook logs
 */
const getWebhookLogs = async (req, res) => {
  try {
    const { platform, limit = 50, offset = 0 } = req.query;
    const userId = req.user.id;

    let query = db('execution_logs')
      .join('automations', 'execution_logs.automation_id', 'automations.id')
      .where('automations.user_id', userId)
      .orderBy('execution_logs.executed_at', 'desc')
      .limit(parseInt(limit))
      .offset(parseInt(offset));

    if (platform) {
      query = query.where('execution_logs.platform', platform);
    }

    const logs = await query.select(
      'execution_logs.*',
      'automations.name as automation_name'
    );

    res.json({
      success: true,
      data: {
        logs,
        total: logs.length,
        pagination: {
          limit: parseInt(limit),
          offset: parseInt(offset)
        }
      }
    });

  } catch (error) {
    logger.error('Error fetching webhook logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch webhook logs'
    });
  }
};

/**
 * Test webhook endpoint
 */
const testWebhook = async (req, res) => {
  try {
    const { platform } = req.body;

    const testData = {
      platform,
      test: true,
      timestamp: new Date().toISOString(),
      message: 'Webhook test successful'
    };

    // Log test webhook
    await db('webhook_tests').insert(testData);

    res.json({
      success: true,
      message: 'Webhook test successful',
      data: testData
    });

  } catch (error) {
    logger.error('Error testing webhook:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to test webhook'
    });
  }
};

module.exports = {
  handleN8nWebhook,
  handleWhatsAppWebhook,
  handleInstagramWebhook,
  handleTikTokWebhook,
  getWebhookLogs,
  testWebhook
};
