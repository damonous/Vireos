/**
 * Integration tests for FR-005: LinkedIn Messaging Campaigns
 *
 * Tests cover:
 *  - POST /api/v1/linkedin/campaigns            — create campaign
 *  - GET  /api/v1/linkedin/campaigns            — list campaigns (paginated, advisor scoped)
 *  - GET  /api/v1/linkedin/campaigns/:id        — get single campaign
 *  - PUT  /api/v1/linkedin/campaigns/:id        — update campaign
 *  - DELETE /api/v1/linkedin/campaigns/:id      — delete campaign
 *  - POST /api/v1/linkedin/campaigns/:id/activate — activate campaign
 *  - POST /api/v1/linkedin/campaigns/:id/pause    — pause campaign
 *  - POST /api/v1/linkedin/campaigns/:id/enrollments — enroll leads
 *  - POST /api/v1/linkedin/webhook/reply        — detect reply (public endpoint)
 *  - processLinkedInCampaignJob unit test
 *
 * All external dependencies (Prisma, BullMQ, fetch) are mocked.
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
process.env['MAILGUN_API_KEY'] = 'key-test_fake_key_for_testing';
process.env['MAILGUN_DOMAIN'] = 'mg.vireos.com';
process.env['MAILGUN_FROM_EMAIL'] = 'test@vireos.com';
process.env['MAILGUN_FROM_NAME'] = 'Vireos Platform';
process.env['STRIPE_SECRET_KEY'] = 'sk_test_fake_stripe_key';
process.env['STRIPE_WEBHOOK_SECRET'] = 'whsec_test_fake_webhook_secret';
process.env['AWS_ACCESS_KEY_ID'] = 'AKIAIOSFODNN7EXAMPLE';
process.env['AWS_SECRET_ACCESS_KEY'] = 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY';
process.env['AWS_S3_BUCKET'] = 'vireos-test-bucket';
process.env['AWS_REGION'] = 'us-east-1';
process.env['API_BASE_URL'] = 'http://localhost:3001';
process.env['CORS_ORIGINS'] = 'http://localhost:3001';

// ---- Mock ioredis ----
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

// ---- Mock BullMQ Queue ----
const mockQueueAdd = jest.fn().mockResolvedValue({ id: 'mock-job-id' });
jest.mock('bullmq', () => {
  const mockQueue = {
    add: mockQueueAdd,
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnThis(),
  };
  const mockWorker = {
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation(() => mockWorker),
    Job: jest.fn(),
  };
});

jest.mock('form-data', () => jest.fn());
jest.mock('mailgun.js', () =>
  jest.fn().mockImplementation(() => ({
    client: jest.fn().mockReturnValue({
      messages: {
        create: jest.fn().mockResolvedValue({
          status: 200,
          id: 'mock-mailgun-message-id-12345',
          message: 'Queued. Thank you.',
        }),
      },
    }),
  }))
);

// ---- Mock OpenAI ----
jest.mock('openai', () => {
  return {
    default: jest.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: jest.fn().mockResolvedValue({
            choices: [{ message: { content: 'Mock AI content' } }],
          }),
        },
      },
    })),
  };
});

// ---- Mock global fetch for LinkedIn API calls ----
const mockFetch = jest.fn();
global.fetch = mockFetch;

// ---- Mock Prisma client ----
jest.mock('../../../src/db/client', () => ({
  prisma: {
    linkedInCampaign: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    linkedInCampaignEnrollment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    socialConnection: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    notification: {
      create: jest.fn(),
    },
    auditTrail: {
      create: jest.fn().mockResolvedValue({}),
    },
    emailTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    emailSequence: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    emailSequenceStep: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    emailEnrollment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailSend: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  default: {},
}));

import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/client';
import { linkedinCampaignService } from '../../../src/services/linkedin-campaign.service';
import { encrypt } from '../../../src/utils/crypto';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_ADVISOR_ID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_ADVISOR2_ID = '770e8400-e29b-41d4-a716-446655440009';
const TEST_ADMIN_ID = '880e8400-e29b-41d4-a716-446655440008';
const TEST_CAMPAIGN_ID = '770e8400-e29b-41d4-a716-446655440002';
const TEST_LEAD_ID = 'aa0e8400-e29b-41d4-a716-446655440005';
const TEST_LEAD2_ID = 'bb0e8400-e29b-41d4-a716-446655440006';
const TEST_ENROLLMENT_ID = 'cc0e8400-e29b-41d4-a716-446655440007';
const TEST_SOCIAL_CONN_ID = 'dd0e8400-e29b-41d4-a716-446655440008';

const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

function makeAccessToken(
  userId: string,
  role = 'advisor',
  orgId = TEST_ORG_ID
): string {
  return jwt.sign(
    {
      sub: userId,
      orgId,
      role,
      email: 'testuser@example.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

const mockSteps = [
  { stepNumber: 1, messageTemplate: 'Hello {{firstName}}, I saw your profile!', delayDays: 0 },
  { stepNumber: 2, messageTemplate: 'Following up on my previous message.', delayDays: 3 },
];

const mockDraftCampaign = {
  id: TEST_CAMPAIGN_ID,
  organizationId: TEST_ORG_ID,
  advisorId: TEST_ADVISOR_ID,
  name: 'Q1 Outreach Campaign',
  description: 'Targeting financial advisors',
  status: 'DRAFT',
  steps: mockSteps,
  targetCriteria: {},
  dailyLimit: 20,
  pauseOnReply: true,
  businessHoursOnly: true,
  totalEnrolled: 0,
  totalCompleted: 0,
  totalReplied: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockActiveCampaign = {
  ...mockDraftCampaign,
  status: 'ACTIVE',
};

const mockSocialConnection = {
  id: TEST_SOCIAL_CONN_ID,
  userId: TEST_ADVISOR_ID,
  organizationId: TEST_ORG_ID,
  platform: 'LINKEDIN',
  accessToken: encrypt('test-linkedin-access-token-123'),
  refreshToken: null,
  tokenExpiresAt: null,
  platformUserId: 'linkedin-user-123',
  platformUsername: 'testadvisor',
  scopes: ['r_liteprofile', 'w_member_social'],
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockLead = {
  id: TEST_LEAD_ID,
  organizationId: TEST_ORG_ID,
  assignedAdvisorId: TEST_ADVISOR_ID,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: null,
  company: 'Acme Corp',
  title: 'CEO',
  linkedinUrl: 'ACoAABRmvhABXY12345',
  source: 'MANUAL_IMPORT',
  status: 'NEW',
  isUnsubscribed: false,
  unsubscribedAt: null,
  customFields: {},
  notes: null,
  campaignId: null,
  prospectRequestId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockLeadNoLinkedIn = {
  ...mockLead,
  id: TEST_LEAD2_ID,
  linkedinUrl: null,
};

const mockEnrollment = {
  id: TEST_ENROLLMENT_ID,
  campaignId: TEST_CAMPAIGN_ID,
  leadId: TEST_LEAD_ID,
  organizationId: TEST_ORG_ID,
  currentStep: 1,
  status: 'ACTIVE',
  nextSendAt: new Date(Date.now() + 60000),
  repliedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockCampaignWithCount = {
  ...mockDraftCampaign,
  _count: { enrollments: 0 },
};

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

beforeEach(() => {
  jest.clearAllMocks();
  mockQueueAdd.mockResolvedValue({ id: 'mock-job-id' });
  (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
  (prisma.notification.create as jest.Mock).mockResolvedValue({});
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (operations: Promise<unknown>[]) => Promise.all(operations)
  );
});

// =============================================================================
// POST /api/v1/linkedin/campaigns
// =============================================================================

describe('POST /api/v1/linkedin/campaigns', () => {
  it('creates a campaign with 201 and returns campaign data', async () => {
    (prisma.socialConnection.findFirst as jest.Mock).mockResolvedValue(mockSocialConnection);
    (prisma.linkedInCampaign.create as jest.Mock).mockResolvedValue(mockDraftCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/linkedin/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Q1 Outreach Campaign',
        description: 'Targeting financial advisors',
        steps: [
          { messageTemplate: 'Hello, I saw your profile!', delayDays: 0 },
          { messageTemplate: 'Following up on my previous message.', delayDays: 3 },
        ],
        dailyLimit: 20,
        pauseOnReply: true,
        businessHoursOnly: true,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_CAMPAIGN_ID,
      name: 'Q1 Outreach Campaign',
      status: 'DRAFT',
    });

    const createCall = (prisma.linkedInCampaign.create as jest.Mock).mock.calls[0]?.[0];
    expect(createCall?.data?.organizationId).toBe(TEST_ORG_ID);
    expect(createCall?.data?.advisorId).toBe(TEST_USER_ID);
    expect(createCall?.data?.status).toBe('DRAFT');
  });

  it('returns 422 for missing name', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/linkedin/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        steps: [{ messageTemplate: 'Hello!', delayDays: 0 }],
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for steps array exceeding max (5)', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/linkedin/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Too Many Steps',
        steps: Array.from({ length: 6 }, (_, i) => ({
          messageTemplate: `Step ${i + 1}`,
          delayDays: i,
        })),
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when advisor has no LinkedIn connection', async () => {
    (prisma.socialConnection.findFirst as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/linkedin/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Campaign',
        steps: [{ messageTemplate: 'Hello!', delayDays: 0 }],
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client
      .post('/api/v1/linkedin/campaigns')
      .send({
        name: 'Test Campaign',
        steps: [{ messageTemplate: 'Hello!', delayDays: 0 }],
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 for VIEWER role', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID, 'viewer');

    const res = await client
      .post('/api/v1/linkedin/campaigns')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Campaign',
        steps: [{ messageTemplate: 'Hello!', delayDays: 0 }],
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// GET /api/v1/linkedin/campaigns
// =============================================================================

describe('GET /api/v1/linkedin/campaigns', () => {
  it('returns paginated campaigns list for advisor', async () => {
    (prisma.linkedInCampaign.findMany as jest.Mock).mockResolvedValue([mockDraftCampaign]);
    (prisma.linkedInCampaign.count as jest.Mock).mockResolvedValue(1);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get('/api/v1/linkedin/campaigns')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.data).toHaveLength(1);
    expect(res.body.data.data[0]).toMatchObject({
      id: TEST_CAMPAIGN_ID,
      name: 'Q1 Outreach Campaign',
    });
    expect(res.body.data.pagination).toMatchObject({
      page: 1,
      totalCount: 1,
    });
  });

  it('scopes advisor to only their own campaigns', async () => {
    (prisma.linkedInCampaign.findMany as jest.Mock).mockResolvedValue([mockDraftCampaign]);
    (prisma.linkedInCampaign.count as jest.Mock).mockResolvedValue(1);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    await client
      .get('/api/v1/linkedin/campaigns')
      .set('Authorization', `Bearer ${accessToken}`);

    const findManyCall = (prisma.linkedInCampaign.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.advisorId).toBe(TEST_USER_ID);
  });

  it('admin can see all campaigns in org (no advisorId filter)', async () => {
    (prisma.linkedInCampaign.findMany as jest.Mock).mockResolvedValue([mockDraftCampaign]);
    (prisma.linkedInCampaign.count as jest.Mock).mockResolvedValue(1);

    const accessToken = makeAccessToken(TEST_ADMIN_ID, 'org_admin');

    await client
      .get('/api/v1/linkedin/campaigns')
      .set('Authorization', `Bearer ${accessToken}`);

    const findManyCall = (prisma.linkedInCampaign.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.advisorId).toBeUndefined();
  });

  it('filters by status when provided', async () => {
    (prisma.linkedInCampaign.findMany as jest.Mock).mockResolvedValue([mockActiveCampaign]);
    (prisma.linkedInCampaign.count as jest.Mock).mockResolvedValue(1);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get('/api/v1/linkedin/campaigns?status=ACTIVE')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    const findManyCall = (prisma.linkedInCampaign.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.status).toBe('ACTIVE');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client.get('/api/v1/linkedin/campaigns');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// GET /api/v1/linkedin/campaigns/:campaignId
// =============================================================================

describe('GET /api/v1/linkedin/campaigns/:campaignId', () => {
  it('returns campaign with enrollment count for campaign owner', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockCampaignWithCount);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_CAMPAIGN_ID,
      name: 'Q1 Outreach Campaign',
      status: 'DRAFT',
    });
  });

  it('returns 404 when campaign not found', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when advisor tries to access another advisor campaign', async () => {
    // Campaign belongs to a different advisor
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue({
      ...mockCampaignWithCount,
      advisorId: TEST_ADVISOR2_ID, // Different advisor
    });

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor'); // TEST_USER_ID != TEST_ADVISOR2_ID

    const res = await client
      .get(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client.get(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// PUT /api/v1/linkedin/campaigns/:campaignId
// =============================================================================

describe('PUT /api/v1/linkedin/campaigns/:campaignId', () => {
  it('updates a DRAFT campaign and returns 200', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockDraftCampaign);
    const updatedCampaign = {
      ...mockDraftCampaign,
      name: 'Updated Campaign Name',
      dailyLimit: 30,
    };
    (prisma.linkedInCampaign.update as jest.Mock).mockResolvedValue(updatedCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .put(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Updated Campaign Name', dailyLimit: 30 });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      name: 'Updated Campaign Name',
      dailyLimit: 30,
    });
  });

  it('returns 409 when trying to update an ACTIVE campaign', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .put(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Trying to update active' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 403 when advisor tries to update another advisor campaign', async () => {
    // Campaign belongs to TEST_ADVISOR2_ID but request is from TEST_USER_ID
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue({
      ...mockDraftCampaign,
      advisorId: TEST_ADVISOR2_ID,
    });

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .put(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Unauthorized update' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid dailyLimit (0 is too low)', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .put(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ dailyLimit: 0 });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// DELETE /api/v1/linkedin/campaigns/:campaignId
// =============================================================================

describe('DELETE /api/v1/linkedin/campaigns/:campaignId', () => {
  it('deletes a DRAFT campaign and returns 204', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockDraftCampaign);
    (prisma.linkedInCampaign.delete as jest.Mock).mockResolvedValue(mockDraftCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .delete(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(204);
    expect(prisma.linkedInCampaign.delete).toHaveBeenCalledWith({
      where: { id: TEST_CAMPAIGN_ID },
    });
  });

  it('returns 409 when trying to delete an ACTIVE campaign', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .delete(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 403 when advisor tries to delete another advisor campaign', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue({
      ...mockDraftCampaign,
      advisorId: TEST_ADVISOR2_ID,
    });

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .delete(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client.delete(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// POST /api/v1/linkedin/campaigns/:campaignId/activate
// =============================================================================

describe('POST /api/v1/linkedin/campaigns/:campaignId/activate', () => {
  it('transitions DRAFT → ACTIVE and returns 200', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockDraftCampaign);
    (prisma.socialConnection.findFirst as jest.Mock).mockResolvedValue(mockSocialConnection);
    (prisma.linkedInCampaign.update as jest.Mock).mockResolvedValue(mockActiveCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/activate`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('ACTIVE');

    const updateCall = (prisma.linkedInCampaign.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.status).toBe('ACTIVE');
  });

  it('returns 409 when campaign is already ACTIVE', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/activate`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 400 when advisor has no active LinkedIn connection', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockDraftCampaign);
    (prisma.socialConnection.findFirst as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/activate`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 404 when campaign not found', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/activate`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/activate`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// POST /api/v1/linkedin/campaigns/:campaignId/pause
// =============================================================================

describe('POST /api/v1/linkedin/campaigns/:campaignId/pause', () => {
  it('transitions ACTIVE → PAUSED and returns 200', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    const pausedCampaign = { ...mockActiveCampaign, status: 'PAUSED' };
    (prisma.linkedInCampaign.update as jest.Mock).mockResolvedValue(pausedCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/pause`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PAUSED');
  });

  it('returns 409 when campaign is not ACTIVE (DRAFT cannot be paused)', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockDraftCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/pause`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 404 when campaign not found', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/pause`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client.post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/pause`);
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// POST /api/v1/linkedin/campaigns/:campaignId/enrollments
// =============================================================================

describe('POST /api/v1/linkedin/campaigns/:campaignId/enrollments', () => {
  it('enrolls 2 valid leads and returns enrolled count 200', async () => {
    const mockLead2 = { ...mockLead, id: TEST_LEAD2_ID, linkedinUrl: 'ACoAABRmvhABXY99999' };

    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    // For each lead: findFirst, findUnique (existing enrollment check), create
    (prisma.lead.findFirst as jest.Mock)
      .mockResolvedValueOnce(mockLead)
      .mockResolvedValueOnce(mockLead2);
    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.linkedInCampaignEnrollment.create as jest.Mock).mockResolvedValue(mockEnrollment);
    (prisma.linkedInCampaign.update as jest.Mock).mockResolvedValue({
      ...mockActiveCampaign,
      totalEnrolled: 2,
    });

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/enrollments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ leadIds: [TEST_LEAD_ID, TEST_LEAD2_ID] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.enrolled).toBe(2);
    expect(res.body.data.skipped).toBe(0);
  });

  it('skips lead without linkedinUrl and includes in errors', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLeadNoLinkedIn);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/enrollments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ leadIds: [TEST_LEAD2_ID] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.enrolled).toBe(0);
    expect(res.body.data.skipped).toBe(1);
    expect(res.body.data.errors.length).toBeGreaterThan(0);
    expect(res.body.data.errors[0]).toContain('LinkedIn');
  });

  it('skips lead already actively enrolled', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    // Return existing active enrollment
    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/enrollments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ leadIds: [TEST_LEAD_ID] });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.enrolled).toBe(0);
    expect(res.body.data.skipped).toBe(1);
  });

  it('returns 409 when campaign is not ACTIVE', async () => {
    (prisma.linkedInCampaign.findFirst as jest.Mock).mockResolvedValue(mockDraftCampaign);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/enrollments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ leadIds: [TEST_LEAD_ID] });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/enrollments`)
      .send({ leadIds: [TEST_LEAD_ID] });
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid UUID in leadIds', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/linkedin/campaigns/${TEST_CAMPAIGN_ID}/enrollments`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ leadIds: ['not-a-uuid'] });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

// =============================================================================
// POST /api/v1/linkedin/webhook/reply
// =============================================================================

describe('POST /api/v1/linkedin/webhook/reply', () => {
  it('marks enrollment PAUSED and sets repliedAt — public endpoint (no auth required)', async () => {
    const pausedEnrollment = {
      ...mockEnrollment,
      status: 'PAUSED',
      repliedAt: new Date('2024-01-15T10:00:00.000Z'),
      campaignId: TEST_CAMPAIGN_ID,
    };

    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment);
    (prisma.linkedInCampaignEnrollment.update as jest.Mock).mockResolvedValue(pausedEnrollment);
    (prisma.linkedInCampaign.update as jest.Mock).mockResolvedValue({
      ...mockActiveCampaign,
      totalReplied: 1,
    });
    (prisma.linkedInCampaign.findUnique as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.notification.create as jest.Mock).mockResolvedValue({});

    const res = await client
      .post('/api/v1/linkedin/webhook/reply')
      .send({
        enrollmentId: TEST_ENROLLMENT_ID,
        repliedAt: '2024-01-15T10:00:00.000Z',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify enrollment was updated to PAUSED
    const updateCall = (prisma.linkedInCampaignEnrollment.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.status).toBe('PAUSED');
    expect(updateCall?.data?.repliedAt).toBeDefined();

    // Verify campaign totalReplied was incremented
    const campaignUpdateCall = (prisma.linkedInCampaign.update as jest.Mock).mock.calls[0]?.[0];
    expect(campaignUpdateCall?.data?.totalReplied).toEqual({ increment: 1 });
  });

  it('creates a notification for the advisor when a reply is detected', async () => {
    const pausedEnrollment = {
      ...mockEnrollment,
      status: 'PAUSED',
      repliedAt: new Date('2024-01-15T10:00:00.000Z'),
    };

    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment);
    (prisma.linkedInCampaignEnrollment.update as jest.Mock).mockResolvedValue(pausedEnrollment);
    (prisma.linkedInCampaign.update as jest.Mock).mockResolvedValue({
      ...mockActiveCampaign,
      totalReplied: 1,
    });
    (prisma.linkedInCampaign.findUnique as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.notification.create as jest.Mock).mockResolvedValue({});

    await client
      .post('/api/v1/linkedin/webhook/reply')
      .send({
        enrollmentId: TEST_ENROLLMENT_ID,
        repliedAt: '2024-01-15T10:00:00.000Z',
      });

    expect(prisma.notification.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: TEST_ADVISOR_ID,
          body: expect.stringContaining('replied'),
        }),
      })
    );
  });

  it('returns 422 for invalid enrollmentId (not a UUID)', async () => {
    const res = await client
      .post('/api/v1/linkedin/webhook/reply')
      .send({
        enrollmentId: 'not-a-valid-uuid',
        repliedAt: '2024-01-15T10:00:00.000Z',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for invalid repliedAt (not ISO datetime)', async () => {
    const res = await client
      .post('/api/v1/linkedin/webhook/reply')
      .send({
        enrollmentId: TEST_ENROLLMENT_ID,
        repliedAt: 'not-a-date',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when enrollment not found', async () => {
    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post('/api/v1/linkedin/webhook/reply')
      .send({
        enrollmentId: TEST_ENROLLMENT_ID,
        repliedAt: '2024-01-15T10:00:00.000Z',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// processLinkedInCampaignJob unit tests
// =============================================================================

describe('processLinkedInCampaignJob', () => {
  const makeJob = (data: Record<string, unknown>) => ({
    id: 'test-job-id',
    data,
  });

  beforeEach(() => {
    // Reset mockFetch
    mockFetch.mockReset();
  });

  it('sends message via LinkedIn API and advances to next step', async () => {
    const campaignWithTwoSteps = {
      ...mockActiveCampaign,
      steps: mockSteps,
    };

    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment);
    (prisma.linkedInCampaign.findUnique as jest.Mock).mockResolvedValue(campaignWithTwoSteps);
    (prisma.linkedInCampaignEnrollment.count as jest.Mock).mockResolvedValue(0); // Under daily limit
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(mockLead);
    (prisma.socialConnection.findFirst as jest.Mock).mockResolvedValue(mockSocialConnection);
    (prisma.linkedInCampaignEnrollment.update as jest.Mock).mockResolvedValue({
      ...mockEnrollment,
      currentStep: 2,
    });

    // Mock successful LinkedIn API response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue(''),
    });

    const job = makeJob({
      campaignId: TEST_CAMPAIGN_ID,
      orgId: TEST_ORG_ID,
      advisorId: TEST_ADVISOR_ID,
      recipientLinkedInId: mockLead.linkedinUrl,
      messageTemplateId: mockSteps[0]!.messageTemplate,
      enrollmentId: TEST_ENROLLMENT_ID,
    });

    await linkedinCampaignService.processLinkedInCampaignJob(job as any);

    // Verify LinkedIn API was called
    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.linkedin.com/v2/messages',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          'Authorization': expect.stringContaining('Bearer'),
          'Content-Type': 'application/json',
        }),
        body: expect.stringContaining(mockLead.linkedinUrl),
      })
    );

    // Verify enrollment was advanced to step 2
    const updateCall = (prisma.linkedInCampaignEnrollment.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.currentStep).toBe(2);
  });

  it('marks enrollment COMPLETED when last step is processed', async () => {
    // Campaign with only 1 step, enrollment already on step 1
    const singleStepCampaign = {
      ...mockActiveCampaign,
      steps: [mockSteps[0]],
    };
    const step1Enrollment = { ...mockEnrollment, currentStep: 1 };

    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(step1Enrollment);
    (prisma.linkedInCampaign.findUnique as jest.Mock).mockResolvedValue(singleStepCampaign);
    (prisma.linkedInCampaignEnrollment.count as jest.Mock).mockResolvedValue(0);
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(mockLead);
    (prisma.socialConnection.findFirst as jest.Mock).mockResolvedValue(mockSocialConnection);
    (prisma.linkedInCampaignEnrollment.update as jest.Mock).mockResolvedValue({
      ...step1Enrollment,
      status: 'COMPLETED',
    });
    (prisma.linkedInCampaign.update as jest.Mock).mockResolvedValue({
      ...singleStepCampaign,
      totalCompleted: 1,
    });

    // Mock successful LinkedIn API response
    mockFetch.mockResolvedValue({
      ok: true,
      status: 201,
      text: jest.fn().mockResolvedValue(''),
    });

    const job = makeJob({
      campaignId: TEST_CAMPAIGN_ID,
      orgId: TEST_ORG_ID,
      advisorId: TEST_ADVISOR_ID,
      recipientLinkedInId: mockLead.linkedinUrl,
      messageTemplateId: mockSteps[0]!.messageTemplate,
      enrollmentId: TEST_ENROLLMENT_ID,
    });

    await linkedinCampaignService.processLinkedInCampaignJob(job as any);

    // Verify enrollment was marked COMPLETED
    const enrollUpdateCall = (prisma.linkedInCampaignEnrollment.update as jest.Mock).mock.calls[0]?.[0];
    expect(enrollUpdateCall?.data?.status).toBe('COMPLETED');
    expect(enrollUpdateCall?.data?.nextSendAt).toBeNull();

    // Verify campaign totalCompleted was incremented
    const campaignUpdateCall = (prisma.linkedInCampaign.update as jest.Mock).mock.calls[0]?.[0];
    expect(campaignUpdateCall?.data?.totalCompleted).toEqual({ increment: 1 });
  });

  it('skips processing when enrollment is not ACTIVE', async () => {
    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue({
      ...mockEnrollment,
      status: 'COMPLETED',
    });

    const job = makeJob({
      campaignId: TEST_CAMPAIGN_ID,
      orgId: TEST_ORG_ID,
      advisorId: TEST_ADVISOR_ID,
      recipientLinkedInId: mockLead.linkedinUrl,
      messageTemplateId: mockSteps[0]!.messageTemplate,
      enrollmentId: TEST_ENROLLMENT_ID,
    });

    await linkedinCampaignService.processLinkedInCampaignJob(job as any);

    // LinkedIn API should NOT be called
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('throws error when LinkedIn API returns non-OK response (triggers BullMQ retry)', async () => {
    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment);
    (prisma.linkedInCampaign.findUnique as jest.Mock).mockResolvedValue(mockActiveCampaign);
    (prisma.linkedInCampaignEnrollment.count as jest.Mock).mockResolvedValue(0);
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(mockLead);
    (prisma.socialConnection.findFirst as jest.Mock).mockResolvedValue(mockSocialConnection);

    // Mock failed LinkedIn API response
    mockFetch.mockResolvedValue({
      ok: false,
      status: 429,
      text: jest.fn().mockResolvedValue('Rate limit exceeded'),
    });

    const job = makeJob({
      campaignId: TEST_CAMPAIGN_ID,
      orgId: TEST_ORG_ID,
      advisorId: TEST_ADVISOR_ID,
      recipientLinkedInId: mockLead.linkedinUrl,
      messageTemplateId: mockSteps[0]!.messageTemplate,
      enrollmentId: TEST_ENROLLMENT_ID,
    });

    await expect(
      linkedinCampaignService.processLinkedInCampaignJob(job as any)
    ).rejects.toThrow(/LinkedIn API error 429/);
  });

  it('skips processing when daily limit is reached', async () => {
    (prisma.linkedInCampaignEnrollment.findUnique as jest.Mock).mockResolvedValue(mockEnrollment);
    (prisma.linkedInCampaign.findUnique as jest.Mock).mockResolvedValue({
      ...mockActiveCampaign,
      dailyLimit: 20,
    });
    // Simulate daily limit already reached
    (prisma.linkedInCampaignEnrollment.count as jest.Mock).mockResolvedValue(20);

    const job = makeJob({
      campaignId: TEST_CAMPAIGN_ID,
      orgId: TEST_ORG_ID,
      advisorId: TEST_ADVISOR_ID,
      recipientLinkedInId: mockLead.linkedinUrl,
      messageTemplateId: mockSteps[0]!.messageTemplate,
      enrollmentId: TEST_ENROLLMENT_ID,
    });

    await linkedinCampaignService.processLinkedInCampaignJob(job as any);

    // LinkedIn API should NOT be called when at daily limit
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
