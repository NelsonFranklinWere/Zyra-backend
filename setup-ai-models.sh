#!/bin/bash

# AI Setup Script for Zyra Backend
# This script ensures all AI models and templates are properly set up

set -e  # Exit on error

echo "🚀 Starting AI Models Setup for Zyra..."
echo ""

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Check if we're in the backend directory
if [ ! -f "package.json" ]; then
  echo "${RED}❌ Error: Must run from backend directory${NC}"
  exit 1
fi

# Function to check if command exists
command_exists() {
  command -v "$1" >/dev/null 2>&1
}

# Check prerequisites
echo "📋 Checking prerequisites..."

if ! command_exists node; then
  echo "${RED}❌ Node.js not found. Please install Node.js first.${NC}"
  exit 1
fi

if ! command_exists npm; then
  echo "${RED}❌ npm not found. Please install npm first.${NC}"
  exit 1
fi

# Check for .env file
if [ ! -f ".env" ]; then
  echo "${YELLOW}⚠️  Warning: .env file not found${NC}"
  echo "   Please create .env file with required environment variables"
  echo "   See env.example for reference"
fi

# Check for OPENAI_API_KEY
if ! grep -q "OPENAI_API_KEY=" .env 2>/dev/null; then
  echo "${YELLOW}⚠️  Warning: OPENAI_API_KEY not found in .env${NC}"
  echo "   AI features will not work without an OpenAI API key"
fi

echo "${GREEN}✅ Prerequisites check complete${NC}"
echo ""

# Step 1: Install dependencies
echo "📦 Installing dependencies..."
if [ ! -d "node_modules" ]; then
  npm install
else
  echo "   Dependencies already installed, skipping..."
fi
echo ""

# Step 2: Run database migrations
echo "🗄️  Running database migrations..."
if command_exists knex; then
  npx knex migrate:latest
else
  npm run migrate
fi
echo ""

# Step 3: Seed AI prompt templates
echo "🤖 Seeding AI prompt templates..."
if [ -f "seeds/002_ai_prompt_templates.js" ]; then
  npx knex seed:run --specific=002_ai_prompt_templates.js
else
  echo "${YELLOW}⚠️  AI templates seed file not found, using general seed...${NC}"
  npm run seed || npx knex seed:run
fi
echo ""

# Step 4: Generate Prisma client (if Prisma is used)
if [ -f "prisma/schema.prisma" ]; then
  echo "🔧 Generating Prisma client..."
  if command_exists prisma; then
    npx prisma generate
    echo "   Pushing Prisma schema to database..."
    npx prisma db push --skip-generate
  else
    echo "${YELLOW}⚠️  Prisma CLI not found, skipping Prisma setup${NC}"
  fi
  echo ""
fi

# Step 5: Verify setup
echo "🔍 Verifying AI setup..."

# Check if ai_prompt_templates table exists and has data
if command_exists psql; then
  echo "   Checking database connection..."
  # Try to query templates (requires DATABASE_URL in .env)
  if [ -f ".env" ] && grep -q "DATABASE_URL=" .env; then
    TEMPLATE_COUNT=$(npx knex raw "SELECT COUNT(*) as count FROM ai_prompt_templates WHERE is_active = true;" 2>/dev/null | grep -o '[0-9]*' | head -1 || echo "0")
    if [ "$TEMPLATE_COUNT" -gt "0" ]; then
      echo "${GREEN}   ✅ Found $TEMPLATE_COUNT active AI prompt templates${NC}"
    else
      echo "${YELLOW}   ⚠️  No active templates found, please run seed script${NC}"
    fi
  else
    echo "${YELLOW}   ⚠️  Cannot verify: DATABASE_URL not configured${NC}"
  fi
else
  echo "   Skipping database verification (psql not found)"
fi

echo ""
echo "${GREEN}✅ AI Models Setup Complete!${NC}"
echo ""
echo "📝 Next steps:"
echo "   1. Ensure OPENAI_API_KEY is set in .env"
echo "   2. Test AI endpoints:"
echo "      - POST /api/ai/cv/generate"
echo "      - POST /api/ai/social/generate"
echo "      - POST /api/ai/insights"
echo "   3. Check logs if issues occur"
echo ""
echo "📚 See AI_SETUP.md for detailed documentation"

