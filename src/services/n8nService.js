const axios = require('axios');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class N8nService {
  constructor() {
    this.baseURL = process.env.N8N_API_URL || 'http://localhost:5678';
    this.apiKey = process.env.N8N_API_KEY;
    this.webhookURL = process.env.N8N_WEBHOOK_URL || 'http://localhost:5678/webhook';
  }

  /**
   * Create a new n8n workflow for marketing automation
   */
  async createMarketingWorkflow(workflowData) {
    try {
      const { userId, campaignId, personaId, channels, schedule } = workflowData;
      
      const workflow = {
        name: `Zyra Marketing Campaign - ${campaignId}`,
        nodes: this.buildMarketingNodes(workflowData),
        connections: this.buildMarketingConnections(),
        active: true,
        settings: {
          executionOrder: 'v1',
          saveManualExecutions: true,
          callerPolicy: 'workflowsFromSameOwner',
          errorWorkflow: null
        }
      };

      const response = await axios.post(`${this.baseURL}/api/v1/workflows`, workflow, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        }
      });

      // Store workflow reference in database
      await db('automations').insert({
        user_id: userId,
        name: workflow.name,
        description: `Marketing automation workflow for campaign ${campaignId}`,
        status: 'active',
        workflow_config: {
          n8n_workflow_id: response.data.id,
          campaign_id: campaignId,
          persona_id: personaId,
          channels: channels,
          schedule: schedule
        },
        trigger_config: {
          type: 'scheduled',
          schedule: schedule
        },
        ai_config: {
          persona_id: personaId,
          content_generation: true,
          channel_optimization: true
        }
      });

      logger.info(`Created n8n workflow ${response.data.id} for campaign ${campaignId}`);
      return response.data;

    } catch (error) {
      logger.error('Error creating n8n workflow:', error);
      throw new Error('Failed to create marketing workflow');
    }
  }

  /**
   * Build marketing automation nodes
   */
  buildMarketingNodes(workflowData) {
    const { personaId, channels, content, schedule } = workflowData;
    
    return [
      // Trigger node
      {
        id: 'trigger',
        name: 'Schedule Trigger',
        type: 'n8n-nodes-base.scheduleTrigger',
        typeVersion: 1,
        position: [240, 300],
        parameters: {
          rule: {
            interval: [
              {
                field: 'cronExpression',
                value: schedule.cron || '0 18 * * 5' // Friday 6PM
              }
            ]
          }
        }
      },
      
      // AI Persona Analysis
      {
        id: 'persona_analysis',
        name: 'AI Persona Analysis',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [460, 300],
        parameters: {
          url: `${process.env.API_BASE_URL}/api/ai/personas/${personaId}/analyze`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: {
            personaId: personaId,
            timestamp: new Date().toISOString()
          }
        }
      },
      
      // Content Generation
      {
        id: 'content_generation',
        name: 'AI Content Generator',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [680, 300],
        parameters: {
          url: `${process.env.API_BASE_URL}/api/ai/personas/${personaId}/mood-content`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: {
            personaId: personaId,
            productData: content,
            moodConfig: {
              tone: 'genz',
              trending: true,
              emojis: true
            }
          }
        }
      },
      
      // Channel Distribution
      {
        id: 'channel_distribution',
        name: 'Multi-Channel Distribution',
        type: 'n8n-nodes-base.splitInBatches',
        typeVersion: 3,
        position: [900, 300],
        parameters: {
          batchSize: 1,
          options: {}
        }
      },
      
      // WhatsApp Distribution
      {
        id: 'whatsapp_send',
        name: 'WhatsApp Send',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1120, 200],
        parameters: {
          url: 'https://graph.facebook.com/v17.0/YOUR_PHONE_NUMBER_ID/messages',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.WHATSAPP_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: {
            messaging_product: 'whatsapp',
            to: '{{$json.phone}}',
            type: 'text',
            text: {
              body: '{{$json.whatsapp_content}}'
            }
          }
        }
      },
      
      // Instagram Distribution
      {
        id: 'instagram_post',
        name: 'Instagram Post',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1120, 400],
        parameters: {
          url: 'https://graph.facebook.com/v17.0/YOUR_IG_ACCOUNT_ID/media',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.INSTAGRAM_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: {
            image_url: '{{$json.image_url}}',
            caption: '{{$json.instagram_caption}}',
            access_token: process.env.INSTAGRAM_ACCESS_TOKEN
          }
        }
      },
      
      // TikTok Distribution
      {
        id: 'tiktok_post',
        name: 'TikTok Post',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1120, 600],
        parameters: {
          url: 'https://open-api.tiktok.com/v2/post/publish/',
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.TIKTOK_ACCESS_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: {
            post_info: {
              title: '{{$json.tiktok_title}}',
              description: '{{$json.tiktok_description}}',
              privacy_level: 'MUTUAL_FOLLOW_FRIEND',
              disable_duet: false,
              disable_comment: false,
              disable_stitch: false,
              video_cover_timestamp_ms: 1000
            }
          }
        }
      },
      
      // Analytics Tracking
      {
        id: 'analytics_track',
        name: 'Track Performance',
        type: 'n8n-nodes-base.httpRequest',
        typeVersion: 4,
        position: [1340, 400],
        parameters: {
          url: `${process.env.API_BASE_URL}/api/analytics/track`,
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: {
            campaign_id: '{{$json.campaign_id}}',
            channel: '{{$json.channel}}',
            message_id: '{{$json.message_id}}',
            timestamp: new Date().toISOString(),
            status: 'sent'
          }
        }
      }
    ];
  }

  /**
   * Build connections between nodes
   */
  buildMarketingConnections() {
    return {
      'trigger': {
        'main': [
          [
            {
              'node': 'persona_analysis',
              'type': 'main',
              'index': 0
            }
          ]
        ]
      },
      'persona_analysis': {
        'main': [
          [
            {
              'node': 'content_generation',
              'type': 'main',
              'index': 0
            }
          ]
        ]
      },
      'content_generation': {
        'main': [
          [
            {
              'node': 'channel_distribution',
              'type': 'main',
              'index': 0
            }
          ]
        ]
      },
      'channel_distribution': {
        'main': [
          [
            {
              'node': 'whatsapp_send',
              'type': 'main',
              'index': 0
            },
            {
              'node': 'instagram_post',
              'type': 'main',
              'index': 0
            },
            {
              'node': 'tiktok_post',
              'type': 'main',
              'index': 0
            }
          ]
        ]
      },
      'whatsapp_send': {
        'main': [
          [
            {
              'node': 'analytics_track',
              'type': 'main',
              'index': 0
            }
          ]
        ]
      },
      'instagram_post': {
        'main': [
          [
            {
              'node': 'analytics_track',
              'type': 'main',
              'index': 0
            }
          ]
        ]
      },
      'tiktok_post': {
        'main': [
          [
            {
              'node': 'analytics_track',
              'type': 'main',
              'index': 0
            }
          ]
        ]
      }
    };
  }

  /**
   * Execute a workflow manually
   */
  async executeWorkflow(workflowId, inputData = {}) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/v1/workflows/${workflowId}/execute`,
        {
          inputData: inputData
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Executed workflow ${workflowId}`);
      return response.data;

    } catch (error) {
      logger.error('Error executing workflow:', error);
      throw new Error('Failed to execute workflow');
    }
  }

  /**
   * Get workflow execution status
   */
  async getWorkflowStatus(executionId) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v1/executions/${executionId}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;

    } catch (error) {
      logger.error('Error getting workflow status:', error);
      throw new Error('Failed to get workflow status');
    }
  }

  /**
   * Update workflow
   */
  async updateWorkflow(workflowId, updates) {
    try {
      const response = await axios.patch(
        `${this.baseURL}/api/v1/workflows/${workflowId}`,
        updates,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Updated workflow ${workflowId}`);
      return response.data;

    } catch (error) {
      logger.error('Error updating workflow:', error);
      throw new Error('Failed to update workflow');
    }
  }

  /**
   * Delete workflow
   */
  async deleteWorkflow(workflowId) {
    try {
      await axios.delete(`${this.baseURL}/api/v1/workflows/${workflowId}`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      logger.info(`Deleted workflow ${workflowId}`);
      return true;

    } catch (error) {
      logger.error('Error deleting workflow:', error);
      throw new Error('Failed to delete workflow');
    }
  }

  /**
   * Get all workflows for a user
   */
  async getUserWorkflows(userId) {
    try {
      const workflows = await db('automations')
        .where({ user_id: userId })
        .whereNotNull('workflow_config->n8n_workflow_id');

      return workflows;

    } catch (error) {
      logger.error('Error getting user workflows:', error);
      throw new Error('Failed to get user workflows');
    }
  }

  /**
   * Create webhook for real-time updates
   */
  async createWebhook(workflowId, webhookUrl) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/v1/webhooks`,
        {
          workflowId: workflowId,
          httpMethod: 'POST',
          path: `/webhook/${workflowId}`,
          webhookUrl: webhookUrl
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Created webhook for workflow ${workflowId}`);
      return response.data;

    } catch (error) {
      logger.error('Error creating webhook:', error);
      throw new Error('Failed to create webhook');
    }
  }

  /**
   * Test workflow connection
   */
  async testConnection() {
    try {
      const response = await axios.get(`${this.baseURL}/api/v1/workflows`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });

      return {
        connected: true,
        version: response.headers['x-n8n-version'] || 'unknown',
        workflows: response.data.data?.length || 0
      };

    } catch (error) {
      logger.error('n8n connection test failed:', error);
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Create campaign automation workflow
   */
  async createCampaignWorkflow(campaignData) {
    try {
      const { userId, campaignId, personaId, channels, schedule, content } = campaignData;
      
      // Create the workflow
      const workflow = await this.createMarketingWorkflow({
        userId,
        campaignId,
        personaId,
        channels,
        schedule,
        content
      });

      // Create webhook for real-time updates
      const webhook = await this.createWebhook(
        workflow.id,
        `${process.env.API_BASE_URL}/api/webhooks/n8n/${workflow.id}`
      );

      // Update automation record with webhook info
      await db('automations')
        .where({ user_id: userId })
        .where('workflow_config->n8n_workflow_id', workflow.id)
        .update({
          workflow_config: db.raw(`workflow_config || '{"webhook_id": "${webhook.id}", "webhook_url": "${webhook.webhookUrl}"}'::jsonb`),
          updated_at: new Date()
        });

      logger.info(`Created complete campaign workflow for campaign ${campaignId}`);
      return {
        workflow,
        webhook,
        status: 'active'
      };

    } catch (error) {
      logger.error('Error creating campaign workflow:', error);
      throw new Error('Failed to create campaign workflow');
    }
  }

  /**
   * Schedule campaign execution
   */
  async scheduleCampaign(workflowId, scheduleTime, campaignData) {
    try {
      const response = await axios.post(
        `${this.baseURL}/api/v1/workflows/${workflowId}/execute`,
        {
          inputData: campaignData,
          scheduleTime: scheduleTime
        },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json'
          }
        }
      );

      logger.info(`Scheduled campaign execution for workflow ${workflowId} at ${scheduleTime}`);
      return response.data;

    } catch (error) {
      logger.error('Error scheduling campaign:', error);
      throw new Error('Failed to schedule campaign');
    }
  }

  /**
   * Get workflow execution history
   */
  async getExecutionHistory(workflowId, limit = 50) {
    try {
      const response = await axios.get(
        `${this.baseURL}/api/v1/executions?workflowId=${workflowId}&limit=${limit}`,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`
          }
        }
      );

      return response.data;

    } catch (error) {
      logger.error('Error getting execution history:', error);
      throw new Error('Failed to get execution history');
    }
  }
}

module.exports = new N8nService();
