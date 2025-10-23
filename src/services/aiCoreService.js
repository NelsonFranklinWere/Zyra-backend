const { OpenAI } = require('openai');
const { db } = require('../config/database');
const logger = require('../utils/logger');

class ZyraAICore {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
    
    this.models = {
      gpt4: 'gpt-4-turbo-preview',
      gpt35: 'gpt-3.5-turbo',
      embedding: 'text-embedding-3-small'
    };
  }

  // CV Builder Module
  async generateCV(userData, preferences = {}) {
    try {
      const prompt = await this.getPromptTemplate('cv_builder');
      
      const systemPrompt = `You are Zyra AI, an expert CV builder. Generate a professional, modern CV based on the user's information. 
      
      Requirements:
      - Use modern 2025 CV format
      - Optimize for ATS (Applicant Tracking Systems)
      - Include relevant keywords for the industry
      - Structure: Header, Summary, Experience, Education, Skills, Certifications
      - Use action verbs and quantifiable achievements
      - Keep it concise but comprehensive
      
      User Data: ${JSON.stringify(userData)}
      Preferences: ${JSON.stringify(preferences)}`;

      const response = await this.openai.chat.completions.create({
        model: this.models.gpt4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const cvContent = response.choices[0].message.content;
      
      // Store the generation
      await this.storeAIGeneration('cv_builder', userData, cvContent, preferences);
      
      return {
        success: true,
        data: {
          cv: cvContent,
          format: 'markdown',
          optimized_for: ['ATS', 'Modern Design', 'Industry Keywords']
        }
      };
    } catch (error) {
      logger.error('CV Builder error:', error);
      throw error;
    }
  }

  // Social Media Generator Module
  async generateSocialPost(content, platform, preferences = {}) {
    try {
      const prompt = await this.getPromptTemplate('social_generator');
      
      const systemPrompt = `You are Zyra AI, a social media expert. Generate engaging, platform-optimized posts.
      
      Platform: ${platform}
      Content Theme: ${content.theme || 'general'}
      Tone: ${preferences.tone || 'professional'}
      Target Audience: ${preferences.audience || 'general'}
      
      Requirements:
      - Platform-specific optimization (character limits, hashtags, format)
      - Engaging and shareable content
      - Relevant hashtags and mentions
      - Call-to-action when appropriate
      - Trend-aware content`;

      const response = await this.openai.chat.completions.create({
        model: this.models.gpt4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n\nContent: ${JSON.stringify(content)}` }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      const postContent = response.choices[0].message.content;
      
      await this.storeAIGeneration('social_generator', content, postContent, { platform, ...preferences });
      
      return {
        success: true,
        data: {
          post: postContent,
          platform,
          engagement_score: this.calculateEngagementScore(postContent, platform),
          hashtags: this.extractHashtags(postContent),
          character_count: postContent.length
        }
      };
    } catch (error) {
      logger.error('Social Generator error:', error);
      throw error;
    }
  }

  // WhatsApp Automation AI Module
  async processWhatsAppMessage(message, context = {}) {
    try {
      const prompt = await this.getPromptTemplate('whatsapp_automation');
      
      const systemPrompt = `You are Zyra AI, a WhatsApp automation assistant. Analyze incoming messages and generate appropriate responses.
      
      Business Context: ${context.business_type || 'general'}
      Industry: ${context.industry || 'general'}
      Customer Service Level: ${context.service_level || 'professional'}
      
      Requirements:
      - Classify message intent (inquiry, complaint, support, sales, etc.)
      - Generate appropriate response
      - Suggest follow-up actions
      - Maintain brand voice
      - Be helpful and professional`;

      const response = await this.openai.chat.completions.create({
        model: this.models.gpt4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n\nMessage: "${message}"\nContext: ${JSON.stringify(context)}` }
        ],
        temperature: 0.6,
        max_tokens: 300
      });

      const aiResponse = response.choices[0].message.content;
      
      await this.storeAIGeneration('whatsapp_automation', { message, context }, aiResponse);
      
      return {
        success: true,
        data: {
          response: aiResponse,
          intent: this.classifyIntent(message),
          confidence: this.calculateConfidence(aiResponse),
          suggested_actions: this.generateSuggestedActions(message, aiResponse)
        }
      };
    } catch (error) {
      logger.error('WhatsApp Automation error:', error);
      throw error;
    }
  }

  // Data Insights Engine Module
  async generateInsights(data, analysisType = 'general') {
    try {
      const prompt = await this.getPromptTemplate('data_insights');
      
      const systemPrompt = `You are Zyra AI, a data analysis expert. Analyze the provided data and generate actionable insights.
      
      Analysis Type: ${analysisType}
      Data Context: Business metrics, performance data, user behavior
      
      Requirements:
      - Identify key patterns and trends
      - Generate actionable recommendations
      - Provide data-driven insights
      - Suggest optimization strategies
      - Create executive summary`;

      const response = await this.openai.chat.completions.create({
        model: this.models.gpt4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n\nData: ${JSON.stringify(data)}` }
        ],
        temperature: 0.5,
        max_tokens: 1000
      });

      const insights = response.choices[0].message.content;
      
      await this.storeAIGeneration('data_insights', data, insights, { analysisType });
      
      return {
        success: true,
        data: {
          insights,
          key_metrics: this.extractKeyMetrics(data),
          recommendations: this.extractRecommendations(insights),
          confidence_score: this.calculateInsightConfidence(insights)
        }
      };
    } catch (error) {
      logger.error('Data Insights error:', error);
      throw error;
    }
  }

  // Audience Targeting AI Module
  async generateAudienceSegments(criteria, preferences = {}) {
    try {
      const prompt = await this.getPromptTemplate('audience_targeting');
      
      const systemPrompt = `You are Zyra AI, a marketing and audience analysis expert. Generate detailed audience segments based on the provided criteria.
      
      Targeting Criteria: ${JSON.stringify(criteria)}
      Preferences: ${JSON.stringify(preferences)}
      
      Requirements:
      - Create detailed audience personas
      - Identify demographic and psychographic characteristics
      - Suggest targeting strategies
      - Provide engagement recommendations
      - Include market size estimates`;

      const response = await this.openai.chat.completions.create({
        model: this.models.gpt4,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `${prompt}\n\nCriteria: ${JSON.stringify(criteria)}` }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const segments = response.choices[0].message.content;
      
      await this.storeAIGeneration('audience_targeting', criteria, segments, preferences);
      
      return {
        success: true,
        data: {
          segments,
          targeting_strategies: this.extractTargetingStrategies(segments),
          engagement_tips: this.extractEngagementTips(segments),
          market_potential: this.calculateMarketPotential(criteria)
        }
      };
    } catch (error) {
      logger.error('Audience Targeting error:', error);
      throw error;
    }
  }

  // Utility Methods
  async getPromptTemplate(templateName) {
    try {
      const template = await db('ai_prompt_templates')
        .where({ name: templateName, is_active: true })
        .first();
      
      return template ? template.content : this.getDefaultPrompt(templateName);
    } catch (error) {
      logger.error('Error fetching prompt template:', error);
      return this.getDefaultPrompt(templateName);
    }
  }

  getDefaultPrompt(templateName) {
    const defaultPrompts = {
      cv_builder: "Generate a professional CV based on the provided user data and preferences.",
      social_generator: "Create engaging social media content optimized for the specified platform.",
      whatsapp_automation: "Analyze the WhatsApp message and generate an appropriate business response.",
      data_insights: "Analyze the provided data and generate actionable business insights.",
      audience_targeting: "Create detailed audience segments based on the targeting criteria."
    };
    
    return defaultPrompts[templateName] || "Generate content based on the provided input.";
  }

  async storeAIGeneration(module, input, output, metadata = {}) {
    try {
      await db('ai_generations').insert({
        module,
        input_data: JSON.stringify(input),
        output_data: JSON.stringify(output),
        metadata: JSON.stringify(metadata),
        created_at: new Date()
      });
    } catch (error) {
      logger.error('Error storing AI generation:', error);
    }
  }

  // Helper Methods
  calculateEngagementScore(content, platform) {
    // Simple engagement scoring based on content characteristics
    let score = 50; // Base score
    
    if (content.includes('?')) score += 10; // Questions increase engagement
    if (content.includes('!')) score += 5; // Excitement
    if (content.match(/#\w+/g)) score += 15; // Hashtags
    if (content.length > 100 && content.length < 280) score += 10; // Optimal length
    
    return Math.min(100, Math.max(0, score));
  }

  extractHashtags(content) {
    const hashtags = content.match(/#\w+/g) || [];
    return hashtags.map(tag => tag.substring(1));
  }

  classifyIntent(message) {
    const intents = {
      inquiry: ['question', 'how', 'what', 'when', 'where', 'why'],
      complaint: ['problem', 'issue', 'wrong', 'bad', 'terrible'],
      support: ['help', 'support', 'assist', 'fix'],
      sales: ['buy', 'purchase', 'price', 'cost', 'order']
    };
    
    const lowerMessage = message.toLowerCase();
    for (const [intent, keywords] of Object.entries(intents)) {
      if (keywords.some(keyword => lowerMessage.includes(keyword))) {
        return intent;
      }
    }
    return 'general';
  }

  calculateConfidence(response) {
    // Simple confidence calculation based on response characteristics
    let confidence = 70; // Base confidence
    
    if (response.length > 50) confidence += 10;
    if (response.includes('?')) confidence += 5;
    if (response.includes('!')) confidence += 5;
    
    return Math.min(100, confidence);
  }

  generateSuggestedActions(message, response) {
    const actions = [];
    
    if (message.toLowerCase().includes('price')) {
      actions.push('Send pricing information');
    }
    if (message.toLowerCase().includes('demo')) {
      actions.push('Schedule a demo call');
    }
    if (message.toLowerCase().includes('support')) {
      actions.push('Create support ticket');
    }
    
    return actions;
  }

  extractKeyMetrics(data) {
    // Extract key metrics from data object
    const metrics = [];
    if (data.revenue) metrics.push({ name: 'Revenue', value: data.revenue });
    if (data.users) metrics.push({ name: 'Users', value: data.users });
    if (data.conversion) metrics.push({ name: 'Conversion Rate', value: data.conversion });
    return metrics;
  }

  extractRecommendations(insights) {
    // Extract recommendations from insights text
    const recommendations = [];
    const lines = insights.split('\n');
    
    lines.forEach(line => {
      if (line.toLowerCase().includes('recommend') || line.toLowerCase().includes('suggest')) {
        recommendations.push(line.trim());
      }
    });
    
    return recommendations;
  }

  calculateInsightConfidence(insights) {
    // Calculate confidence based on insight characteristics
    let confidence = 60;
    
    if (insights.length > 200) confidence += 15;
    if (insights.includes('data')) confidence += 10;
    if (insights.includes('trend')) confidence += 10;
    if (insights.includes('recommendation')) confidence += 5;
    
    return Math.min(100, confidence);
  }

  extractTargetingStrategies(segments) {
    // Extract targeting strategies from segments
    return [
      'Social media advertising',
      'Content marketing',
      'Email campaigns',
      'Influencer partnerships'
    ];
  }

  extractEngagementTips(segments) {
    // Extract engagement tips from segments
    return [
      'Use visual content',
      'Post during peak hours',
      'Engage with comments',
      'Create interactive content'
    ];
  }

  calculateMarketPotential(criteria) {
    // Calculate market potential based on criteria
    let potential = 50; // Base potential
    
    if (criteria.age_range) potential += 10;
    if (criteria.interests) potential += 15;
    if (criteria.location) potential += 10;
    if (criteria.behavior) potential += 15;
    
    return Math.min(100, potential);
  }
}

module.exports = new ZyraAICore();
