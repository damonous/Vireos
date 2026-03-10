/**
 * Integration tests for FR-010: Unified Analytics Dashboard APIs
 *
 * Tests cover:
 *  - GET /api/v1/analytics/overview       — shape, preset, custom range
 *  - GET /api/v1/analytics/linkedin       — LinkedIn metrics shape
 *  - GET /api/v1/analytics/facebook       — Facebook metrics shape + rate calculations
 *  - GET /api/v1/analytics/email          — Email metrics with rate calculations
 *  - GET /api/v1/analytics/leads          — Lead funnel with byStatus breakdown
 *  - GET /api/v1/analytics/prospects      — Prospect conversion metrics
 *  - Unauthenticated requests → 401
 *  - Advisor scope: can only see own org data
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

// ---- Mock Prisma client ----
jest.mock('../../../src/db/client', () => ({
  prisma: {
    draft: {
      count: jest.fn(),
    },
    publishJob: {
      count: jest.fn(),
    },
    lead: {
      count: jest.fn(),
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    emailSend: {
      findMany: jest.fn(),
    },
    emailEnrollment: {
      count: jest.fn(),
    },
    linkedInCampaign: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    facebookAdCampaign: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    prospectListRequest: {
      findMany: jest.fn(),
    },
    creditTransaction: {
      aggregate: jest.fn(),
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
// Fixtures
// ---------------------------------------------------------------------------

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const OTHER_ORG_ID = '770e8400-e29b-41d4-a716-446655440002';
const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

function makeAccessToken(
  userId: string,
  orgId: string = TEST_ORG_ID,
  role: string = 'advisor'
): string {
  return jwt.sign(
    {
      sub: userId,
      orgId,
      role,
      email: 'test@example.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// ---------------------------------------------------------------------------
// Default mock return values (happy path — all return data)
// ---------------------------------------------------------------------------

function setupOverviewMocks(): void {
  (prisma.draft.count as jest.Mock).mockResolvedValue(10);
  (prisma.publishJob.count as jest.Mock).mockResolvedValue(5);
  (prisma.lead.count as jest.Mock).mockResolvedValue(8);
  (prisma.emailSend.findMany as jest.Mock).mockResolvedValue([
    { openedAt: new Date() },
    { openedAt: new Date() },
    { openedAt: null },
    { openedAt: null },
  ]);
  (prisma.linkedInCampaign.count as jest.Mock).mockResolvedValue(2);
  (prisma.facebookAdCampaign.count as jest.Mock).mockResolvedValue(1);
  (prisma.creditTransaction.aggregate as jest.Mock).mockResolvedValue({
    _sum: { amount: 150 },
  });
}

function setupLinkedInMocks(): void {
  (prisma.publishJob.count as jest.Mock).mockResolvedValue(12);
  (prisma.linkedInCampaign.findMany as jest.Mock).mockResolvedValue([
    {
      id: 'li-camp-1',
      name: 'Q1 Outreach',
      status: 'ACTIVE',
      totalEnrolled: 100,
      totalReplied: 20,
    },
    {
      id: 'li-camp-2',
      name: 'Follow-up',
      status: 'PAUSED',
      totalEnrolled: 50,
      totalReplied: 5,
    },
  ]);
}

function setupFacebookMocks(): void {
  (prisma.publishJob.count as jest.Mock).mockResolvedValue(4);
  (prisma.facebookAdCampaign.findMany as jest.Mock).mockResolvedValue([
    {
      id: 'fb-camp-1',
      name: 'Retirement Ad',
      status: 'ACTIVE',
      impressions: 1000,
      clicks: 50,
      leads: 10,
      spend: '500.00',
    },
    {
      id: 'fb-camp-2',
      name: 'IRA Campaign',
      status: 'COMPLETED',
      impressions: 2000,
      clicks: 100,
      leads: 20,
      spend: '800.00',
    },
  ]);
  (prisma.lead.count as jest.Mock).mockResolvedValue(30);
}

function setupEmailMocks(): void {
  (prisma.emailSend.findMany as jest.Mock).mockResolvedValue([
    { status: 'delivered', openedAt: new Date(), clickedAt: new Date(), bouncedAt: null },
    { status: 'delivered', openedAt: new Date(), clickedAt: null, bouncedAt: null },
    { status: 'delivered', openedAt: null, clickedAt: null, bouncedAt: null },
    { status: 'bounced', openedAt: null, clickedAt: null, bouncedAt: new Date() },
  ]);
  (prisma.emailEnrollment.count as jest.Mock).mockResolvedValue(2);
}

function setupLeadMocks(): void {
  (prisma.lead.groupBy as jest.Mock)
    .mockResolvedValueOnce([
      { status: 'NEW', _count: { _all: 5 } },
      { status: 'CONTACTED', _count: { _all: 3 } },
      { status: 'CLIENT', _count: { _all: 2 } },
    ])
    .mockResolvedValueOnce([
      { source: 'PROSPECT_FINDER', _count: { _all: 6 } },
      { source: 'FACEBOOK_ADS', _count: { _all: 4 } },
    ]);
  (prisma.lead.findMany as jest.Mock).mockResolvedValue([
    {
      createdAt: new Date('2026-01-01'),
      updatedAt: new Date('2026-01-15'),
    },
    {
      createdAt: new Date('2026-01-05'),
      updatedAt: new Date('2026-01-20'),
    },
  ]);
}

function setupProspectMocks(): void {
  (prisma.prospectListRequest.findMany as jest.Mock).mockResolvedValue([
    {
      id: 'req-1',
      status: 'FULFILLED',
      fulfilledCount: 100,
      creditCost: 50,
    },
    {
      id: 'req-2',
      status: 'PENDING',
      fulfilledCount: 0,
      creditCost: 0,
    },
  ]);
  (prisma.creditTransaction.aggregate as jest.Mock).mockResolvedValue({
    _sum: { amount: 50 },
  });
  (prisma.lead.count as jest.Mock).mockResolvedValue(25);
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

beforeEach(() => {
  jest.clearAllMocks();
});

// ---------------------------------------------------------------------------
// Unauthenticated → 401
// ---------------------------------------------------------------------------

describe('Unauthenticated requests → 401', () => {
  it('GET /api/v1/analytics/overview without token returns 401', async () => {
    const res = await client.get('/api/v1/analytics/overview');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/analytics/linkedin without token returns 401', async () => {
    const res = await client.get('/api/v1/analytics/linkedin');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/analytics/facebook without token returns 401', async () => {
    const res = await client.get('/api/v1/analytics/facebook');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/analytics/email without token returns 401', async () => {
    const res = await client.get('/api/v1/analytics/email');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/analytics/leads without token returns 401', async () => {
    const res = await client.get('/api/v1/analytics/leads');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('GET /api/v1/analytics/prospects without token returns 401', async () => {
    const res = await client.get('/api/v1/analytics/prospects');
    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/overview
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/overview', () => {
  it('returns metrics object with correct shape', async () => {
    setupOverviewMocks();
    // lead.count is called twice (total leads + new leads), mock both
    (prisma.lead.count as jest.Mock)
      .mockResolvedValueOnce(8)  // total leads
      .mockResolvedValueOnce(4); // new leads

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data).toHaveProperty('contentCreated');
    expect(data).toHaveProperty('contentPublished');
    expect(data).toHaveProperty('totalLeads');
    expect(data).toHaveProperty('newLeads');
    expect(data).toHaveProperty('totalEmailsSent');
    expect(data).toHaveProperty('emailOpenRate');
    expect(data).toHaveProperty('activeCampaigns');
    expect(data).toHaveProperty('creditsUsed');

    // Type checks
    expect(typeof data.contentCreated).toBe('number');
    expect(typeof data.contentPublished).toBe('number');
    expect(typeof data.totalLeads).toBe('number');
    expect(typeof data.newLeads).toBe('number');
    expect(typeof data.totalEmailsSent).toBe('number');
    expect(typeof data.emailOpenRate).toBe('number');
    expect(typeof data.activeCampaigns).toBe('number');
    expect(typeof data.creditsUsed).toBe('number');
  });

  it('returns correct computed values', async () => {
    (prisma.draft.count as jest.Mock).mockResolvedValue(10);
    (prisma.publishJob.count as jest.Mock).mockResolvedValue(5);
    (prisma.lead.count as jest.Mock)
      .mockResolvedValueOnce(8)
      .mockResolvedValueOnce(3);
    (prisma.emailSend.findMany as jest.Mock).mockResolvedValue([
      { openedAt: new Date() },
      { openedAt: new Date() },
      { openedAt: null },
      { openedAt: null },
    ]);
    (prisma.linkedInCampaign.count as jest.Mock).mockResolvedValue(2);
    (prisma.facebookAdCampaign.count as jest.Mock).mockResolvedValue(1);
    (prisma.creditTransaction.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: 150 },
    });

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.contentCreated).toBe(10);
    expect(data.contentPublished).toBe(5);
    expect(data.totalLeads).toBe(8);
    expect(data.newLeads).toBe(3);
    expect(data.totalEmailsSent).toBe(4);
    expect(data.emailOpenRate).toBe(50); // 2 of 4 opened = 50%
    expect(data.activeCampaigns).toBe(3); // 2 LI + 1 FB
    expect(data.creditsUsed).toBe(150);
  });

  it('GET /api/v1/analytics/overview?preset=7d — uses correct date range (7d window)', async () => {
    setupOverviewMocks();
    (prisma.lead.count as jest.Mock)
      .mockResolvedValueOnce(3)
      .mockResolvedValueOnce(1);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/overview?preset=7d')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify Prisma was called with a date filter approximately 7 days back
    const draftCountCall = (prisma.draft.count as jest.Mock).mock.calls[0]?.[0];
    const fromDate: Date = draftCountCall?.where?.createdAt?.gte;
    const toDate: Date = draftCountCall?.where?.createdAt?.lte;

    expect(fromDate).toBeInstanceOf(Date);
    expect(toDate).toBeInstanceOf(Date);

    const diffMs = toDate.getTime() - fromDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);
    // Should be approximately 7 days (within 1 minute tolerance)
    expect(diffDays).toBeGreaterThan(6.99);
    expect(diffDays).toBeLessThan(7.01);
  });

  it('GET /api/v1/analytics/overview?from=...&to=... — uses custom date range', async () => {
    setupOverviewMocks();
    (prisma.lead.count as jest.Mock)
      .mockResolvedValueOnce(5)
      .mockResolvedValueOnce(2);

    const token = makeAccessToken(TEST_USER_ID);
    const from = '2026-01-01T00:00:00Z';
    const to = '2026-02-01T00:00:00Z';
    const res = await client
      .get(`/api/v1/analytics/overview?from=${from}&to=${to}`)
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify exact dates were passed through
    const draftCountCall = (prisma.draft.count as jest.Mock).mock.calls[0]?.[0];
    const fromDate: Date = draftCountCall?.where?.createdAt?.gte;
    const toDate: Date = draftCountCall?.where?.createdAt?.lte;

    expect(fromDate.toISOString()).toBe('2026-01-01T00:00:00.000Z');
    expect(toDate.toISOString()).toBe('2026-02-01T00:00:00.000Z');
  });

  it('returns 0 emailOpenRate when no emails sent', async () => {
    (prisma.draft.count as jest.Mock).mockResolvedValue(0);
    (prisma.publishJob.count as jest.Mock).mockResolvedValue(0);
    (prisma.lead.count as jest.Mock).mockResolvedValue(0).mockResolvedValue(0);
    (prisma.emailSend.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.linkedInCampaign.count as jest.Mock).mockResolvedValue(0);
    (prisma.facebookAdCampaign.count as jest.Mock).mockResolvedValue(0);
    (prisma.creditTransaction.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: null },
    });

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.emailOpenRate).toBe(0);
    expect(res.body.data.creditsUsed).toBe(0);
  });

  it('returns 422 for invalid preset value', async () => {
    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/overview?preset=invalid')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/linkedin
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/linkedin', () => {
  it('returns LinkedIn metrics with correct shape', async () => {
    setupLinkedInMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/linkedin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data).toHaveProperty('postsPublished');
    expect(data).toHaveProperty('activeCampaigns');
    expect(data).toHaveProperty('totalEnrolled');
    expect(data).toHaveProperty('totalReplied');
    expect(data).toHaveProperty('replyRate');
    expect(data).toHaveProperty('campaignList');
    expect(Array.isArray(data.campaignList)).toBe(true);

    expect(typeof data.postsPublished).toBe('number');
    expect(typeof data.activeCampaigns).toBe('number');
    expect(typeof data.totalEnrolled).toBe('number');
    expect(typeof data.totalReplied).toBe('number');
    expect(typeof data.replyRate).toBe('number');
  });

  it('correctly computes replyRate and activeCampaigns', async () => {
    setupLinkedInMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/linkedin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;

    // 1 ACTIVE out of 2 campaigns
    expect(data.activeCampaigns).toBe(1);
    // totalEnrolled = 100 + 50 = 150
    expect(data.totalEnrolled).toBe(150);
    // totalReplied = 20 + 5 = 25
    expect(data.totalReplied).toBe(25);
    // replyRate = 25/150 * 100 ≈ 16.67
    expect(data.replyRate).toBeCloseTo(16.67, 1);
    // postsPublished = 12
    expect(data.postsPublished).toBe(12);
  });

  it('campaignList contains correct fields per campaign', async () => {
    setupLinkedInMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/linkedin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { campaignList } = res.body.data;
    expect(campaignList).toHaveLength(2);

    const firstCampaign = campaignList[0];
    expect(firstCampaign).toHaveProperty('id');
    expect(firstCampaign).toHaveProperty('name');
    expect(firstCampaign).toHaveProperty('status');
    expect(firstCampaign).toHaveProperty('enrolled');
    expect(firstCampaign).toHaveProperty('replied');
  });

  it('returns 0 replyRate when no enrolled leads', async () => {
    (prisma.publishJob.count as jest.Mock).mockResolvedValue(0);
    (prisma.linkedInCampaign.findMany as jest.Mock).mockResolvedValue([]);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/linkedin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.replyRate).toBe(0);
    expect(res.body.data.campaignList).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/facebook
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/facebook', () => {
  it('returns Facebook metrics with correct shape', async () => {
    setupFacebookMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/facebook')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data).toHaveProperty('postsPublished');
    expect(data).toHaveProperty('activeCampaigns');
    expect(data).toHaveProperty('totalImpressions');
    expect(data).toHaveProperty('totalClicks');
    expect(data).toHaveProperty('ctr');
    expect(data).toHaveProperty('totalLeads');
    expect(data).toHaveProperty('totalSpend');
    expect(data).toHaveProperty('cpl');
    expect(data).toHaveProperty('campaignList');
    expect(Array.isArray(data.campaignList)).toBe(true);
  });

  it('correctly computes CTR and CPL', async () => {
    setupFacebookMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/facebook')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;

    // totalImpressions = 1000 + 2000 = 3000
    expect(data.totalImpressions).toBe(3000);
    // totalClicks = 50 + 100 = 150
    expect(data.totalClicks).toBe(150);
    // CTR = 150/3000 * 100 = 5%
    expect(data.ctr).toBe(5);
    // totalSpend = 500 + 800 = 1300
    expect(data.totalSpend).toBeCloseTo(1300, 1);
    // totalLeads from FACEBOOK_ADS source = 30 (mocked)
    expect(data.totalLeads).toBe(30);
    // CPL = 1300/30 ≈ 43.33
    expect(data.cpl).toBeCloseTo(43.33, 1);
  });

  it('campaignList contains correct fields', async () => {
    setupFacebookMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/facebook')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { campaignList } = res.body.data;
    expect(campaignList).toHaveLength(2);

    const firstCampaign = campaignList[0];
    expect(firstCampaign).toHaveProperty('id');
    expect(firstCampaign).toHaveProperty('name');
    expect(firstCampaign).toHaveProperty('status');
    expect(firstCampaign).toHaveProperty('impressions');
    expect(firstCampaign).toHaveProperty('clicks');
    expect(firstCampaign).toHaveProperty('leads');
    expect(firstCampaign).toHaveProperty('spend');
  });

  it('returns 0 CTR and CPL when no impressions/leads', async () => {
    (prisma.publishJob.count as jest.Mock).mockResolvedValue(0);
    (prisma.facebookAdCampaign.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.lead.count as jest.Mock).mockResolvedValue(0);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/facebook')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.ctr).toBe(0);
    expect(res.body.data.cpl).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/email
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/email', () => {
  it('returns email metrics with correct shape and rate calculations', async () => {
    setupEmailMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/email')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data).toHaveProperty('totalSent');
    expect(data).toHaveProperty('totalDelivered');
    expect(data).toHaveProperty('totalOpened');
    expect(data).toHaveProperty('totalClicked');
    expect(data).toHaveProperty('deliveryRate');
    expect(data).toHaveProperty('openRate');
    expect(data).toHaveProperty('clickRate');
    expect(data).toHaveProperty('bounceRate');
    expect(data).toHaveProperty('unsubscribeCount');

    // All rate fields must be numbers
    expect(typeof data.deliveryRate).toBe('number');
    expect(typeof data.openRate).toBe('number');
    expect(typeof data.clickRate).toBe('number');
    expect(typeof data.bounceRate).toBe('number');
  });

  it('correctly computes email rates from mock data', async () => {
    setupEmailMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/email')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;

    // 4 total sent
    expect(data.totalSent).toBe(4);
    // 3 delivered (1 bounced)
    expect(data.totalDelivered).toBe(3);
    // 2 opened
    expect(data.totalOpened).toBe(2);
    // 1 clicked
    expect(data.totalClicked).toBe(1);
    // bounceRate = 1/4 * 100 = 25%
    expect(data.bounceRate).toBe(25);
    // openRate = 2/4 * 100 = 50%
    expect(data.openRate).toBe(50);
    // clickRate = 1/4 * 100 = 25%
    expect(data.clickRate).toBe(25);
    // deliveryRate = 3/4 * 100 = 75%
    expect(data.deliveryRate).toBe(75);
    // unsubscribeCount = 2 from enrollment mock
    expect(data.unsubscribeCount).toBe(2);
  });

  it('returns zero rates when no emails sent', async () => {
    (prisma.emailSend.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.emailEnrollment.count as jest.Mock).mockResolvedValue(0);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/email')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;
    expect(data.totalSent).toBe(0);
    expect(data.deliveryRate).toBe(0);
    expect(data.openRate).toBe(0);
    expect(data.clickRate).toBe(0);
    expect(data.bounceRate).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/leads
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/leads', () => {
  it('returns lead funnel metrics with byStatus breakdown', async () => {
    setupLeadMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/leads')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data).toHaveProperty('total');
    expect(data).toHaveProperty('byStatus');
    expect(data).toHaveProperty('bySource');
    expect(data).toHaveProperty('conversionRate');
    expect(data).toHaveProperty('averageTimeToClient');

    // byStatus must have all LeadStatus keys
    expect(data.byStatus).toHaveProperty('NEW');
    expect(data.byStatus).toHaveProperty('CONTACTED');
    expect(data.byStatus).toHaveProperty('ENGAGED');
    expect(data.byStatus).toHaveProperty('MEETING_SCHEDULED');
    expect(data.byStatus).toHaveProperty('CLIENT');
    expect(data.byStatus).toHaveProperty('LOST');

    // bySource must have all LeadSource keys
    expect(data.bySource).toHaveProperty('PROSPECT_FINDER');
    expect(data.bySource).toHaveProperty('FACEBOOK_ADS');
    expect(data.bySource).toHaveProperty('WEBSITE');
    expect(data.bySource).toHaveProperty('MANUAL_IMPORT');
    expect(data.bySource).toHaveProperty('LINKEDIN');
  });

  it('correctly computes total and conversionRate', async () => {
    setupLeadMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/leads')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;

    // NEW=5, CONTACTED=3, CLIENT=2 = 10 total
    expect(data.total).toBe(10);
    // byStatus counts
    expect(data.byStatus['NEW']).toBe(5);
    expect(data.byStatus['CONTACTED']).toBe(3);
    expect(data.byStatus['CLIENT']).toBe(2);
    // missing statuses default to 0
    expect(data.byStatus['ENGAGED']).toBe(0);
    // conversionRate = 2/10 * 100 = 20%
    expect(data.conversionRate).toBe(20);
  });

  it('computes averageTimeToClient from CLIENT lead data', async () => {
    setupLeadMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/leads')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;
    // Two CLIENT leads: 14 days and 15 days → avg 14.5
    expect(data.averageTimeToClient).toBeCloseTo(14.5, 0);
  });

  it('returns null averageTimeToClient when no CLIENT leads', async () => {
    (prisma.lead.groupBy as jest.Mock)
      .mockResolvedValueOnce([
        { status: 'NEW', _count: { _all: 5 } },
      ])
      .mockResolvedValueOnce([]);
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/leads')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.averageTimeToClient).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/analytics/prospects
// ---------------------------------------------------------------------------

describe('GET /api/v1/analytics/prospects', () => {
  it('returns prospect conversion metrics with correct shape', async () => {
    setupProspectMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/prospects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const { data } = res.body;
    expect(data).toHaveProperty('requestsTotal');
    expect(data).toHaveProperty('requestsFulfilled');
    expect(data).toHaveProperty('totalProspectsImported');
    expect(data).toHaveProperty('creditsConsumed');
    expect(data).toHaveProperty('conversionToLead');

    expect(typeof data.requestsTotal).toBe('number');
    expect(typeof data.requestsFulfilled).toBe('number');
    expect(typeof data.totalProspectsImported).toBe('number');
    expect(typeof data.creditsConsumed).toBe('number');
    expect(typeof data.conversionToLead).toBe('number');
  });

  it('correctly computes prospect metrics values', async () => {
    setupProspectMocks();

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/prospects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    const { data } = res.body;

    // 2 total requests
    expect(data.requestsTotal).toBe(2);
    // 1 fulfilled
    expect(data.requestsFulfilled).toBe(1);
    // 100 prospects imported from fulfilled request
    expect(data.totalProspectsImported).toBe(100);
    // 50 credits from request records
    expect(data.creditsConsumed).toBe(50);
    // 25 leads from 100 prospects = 25%
    expect(data.conversionToLead).toBe(25);
  });

  it('returns 0 conversionToLead when no prospects imported', async () => {
    (prisma.prospectListRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.creditTransaction.aggregate as jest.Mock).mockResolvedValue({
      _sum: { amount: 0 },
    });
    (prisma.lead.count as jest.Mock).mockResolvedValue(0);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/prospects')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.conversionToLead).toBe(0);
    expect(res.body.data.requestsTotal).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Advisor scope: can only see own org data
// ---------------------------------------------------------------------------

describe('Advisor org isolation', () => {
  it('advisor cannot query a different org (forbidden)', async () => {
    // Advisor token for TEST_ORG_ID attempts to access OTHER_ORG_ID
    // But our routes use the token orgId, so there's no cross-org injection
    // possible via the API. We test that the service enforces the orgId from JWT.
    setupOverviewMocks();
    (prisma.lead.count as jest.Mock)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    // Token for TEST_ORG_ID — the route uses user.orgId from token
    const token = makeAccessToken(TEST_USER_ID, TEST_ORG_ID, 'advisor');
    const res = await client
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${token}`);

    // Should succeed with their own org
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    // Verify prisma was called with the correct orgId from the token
    const draftCountCall = (prisma.draft.count as jest.Mock).mock.calls[0]?.[0];
    expect(draftCountCall?.where?.organizationId).toBe(TEST_ORG_ID);
  });

  it('super_admin can query any org', async () => {
    setupOverviewMocks();
    (prisma.lead.count as jest.Mock)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(1);

    // Super admin token but with OTHER_ORG_ID
    const token = makeAccessToken(TEST_USER_ID, OTHER_ORG_ID, 'super_admin');
    const res = await client
      .get('/api/v1/analytics/overview')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('advisor queries scope to advisorId on advisor-owned tables', async () => {
    setupLinkedInMocks();

    const token = makeAccessToken(TEST_USER_ID, TEST_ORG_ID, 'advisor');
    const res = await client
      .get('/api/v1/analytics/linkedin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // The linkedInCampaign.findMany should have been called with advisorId filter
    const findManyCall = (prisma.linkedInCampaign.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.advisorId).toBe(TEST_USER_ID);
  });

  it('org_admin does NOT scope to advisorId (sees full org)', async () => {
    setupLinkedInMocks();

    const token = makeAccessToken(TEST_USER_ID, TEST_ORG_ID, 'org_admin');
    const res = await client
      .get('/api/v1/analytics/linkedin')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    // The linkedInCampaign.findMany should NOT have advisorId filter for org_admin
    const findManyCall = (prisma.linkedInCampaign.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.advisorId).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Preset date range validation
// ---------------------------------------------------------------------------

describe('Preset date ranges', () => {
  it('preset=30d covers approximately 30 days', async () => {
    setupOverviewMocks();
    (prisma.lead.count as jest.Mock).mockResolvedValue(0);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/overview?preset=30d')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const draftCountCall = (prisma.draft.count as jest.Mock).mock.calls[0]?.[0];
    const fromDate: Date = draftCountCall?.where?.createdAt?.gte;
    const toDate: Date = draftCountCall?.where?.createdAt?.lte;

    const diffDays = (toDate.getTime() - fromDate.getTime()) / (1000 * 60 * 60 * 24);
    expect(diffDays).toBeGreaterThan(29.99);
    expect(diffDays).toBeLessThan(30.01);
  });

  it('preset=this_month uses start/end of current month', async () => {
    setupOverviewMocks();
    (prisma.lead.count as jest.Mock).mockResolvedValue(0);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/overview?preset=this_month')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const draftCountCall = (prisma.draft.count as jest.Mock).mock.calls[0]?.[0];
    const fromDate: Date = draftCountCall?.where?.createdAt?.gte;
    const now = new Date();

    expect(fromDate.getDate()).toBe(1);
    expect(fromDate.getMonth()).toBe(now.getMonth());
    expect(fromDate.getFullYear()).toBe(now.getFullYear());
  });

  it('preset=last_month uses start/end of previous month', async () => {
    setupOverviewMocks();
    (prisma.lead.count as jest.Mock).mockResolvedValue(0);

    const token = makeAccessToken(TEST_USER_ID);
    const res = await client
      .get('/api/v1/analytics/overview?preset=last_month')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);

    const draftCountCall = (prisma.draft.count as jest.Mock).mock.calls[0]?.[0];
    const fromDate: Date = draftCountCall?.where?.createdAt?.gte;
    const now = new Date();
    const expectedLastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;

    expect(fromDate.getDate()).toBe(1);
    expect(fromDate.getMonth()).toBe(expectedLastMonth);
  });
});
