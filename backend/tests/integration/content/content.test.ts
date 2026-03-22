/**
 * Integration tests for FR-002: AI Content Generation Engine
 *
 * Tests cover:
 *  - POST /api/v1/content/generate — happy path, prohibited terms, unauthenticated, OpenAI failure
 *  - GET  /api/v1/content/drafts   — paginated list
 *  - GET  /api/v1/content/drafts/:id — single draft, 404 for missing
 *  - PUT  /api/v1/content/drafts/:id — advisor can update own DRAFT, cannot update PENDING_REVIEW
 *  - DELETE /api/v1/content/drafts/:id — soft delete (status=ARCHIVED)
 *
 * Uses jest.mock to replace Prisma and OpenAI — no real DB or API calls.
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
process.env['OPENAI_MODEL'] = 'gpt-4o-mini';
process.env['LINKEDIN_CLIENT_ID'] = 'test_linkedin_client_id';
process.env['LINKEDIN_CLIENT_SECRET'] = 'test_linkedin_client_secret';
process.env['LINKEDIN_REDIRECT_URI'] = 'http://localhost:3001/api/v1/oauth/linkedin/callback';
process.env['FACEBOOK_APP_ID'] = 'test_facebook_app_id';
process.env['FACEBOOK_APP_SECRET'] = 'test_facebook_app_secret';
process.env['FACEBOOK_REDIRECT_URI'] = 'http://localhost:3001/api/v1/oauth/facebook/callback';
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
jest.mock('rate-limit-redis', () => {
  return {
    RedisStore: jest.fn().mockImplementation(() => ({
      init: jest.fn(),
      increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
      decrement: jest.fn(),
      resetKey: jest.fn(),
      resetAll: jest.fn(),
    })),
  };
});

// ---- Mock BullMQ queues to avoid real Redis connections ----
jest.mock('../../../src/queues', () => ({
  publishQueue: { add: jest.fn().mockResolvedValue({ id: 'job-1' }), close: jest.fn() },
  emailQueue: { add: jest.fn().mockResolvedValue({ id: 'job-2' }), close: jest.fn() },
  linkedinCampaignQueue: { add: jest.fn().mockResolvedValue({ id: 'job-3' }), close: jest.fn() },
  notificationQueue: { add: jest.fn().mockResolvedValue({ id: 'job-4' }), close: jest.fn() },
  queues: {},
  closeQueues: jest.fn().mockResolvedValue(undefined),
}));

// ---- Mock OpenAI — use a module-level jest.fn() inside the factory
// and retrieve it via jest.requireMock to avoid the jest.mock() hoisting issue.
jest.mock('openai', () => {
  // This factory is hoisted to the top by Jest, so we define the mock fn here.
  const mockCreate = jest.fn();
  const MockOpenAI = jest.fn().mockImplementation(() => ({
    responses: {
      create: mockCreate,
    },
  }));
  // Expose mockCreate on the constructor so we can access it after mock resolution.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (MockOpenAI as any).__mockCreate = mockCreate;
  return {
    default: MockOpenAI,
    __esModule: true,
  };
});

// Retrieve the mock create function after jest.mock() has been set up.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockOpenAICreate = (jest.requireMock('openai') as any).default.__mockCreate as jest.Mock;

// ---- Mock Prisma client ----
jest.mock('../../../src/db/client', () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    draft: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    featureFlag: {
      findUnique: jest.fn(),
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

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_DRAFT_ID = '770e8400-e29b-41d4-a716-446655440002';
const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

const mockOrg = {
  id: TEST_ORG_ID,
  name: 'Test Organization',
  slug: 'test-org',
  icpType: 'financial_advisor',
  prohibitedTerms: [],
  requiredDisclosures: {},
  complianceRules: {},
  isActive: true,
  subscriptionStatus: 'TRIALING',
  creditBalance: 0,
  settings: {},
  logoUrl: null,
  website: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockDraft = {
  id: TEST_DRAFT_ID,
  organizationId: TEST_ORG_ID,
  creatorId: TEST_USER_ID,
  reviewerId: null,
  title: 'Test prompt about growing your wealth',
  originalPrompt: 'Test prompt about growing your wealth',
  linkedinContent: 'LinkedIn content here',
  facebookContent: 'Facebook content here',
  emailContent: 'Email content here',
  adCopyContent: 'Ad copy here',
  variantsJson: {},
  flagsJson: {},
  status: 'DRAFT',
  reviewNotes: null,
  publishedChannels: [],
  aiModel: 'gpt-4o-mini',
  tokensUsed: 500,
  version: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockOpenAISuccessResponse = {
  output_text: JSON.stringify({
    linkedin: 'LinkedIn content here',
    facebook: 'Facebook content here',
    email: 'Email content here',
    adCopy: 'Ad copy here',
  }),
  usage: { total_tokens: 500 },
  model: 'gpt-4o-mini',
};

// ---------------------------------------------------------------------------
// JWT helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

beforeEach(() => {
  jest.clearAllMocks();

  // Reset OpenAI mock to success by default
  mockOpenAICreate.mockResolvedValue(mockOpenAISuccessResponse);

  // Default Prisma mock setups
  (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
  (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue(null);
  (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
  (prisma.draft.create as jest.Mock).mockResolvedValue(mockDraft);
  (prisma.draft.findUnique as jest.Mock).mockResolvedValue(mockDraft);
  (prisma.draft.findMany as jest.Mock).mockResolvedValue([mockDraft]);
  (prisma.draft.count as jest.Mock).mockResolvedValue(1);
  (prisma.draft.update as jest.Mock).mockResolvedValue(mockDraft);
});

// ---------------------------------------------------------------------------
// POST /api/v1/content/generate
// ---------------------------------------------------------------------------

describe('POST /api/v1/content/generate', () => {
  it('happy path — returns draft with all 4 content variants', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prompt: 'Help me create content about retirement planning strategies',
        title: 'Retirement Planning Content',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_DRAFT_ID,
      organizationId: TEST_ORG_ID,
      creatorId: TEST_USER_ID,
      linkedinContent: expect.any(String),
      facebookContent: expect.any(String),
      emailContent: expect.any(String),
      adCopyContent: expect.any(String),
      status: 'DRAFT',
      aiModel: expect.any(String),
      tokensUsed: expect.any(Number),
    });

    // Verify draft was created in DB
    expect(prisma.draft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: TEST_ORG_ID,
          creatorId: TEST_USER_ID,
          status: 'DRAFT',
        }),
      })
    );
  });

  it('returns 400 when prompt contains "guaranteed returns" (FINRA prohibited)', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prompt: 'We offer guaranteed returns on your investment with no risk',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
    expect(res.body.error.details).toMatchObject({
      flagged_terms: expect.arrayContaining(['guaranteed returns']),
    });

    // OpenAI should NOT have been called — scan happens pre-generation
    expect(mockOpenAICreate).not.toHaveBeenCalled();
  });

  it('returns 400 when prompt contains "risk-free" (FINRA prohibited)', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prompt: 'Our risk-free investment strategy will help you grow your wealth',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.details).toMatchObject({
      flagged_terms: expect.arrayContaining(['risk-free']),
    });
  });

  it('returns 401 when unauthenticated (no Authorization header)', async () => {
    const res = await client
      .post('/api/v1/content/generate')
      .send({
        prompt: 'Help me create content about retirement planning strategies',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 for prompt too short (under 10 chars)', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ prompt: 'short' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 502 when OpenAI API call fails', async () => {
    // Make the OpenAI create() function throw
    mockOpenAICreate.mockRejectedValue(new Error('OpenAI API is unavailable'));

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prompt: 'Help me create content about retirement planning for high net worth clients',
      });

    expect(res.status).toBe(502);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_GATEWAY');
  });

  it('stores draft with correct fields after successful generation', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    await client
      .post('/api/v1/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prompt: 'Content about wealth management strategies for affluent clients',
        title: 'Wealth Management Post',
      });

    expect(prisma.draft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: TEST_ORG_ID,
          creatorId: TEST_USER_ID,
          title: 'Wealth Management Post',
          status: 'DRAFT',
          linkedinContent: expect.any(String),
          facebookContent: expect.any(String),
          emailContent: expect.any(String),
          adCopyContent: expect.any(String),
          tokensUsed: 500,
        }),
      })
    );
  });

  it('trims overlong generated content before persistence and avoids duplicating channel disclosures', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);
    const longParagraph = 'Steady retirement planning matters during volatile markets. '.repeat(80);

    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrg,
      requiredDisclosures: {
        linkedin: 'Past performance is not indicative of future results. Investments involve risk.',
        facebook: 'Past performance is not indicative of future results. Investments involve risk.',
        email: 'This communication is for informational purposes only and does not constitute investment advice.',
        adCopy: 'Investing involves risk. Past performance does not guarantee future results.',
      },
    });

    mockOpenAICreate.mockResolvedValue({
      output_text: JSON.stringify({
        linkedin: `${longParagraph}\n\nPast performance is not indicative of future results. Investments involve risk.\nPast performance is not indicative of future results. Investments involve risk.`,
        facebook: `${longParagraph}\n\nPast performance is not indicative of future results. Investments involve risk.`,
        email: `${longParagraph}\n\nThis communication is for informational purposes only and does not constitute investment advice.`,
        adCopy: `${longParagraph}\n\nInvesting involves risk. Past performance does not guarantee future results.`,
      }),
      usage: { total_tokens: 500 },
      model: 'gpt-4o-mini',
    });

    await client
      .post('/api/v1/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prompt: 'Create concise compliant retirement planning content for volatile markets',
        title: 'Volatility Content',
      });

    expect(prisma.draft.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          linkedinContent: expect.any(String),
          facebookContent: expect.any(String),
          emailContent: expect.any(String),
          adCopyContent: expect.any(String),
        }),
      })
    );

    const createArg = (prisma.draft.create as jest.Mock).mock.calls.at(-1)?.[0];
    expect(createArg.data.linkedinContent.length).toBeLessThanOrEqual(1300);
    expect(createArg.data.facebookContent.length).toBeLessThanOrEqual(1500);
    expect(createArg.data.emailContent.length).toBeLessThanOrEqual(2200);
    expect(createArg.data.adCopyContent.length).toBeLessThanOrEqual(500);
    expect(createArg.data.linkedinContent.match(/Past performance is not indicative of future results\. Investments involve risk\./g)).toHaveLength(1);
  });

  it('writes an audit trail after successful generation', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    await client
      .post('/api/v1/content/generate')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        prompt: 'Content about wealth management strategies for high net worth clients',
      });

    expect(prisma.auditTrail.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          entityType: 'Draft',
          action: 'CREATED',
          actorId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
        }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/content/drafts
// ---------------------------------------------------------------------------

describe('GET /api/v1/content/drafts', () => {
  it('returns paginated list of drafts for the org', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get('/api/v1/content/drafts')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 20,
      totalCount: expect.any(Number),
      totalPages: expect.any(Number),
      hasNextPage: expect.any(Boolean),
      hasPreviousPage: expect.any(Boolean),
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/content/drafts');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('advisors see only their own drafts (creatorId filter applied)', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    await client
      .get('/api/v1/content/drafts')
      .set('Authorization', `Bearer ${accessToken}`);

    // Advisors should have creatorId filter applied
    expect(prisma.draft.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          creatorId: TEST_USER_ID,
          organizationId: TEST_ORG_ID,
        }),
      })
    );
  });

  it('supports pagination parameters', async () => {
    (prisma.draft.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.draft.count as jest.Mock).mockResolvedValue(0);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get('/api/v1/content/drafts?page=2&limit=10')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.meta.page).toBe(2);
    expect(res.body.meta.limit).toBe(10);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/content/drafts/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/content/drafts/:id', () => {
  it('returns the draft when found and user has access', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_DRAFT_ID,
      organizationId: TEST_ORG_ID,
    });
  });

  it('returns 404 for non-existent draft', async () => {
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get('/api/v1/content/drafts/non-existent-id')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 404 for draft belonging to a different org', async () => {
    const differentOrgDraft = { ...mockDraft, organizationId: 'different-org-id' };
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(differentOrgDraft);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor', TEST_ORG_ID);

    const res = await client
      .get(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    // Should appear as 404 to prevent leaking existence of cross-org resources
    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get(`/api/v1/content/drafts/${TEST_DRAFT_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/content/drafts/:id
// ---------------------------------------------------------------------------

describe('PUT /api/v1/content/drafts/:id', () => {
  it('advisor can update their own DRAFT-status draft', async () => {
    const updatedDraft = {
      ...mockDraft,
      linkedinContent: 'Updated LinkedIn content',
      version: 2,
    };
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .put(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ linkedinContent: 'Updated LinkedIn content' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.linkedinContent).toBe('Updated LinkedIn content');
  });

  it('advisor cannot update a PENDING_REVIEW draft (returns 403)', async () => {
    const pendingReviewDraft = { ...mockDraft, status: 'PENDING_REVIEW' };
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(pendingReviewDraft);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .put(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ linkedinContent: 'Trying to update a pending review draft' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it("advisor cannot update another advisor's draft (returns 403)", async () => {
    const otherUserDraft = { ...mockDraft, creatorId: 'other-user-id' };
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(otherUserDraft);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .put(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ linkedinContent: "Trying to update someone else's draft" });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('admin can update any draft regardless of status', async () => {
    const pendingReviewDraft = { ...mockDraft, status: 'PENDING_REVIEW' };
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(pendingReviewDraft);
    (prisma.draft.update as jest.Mock).mockResolvedValue({
      ...pendingReviewDraft,
      linkedinContent: 'Admin updated content',
    });

    const accessToken = makeAccessToken(TEST_USER_ID, 'org_admin');

    const res = await client
      .put(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ linkedinContent: 'Admin updated content' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 404 for non-existent draft', async () => {
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .put('/api/v1/content/drafts/non-existent-id')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ linkedinContent: 'Updated content' });

    expect(res.status).toBe(404);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client
      .put(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .send({ linkedinContent: 'Updated content' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/content/drafts/:id
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/content/drafts/:id', () => {
  it('advisor can soft-delete their own DRAFT-status draft (status set to ARCHIVED)', async () => {
    const archivedDraft = { ...mockDraft, status: 'ARCHIVED' };
    (prisma.draft.update as jest.Mock).mockResolvedValue(archivedDraft);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .delete(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify that the update set status to ARCHIVED (soft delete)
    expect(prisma.draft.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_DRAFT_ID },
        data: expect.objectContaining({
          status: 'ARCHIVED',
        }),
      })
    );
  });

  it('returns 404 for non-existent draft', async () => {
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .delete('/api/v1/content/drafts/non-existent-id')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it("advisor cannot delete another user's draft (returns 403)", async () => {
    const otherUserDraft = { ...mockDraft, creatorId: 'other-user-id' };
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(otherUserDraft);

    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .delete(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('admin can delete any draft in the org', async () => {
    const otherUserDraft = { ...mockDraft, creatorId: 'other-user-id' };
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(otherUserDraft);
    (prisma.draft.update as jest.Mock).mockResolvedValue({ ...otherUserDraft, status: 'ARCHIVED' });

    const accessToken = makeAccessToken(TEST_USER_ID, 'org_admin');

    const res = await client
      .delete(`/api/v1/content/drafts/${TEST_DRAFT_ID}`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.delete(`/api/v1/content/drafts/${TEST_DRAFT_ID}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/content/drafts/:id/archive
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/content/drafts/:id/archive', () => {
  it('admin can archive a draft', async () => {
    const archivedDraft = { ...mockDraft, status: 'ARCHIVED' };
    (prisma.draft.update as jest.Mock).mockResolvedValue(archivedDraft);

    const accessToken = makeAccessToken(TEST_USER_ID, 'org_admin');

    const res = await client
      .patch(`/api/v1/content/drafts/${TEST_DRAFT_ID}/archive`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('advisor cannot use the archive endpoint (returns 403)', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID, 'advisor');

    const res = await client
      .patch(`/api/v1/content/drafts/${TEST_DRAFT_ID}/archive`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when draft is already archived', async () => {
    const alreadyArchivedDraft = { ...mockDraft, status: 'ARCHIVED' };
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(alreadyArchivedDraft);

    const accessToken = makeAccessToken(TEST_USER_ID, 'org_admin');

    const res = await client
      .patch(`/api/v1/content/drafts/${TEST_DRAFT_ID}/archive`)
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});
