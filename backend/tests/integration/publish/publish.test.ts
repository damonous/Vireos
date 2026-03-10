/**
 * Integration tests for FR-004: Social Publishing Engine
 *
 * Tests cover:
 *  - POST /api/v1/publish — schedules job when draft is APPROVED
 *  - POST /api/v1/publish — rejects when draft is not APPROVED → 400
 *  - POST /api/v1/publish — rejects when no social connection → 400
 *  - GET  /api/v1/publish — returns paginated jobs
 *  - DELETE /api/v1/publish/:jobId — cancels QUEUED job
 *  - GET  /api/v1/oauth/linkedin — returns auth URL with state param
 *  - GET  /api/v1/oauth/connections — lists user's connections
 *
 * Mocks: Prisma client, BullMQ publishQueue, notificationQueue, fetch
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

// ---- Mock BullMQ Queue & Worker ----
const mockPublishQueueAdd = jest.fn().mockResolvedValue({ id: 'bull-job-id' });
const mockPublishQueueGetJob = jest.fn().mockResolvedValue(null);
const mockPublishQueueClose = jest.fn().mockResolvedValue(undefined);
const mockNotificationQueueAdd = jest.fn().mockResolvedValue({ id: 'notif-job-id' });

jest.mock('bullmq', () => {
  const actualBullMQ = jest.requireActual('bullmq');
  return {
    ...actualBullMQ,
    Queue: jest.fn().mockImplementation(() => ({
      add: jest.fn().mockImplementation((name: string, data: unknown) => {
        // Route to correct mock based on queue name detection
        if (name.startsWith('publish:') || name.startsWith('notify:')) {
          return Promise.resolve({ id: 'bull-job-id' });
        }
        return Promise.resolve({ id: 'bull-job-id' });
      }),
      getJob: jest.fn().mockResolvedValue(null),
      close: jest.fn().mockResolvedValue(undefined),
    })),
    Worker: jest.fn().mockImplementation(() => ({
      on: jest.fn().mockReturnThis(),
      close: jest.fn().mockResolvedValue(undefined),
    })),
  };
});

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
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    publishJob: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    socialConnection: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
      delete: jest.fn(),
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
// Constants & fixtures
// ---------------------------------------------------------------------------

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_DRAFT_ID = '770e8400-e29b-41d4-a716-446655440002';
const TEST_JOB_ID = '880e8400-e29b-41d4-a716-446655440003';
const TEST_CONNECTION_ID = '990e8400-e29b-41d4-a716-446655440004';

const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

function makeToken(overrides: Partial<{ id: string; orgId: string; role: string }> = {}): string {
  return jwt.sign(
    {
      sub: overrides.id ?? TEST_USER_ID,
      orgId: overrides.orgId ?? TEST_ORG_ID,
      role: overrides.role ?? 'advisor',
      email: 'advisor@testorg.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const mockApprovedDraft = {
  id: TEST_DRAFT_ID,
  organizationId: TEST_ORG_ID,
  creatorId: TEST_USER_ID,
  reviewerId: null,
  title: 'Test LinkedIn Post',
  originalPrompt: 'Write a test post',
  linkedinContent: 'This is my LinkedIn post content for testing.',
  facebookContent: 'This is my Facebook post content for testing.',
  emailContent: null,
  adCopyContent: null,
  status: 'APPROVED',
  publishedChannels: [],
  aiModel: 'gpt-4o',
  tokensUsed: 100,
  version: 1,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockDraftNotApproved = {
  ...mockApprovedDraft,
  status: 'PENDING_REVIEW',
};

const mockLinkedInConnection = {
  id: TEST_CONNECTION_ID,
  userId: TEST_USER_ID,
  organizationId: TEST_ORG_ID,
  platform: 'LINKEDIN',
  accessToken: 'encrypted-access-token',
  refreshToken: null,
  tokenExpiresAt: null,
  platformUserId: 'urn-li-person-12345',
  platformUsername: 'Test Advisor',
  scopes: ['w_member_social', 'r_liteprofile'],
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockPublishJob = {
  id: TEST_JOB_ID,
  organizationId: TEST_ORG_ID,
  draftId: TEST_DRAFT_ID,
  advisorId: TEST_USER_ID,
  channel: 'LINKEDIN',
  platform: 'LINKEDIN',
  status: 'QUEUED',
  scheduledAt: null,
  publishedAt: null,
  platformPostId: null,
  platformUrl: null,
  errorMessage: null,
  retryCount: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

// ---------------------------------------------------------------------------
// Test suite
// ---------------------------------------------------------------------------

describe('FR-004: Social Publishing Engine', () => {
  let app: ReturnType<typeof createApp>;

  beforeAll(() => {
    app = createApp();
  });

  beforeEach(() => {
    jest.clearAllMocks();
    // Default audit trail mock
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
  });

  // =========================================================================
  // POST /api/v1/publish — create a publish job
  // =========================================================================

  describe('POST /api/v1/publish', () => {
    it('schedules a job when draft is APPROVED and connection exists', async () => {
      (prisma.draft.findUnique as jest.Mock).mockResolvedValue(mockApprovedDraft);
      (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(mockLinkedInConnection);
      (prisma.publishJob.create as jest.Mock).mockResolvedValue(mockPublishJob);

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeDefined();
      expect(res.body.data.id).toBe(TEST_JOB_ID);
      expect(res.body.data.status).toBe('QUEUED');
      expect(prisma.publishJob.create).toHaveBeenCalledTimes(1);
    });

    it('schedules a future job when scheduledAt is provided', async () => {
      const futureDate = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hour from now

      (prisma.draft.findUnique as jest.Mock).mockResolvedValue(mockApprovedDraft);
      (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(mockLinkedInConnection);
      (prisma.publishJob.create as jest.Mock).mockResolvedValue({
        ...mockPublishJob,
        scheduledAt: new Date(futureDate),
      });

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
          scheduledAt: futureDate,
        })
        .expect(201);

      expect(res.body.success).toBe(true);
      expect(res.body.data.scheduledAt).toBeDefined();
      expect(prisma.publishJob.create).toHaveBeenCalledTimes(1);
    });

    it('returns 400 when draft is not APPROVED', async () => {
      (prisma.draft.findUnique as jest.Mock).mockResolvedValue(mockDraftNotApproved);

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/APPROVED/);
      expect(prisma.publishJob.create).not.toHaveBeenCalled();
    });

    it('returns 400 when draft is in DRAFT status', async () => {
      (prisma.draft.findUnique as jest.Mock).mockResolvedValue({
        ...mockApprovedDraft,
        status: 'DRAFT',
      });

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/APPROVED/);
    });

    it('returns 400 when no social connection exists for the channel', async () => {
      (prisma.draft.findUnique as jest.Mock).mockResolvedValue(mockApprovedDraft);
      (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('BAD_REQUEST');
      expect(res.body.error.message).toMatch(/connection/i);
      expect(prisma.publishJob.create).not.toHaveBeenCalled();
    });

    it('returns 400 when social connection is inactive', async () => {
      (prisma.draft.findUnique as jest.Mock).mockResolvedValue(mockApprovedDraft);
      (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue({
        ...mockLinkedInConnection,
        isActive: false,
      });

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
        })
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/connection/i);
    });

    it('returns 404 when draft does not exist', async () => {
      (prisma.draft.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
        })
        .expect(404);

      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });

    it('returns 422 when channel is invalid', async () => {
      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'TIKTOK', // invalid
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('returns 422 when draftId is not a UUID', async () => {
      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: 'not-a-uuid',
          channel: 'LINKEDIN',
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('returns 422 when scheduledAt is in the past', async () => {
      const pastDate = new Date(Date.now() - 60 * 60 * 1000).toISOString(); // 1 hour ago

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
          scheduledAt: pastDate,
        })
        .expect(422);

      expect(res.body.success).toBe(false);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await supertest(app)
        .post('/api/v1/publish')
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
        })
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('returns 403 when draft belongs to different org', async () => {
      (prisma.draft.findUnique as jest.Mock).mockResolvedValue({
        ...mockApprovedDraft,
        organizationId: 'different-org-id',
      });

      const res = await supertest(app)
        .post('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .send({
          draftId: TEST_DRAFT_ID,
          channel: 'LINKEDIN',
        })
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/v1/publish — list jobs
  // =========================================================================

  describe('GET /api/v1/publish', () => {
    it('returns paginated list of publish jobs for the org', async () => {
      (prisma.publishJob.findMany as jest.Mock).mockResolvedValue([mockPublishJob]);
      (prisma.publishJob.count as jest.Mock).mockResolvedValue(1);

      const res = await supertest(app)
        .get('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].id).toBe(TEST_JOB_ID);
      expect(res.body.pagination).toBeDefined();
      expect(res.body.pagination.totalCount).toBe(1);
    });

    it('returns empty array when no jobs exist', async () => {
      (prisma.publishJob.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.publishJob.count as jest.Mock).mockResolvedValue(0);

      const res = await supertest(app)
        .get('/api/v1/publish')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
      expect(res.body.pagination.totalCount).toBe(0);
    });

    it('supports pagination parameters', async () => {
      (prisma.publishJob.findMany as jest.Mock).mockResolvedValue([]);
      (prisma.publishJob.count as jest.Mock).mockResolvedValue(50);

      const res = await supertest(app)
        .get('/api/v1/publish?page=2&limit=10')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.pagination.page).toBe(2);
      expect(res.body.pagination.limit).toBe(10);
      expect(res.body.pagination.totalCount).toBe(50);

      // Verify prisma was called with correct skip
      expect(prisma.publishJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 })
      );
    });

    it('returns 401 when not authenticated', async () => {
      const res = await supertest(app).get('/api/v1/publish').expect(401);
      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/v1/publish/:jobId — get a specific job
  // =========================================================================

  describe('GET /api/v1/publish/:jobId', () => {
    it('returns the publish job when it belongs to the user org', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue(mockPublishJob);

      const res = await supertest(app)
        .get(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.id).toBe(TEST_JOB_ID);
    });

    it('returns 404 when job does not exist', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await supertest(app)
        .get(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 403 when job belongs to different org', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue({
        ...mockPublishJob,
        organizationId: 'different-org-id',
      });

      const res = await supertest(app)
        .get(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(403);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // DELETE /api/v1/publish/:jobId — cancel a job
  // =========================================================================

  describe('DELETE /api/v1/publish/:jobId', () => {
    it('cancels a QUEUED job', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue(mockPublishJob);
      (prisma.publishJob.update as jest.Mock).mockResolvedValue({
        ...mockPublishJob,
        status: 'CANCELLED',
      });

      const res = await supertest(app)
        .delete(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/cancelled/i);
      expect(prisma.publishJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: TEST_JOB_ID },
          data: { status: 'CANCELLED' },
        })
      );
    });

    it('returns 400 when trying to cancel a PUBLISHED job', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue({
        ...mockPublishJob,
        status: 'PUBLISHED',
      });

      const res = await supertest(app)
        .delete(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/QUEUED/);
      expect(prisma.publishJob.update).not.toHaveBeenCalled();
    });

    it('returns 400 when trying to cancel a FAILED job', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue({
        ...mockPublishJob,
        status: 'FAILED',
      });

      const res = await supertest(app)
        .delete(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 403 when advisor tries to cancel another advisors job', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue({
        ...mockPublishJob,
        advisorId: 'different-advisor-id', // different advisor in same org
      });

      const res = await supertest(app)
        .delete(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`) // advisor role
        .expect(403);

      expect(res.body.success).toBe(false);
    });

    it('allows admin to cancel any job in their org', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue({
        ...mockPublishJob,
        advisorId: 'different-advisor-id', // different advisor
      });
      (prisma.publishJob.update as jest.Mock).mockResolvedValue({
        ...mockPublishJob,
        status: 'CANCELLED',
      });

      const adminToken = makeToken({ role: 'org_admin' });

      const res = await supertest(app)
        .delete(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.success).toBe(true);
    });

    it('returns 404 when job does not exist', async () => {
      (prisma.publishJob.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await supertest(app)
        .delete(`/api/v1/publish/${TEST_JOB_ID}`)
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await supertest(app)
        .delete(`/api/v1/publish/${TEST_JOB_ID}`)
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/v1/oauth/linkedin — get LinkedIn auth URL
  // =========================================================================

  describe('GET /api/v1/oauth/linkedin', () => {
    it('returns a LinkedIn authorization URL with a state param', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/linkedin')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBeDefined();

      const url = new URL(res.body.data.url);
      expect(url.hostname).toBe('www.linkedin.com');
      expect(url.pathname).toBe('/oauth/v2/authorization');
      expect(url.searchParams.get('client_id')).toBe('test_linkedin_client_id');
      expect(url.searchParams.get('redirect_uri')).toBe(
        'http://localhost:3001/api/v1/oauth/linkedin/callback'
      );
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(url.searchParams.get('scope')).toContain('w_member_social');
    });

    it('encodes orgId and userId in the state param', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/linkedin')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      const url = new URL(res.body.data.url);
      const state = url.searchParams.get('state')!;

      // Decode the base64url state
      const decoded = Buffer.from(state, 'base64url').toString('utf8');
      const parts = decoded.split(':');
      expect(parts).toHaveLength(3);
      expect(parts[0]).toBe(TEST_ORG_ID);
      expect(parts[1]).toBe(TEST_USER_ID);
      expect(parts[2]).toBe('LINKEDIN');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/linkedin')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/v1/oauth/facebook — get Facebook auth URL
  // =========================================================================

  describe('GET /api/v1/oauth/facebook', () => {
    it('returns a Facebook authorization URL with a state param', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/facebook')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.url).toBeDefined();

      const url = new URL(res.body.data.url);
      expect(url.hostname).toBe('www.facebook.com');
      expect(url.searchParams.get('client_id')).toBe('test_facebook_app_id');
      expect(url.searchParams.get('state')).toBeTruthy();
      expect(url.searchParams.get('scope')).toContain('pages_manage_posts');
    });

    it('returns 401 when not authenticated', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/facebook')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });

  // =========================================================================
  // GET /api/v1/oauth/connections — list connections
  // =========================================================================

  describe('GET /api/v1/oauth/connections', () => {
    it('returns the list of social connections for the authenticated user', async () => {
      (prisma.socialConnection.findMany as jest.Mock).mockResolvedValue([
        mockLinkedInConnection,
      ]);

      const res = await supertest(app)
        .get('/api/v1/oauth/connections')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toBeInstanceOf(Array);
      expect(res.body.data).toHaveLength(1);
      expect(res.body.data[0].platform).toBe('LINKEDIN');
      expect(res.body.data[0].platformUsername).toBe('Test Advisor');
    });

    it('does NOT expose encrypted access tokens in the response', async () => {
      (prisma.socialConnection.findMany as jest.Mock).mockResolvedValue([
        mockLinkedInConnection,
      ]);

      const res = await supertest(app)
        .get('/api/v1/oauth/connections')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      // accessToken and refreshToken fields should not be in the response
      expect(res.body.data[0].accessToken).toBeUndefined();
      expect(res.body.data[0].refreshToken).toBeUndefined();
    });

    it('returns empty array when user has no connections', async () => {
      (prisma.socialConnection.findMany as jest.Mock).mockResolvedValue([]);

      const res = await supertest(app)
        .get('/api/v1/oauth/connections')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data).toHaveLength(0);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/connections')
        .expect(401);

      expect(res.body.success).toBe(false);
    });

    it('calls prisma with correct userId and orgId filters', async () => {
      (prisma.socialConnection.findMany as jest.Mock).mockResolvedValue([]);

      await supertest(app)
        .get('/api/v1/oauth/connections')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(prisma.socialConnection.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            userId: TEST_USER_ID,
            organizationId: TEST_ORG_ID,
            isActive: true,
          }),
        })
      );
    });
  });

  // =========================================================================
  // GET /api/v1/oauth/linkedin/callback — OAuth callback
  // =========================================================================

  describe('GET /api/v1/oauth/linkedin/callback', () => {
    it('returns 400 when code param is missing', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/linkedin/callback?state=somestate')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/code|state/i);
    });

    it('returns 400 when state param is missing', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/linkedin/callback?code=somecode')
        .expect(400);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 when OAuth error is returned by LinkedIn', async () => {
      const res = await supertest(app)
        .get('/api/v1/oauth/linkedin/callback?error=access_denied&error_description=User+denied')
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/access_denied/);
    });
  });

  // =========================================================================
  // DELETE /api/v1/oauth/:platform — disconnect
  // =========================================================================

  describe('DELETE /api/v1/oauth/:platform', () => {
    it('disconnects a LinkedIn connection', async () => {
      (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(
        mockLinkedInConnection
      );
      (prisma.socialConnection.delete as jest.Mock).mockResolvedValue(
        mockLinkedInConnection
      );

      const res = await supertest(app)
        .delete('/api/v1/oauth/linkedin')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(200);

      expect(res.body.success).toBe(true);
      expect(res.body.data.message).toMatch(/disconnected/i);
      expect(prisma.socialConnection.delete).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: TEST_CONNECTION_ID } })
      );
    });

    it('returns 404 when no LinkedIn connection exists', async () => {
      (prisma.socialConnection.findUnique as jest.Mock).mockResolvedValue(null);

      const res = await supertest(app)
        .delete('/api/v1/oauth/linkedin')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(404);

      expect(res.body.success).toBe(false);
    });

    it('returns 400 for an invalid platform name', async () => {
      const res = await supertest(app)
        .delete('/api/v1/oauth/tiktok')
        .set('Authorization', `Bearer ${makeToken()}`)
        .expect(400);

      expect(res.body.success).toBe(false);
      expect(res.body.error.message).toMatch(/invalid platform/i);
    });

    it('returns 401 when not authenticated', async () => {
      const res = await supertest(app)
        .delete('/api/v1/oauth/linkedin')
        .expect(401);

      expect(res.body.success).toBe(false);
    });
  });
});
