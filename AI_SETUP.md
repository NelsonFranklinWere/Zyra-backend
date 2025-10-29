# AI Models Setup Guide

This guide explains what AI models and database tables need to be created to ensure the Zyra application works properly.

## Overview

The Zyra application uses AI capabilities powered by OpenAI (GPT-4) for various modules:
- **CV Builder**: Generate professional CVs
- **Social Media Generator**: Create platform-optimized social content
- **WhatsApp Automation**: AI-powered message responses
- **Data Insights**: Analyze data and generate business insights
- **Audience Targeting**: Create detailed customer personas
- **Email Analysis**: Analyze email sentiment and intent

## Prerequisites

1. **OpenAI API Key**: Required for all AI functionality
   - Get your API key from https://platform.openai.com/api-keys
   - Set in environment: `OPENAI_API_KEY=sk-your-key-here`

2. **Database**: PostgreSQL database with migrations run

## Database Tables Required

### 1. Prisma Models (for new API endpoints)

The application uses Prisma for some AI-related models:

```bash
# Generate Prisma client and sync schema
cd backend
npx prisma generate
npx prisma db push
```

**Required Prisma Models:**
- `AiAnalysisRequest` - Stores AI analysis requests
- `AiGenerationHistory` - Tracks AI generation history
- `AiPromptTemplate` - Prompt templates (newer schema)

### 2. Knex Migrations (for core AI functionality)

Run all migrations including AI-specific ones:

```bash
cd backend
npm run migrate
```

**Required Knex Tables:**
- `ai_prompt_templates` - Stores prompt templates for AI modules
- `ai_generations` - General AI generation history
- `user_cvs` - User CV data and generated CVs
- `user_social_posts` - Generated social media posts
- `user_insights` - Data insights and analysis results
- `user_audience_segments` - Audience targeting segments
- `user_ai_preferences` - User AI preferences
- `whatsapp_interactions` - WhatsApp AI interactions
- `ai_insights` - General AI insights table

## Setup Steps

### Step 1: Run Database Migrations

```bash
cd backend
npm run migrate
```

This creates all required tables including AI-related ones.

### Step 2: Seed AI Prompt Templates

The AI modules require prompt templates to function. Run the seed script:

```bash
cd backend
npm run seed
```

Or run the specific AI templates seed:

```bash
npx knex seed:run --specific=002_ai_prompt_templates.js
```

### Step 3: Verify Templates Exist

Check that all required templates are present:

```sql
SELECT name, module, is_active 
FROM ai_prompt_templates 
WHERE is_active = true;
```

**Required Templates:**
- `cv_builder` (module: cv_builder)
- `social_generator` (module: social_generator)
- `whatsapp_automation` (module: whatsapp_automation)
- `data_insights` (module: data_insights)
- `audience_targeting` (module: audience_targeting)
- `email_analysis` (module: email_automation)
- `persona_generation` (module: persona_generation)

### Step 4: Configure Environment Variables

Ensure these are set in your `.env` file:

```env
# OpenAI Configuration
OPENAI_API_KEY=sk-your-openai-api-key-here
OPENAI_MODEL=gpt-4-turbo-preview  # Optional, defaults to gpt-4-turbo-preview

# Database (for AI data storage)
DATABASE_URL=postgresql://user:password@localhost:5432/zyra_db

# Optional: AI Service Configuration
AI_RATE_LIMIT_MAX_REQUESTS=50
ENABLE_AI_ANALYSIS=true
```

### Step 5: Sync Prisma Schema (if using Prisma models)

If your code uses Prisma models (`AiAnalysisRequest`, `AiGenerationHistory`):

```bash
cd backend
npx prisma generate
npx prisma db push
```

## Verification

### Test AI Functionality

1. **Test CV Builder:**
```bash
curl -X POST http://localhost:3001/api/ai/cv/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "personalInfo": {"name": "John Doe", "email": "john@example.com"},
    "experience": [{"title": "Developer", "company": "Tech Co"}],
    "education": [{"degree": "BS Computer Science"}],
    "skills": ["JavaScript", "React"]
  }'
```

2. **Test Social Media Generator:**
```bash
curl -X POST http://localhost:3001/api/ai/social/generate \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "platform": "twitter",
    "topic": "Product launch announcement",
    "tone": "professional"
  }'
```

3. **Test Data Insights:**
```bash
curl -X POST http://localhost:3001/api/ai/insights \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "sourceType": "dataset",
    "sourceId": "dataset-123",
    "options": {"data": {"sales": 1000, "users": 500}}
  }'
```

## Troubleshooting

### Error: "Prompt template not found"
- **Solution**: Run the seed script: `npm run seed` or `npx knex seed:run --specific=002_ai_prompt_templates.js`

### Error: "OpenAI API key not configured"
- **Solution**: Set `OPENAI_API_KEY` in your `.env` file

### Error: "Table 'ai_prompt_templates' does not exist"
- **Solution**: Run migrations: `npm run migrate`

### Error: Prisma client not generated
- **Solution**: Run `npx prisma generate` in the backend directory

### AI responses are empty or generic
- **Solution**: Check that prompt templates exist and are active:
  ```sql
  SELECT * FROM ai_prompt_templates WHERE is_active = true;
  ```

## Database Schema Reference

### ai_prompt_templates
```sql
CREATE TABLE ai_prompt_templates (
  id UUID PRIMARY KEY,
  name VARCHAR UNIQUE NOT NULL,
  content TEXT NOT NULL,
  module VARCHAR NOT NULL,
  variables JSONB DEFAULT '{}',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

### ai_generations
```sql
CREATE TABLE ai_generations (
  id UUID PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  module VARCHAR NOT NULL,
  input_data JSONB NOT NULL,
  output_data JSONB NOT NULL,
  metadata JSONB DEFAULT '{}',
  confidence_score FLOAT,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Quick Setup Script

Run this complete setup:

```bash
#!/bin/bash
cd backend

# 1. Run migrations
echo "Running database migrations..."
npm run migrate

# 2. Seed AI templates
echo "Seeding AI prompt templates..."
npx knex seed:run --specific=002_ai_prompt_templates.js

# 3. Generate Prisma client (if using Prisma)
if [ -f "prisma/schema.prisma" ]; then
  echo "Generating Prisma client..."
  npx prisma generate
  npx prisma db push
fi

# 4. Verify setup
echo "Verifying AI templates..."
npx knex raw "SELECT name, module FROM ai_prompt_templates WHERE is_active = true;"

echo "✅ AI setup complete!"
```

## Next Steps

1. Configure your OpenAI API key
2. Test each AI module endpoint
3. Customize prompt templates if needed
4. Set up monitoring for AI usage and costs
5. Configure rate limiting for AI endpoints

## Cost Considerations

- OpenAI GPT-4 pricing: ~$0.03 per 1K tokens
- Monitor usage in OpenAI dashboard
- Consider caching frequently used generations
- Set up rate limits to control costs

## Support

For issues:
1. Check database migrations ran successfully
2. Verify prompt templates exist
3. Confirm OpenAI API key is valid
4. Check application logs for detailed errors

