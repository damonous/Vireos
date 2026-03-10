/**
 * Integration tests for FR-003: Compliance Review Workflow
 *
 * Tests cover:
 *  - PATCH /api/v1/reviews/:id/submit  — advisor submits DRAFT → 200 PENDING_REVIEW
 *  - PATCH /api/v1/reviews/:id/submit  — already PENDING_REVIEW → 409
 *  - PATCH /api/v1/reviews/:id/submit  — unauthenticated → 401
 *  - PATCH /api/v1/reviews/:id/approve — compliance approves PENDING_REVIEW → 200 APPROVED
 *  - PATCH /api/v1/reviews/:id/approve — advisor tries to approve → 403
 *  - PATCH /api/v1/reviews/:id/reject  — compliance rejects with reason → 200 REJECTED
 *  - PATCH /api/v1/reviews/:id/request-changes — compliance requests changes → 200 NEEDS_CHANGES
 *  - PATCH /api/v1/reviews/:id/edit    — compliance edits PENDING_REVIEW content → 200
 *  - PATCH /api/v1/reviews/:id/edit    — advisor tries to edit PENDING_REVIEW → 403
 *  - GET   /api/v1/reviews             — compliance sees pending review queue
 *  - AuditTrail: verify rows written on submit, approve, reject
 *
 * Uses jest.mock to replace Prisma client — no live DB connection required.
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
      count: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    auditTrail: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    notification: {
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
// Constants
// ---------------------------------------------------------------------------

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const ADVISOR_USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const COMPLIANCE_USER_ID = '770e8400-e29b-41d4-a716-446655440002';
const ADMIN_USER_ID = '880e8400-e29b-41d4-a716-446655440003';
const DRAFT_ID = '990e8400-e29b-41d4-a716-446655440004';

const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

// ---------------------------------------------------------------------------
// Token factories
// ---------------------------------------------------------------------------

/**
 * Generates an access token for an advisor (role: 'advisor').
 */
