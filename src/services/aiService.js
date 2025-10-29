const OpenAI = require('openai');
const { logger } = require('../utils/logger');

class AiService {
  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Analyze content with AI
  async analyzeContent(analysisId, { sourceType, sourceId, options }) {
    try {
      let prompt;
      
      switch (sourceType) {
        case 'email':
          prompt = this.getEmailAnalysisPrompt(options);
          break;
        case 'dataset':
          prompt = this.getDatasetAnalysisPrompt(options);
          break;
        case 'cv':
          prompt = this.getCVAnalysisPrompt(options);
          break;
        case 'social':
          prompt = this.getSocialAnalysisPrompt(options);
          break;
        default:
          prompt = this.getGenericAnalysisPrompt(options);
      }

      const response = await this.openai.chat.completions.create({
        model: options.model || 'gpt-4',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: options.temperature || 0.7,
        max_tokens: options.maxTokens || 1000
      });

      const analysis = response.choices[0].message.content;
      const confidence = this.calculateConfidence(analysis);

      return {
        analysis: JSON.parse(analysis),
        confidence,
        tokens: response.usage.total_tokens,
        cost: this.calculateCost(response.usage.total_tokens)
      };
    } catch (error) {
      logger.error('AI analysis error:', error);
      throw new Error('AI analysis failed');
    }
  }

  // Generate CV
  async generateCV(cvData) {
    try {
      const prompt = this.getCVPrompt(cvData);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: 0.7,
        max_tokens: 2000
      });

      const cvContent = response.choices[0].message.content;
      
      return {
        content: cvContent,
        html: this.convertToHTML(cvContent, cvData.template),
        tokens: response.usage.total_tokens,
        cost: this.calculateCost(response.usage.total_tokens)
      };
    } catch (error) {
      logger.error('CV generation error:', error);
      throw new Error('CV generation failed');
    }
  }

  // Generate social media content
  async generateSocialContent(contentData) {
    try {
      const prompt = this.getSocialContentPrompt(contentData);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: 0.8,
        max_tokens: 500
      });

      const content = response.choices[0].message.content;
      
      return {
        content,
        engagementScore: this.calculateEngagementScore(content, contentData.platform),
        hashtags: this.extractHashtags(content),
        tokens: response.usage.total_tokens,
        cost: this.calculateCost(response.usage.total_tokens)
      };
    } catch (error) {
      logger.error('Social content generation error:', error);
      throw new Error('Social content generation failed');
    }
  }

  // Generate persona from data
  async generatePersona(personaData) {
    try {
      const prompt = this.getPersonaPrompt(personaData);
      
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: prompt.system },
          { role: 'user', content: prompt.user }
        ],
        temperature: 0.7,
        max_tokens: 1500
      });

      const persona = response.choices[0].message.content;
      
      return {
        persona: JSON.parse(persona),
        tokens: response.usage.total_tokens,
        cost: this.calculateCost(response.usage.total_tokens)
      };
    } catch (error) {
      logger.error('Persona generation error:', error);
      throw new Error('Persona generation failed');
    }
  }

  // Prompt templates
  getEmailAnalysisPrompt(options) {
    return {
      system: `You are an AI email analysis expert. Analyze emails for sentiment, intent, and provide actionable recommendations.`,
      user: `Analyze this email and provide:
      1. Sentiment (positive/negative/neutral)
      2. Intent (inquiry/complaint/request/etc.)
      3. Urgency level (low/medium/high)
      4. Recommended response type
      5. Key action items
      
      Email content: ${options.content}`
    };
  }

  getDatasetAnalysisPrompt(options) {
    return {
      system: `You are a data analysis expert. Analyze datasets and provide insights, trends, and recommendations.`,
      user: `Analyze this dataset and provide:
      1. Key insights and trends
      2. Data quality assessment
      3. Recommendations for improvement
      4. Potential business opportunities
      
      Dataset: ${options.data}`
    };
  }

  getCVAnalysisPrompt(options) {
    return {
      system: `You are a career expert and ATS (Applicant Tracking System) specialist. Analyze CVs for ATS optimization and career advice.`,
      user: `Analyze this CV and provide:
      1. ATS compatibility score
      2. Missing keywords for target role
      3. Strengths and weaknesses
      4. Improvement recommendations
      5. Career path suggestions
      
      CV content: ${options.content}`
    };
  }

  getSocialAnalysisPrompt(options) {
    return {
      system: `You are a social media marketing expert. Analyze social media content for engagement potential and marketing effectiveness.`,
      user: `Analyze this social media content and provide:
      1. Engagement prediction score
      2. Target audience analysis
      3. Content quality assessment
      4. Optimization suggestions
      5. Platform-specific recommendations
      
      Content: ${options.content}
      Platform: ${options.platform}`
    };
  }

  getCVPrompt(cvData) {
    return {
      system: `You are a professional CV writer and ATS optimization expert. Create compelling, ATS-friendly CVs that highlight achievements and skills.`,
      user: `Create a professional CV with the following information:
      Personal Info: ${JSON.stringify(cvData.personalInfo)}
      Experience: ${JSON.stringify(cvData.experience)}
      Education: ${JSON.stringify(cvData.education)}
      Skills: ${JSON.stringify(cvData.skills)}
      Template: ${cvData.template}
      
      Format the CV in a clear, professional structure with proper sections and bullet points.`
    };
  }

  getSocialContentPrompt(contentData) {
    return {
      system: `You are a social media content creator. Generate engaging, platform-specific content that resonates with target audiences.`,
      user: `Create social media content with these specifications:
      Platform: ${contentData.platform}
      Topic: ${contentData.topic}
      Tone: ${contentData.tone}
      Target Audience: ${contentData.targetAudience}
      Include Hashtags: ${contentData.includeHashtags}
      Include Call to Action: ${contentData.includeCallToAction}
      
      Generate content that is engaging, authentic, and optimized for the platform.`
    };
  }

  getPersonaPrompt(personaData) {
    return {
      system: `You are a customer persona expert. Analyze customer data to create detailed buyer personas with demographics, psychographics, and behavior patterns.`,
      user: `Create customer personas based on this data:
      Data Source: ${personaData.dataSource}
      Sample Size: ${personaData.sampleSize}
      Criteria: ${JSON.stringify(personaData.criteria)}
      
      Generate detailed personas including:
      1. Demographics (age, gender, location, income)
      2. Psychographics (interests, values, lifestyle)
      3. Behavior patterns (purchasing habits, online activity)
      4. Pain points and motivations
      5. Preferred communication channels
      6. Content preferences`
    };
  }

  // Utility methods
  calculateConfidence(analysis) {
    // Simple confidence calculation based on analysis completeness
    const factors = ['sentiment', 'intent', 'urgency', 'recommendations'];
    const foundFactors = factors.filter(factor => 
      analysis.toLowerCase().includes(factor)
    ).length;
    return (foundFactors / factors.length) * 100;
  }

  calculateEngagementScore(content, platform) {
    // Calculate engagement score based on content characteristics
    const score = Math.random() * 100; // Placeholder - would use ML model
    return Math.round(score);
  }

  extractHashtags(content) {
    const hashtagRegex = /#\w+/g;
    return content.match(hashtagRegex) || [];
  }

  calculateCost(tokens) {
    // OpenAI pricing: $0.03 per 1K tokens for GPT-4
    return (tokens / 1000) * 0.03;
  }

  convertToHTML(content, template) {
    // Convert CV content to HTML based on template
    // This would use a template engine like Handlebars
    return `<div class="cv-template-${template}">${content}</div>`;
  }
}

module.exports = { aiService: new AiService() };
