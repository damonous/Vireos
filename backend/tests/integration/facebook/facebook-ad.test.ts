/**
 * Integration tests for FR-006: Facebook Ads with Lead Capture
 *
 * Tests cover:
 *  - POST /api/v1/facebook/campaigns — create
 *  - GET  /api/v1/facebook/campaigns — list with pagination and scoping
 *  - GET  /api/v1/facebook/campaigns/:id — get one
 *  - PUT  /api/v1/facebook/campaigns/:id — update
 *  - DELETE /api/v1/facebook/campaigns/:id — delete
 *  - POST /api/v1/facebook/campaigns/:id/launch — launch
 *  - POST /api/v1/facebook/campaigns/:id/pause — pause
 *  - GET  /api/v1/facebook/webhook — webhook verification
 *  - POST /api/v1/facebook/webhook — webhook lead ingestion
 */

// ---- Set required env variables BEFORE any module imports ----
process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';
process.env['JWT_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['ENCRYPTION_KEY'] = 'a'.repeat(64);
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] = 'redis://localhost:6379/1';
process.env['OPENAI_API_KEY'] = 'sk-test-fake-key-for-testing';
process.env['LINKEDIN_CLIENT_ID'] = 'test_linkedin_client_id';
process.env['LINKEDIN_CLIENT_SECRET'] = 'test_linkedin_client_secret';
process.env['LINKEDIN_REDIRECT_URI'] = 'http://localhost:3001/api/v1/oauth/linkedin/callback';
process.env['FACEBOOK_APP_ID'] = 'test_facebook_app_id';
process.env['FACEBOOK_APP_SECRET'] = 'test_facebook_app_secret';
process.env['FACEBOOK_REDIRECT_URI'] = 'http://localhost:3001/api/v1/oauth/facebook/callback';
process.env['FACEBOOK_WEBHOOK_VERIFY_TOKEN'] = 'test_webhook_verify_token_secret';
process.env['SENDGRID_API_KEY'] = 'SG.test_fake_key_for_testing';
process.env['SENDGRID_FROM_EMAIL'] = 'test@vireos.com';
process.env['STRIPE_SECRET_KEY'] = 'sk_test_fake_stripe_key';
process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_fake_webhook_secret';
process.env['AWS_ACCESS_KEY_ID'] = 'AKIAIOSFODNN7EXAMPLE';
process.env['AWS_SECRET_ACCESS_KEY'] = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
process.env['AWS_S3_BUCKET'] = 'vireos-test-bucket';
process.env['AWS_REGION'] = 'us-east-1';
process.env['API_BASE_URL'] = 'http://localhost:3001';
process.env['CORS_ORIGINS'] = 'http://localhost:3001';

// ---- Mock ioredis to prevent real Redis connections ----
jest.mock('ioredis', () => {
  const mRedisInstance = {
    on: jest.fn().mockReturnThis(),
    quit: jest.fn().mockResolvedValue(undefined),
    call: jest.fn().mockResolvedValue(0),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    incr: jest.fn().mockResolvedValue(1),
    expire: jest.fn().mockResolvedValue(1),
  };
  const RedisMock = jest.fn().mockImplementation(() => mRedisInstance);
  return { Redis: RedisMock, default: RedisMock, __esModule: true };
});

// ---- Mock rate-limit-redis ----
jest.mock('rate-limit-redis', () => ({
  RedisStore: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
    decrement: jest.fn(),
    resetKey: jest.fn(),
    resetAll: jest.fn(),
  })),
}));