function makeAdvisorToken(userId = ADVISOR_USER_ID): string {
  return jwt.sign(
    {
      sub: userId,
      orgId: TEST_ORG_ID,
      role: 'advisor',
      email: 'advisor@testorg.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Generates an access token for a compliance officer (role: 'viewer').
 * The Prisma COMPLIANCE role maps to 'viewer' in the app-layer enum.
 */
function makeComplianceToken(userId = COMPLIANCE_USER_ID): string {
  return jwt.sign(
    {
      sub: userId,
      orgId: TEST_ORG_ID,
      role: 'viewer',
      email: 'compliance@testorg.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

/**
 * Generates an access token for an org admin (role: 'org_admin').
 */
function makeAdminToken(userId = ADMIN_USER_ID): string {
  return jwt.sign(
    {
      sub: userId,
      orgId: TEST_ORG_ID,
      role: 'org_admin',
      email: 'admin@testorg.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// ---------------------------------------------------------------------------
// Draft fixtures
// ---------------------------------------------------------------------------

function makeDraft(overrides: Partial<MockDraft> = {}): MockDraft {
  return {
    id: DRAFT_ID,
    organizationId: TEST_ORG_ID,
    creatorId: ADVISOR_USER_ID,
    reviewerId: null,
    title: 'Test LinkedIn Post',
    originalPrompt: 'Write me a post about retirement planning',
    linkedinContent: 'Retirement planning is important...',
    facebookContent: null,
    emailContent: null,
    adCopyContent: null,
    variantsJson: {},
    flagsJson: {},
    status: 'DRAFT',
    reviewNotes: null,
    publishedChannels: [],
    aiModel: 'gpt-4o',
    tokensUsed: 150,
    version: 1,
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  };
}

interface MockDraft {
  id: string;
  organizationId: string;
  creatorId: string;
  reviewerId: string | null;
  title: string;
  originalPrompt: string;
  linkedinContent: string | null;
  facebookContent: string | null;
  emailContent: string | null;
  adCopyContent: string | null;
  variantsJson: Record<string, unknown>;
  flagsJson: Record<string, unknown>;
  status: string;
  reviewNotes: string | null;
  publishedChannels: string[];
  aiModel: string | null;
  tokensUsed: number;
  version: number;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

beforeEach(() => {
  jest.clearAllMocks();
  // Default: audit trail + notification writes always succeed
  (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
  (prisma.notification.create as jest.Mock).mockResolvedValue({});
  // Default: compliance officer lookup returns one officer
  (prisma.user.findMany as jest.Mock).mockResolvedValue([
    { id: COMPLIANCE_USER_ID },
  ]);
});

// ===========================================================================
// PATCH /api/v1/reviews/:draftId/submit
// ===========================================================================

describe('PATCH /api/v1/reviews/:draftId/submit', () => {
  it('advisor submits a DRAFT → 200 with status PENDING_REVIEW', async () => {
    const draft = makeDraft({ status: 'DRAFT' });
    const updatedDraft = makeDraft({ status: 'PENDING_REVIEW' });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/submit`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING_REVIEW');

    // Verify draft.update was called with PENDING_REVIEW
    expect(prisma.draft.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: DRAFT_ID },
        data: expect.objectContaining({ status: 'PENDING_REVIEW' }),
      })
    );
  });

  it('advisor submits a NEEDS_CHANGES draft → 200 with status PENDING_REVIEW', async () => {
    const draft = makeDraft({ status: 'NEEDS_CHANGES' });
    const updatedDraft = makeDraft({ status: 'PENDING_REVIEW' });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/submit`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PENDING_REVIEW');
  });

  it('returns 409 when draft is already PENDING_REVIEW', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/submit`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 401 when unauthenticated (no token)', async () => {
    const res = await client.patch(`/api/v1/reviews/${DRAFT_ID}/submit`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 404 when draft does not exist', async () => {
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/submit`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });
});

// ===========================================================================
// PATCH /api/v1/reviews/:draftId/approve
// ===========================================================================

describe('PATCH /api/v1/reviews/:draftId/approve', () => {
  it('compliance officer approves a PENDING_REVIEW draft → 200 APPROVED', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    const updatedDraft = makeDraft({
      status: 'APPROVED',
      reviewerId: COMPLIANCE_USER_ID,
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
    expect(res.body.data.reviewerId).toBe(COMPLIANCE_USER_ID);
  });

  it('admin can approve a PENDING_REVIEW draft → 200 APPROVED', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    const updatedDraft = makeDraft({
      status: 'APPROVED',
      reviewerId: ADMIN_USER_ID,
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${makeAdminToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('APPROVED');
  });

  it('returns 403 when an advisor tries to approve a draft', async () => {
    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 when draft is not in PENDING_REVIEW status', async () => {
    const draft = makeDraft({ status: 'DRAFT' });
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.patch(`/api/v1/reviews/${DRAFT_ID}/approve`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================================================
// PATCH /api/v1/reviews/:draftId/reject
// ===========================================================================

describe('PATCH /api/v1/reviews/:draftId/reject', () => {
  it('compliance officer rejects a PENDING_REVIEW draft with reason → 200 REJECTED', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    const updatedDraft = makeDraft({
      status: 'REJECTED',
      reviewerId: COMPLIANCE_USER_ID,
      reviewNotes: 'Contains prohibited terms about guaranteed returns.',
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/reject`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ reason: 'Contains prohibited terms about guaranteed returns.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('REJECTED');
    expect(res.body.data.reviewNotes).toBe('Contains prohibited terms about guaranteed returns.');
  });

  it('returns 400 when no reason is provided', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/reject`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({});

    // Service throws 400 for missing reason
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when an advisor tries to reject a draft', async () => {
    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/reject`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`)
      .send({ reason: 'Bad content' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 when draft is not in PENDING_REVIEW status', async () => {
    const draft = makeDraft({ status: 'APPROVED' });
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/reject`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ reason: 'Cannot reject an already-approved draft' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================================================
// PATCH /api/v1/reviews/:draftId/request-changes
// ===========================================================================

describe('PATCH /api/v1/reviews/:draftId/request-changes', () => {
  it('compliance requests changes on a PENDING_REVIEW draft → 200 NEEDS_CHANGES', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    const updatedDraft = makeDraft({
      status: 'NEEDS_CHANGES',
      reviewerId: COMPLIANCE_USER_ID,
      reviewNotes: 'Please add the required disclosure at the bottom.',
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/request-changes`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ notes: 'Please add the required disclosure at the bottom.' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('NEEDS_CHANGES');
    expect(res.body.data.reviewNotes).toBe(
      'Please add the required disclosure at the bottom.'
    );
  });

  it('returns 400 when no notes are provided', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/request-changes`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when an advisor tries to request changes', async () => {
    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/request-changes`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`)
      .send({ notes: 'This should not work' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 when draft is not in PENDING_REVIEW status', async () => {
    const draft = makeDraft({ status: 'DRAFT' });
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/request-changes`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ notes: 'Add disclosures please' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================================================
// PATCH /api/v1/reviews/:draftId/edit
// ===========================================================================

describe('PATCH /api/v1/reviews/:draftId/edit', () => {
  it('compliance officer can edit content of a PENDING_REVIEW draft → 200', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW', version: 1 });
    const updatedDraft = makeDraft({
      status: 'PENDING_REVIEW',
      version: 2,
      linkedinContent: 'Retirement planning is important. Past performance does not guarantee future results.',
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/edit`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({
        linkedinContent:
          'Retirement planning is important. Past performance does not guarantee future results.',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.version).toBe(2);
    expect(res.body.data.linkedinContent).toContain(
      'Past performance does not guarantee future results.'
    );
  });

  it('version counter is incremented when compliance edits content', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW', version: 3 });
    const updatedDraft = makeDraft({ status: 'PENDING_REVIEW', version: 4 });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/edit`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ linkedinContent: 'Updated content with disclosure.' });

    // Verify version was incremented in the update call
    expect(prisma.draft.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ version: 4 }),
      })
    );
  });

  it('advisor tries to edit a PENDING_REVIEW draft → 403', async () => {
    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/edit`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`)
      .send({ linkedinContent: 'Trying to edit...' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 409 when trying to edit a draft not in PENDING_REVIEW', async () => {
    const draft = makeDraft({ status: 'DRAFT' });
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);

    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/edit`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ linkedinContent: 'Editing a draft-status draft' });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/edit`)
      .send({ linkedinContent: 'No auth' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================================================
// GET /api/v1/reviews  — compliance review queue
// ===========================================================================

describe('GET /api/v1/reviews', () => {
  it('compliance officer sees the PENDING_REVIEW queue', async () => {
    const pendingDraft1 = makeDraft({
      id: '11111111-e29b-41d4-a716-446655440001',
      status: 'PENDING_REVIEW',
    });
    const pendingDraft2 = makeDraft({
      id: '22222222-e29b-41d4-a716-446655440002',
      status: 'PENDING_REVIEW',
    });

    (prisma.draft.findMany as jest.Mock).mockResolvedValue([
      pendingDraft1,
      pendingDraft2,
    ]);
    (prisma.draft.count as jest.Mock).mockResolvedValue(2);

    const res = await client
      .get('/api/v1/reviews')
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.data)).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.data[0].status).toBe('PENDING_REVIEW');
    expect(res.body.data[1].status).toBe('PENDING_REVIEW');
  });

  it('returns pagination metadata', async () => {
    (prisma.draft.findMany as jest.Mock).mockResolvedValue([makeDraft({ status: 'PENDING_REVIEW' })]);
    (prisma.draft.count as jest.Mock).mockResolvedValue(15);

    const res = await client
      .get('/api/v1/reviews?page=1&limit=10')
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.meta).toMatchObject({
      page: 1,
      limit: 10,
      totalCount: 15,
      totalPages: 2,
      hasNextPage: true,
      hasPreviousPage: false,
    });
  });

  it('returns 403 when an advisor tries to view the review queue', async () => {
    const res = await client
      .get('/api/v1/reviews')
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/reviews');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================================================
// GET /api/v1/reviews/:draftId — single draft for review
// ===========================================================================

describe('GET /api/v1/reviews/:draftId', () => {
  it('compliance officer can view a specific draft for review', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);

    const res = await client
      .get(`/api/v1/reviews/${DRAFT_ID}`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(DRAFT_ID);
  });

  it('returns 403 when an advisor tries to view the review endpoint', async () => {
    const res = await client
      .get(`/api/v1/reviews/${DRAFT_ID}`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when draft does not exist', async () => {
    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .get(`/api/v1/reviews/${DRAFT_ID}`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ===========================================================================
// Audit trail verification
// ===========================================================================

describe('AuditTrail — state changes write audit rows', () => {
  it('audit trail row is written with SUBMITTED action when advisor submits', async () => {
    const draft = makeDraft({ status: 'DRAFT' });
    const updatedDraft = makeDraft({ status: 'PENDING_REVIEW' });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/submit`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    expect(prisma.auditTrail.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'SUBMITTED',
          entityType: 'Draft',
          entityId: DRAFT_ID,
          actorId: ADVISOR_USER_ID,
          organizationId: TEST_ORG_ID,
        }),
      })
    );
  });

  it('audit trail row is written with APPROVED action when compliance approves', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    const updatedDraft = makeDraft({
      status: 'APPROVED',
      reviewerId: COMPLIANCE_USER_ID,
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    expect(prisma.auditTrail.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'APPROVED',
          entityType: 'Draft',
          entityId: DRAFT_ID,
          actorId: COMPLIANCE_USER_ID,
          organizationId: TEST_ORG_ID,
        }),
      })
    );
  });

  it('audit trail row is written with REJECTED action and reason in metadata', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    const updatedDraft = makeDraft({
      status: 'REJECTED',
      reviewerId: COMPLIANCE_USER_ID,
      reviewNotes: 'Misleading claims about investment returns',
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/reject`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ reason: 'Misleading claims about investment returns' });

    expect(prisma.auditTrail.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'REJECTED',
          entityType: 'Draft',
          entityId: DRAFT_ID,
          actorId: COMPLIANCE_USER_ID,
          organizationId: TEST_ORG_ID,
          metadata: expect.objectContaining({
            reason: 'Misleading claims about investment returns',
          }),
        }),
      })
    );
  });

  it('audit trail row includes previousState and newState on approve', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW', version: 2 });
    const updatedDraft = makeDraft({
      status: 'APPROVED',
      reviewerId: COMPLIANCE_USER_ID,
      version: 2,
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    const auditCall = (prisma.auditTrail.create as jest.Mock).mock.calls[0][0];
    expect(auditCall.data.previousState).toBeDefined();
    expect(auditCall.data.newState).toBeDefined();
    expect(auditCall.data.previousState.status).toBe('PENDING_REVIEW');
    expect(auditCall.data.newState.status).toBe('APPROVED');
  });

  it('audit trail row is written with STATUS_CHANGED action when changes requested', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW' });
    const updatedDraft = makeDraft({
      status: 'NEEDS_CHANGES',
      reviewerId: COMPLIANCE_USER_ID,
      reviewNotes: 'Add required FINRA disclosure',
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/request-changes`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ notes: 'Add required FINRA disclosure' });

    expect(prisma.auditTrail.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'STATUS_CHANGED',
          entityType: 'Draft',
          entityId: DRAFT_ID,
          actorId: COMPLIANCE_USER_ID,
        }),
      })
    );
  });

  it('audit trail row is written with UPDATED action when compliance edits content', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW', version: 1 });
    const updatedDraft = makeDraft({ status: 'PENDING_REVIEW', version: 2 });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/edit`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`)
      .send({ linkedinContent: 'Updated with required disclosure text.' });

    expect(prisma.auditTrail.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'UPDATED',
          entityType: 'Draft',
          entityId: DRAFT_ID,
          actorId: COMPLIANCE_USER_ID,
        }),
      })
    );
  });
});

// ===========================================================================
// Notification verification
// ===========================================================================

describe('Notifications — status change notifications are sent', () => {
  it('compliance officers are notified when a draft is submitted for review', async () => {
    const draft = makeDraft({ status: 'DRAFT' });
    const updatedDraft = makeDraft({ status: 'PENDING_REVIEW' });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/submit`)
      .set('Authorization', `Bearer ${makeAdvisorToken()}`);

    // Notification should be created for the compliance officer
    expect(prisma.notification.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: COMPLIANCE_USER_ID,
          type: 'CONTENT_SUBMITTED',
          organizationId: TEST_ORG_ID,
        }),
      })
    );
  });

  it('advisor is notified when their draft is approved', async () => {
    const draft = makeDraft({ status: 'PENDING_REVIEW', creatorId: ADVISOR_USER_ID });
    const updatedDraft = makeDraft({
      status: 'APPROVED',
      reviewerId: COMPLIANCE_USER_ID,
    });

    (prisma.draft.findUnique as jest.Mock).mockResolvedValue(draft);
    (prisma.draft.update as jest.Mock).mockResolvedValue(updatedDraft);

    await client
      .patch(`/api/v1/reviews/${DRAFT_ID}/approve`)
      .set('Authorization', `Bearer ${makeComplianceToken()}`);

    expect(prisma.notification.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: ADVISOR_USER_ID,
          type: 'CONTENT_APPROVED',
          organizationId: TEST_ORG_ID,
        }),
      })
    );
  });
});
