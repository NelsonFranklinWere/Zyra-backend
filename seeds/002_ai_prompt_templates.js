const bcrypt = require('bcryptjs');

/**
 * Comprehensive AI Prompt Templates Seed
 * This seed file ensures all required AI prompt templates exist for the app to function properly
 */
exports.seed = async function(knex) {
  // Check if templates already exist to avoid duplicates
  const existingTemplates = await knex('ai_prompt_templates').select('name');
  const existingNames = existingTemplates.map(t => t.name);

  // Define all required AI prompt templates
  const requiredTemplates = [
    {
      name: 'cv_builder',
      content: `Generate a professional, modern CV based on the provided user data and preferences.

Requirements:
- Use modern 2025 CV format
- Optimize for ATS (Applicant Tracking Systems)
- Include relevant keywords for the industry
- Structure: Header, Summary, Experience, Education, Skills, Certifications
- Use action verbs and quantifiable achievements
- Keep it concise but comprehensive
- Format in clear markdown structure

Focus on:
- Highlighting key achievements and skills
- Industry-specific terminology
- Clean, readable formatting
- Professional tone`,
      module: 'cv_builder',
      variables: JSON.stringify({
        personalInfo: 'object',
        experience: 'array',
        education: 'array',
        skills: 'array',
        certifications: 'array',
        preferences: 'object'
      }),
      is_active: true
    },
    {
      name: 'social_generator',
      content: `Create engaging social media content optimized for the specified platform.

Platform-specific requirements:
- Twitter/X: Max 280 characters, use hashtags strategically
- Instagram: Visual-first, use relevant hashtags (5-10), consider captions
- LinkedIn: Professional tone, longer form content acceptable
- Facebook: Conversational, can include questions, emojis okay
- TikTok: Trend-aware, engaging hooks, short and punchy

Content requirements:
- Engaging and shareable
- Platform-optimized format
- Relevant hashtags and mentions when appropriate
- Clear call-to-action when specified
- Trend-aware content where applicable
- Maintain brand voice and tone`,
      module: 'social_generator',
      variables: JSON.stringify({
        platform: 'string',
        content: 'object',
        tone: 'string',
        audience: 'string',
        includeHashtags: 'boolean',
        includeCallToAction: 'boolean'
      }),
      is_active: true
    },
    {
      name: 'whatsapp_automation',
      content: `Analyze the incoming WhatsApp message and generate an appropriate business response.

Requirements:
- Classify message intent (inquiry, complaint, support, sales, booking, etc.)
- Generate contextually appropriate response
- Maintain professional yet friendly tone
- Suggest follow-up actions when needed
- Keep responses concise but helpful
- Use emojis sparingly and appropriately
- Acknowledge customer concerns
- Provide clear next steps

Response guidelines:
- Be helpful and solution-oriented
- If uncertain, suggest connecting with human agent
- Maintain brand voice
- Personalize when possible`,
      module: 'whatsapp_automation',
      variables: JSON.stringify({
        message: 'string',
        context: 'object',
        business_type: 'string',
        industry: 'string',
        service_level: 'string'
      }),
      is_active: true
    },
    {
      name: 'data_insights',
      content: `Analyze the provided data and generate actionable business insights.

Analysis requirements:
- Identify key patterns and trends
- Extract meaningful metrics
- Generate actionable recommendations
- Provide data-driven insights
- Suggest optimization strategies
- Create executive summary
- Highlight anomalies or outliers
- Quantify opportunities

Output format:
- Executive summary (2-3 sentences)
- Key findings (3-5 bullet points)
- Data trends identified
- Recommendations (prioritized)
- Risk indicators if any
- Next steps suggested`,
      module: 'data_insights',
      variables: JSON.stringify({
        data: 'object',
        analysis_type: 'string',
        metrics: 'array',
        timeframe: 'string'
      }),
      is_active: true
    },
    {
      name: 'audience_targeting',
      content: `Create detailed audience segments based on the targeting criteria.

Persona requirements:
- Demographics (age, gender, location, income, education)
- Psychographics (interests, values, lifestyle, attitudes)
- Behavior patterns (purchasing habits, online activity, media consumption)
- Pain points and motivations
- Preferred communication channels
- Content preferences
- Buying journey stage

Output format:
- Persona name and summary
- Demographic profile
- Psychographic characteristics
- Behavioral patterns
- Pain points and motivations
- Preferred channels
- Content recommendations
- Targeting strategies
- Engagement tips
- Market size estimate`,
      module: 'audience_targeting',
      variables: JSON.stringify({
        criteria: 'object',
        preferences: 'object',
        market_size: 'number',
        sample_data: 'object'
      }),
      is_active: true
    },
    {
      name: 'email_analysis',
      content: `Analyze email content for sentiment, intent, and provide actionable recommendations.

Analysis requirements:
- Sentiment classification (positive/negative/neutral)
- Intent identification (inquiry/complaint/request/support/sales)
- Urgency level assessment (low/medium/high)
- Key topics and themes
- Recommended response type
- Action items extraction
- Priority classification

Provide structured analysis with:
- Overall sentiment score (0-100)
- Primary intent
- Urgency level
- Key topics identified
- Recommended response approach
- Suggested actions
- Follow-up requirements`,
      module: 'email_automation',
      variables: JSON.stringify({
        email_content: 'string',
        sender_info: 'object',
        subject: 'string',
        attachments: 'array'
      }),
      is_active: true
    },
    {
      name: 'persona_generation',
      content: `Generate detailed customer personas from provided data and criteria.

Persona structure:
- Name and role title
- Demographics (age, location, income, family status)
- Goals and motivations
- Pain points and challenges
- Preferred communication channels
- Content consumption habits
- Buying behavior patterns
- Quotes (representative statements)
- Brand affinities

Create realistic, data-driven personas that can guide:
- Marketing strategy
- Content creation
- Product development
- Customer communication`,
      module: 'persona_generation',
      variables: JSON.stringify({
        data_source: 'string',
        sample_size: 'number',
        criteria: 'object',
        industry: 'string'
      }),
      is_active: true
    }
  ];

  // Insert only missing templates
  const templatesToInsert = requiredTemplates.filter(
    template => !existingNames.includes(template.name)
  );

  if (templatesToInsert.length > 0) {
    await knex('ai_prompt_templates').insert(
      templatesToInsert.map(template => ({
        ...template,
        id: knex.raw('gen_random_uuid()'),
        created_at: new Date(),
        updated_at: new Date()
      }))
    );
    console.log(`✅ Inserted ${templatesToInsert.length} AI prompt templates`);
  } else {
    console.log('✅ All AI prompt templates already exist');
  }

  // List all active templates
  const allTemplates = await knex('ai_prompt_templates')
    .where('is_active', true)
    .select('name', 'module');
  
  console.log('\n📋 Active AI Prompt Templates:');
  allTemplates.forEach(template => {
    console.log(`   - ${template.name} (${template.module})`);
  });
};

