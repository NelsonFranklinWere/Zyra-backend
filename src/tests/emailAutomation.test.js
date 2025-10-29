const request = require('supertest');
const { PrismaClient } = require('@prisma/client');
const app = require('../server');

const prisma = new PrismaClient();

describe('Email Automation API', () => {
  let authToken;
  let testTenantId;

  beforeAll(async () => {
    // Setup test data
    const tenant = await prisma.tenant.create({
      data: {
        name: 'Test Tenant',
        domain: 'test.zyra.com'
      }
    });
    testTenantId = tenant.id;

    // Mock authentication token
    authToken = 'test-jwt-token';
  });

  afterAll(async () => {
    // Cleanup test data
    await prisma.tenant.deleteMany({
      where: { name: 'Test Tenant' }
    });
    await prisma.$disconnect();
  });

  describe('POST /api/automations/email', () => {
    it('should create a new email automation', async () => {
      const automationData = {
        name: 'Test Automation',
        description: 'Test automation description',
        triggers: {
          type: 'user_signup',
          conditions: ['email_verified']
        },
        conditions: {
          user_segment: 'premium'
        },
        actions: {
          type: 'send_email',
          template: 'welcome_template'
        },
        schedule: {
          frequency: 'daily',
          time: '09:00'
        },
        settings: {
          max_retries: 3
        },
        isActive: true
      };

      const response = await request(app)
        .post('/api/automations/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(automationData)
        .expect(201);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('id');
      expect(response.body.data.name).toBe(automationData.name);
      expect(response.body.data.triggers).toEqual(automationData.triggers);
    });

    it('should return 400 for invalid automation data', async () => {
      const invalidData = {
        name: '', // Invalid: empty name
        triggers: {} // Invalid: missing required fields
      };

      const response = await request(app)
        .post('/api/automations/email')
        .set('Authorization', `Bearer ${authToken}`)
        .send(invalidData)
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/automations/email', () => {
    it('should return list of automations', async () => {
      const response = await request(app)
        .get('/api/automations/email')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(Array.isArray(response.body.data)).toBe(true);
    });

    it('should support pagination', async () => {
      const response = await request(app)
        .get('/api/automations/email?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.pagination).toHaveProperty('page', 1);
      expect(response.body.pagination).toHaveProperty('limit', 5);
    });
  });

  describe('POST /api/automations/email/:id/trigger', () => {
    let automationId;

    beforeEach(async () => {
      // Create a test automation
      const automation = await prisma.emailAutomation.create({
        data: {
          tenantId: testTenantId,
          name: 'Test Trigger Automation',
          triggers: { type: 'manual' },
          conditions: {},
          actions: { type: 'send_email' },
          isActive: true
        }
      });
      automationId = automation.id;
    });

    afterEach(async () => {
      // Cleanup
      await prisma.emailAutomation.delete({
        where: { id: automationId }
      });
    });

    it('should trigger automation successfully', async () => {
      const triggerData = {
        triggerPayload: {
          manual: true,
          user_id: '123'
        }
      };

      const response = await request(app)
        .post(`/api/automations/email/${automationId}/trigger`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(triggerData)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('runId');
    });
  });

  describe('PUT /api/automations/email/:id', () => {
    let automationId;

    beforeEach(async () => {
      const automation = await prisma.emailAutomation.create({
        data: {
          tenantId: testTenantId,
          name: 'Test Update Automation',
          triggers: { type: 'manual' },
          conditions: {},
          actions: { type: 'send_email' },
          isActive: true
        }
      });
      automationId = automation.id;
    });

    afterEach(async () => {
      await prisma.emailAutomation.delete({
        where: { id: automationId }
      });
    });

    it('should update automation successfully', async () => {
      const updateData = {
        name: 'Updated Automation Name',
        isActive: false
      };

      const response = await request(app)
        .put(`/api/automations/email/${automationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify update
      const updatedAutomation = await prisma.emailAutomation.findUnique({
        where: { id: automationId }
      });
      expect(updatedAutomation.name).toBe(updateData.name);
      expect(updatedAutomation.isActive).toBe(updateData.isActive);
    });
  });

  describe('DELETE /api/automations/email/:id', () => {
    let automationId;

    beforeEach(async () => {
      const automation = await prisma.emailAutomation.create({
        data: {
          tenantId: testTenantId,
          name: 'Test Delete Automation',
          triggers: { type: 'manual' },
          conditions: {},
          actions: { type: 'send_email' },
          isActive: true
        }
      });
      automationId = automation.id;
    });

    it('should delete automation successfully', async () => {
      const response = await request(app)
        .delete(`/api/automations/email/${automationId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.success).toBe(true);

      // Verify deletion
      const deletedAutomation = await prisma.emailAutomation.findUnique({
        where: { id: automationId }
      });
      expect(deletedAutomation).toBeNull();
    });
  });
});
