const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../server');

const prisma = new PrismaClient();

// Mock OpenAI service
jest.mock('../services/aiService', () => ({
  aiService: {
    analyzeContent: jest.fn().mockResolvedValue({
      analysis: {
        sentiment: 'positive',
        intent: 'inquiry',
        urgency: 'medium',
        recommendations: ['respond within 24 hours']
      },
      confidence: 0.85,
      tokens: 150,
      cost: 0.002
    }),
    generateCV: jest.fn().mockResolvedValue({
      content: 'Generated CV content',
      html: '<div>Generated CV HTML</div>',
      tokens: 500,
      cost: 0.01
    }),
    generateSocialContent: jest.fn().mockResolvedValue({
      content: 'Generated social media content',
      engagementScore: 85,
      hashtags: ['#tech', '#innovation'],
      tokens: 200,
      cost: 0.005
    }),
    generatePersona: jest.fn().mockResolvedValue({
      persona: {
        demographics: { age: '25-35', income: 'high' },
        psychographics: { interests: ['technology'] }
      },
      tokens: 300,
      cost: 0.008
    })
  }
}));

describe('AI Analysis API', () => {
  let authToken;
  let testTenantId;

  beforeAll(async () => {
    // Setup test data
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test AI Tenant',
        domain: 'ai-test.zyra.com'
      }
    });
    testTenantId = tenant.id;
    authToken = 'test-jwt-token';
  });

  afterAll(async () => {
    await prisma.tenant.deleteMany({
      where: { name: 'Test AI Tenant' }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/ai/analyze', () => {
    it('should analyze content successfully', async () => {
      const analysisData = {
        sourceType: 'email',
        sourceId: 'email_123',
        options: {
          model: 'gpt-4',
          temperature: 0.7
        }
      };

      const response = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send(analysisData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.result).toHaveProperty('sentiment');
      expect(response.body.data.confidence).toBeGreaterThan(0);
    });

    it('should return 400 for missing sourceType', async () => {
      const invalidData = {
        sourceId: 'email_123',
        options: { model: 'gpt-4' }
      };

      const response = await request(app)
        .post('/api/ai/analyze')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/ai/analysis/:id', () => {
    let analysisId;

    beforeEach(async () => {
      const analysis = await prisma.aiAnalysisRequest.create({
        data: {
          tenantId: testTenantId,
          sourceType: 'email',
          sourceId: 'email_123',
          payload: { content: 'Test email content' },
          modelUsed: 'gpt-4',
          result: { sentiment: 'positive' },
          confidence: 0.85
        }
      });
      analysisId = analysis.id;
    });

    afterEach(async () => {
      await prisma.aiAnalysisRequest.delete({
        where: { id: analysisId }
      });
    });

    it('should return analysis result', async () => {
      const response = await request(app)
        .get(`/api/ai/analysis/${analysisId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.id).toBe(analysisId);
      expect(response.body.data.result).toHaveProperty('sentiment');
    });

    it('should return 404 for non-existent analysis', async () => {
      const response = await request(app)
        .get('/api/ai/analysis/non-existent-id')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/ai/generate/cv', () => {
    it('should generate CV successfully', async () => {
      const cvData = {
        personalInfo: {
          firstName: 'John',
          lastName: 'Doe',
          email: 'john@example.com'
        },
        experience: [
          {
            company: 'Tech Corp',
            position: 'Developer',
            duration: '2020-2023'
          }
        ],
        education: [
          {
            degree: 'Computer Science',
            university: 'Stanford'
          }
        ],
        skills: ['JavaScript', 'Python'],
        template: 'modern'
      };

      const response = await request(app)
        .post('/api/ai/generate/cv')
        .set('Authorization', `Bearer ${authToken}`)
        .send(cvData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data).toHaveProperty('html');
      expect(response.body.data).toHaveProperty('tokens');
      expect(response.body.data).toHaveProperty('cost');
    });
  });

  describe('POST /api/ai/generate/social', () => {
    it('should generate social media content successfully', async () => {
      const socialData = {
        platform: 'twitter',
        topic: 'AI technology',
        tone: 'professional',
        targetAudience: 'tech professionals',
        includeHashtags: true,
        includeCallToAction: true
      };

      const response = await request(app)
        .post('/api/ai/generate/social')
        .set('Authorization', `Bearer ${authToken}`)
        .send(socialData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('content');
      expect(response.body.data).toHaveProperty('engagementScore');
      expect(response.body.data).toHaveProperty('hashtags');
      expect(Array.isArray(response.body.data.hashtags)).toBe(true);
    });
  });

  describe('POST /api/ai/generate/persona', () => {
    it('should generate persona successfully', async () => {
      const personaData = {
        dataSource: 'customer_data',
        sampleSize: 1000,
        criteria: {
          age_range: '25-35',
          interests: ['technology']
        }
      };

      const response = await request(app)
        .post('/api/ai/generate/persona')
        .set('Authorization', `Bearer ${authToken}`)
        .send(personaData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('persona');
      expect(response.body.data.persona).toHaveProperty('demographics');
      expect(response.body.data.persona).toHaveProperty('psychographics');
    });
  });

  describe('POST /api/ai/feedback/:id', () => {
    let generationId;

    beforeEach(async () => {
      const generation = await prisma.aiGenerationHistory.create({
        data: {
          tenantId: testTenantId,
          prompt: 'Test prompt',
          response: 'Test response',
          model: 'gpt-4',
          tokens: 100,
          cost: 0.002
        }
      });
      generationId = generation.id;
    });

    afterEach(async () => {
      await prisma.aiGenerationHistory.delete({
        where: { id: generationId }
      });
    });

    it('should record positive feedback', async () => {
      const response = await request(app)
        .post(`/api/ai/feedback/${generationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'positive' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify feedback was recorded
      const updatedGeneration = await prisma.aiGenerationHistory.findUnique({
        where: { id: generationId }
      });
      expect(updatedGeneration.feedback).toBe(1);
    });

    it('should record negative feedback', async () => {
      const response = await request(app)
        .post(`/api/ai/feedback/${generationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ feedback: 'negative' })
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify feedback was recorded
      const updatedGeneration = await prisma.aiGenerationHistory.findUnique({
        where: { id: generationId }
      });
      expect(updatedGeneration.feedback).toBe(-1);
    });
  });

  describe('GET /api/ai/history', () => {
    beforeEach(async () => {
      // Create test generation history
      await prisma.aiGenerationHistory.createMany({
        data: [
          {
            tenantId: testTenantId,
            prompt: 'Test prompt 1',
            response: 'Test response 1',
            model: 'gpt-4',
            tokens: 100,
            cost: 0.002
          },
          {
            tenantId: testTenantId,
            prompt: 'Test prompt 2',
            response: 'Test response 2',
            model: 'gpt-3.5-turbo',
            tokens: 80,
            cost: 0.001
          }
        ]
      });
    });

    afterEach(async () => {
      await prisma.aiGenerationHistory.deleteMany({
        where: { tenantId: testTenantId }
      });
    });

    it('should return generation history', async () => {
      const response = await request(app)
        .get('/api/ai/history')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
      expect(response.body.data.length).toBeGreaterThan(0);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/ai/history?page=1&limit=1')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 1);
    });

    it('should filter by model', async () => {
      const response = await request(app)
        .get('/api/ai/history?model=gpt-4')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data.every(item => item.model === 'gpt-4')).toBe(true);
    });
  });
});