// ---- Mock BullMQ ----
jest.mock('bullmq', () => {
  const actualBullMQ = jest.requireActual('bullmq');
  return {
    ...actualBullMQ,
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockResolvedValue({ id: 'bull-job-id' }),
      getJob: jest.fn().mockResolvedValue(null),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

// ---- Mock global fetch for Facebook API calls ----
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---- Mock Prisma client ----
jest.mock('../../../src/db/client', () => ({
  prisma: {
    facebookAdCampaign: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    socialConnection: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    lead: {
      upsert: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
    },
    emailSequence: {
      findFirst: jest.fn(),
    },
    emailEnrollment: {
      create: jest.fn(),
    },
    auditTrail: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
  default: {},
}));

import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/client';
import { encrypt } from '../../../src/utils/crypto';

// ---------------------------------------------------------------------------
// Constants & fixtures
// ---------------------------------------------------------------------------

const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_ORG_ID = '550e8400-e29b-41d4-a716-446655440001';
const ADVISOR_ID = '660e8400-e29b-41d4-a716-446655440001';
const ADMIN_ID = '660e8400-e29b-41d4-a716-446655440002';
const OTHER_ADVISOR_ID = '660e8400-e29b-41d4-a716-446655440003';
const VIEWER_ID = '660e8400-e29b-41d4-a716-446655440004';
const CAMPAIGN_ID = '770e8400-e29b-41d4-a716-446655440001';
const CONNECTION_ID = '880e8400-e29b-41d4-a716-446655440001';

function makeToken(
  userId: string,
  orgId: string,
  role: string = 'advisor'
): string {
  return jwt.sign(
    { sub: userId, orgId, role, email: `${userId}@test.com`, type: 'access' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const advisorToken = makeToken(ADVISOR_ID, ORG_ID, 'advisor');
const adminToken = makeToken(ADMIN_ID, ORG_ID, 'org_admin');
const viewerToken = makeToken(VIEWER_ID, ORG_ID, 'viewer');
const otherAdvisorToken = makeToken(OTHER_ADVISOR_ID, ORG_ID, 'advisor');
const otherOrgToken = makeToken(ADMIN_ID, OTHER_ORG_ID, 'org_admin');

// Encrypted token for mock Facebook connection
const encryptedFbToken = encrypt('fb_test_access_token_12345');

const mockCampaign = {
  id: CAMPAIGN_ID,
  organizationId: ORG_ID,
  advisorId: ADVISOR_ID,
  name: 'Test Lead Gen Campaign',
  objective: 'LEAD_GENERATION',
  status: 'DRAFT',
  fbCampaignId: null,
  fbAdSetId: null,
  fbAdId: null,
  budget: null,
  budgetCurrency: 'USD',
  startDate: null,
  endDate: null,
  targetingJson: {},
  impressions: 0,
  clicks: 0,
  leads: 0,
  spend: '0',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockActiveCampaign = {
  ...mockCampaign,
  status: 'ACTIVE',
  fbCampaignId: 'fb_campaign_123',
};

const mockFacebookConnection = {
  id: CONNECTION_ID,
  userId: ADVISOR_ID,
  organizationId: ORG_ID,
  platform: 'FACEBOOK',
  accessToken: encryptedFbToken,
  refreshToken: null,
  tokenExpiresAt: null,
  platformUserId: 'act_12345678',
  platformUsername: 'Test Advisor',
  scopes: ['pages_manage_posts'],
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
  mockFetch.mockReset();
});

// ---------------------------------------------------------------------------
// POST /api/v1/facebook/campaigns — create campaign
// ---------------------------------------------------------------------------

describe('POST /api/v1/facebook/campaigns', () => {
  it('creates a campaign and returns 201 for advisor', async () => {
    (prisma.facebookAdCampaign.create as jest.Mock).mockResolvedValue(mockCampaign);

    const res = await client
      .post('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        name: 'Test Lead Gen Campaign',
        objective: 'LEAD_GENERATION',
        budget: 1000,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: CAMPAIGN_ID,
      name: 'Test Lead Gen Campaign',
      objective: 'LEAD_GENERATION',
      status: 'DRAFT',
    });

    expect(prisma.facebookAdCampaign.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          advisorId: ADVISOR_ID,
          name: 'Test Lead Gen Campaign',
          objective: 'LEAD_GENERATION',
          status: 'DRAFT',
        }),
      })
    );
  });

  it('creates a campaign for org_admin', async () => {
    const adminCampaign = { ...mockCampaign, advisorId: ADMIN_ID };
    (prisma.facebookAdCampaign.create as jest.Mock).mockResolvedValue(adminCampaign);

    const res = await client
      .post('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'Admin Campaign',
        objective: 'BRAND_AWARENESS',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  it('returns 422 for missing name', async () => {
    const res = await client
      .post('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ objective: 'LEAD_GENERATION' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for missing objective', async () => {
    const res = await client
      .post('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ name: 'Test Campaign' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for invalid objective', async () => {
    const res = await client
      .post('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ name: 'Test Campaign', objective: 'INVALID_OBJECTIVE' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client
      .post('/api/v1/facebook/campaigns')
      .send({ name: 'Test', objective: 'LEAD_GENERATION' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for VIEWER role', async () => {
    const res = await client
      .post('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({ name: 'Test', objective: 'LEAD_GENERATION' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/facebook/campaigns — list campaigns
// ---------------------------------------------------------------------------

describe('GET /api/v1/facebook/campaigns', () => {
  it('returns paginated list of campaigns', async () => {
    (prisma.facebookAdCampaign.findMany as jest.Mock).mockResolvedValue([mockCampaign]);
    (prisma.facebookAdCampaign.count as jest.Mock).mockResolvedValue(1);

    const res = await client
      .get('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: CAMPAIGN_ID })])
    );
    expect(res.body.pagination).toMatchObject({
      page: 1,
      limit: 20,
      totalCount: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('advisor only sees their own campaigns (scoped by advisorId)', async () => {
    (prisma.facebookAdCampaign.findMany as jest.Mock).mockResolvedValue([mockCampaign]);
    (prisma.facebookAdCampaign.count as jest.Mock).mockResolvedValue(1);

    await client
      .get('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${advisorToken}`);

    const findManyCall = (prisma.facebookAdCampaign.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.advisorId).toBe(ADVISOR_ID);
    expect(findManyCall?.where?.organizationId).toBe(ORG_ID);
  });

  it('admin sees all campaigns in org (no advisor filter)', async () => {
    (prisma.facebookAdCampaign.findMany as jest.Mock).mockResolvedValue([mockCampaign]);
    (prisma.facebookAdCampaign.count as jest.Mock).mockResolvedValue(1);

    await client
      .get('/api/v1/facebook/campaigns')
      .set('Authorization', `Bearer ${adminToken}`);

    const findManyCall = (prisma.facebookAdCampaign.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.organizationId).toBe(ORG_ID);
    expect(findManyCall?.where?.advisorId).toBeUndefined();
  });

  it('applies status filter', async () => {
    (prisma.facebookAdCampaign.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.facebookAdCampaign.count as jest.Mock).mockResolvedValue(0);

    await client
      .get('/api/v1/facebook/campaigns?status=ACTIVE')
      .set('Authorization', `Bearer ${adminToken}`);

    const findManyCall = (prisma.facebookAdCampaign.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.status).toBe('ACTIVE');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/facebook/campaigns');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/facebook/campaigns/:id — get single campaign
// ---------------------------------------------------------------------------

describe('GET /api/v1/facebook/campaigns/:id', () => {
  it('returns campaign for admin', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);

    const res = await client
      .get(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ id: CAMPAIGN_ID });
  });

  it('returns 404 when campaign not found', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .get(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for campaign in different org', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .get(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);

    const findFirstCall = (prisma.facebookAdCampaign.findFirst as jest.Mock).mock.calls[0]?.[0];
    expect(findFirstCall?.where?.organizationId).toBe(OTHER_ORG_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/facebook/campaigns/:id — update campaign
// ---------------------------------------------------------------------------

describe('PUT /api/v1/facebook/campaigns/:id', () => {
  it('updates DRAFT campaign and returns 200', async () => {
    const updatedCampaign = { ...mockCampaign, name: 'Updated Campaign Name' };
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
    (prisma.facebookAdCampaign.update as jest.Mock).mockResolvedValue(updatedCampaign);

    const res = await client
      .put(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ name: 'Updated Campaign Name' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.name).toBe('Updated Campaign Name');
  });

  it('returns 409 when trying to update an ACTIVE campaign', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);

    const res = await client
      .put(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ name: 'New Name' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it("advisor cannot update another advisor's campaign (returns 404)", async () => {
    // findFirst returns null because the WHERE clause scopes to otherAdvisor's own campaigns
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .put(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${otherAdvisorToken}`)
      .send({ name: 'Hijacked Name' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid objective value', async () => {
    const res = await client
      .put(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ objective: 'INVALID' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client
      .put(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .send({ name: 'Test' });

    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/facebook/campaigns/:id — delete campaign
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/facebook/campaigns/:id', () => {
  it('deletes DRAFT campaign and returns 204', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
    (prisma.facebookAdCampaign.delete as jest.Mock).mockResolvedValue(mockCampaign);

    const res = await client
      .delete(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(204);
    expect(prisma.facebookAdCampaign.delete as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: CAMPAIGN_ID } })
    );
  });

  it('returns 409 when trying to delete an ACTIVE campaign', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);

    const res = await client
      .delete(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 when campaign not found', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .delete(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.delete(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/facebook/campaigns/:id/launch — launch campaign
// ---------------------------------------------------------------------------

describe('POST /api/v1/facebook/campaigns/:id/launch', () => {
  it('launches DRAFT campaign → ACTIVE 200', async () => {
    const activatedCampaign = {
      ...mockCampaign,
      status: 'ACTIVE',
      fbCampaignId: 'new_fb_campaign_456',
    };

    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
    (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(
      mockFacebookConnection
    );
    (prisma.facebookAdCampaign.update as jest.Mock).mockResolvedValue(activatedCampaign);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'new_fb_campaign_456' }),
    });

    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/launch`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ adAccountId: '12345678' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      status: 'ACTIVE',
      fbCampaignId: 'new_fb_campaign_456',
    });

    // Verify Facebook API was called
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining('/act_12345678/campaigns'),
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('LEAD_GENERATION'),
      })
    );
  });

  it('returns 400 when no Facebook connection exists', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
    (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/launch`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ adAccountId: '12345678' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when Facebook connection is inactive', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
    (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue({
      ...mockFacebookConnection,
      isActive: false,
    });

    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/launch`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ adAccountId: '12345678' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when campaign not found', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/launch`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ adAccountId: '12345678' });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/launch`)
      .send({ adAccountId: '12345678' });

    expect(res.status).toBe(401);
  });

  it('returns 5xx when Facebook API returns an error', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign);
    (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(
      mockFacebookConnection
    );

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 400,
      text: async () => '{"error":{"message":"Invalid ad account"}}',
    });

    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/launch`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ adAccountId: '12345678' });

    expect(res.status).toBeGreaterThanOrEqual(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/facebook/campaigns/:id/pause — pause campaign
// ---------------------------------------------------------------------------

describe('POST /api/v1/facebook/campaigns/:id/pause', () => {
  it('pauses ACTIVE campaign → PAUSED 200', async () => {
    const pausedCampaign = { ...mockActiveCampaign, status: 'PAUSED' };

    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(
      mockFacebookConnection
    );
    (prisma.facebookAdCampaign.update as jest.Mock).mockResolvedValue(pausedCampaign);

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ success: true }),
    });

    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/pause`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'PAUSED' });
  });

  it('returns 409 when campaign is not ACTIVE', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaign); // DRAFT

    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/pause`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 when campaign not found', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/pause`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.post(`/api/v1/facebook/campaigns/${CAMPAIGN_ID}/pause`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/facebook/webhook — webhook verification
// ---------------------------------------------------------------------------

describe('GET /api/v1/facebook/webhook', () => {
  it('returns challenge string when verify_token is valid', async () => {
    const res = await client.get(
      '/api/v1/facebook/webhook?hub.mode=subscribe&hub.challenge=abc123challenge&hub.verify_token=test_webhook_verify_token_secret'
    );

    expect(res.status).toBe(200);
    expect(res.text).toBe('abc123challenge');
  });

  it('returns 403 when verify_token is invalid', async () => {
    const res = await client.get(
      '/api/v1/facebook/webhook?hub.mode=subscribe&hub.challenge=abc123&hub.verify_token=WRONG_TOKEN'
    );

    expect(res.status).toBe(403);
  });

  it('returns 403 when mode is not subscribe', async () => {
    const res = await client.get(
      '/api/v1/facebook/webhook?hub.mode=unsubscribe&hub.challenge=abc123&hub.verify_token=test_webhook_verify_token_secret'
    );

    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/facebook/webhook — webhook lead ingestion
// ---------------------------------------------------------------------------

describe('POST /api/v1/facebook/webhook', () => {
  const mockLeadPayload = {
    object: 'page',
    entry: [
      {
        id: 'page_123',
        changes: [
          {
            value: {
              leadgen_id: 'lead_fb_001',
              form_id: 'form_456',
              page_id: 'page_123',
              campaign_id: 'fb_campaign_123',
              field_data: [
                { name: 'email', values: ['john.doe@example.com'] },
                { name: 'full_name', values: ['John Doe'] },
                { name: 'phone_number', values: ['555-1234'] },
              ],
            },
            field: 'leadgen',
          },
        ],
      },
    ],
  };

  it('always returns 200 to Facebook even for valid lead', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.lead.upsert as jest.Mock).mockResolvedValue({
      id: 'new-lead-id',
      organizationId: ORG_ID,
      email: 'john.doe@example.com',
      firstName: 'John',
      lastName: 'Doe',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.facebookAdCampaign.update as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.emailSequence.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post('/api/v1/facebook/webhook')
      .send(mockLeadPayload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('always returns 200 even for unknown campaign (silent fail)', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post('/api/v1/facebook/webhook')
      .send({
        object: 'page',
        entry: [
          {
            id: 'page_999',
            changes: [
              {
                value: {
                  leadgen_id: 'lead_unknown',
                  campaign_id: 'fb_nonexistent',
                  field_data: [],
                },
                field: 'leadgen',
              },
            ],
          },
        ],
      });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('always returns 200 when payload has no leads', async () => {
    const res = await client
      .post('/api/v1/facebook/webhook')
      .send({ object: 'page', entry: [] });

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });

  it('always returns 200 even when processing throws an internal error', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockRejectedValue(
      new Error('DB connection error')
    );

    const res = await client
      .post('/api/v1/facebook/webhook')
      .send(mockLeadPayload);

    expect(res.status).toBe(200);
    expect(res.body.received).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Lead ingestion edge cases
// ---------------------------------------------------------------------------

describe('Facebook lead ingestion details', () => {
  it('correctly splits full_name into firstName and lastName', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.lead.upsert as jest.Mock).mockImplementation((args) => {
      const data = args.create;
      return Promise.resolve({
        id: 'new-lead-id',
        organizationId: ORG_ID,
        email: data.email,
        firstName: data.firstName,
        lastName: data.lastName,
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    });
    (prisma.facebookAdCampaign.update as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.emailSequence.findFirst as jest.Mock).mockResolvedValue(null);

    await client
      .post('/api/v1/facebook/webhook')
      .send({
        object: 'page',
        entry: [
          {
            id: 'page_123',
            changes: [
              {
                value: {
                  leadgen_id: 'lead_001',
                  campaign_id: 'fb_campaign_123',
                  field_data: [
                    { name: 'email', values: ['alice.smith@example.com'] },
                    { name: 'full_name', values: ['Alice Marie Smith'] },
                  ],
                },
                field: 'leadgen',
              },
            ],
          },
        ],
      });

    // Wait for async processing
    await new Promise((resolve) => setTimeout(resolve, 100));

    const upsertCall = (prisma.lead.upsert as jest.Mock).mock.calls[0]?.[0];
    expect(upsertCall?.create?.firstName).toBe('Alice');
    expect(upsertCall?.create?.lastName).toBe('Marie Smith');
    expect(upsertCall?.create?.source).toBe('FACEBOOK_ADS');
    expect(upsertCall?.create?.status).toBe('NEW');
  });

  it('creates lead with source=FACEBOOK_ADS', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.lead.upsert as jest.Mock).mockResolvedValue({
      id: 'new-lead-id',
      organizationId: ORG_ID,
      email: 'test@example.com',
      firstName: 'Test',
      lastName: 'User',
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    (prisma.facebookAdCampaign.update as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.emailSequence.findFirst as jest.Mock).mockResolvedValue(null);

    await client
      .post('/api/v1/facebook/webhook')
      .send({
        object: 'page',
        entry: [
          {
            id: 'page_123',
            changes: [
              {
                value: {
                  leadgen_id: 'lead_002',
                  campaign_id: 'fb_campaign_123',
                  field_data: [
                    { name: 'email', values: ['test@example.com'] },
                    { name: 'full_name', values: ['Test User'] },
                  ],
                },
                field: 'leadgen',
              },
            ],
          },
        ],
      });

    await new Promise((resolve) => setTimeout(resolve, 100));

    const upsertCall = (prisma.lead.upsert as jest.Mock).mock.calls[0]?.[0];
    expect(upsertCall?.create?.source).toBe('FACEBOOK_ADS');
    expect(upsertCall?.create?.organizationId).toBe(ORG_ID);
    expect(upsertCall?.create?.assignedAdvisorId).toBe(ADVISOR_ID);
  });

  it('uses upsert to deduplicate leads by email in org', async () => {
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.lead.upsert as jest.Mock).mockResolvedValue({
      id: 'existing-lead-id',
      organizationId: ORG_ID,
      email: 'existing@example.com',
      firstName: 'Existing',
      lastName: 'Lead',
      createdAt: new Date('2023-01-01'), // Old creation date — duplicate
      updatedAt: new Date(), // Was just updated
    });
    (prisma.emailSequence.findFirst as jest.Mock).mockResolvedValue(null);

    await client
      .post('/api/v1/facebook/webhook')
      .send({
        object: 'page',
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: 'lead_dup',
                  campaign_id: 'fb_campaign_123',
                  field_data: [
                    { name: 'email', values: ['existing@example.com'] },
                    { name: 'full_name', values: ['Existing Lead'] },
                  ],
                },
              },
            ],
          },
        ],
      });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // The upsert was called (deduplication logic runs via Prisma upsert)
    expect(prisma.lead.upsert as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId_email: expect.objectContaining({
            email: 'existing@example.com',
          }),
        }),
      })
    );
  });

  it('increments campaign.leads counter after successful lead ingestion', async () => {
    const now = new Date();
    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.lead.upsert as jest.Mock).mockResolvedValue({
      id: 'brand-new-lead-id',
      organizationId: ORG_ID,
      email: 'newlead@example.com',
      firstName: 'New',
      lastName: 'Lead',
      createdAt: now,
      updatedAt: now, // Same timestamps = newly created
    });
    (prisma.facebookAdCampaign.update as jest.Mock).mockResolvedValue({
      ...mockActiveCampaign,
      leads: 1,
    });
    (prisma.emailSequence.findFirst as jest.Mock).mockResolvedValue(null);

    await client
      .post('/api/v1/facebook/webhook')
      .send({
        object: 'page',
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: 'lead_new_001',
                  campaign_id: 'fb_campaign_123',
                  field_data: [
                    { name: 'email', values: ['newlead@example.com'] },
                    { name: 'full_name', values: ['New Lead'] },
                  ],
                },
              },
            ],
          },
        ],
      });

    await new Promise((resolve) => setTimeout(resolve, 100));

    // Campaign update with leads increment should have been called
    const updateCall = (prisma.facebookAdCampaign.update as jest.Mock).mock.calls.find(
      (call) => call[0]?.data?.leads?.increment === 1
    );
    expect(updateCall).toBeDefined();
  });

  it('auto-enrolls lead in active email sequence when one exists', async () => {
    const now = new Date();
    const mockSequence = {
      id: 'seq-001',
      organizationId: ORG_ID,
      name: 'Welcome Sequence',
      status: 'ACTIVE',
    };

    (prisma.facebookAdCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.lead.upsert as jest.Mock).mockResolvedValue({
      id: 'enrolled-lead-id',
      organizationId: ORG_ID,
      email: 'enroll@example.com',
      firstName: 'Enroll',
      lastName: 'Me',
      createdAt: now,
      updatedAt: now,
    });
    (prisma.facebookAdCampaign.update as jest.Mock).mockResolvedValue({
      ...mockActiveCampaign,
      leads: 1,
    });
    (prisma.emailSequence.findFirst as jest.Mock).mockResolvedValue(mockSequence);
    (prisma.emailEnrollment.create as jest.Mock).mockResolvedValue({
      id: 'enrollment-id',
      sequenceId: 'seq-001',
      leadId: 'enrolled-lead-id',
    });

    await client
      .post('/api/v1/facebook/webhook')
      .send({
        object: 'page',
        entry: [
          {
            changes: [
              {
                value: {
                  leadgen_id: 'lead_enroll_001',
                  campaign_id: 'fb_campaign_123',
                  field_data: [
                    { name: 'email', values: ['enroll@example.com'] },
                    { name: 'full_name', values: ['Enroll Me'] },
                  ],
                },
              },
            ],
          },
        ],
      });

    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(prisma.emailSequence.findFirst as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          organizationId: ORG_ID,
          status: 'ACTIVE',
        }),
      })
    );

    expect(prisma.emailEnrollment.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sequenceId: 'seq-001',
          leadId: 'enrolled-lead-id',
          organizationId: ORG_ID,
        }),
      })
    );
  });
});
