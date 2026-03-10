/**
 * Integration tests for FR-008: Lead Management & Pipeline
 *
 * Tests cover:
 *  - POST /api/v1/leads — creates lead, returns lead object
 *  - POST /api/v1/leads — duplicate email in same org → updates existing (upsert)
 *  - GET  /api/v1/leads — paginated list with filters
 *  - GET  /api/v1/leads/:id — returns lead with activities
 *  - PUT  /api/v1/leads/:id — updates lead
 *  - PATCH /api/v1/leads/:id/status — changes status, auto-creates activity
 *  - PATCH /api/v1/leads/:id/assign — assigns to advisor (admin only)
 *  - POST /api/v1/leads/:id/activities — adds activity
 *  - GET  /api/v1/leads/:id/activities — returns activities
 *  - POST /api/v1/leads/import — imports CSV, returns counts
 *  - POST /api/v1/leads/bulk/status — bulk status update
 *  - Org isolation: user can't access leads from other org → 404
 *
 * Uses jest.mock to replace Prisma client and avoid a live DB connection.
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
jest.mock('rate-limit-redis', () => ({
  RedisStore: jest.fn().mockImplementation(() => ({
    init: jest.fn(),
    increment: jest.fn().mockResolvedValue({ totalHits: 1, resetTime: new Date() }),
    decrement: jest.fn(),
    resetKey: jest.fn(),
    resetAll: jest.fn(),
  })),
}));

// ---- Mock csv-parse/sync ----
jest.mock('csv-parse/sync', () => ({
  parse: jest.fn(),
}));

// ---- Mock Prisma client ----
jest.mock('../../../src/db/client', () => ({
  prisma: {
    lead: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
      createMany: jest.fn(),
    },
    leadActivity: {
      findMany: jest.fn(),
      create: jest.fn(),
      createMany: jest.fn(),
      count: jest.fn(),
    },
    user: {
      findFirst: jest.fn(),
      findUnique: jest.fn(),
    },
    auditTrail: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: jest.fn(),
  },
  default: {},
}));

import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/client';
import { parse as csvParseMock } from 'csv-parse/sync';

// ---------------------------------------------------------------------------
// Constants & fixtures
// ---------------------------------------------------------------------------

const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const OTHER_ORG_ID = '550e8400-e29b-41d4-a716-446655440001';
const USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const ADMIN_ID = '660e8400-e29b-41d4-a716-446655440002';
const ADVISOR_ID = '770e8400-e29b-41d4-a716-446655440003';
const LEAD_ID = '880e8400-e29b-41d4-a716-446655440001';

function makeToken(
  userId: string,
  orgId: string,
  role: string = 'org_admin'
): string {
  return jwt.sign(
    { sub: userId, orgId, role, email: `${userId}@test.com`, type: 'access' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const adminToken = makeToken(ADMIN_ID, ORG_ID, 'org_admin');
const advisorToken = makeToken(USER_ID, ORG_ID, 'advisor');
const otherOrgToken = makeToken(USER_ID, OTHER_ORG_ID, 'org_admin');

const mockLead = {
  id: LEAD_ID,
  organizationId: ORG_ID,
  assignedAdvisorId: null,
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  phone: '555-1234',
  company: 'Acme Corp',
  title: 'CEO',
  linkedinUrl: null,
  source: 'MANUAL_IMPORT',
  status: 'NEW',
  campaignId: null,
  prospectRequestId: null,
  customFields: {},
  notes: 'Test lead',
  isUnsubscribed: false,
  unsubscribedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockActivity = {
  id: '990e8400-e29b-41d4-a716-446655440001',
  leadId: LEAD_ID,
  organizationId: ORG_ID,
  actorId: ADMIN_ID,
  type: 'NOTE',
  description: 'Spoke with the client today',
  metadata: {},
  createdAt: new Date('2024-01-01'),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// POST /api/v1/leads — create lead
// ---------------------------------------------------------------------------

describe('POST /api/v1/leads', () => {
  it('creates a new lead and returns it with 201', async () => {
    // No existing lead with this email
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.lead.create as jest.Mock).mockResolvedValue(mockLead);

    const res = await client
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        source: 'MANUAL_IMPORT',
        phone: '555-1234',
        company: 'Acme Corp',
        title: 'CEO',
        notes: 'Test lead',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: LEAD_ID,
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
      organizationId: ORG_ID,
    });

    expect(prisma.lead.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: ORG_ID,
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          source: 'MANUAL_IMPORT',
          status: 'NEW',
        }),
      })
    );
  });

  it('upserts (updates) existing lead on duplicate email within same org', async () => {
    const updatedLead = { ...mockLead, phone: '555-9999' };

    // findUnique returns existing lead
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(mockLead);
    (prisma.lead.update as jest.Mock).mockResolvedValue(updatedLead);

    const res = await client
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        source: 'MANUAL_IMPORT',
        phone: '555-9999',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    // Should have called update, NOT create
    expect(prisma.lead.update as jest.Mock).toHaveBeenCalled();
    expect(prisma.lead.create as jest.Mock).not.toHaveBeenCalled();
  });

  it('returns 422 for missing required fields', async () => {
    const res = await client
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'John' }); // missing lastName, email, source

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for invalid email', async () => {
    const res = await client
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'not-an-email',
        source: 'MANUAL_IMPORT',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid source enum', async () => {
    const res = await client
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
        source: 'INVALID_SOURCE',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.post('/api/v1/leads').send({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
      source: 'MANUAL_IMPORT',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/leads — list leads
// ---------------------------------------------------------------------------

describe('GET /api/v1/leads', () => {
  it('returns a paginated list of leads', async () => {
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead]);
    (prisma.lead.count as jest.Mock).mockResolvedValue(1);

    const res = await client
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: LEAD_ID })])
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

  it('applies status filter', async () => {
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead]);
    (prisma.lead.count as jest.Mock).mockResolvedValue(1);

    const res = await client
      .get('/api/v1/leads?status=NEW')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const findManyCall = (prisma.lead.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where).toMatchObject({ status: 'NEW' });
  });

  it('applies search filter on firstName, lastName, email', async () => {
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([mockLead]);
    (prisma.lead.count as jest.Mock).mockResolvedValue(1);

    const res = await client
      .get('/api/v1/leads?search=John')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);

    const findManyCall = (prisma.lead.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where).toHaveProperty('OR');
  });

  it('applies pagination parameters', async () => {
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.lead.count as jest.Mock).mockResolvedValue(0);

    const res = await client
      .get('/api/v1/leads?page=2&limit=10')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(2);
    expect(res.body.pagination.limit).toBe(10);

    const findManyCall = (prisma.lead.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.skip).toBe(10); // (page-1) * limit
    expect(findManyCall?.take).toBe(10);
  });

  it('advisors only see their assigned leads', async () => {
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.lead.count as jest.Mock).mockResolvedValue(0);

    await client
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${advisorToken}`);

    const findManyCall = (prisma.lead.findMany as jest.Mock).mock.calls[0]?.[0];
    // Advisor scoping: assignedAdvisorId must equal the user's own ID
    expect(findManyCall?.where?.assignedAdvisorId).toBe(USER_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/leads');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/leads/:id — get single lead with activities
// ---------------------------------------------------------------------------

describe('GET /api/v1/leads/:id', () => {
  it('returns the lead with activities for admin', async () => {
    const leadWithActivities = {
      ...mockLead,
      leadActivities: [mockActivity],
    };

    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(leadWithActivities);

    const res = await client
      .get(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: LEAD_ID,
      firstName: 'John',
      activities: expect.arrayContaining([
        expect.objectContaining({ id: mockActivity.id }),
      ]),
    });
  });

  it('returns 404 when lead does not exist', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .get(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('org isolation — other org user cannot access lead → 404', async () => {
    // findFirst returns null because it filters by organizationId
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .get(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get(`/api/v1/leads/${LEAD_ID}`);
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// PUT /api/v1/leads/:id — update lead
// ---------------------------------------------------------------------------

describe('PUT /api/v1/leads/:id', () => {
  it('updates a lead and returns updated data', async () => {
    const updatedLead = { ...mockLead, firstName: 'Jane', company: 'New Corp' };
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    (prisma.lead.update as jest.Mock).mockResolvedValue(updatedLead);

    const res = await client
      .put(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Jane', company: 'New Corp' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      firstName: 'Jane',
      company: 'New Corp',
    });
  });

  it('returns 404 when lead not found', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .put(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Jane' });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 422 for invalid email in update', async () => {
    const res = await client
      .put(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ email: 'not-valid-email' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('does not allow updating the source field', async () => {
    // source is omitted from updateLeadSchema — the value would be stripped
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    (prisma.lead.update as jest.Mock).mockResolvedValue(mockLead);

    const res = await client
      .put(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ firstName: 'Jane', source: 'WEBSITE' }); // source should be stripped

    // Should succeed (source field is just ignored)
    expect(res.status).toBe(200);

    const updateCall = (prisma.lead.update as jest.Mock).mock.calls[0]?.[0];
    // source should NOT be in the data passed to Prisma
    expect(updateCall?.data?.source).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/leads/:id/status — update status
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/leads/:id/status', () => {
  it('changes status and auto-creates STATUS_CHANGE activity', async () => {
    const updatedLead = { ...mockLead, status: 'CONTACTED' };

    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    (prisma.$transaction as jest.Mock).mockResolvedValue([updatedLead, mockActivity]);

    const res = await client
      .patch(`/api/v1/leads/${LEAD_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONTACTED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ status: 'CONTACTED' });

    // Verify $transaction was called (creates lead update + activity together)
    expect(prisma.$transaction as jest.Mock).toHaveBeenCalled();
    const txArgs = (prisma.$transaction as jest.Mock).mock.calls[0]?.[0];
    expect(Array.isArray(txArgs)).toBe(true);
    expect(txArgs).toHaveLength(2);
  });

  it('returns 422 for invalid status', async () => {
    const res = await client
      .patch(`/api/v1/leads/${LEAD_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'INVALID_STATUS' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when lead not found', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .patch(`/api/v1/leads/${LEAD_ID}/status`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONTACTED' });

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/leads/:id/assign — assign lead to advisor
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/leads/:id/assign', () => {
  it('assigns lead to an advisor (admin only)', async () => {
    const assignedLead = { ...mockLead, assignedAdvisorId: ADVISOR_ID };
    const mockAdvisor = { id: ADVISOR_ID, organizationId: ORG_ID };

    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockAdvisor);
    (prisma.lead.update as jest.Mock).mockResolvedValue(assignedLead);

    const res = await client
      .patch(`/api/v1/leads/${LEAD_ID}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ advisorId: ADVISOR_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      assignedAdvisorId: ADVISOR_ID,
    });
  });

  it('returns 404 when advisor not found in org', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null); // advisor not in org

    const res = await client
      .patch(`/api/v1/leads/${LEAD_ID}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ advisorId: ADVISOR_ID });

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when advisor (non-admin) tries to assign', async () => {
    const res = await client
      .patch(`/api/v1/leads/${LEAD_ID}/assign`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ advisorId: ADVISOR_ID });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid advisorId (not a UUID)', async () => {
    const res = await client
      .patch(`/api/v1/leads/${LEAD_ID}/assign`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ advisorId: 'not-a-uuid' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/leads/:id/activities — add activity
// ---------------------------------------------------------------------------

describe('POST /api/v1/leads/:id/activities', () => {
  it('adds a NOTE activity to a lead', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    (prisma.leadActivity.create as jest.Mock).mockResolvedValue(mockActivity);

    const res = await client
      .post(`/api/v1/leads/${LEAD_ID}/activities`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'NOTE',
        description: 'Spoke with the client today',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: mockActivity.id,
      type: 'NOTE',
      description: 'Spoke with the client today',
    });

    expect(prisma.leadActivity.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          leadId: LEAD_ID,
          organizationId: ORG_ID,
          type: 'NOTE',
          description: 'Spoke with the client today',
        }),
      })
    );
  });

  it('returns 422 for invalid activity type', async () => {
    const res = await client
      .post(`/api/v1/leads/${LEAD_ID}/activities`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'INVALID_TYPE',
        description: 'Test',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for empty description', async () => {
    const res = await client
      .post(`/api/v1/leads/${LEAD_ID}/activities`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        type: 'NOTE',
        description: '',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when lead not found', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post(`/api/v1/leads/${LEAD_ID}/activities`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ type: 'NOTE', description: 'Test note' });

    expect(res.status).toBe(404);
  });

  it('accepts all valid activity types', async () => {
    const activityTypes = [
      'NOTE',
      'STATUS_CHANGE',
      'EMAIL_SENT',
      'CALL_LOGGED',
      'MEETING_SCHEDULED',
    ];

    for (const type of activityTypes) {
      (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
      (prisma.leadActivity.create as jest.Mock).mockResolvedValue({
        ...mockActivity,
        type,
      });

      const res = await client
        .post(`/api/v1/leads/${LEAD_ID}/activities`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ type, description: `Activity of type ${type}` });

      expect(res.status).toBe(201);
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/leads/:id/activities — list activities
// ---------------------------------------------------------------------------

describe('GET /api/v1/leads/:id/activities', () => {
  it('returns paginated activities for a lead', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    (prisma.leadActivity.findMany as jest.Mock).mockResolvedValue([mockActivity]);
    (prisma.leadActivity.count as jest.Mock).mockResolvedValue(1);

    const res = await client
      .get(`/api/v1/leads/${LEAD_ID}/activities`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: mockActivity.id }),
      ])
    );
    expect(res.body.pagination).toMatchObject({
      page: 1,
      totalCount: 1,
    });
  });

  it('returns 404 when lead not found', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .get(`/api/v1/leads/${LEAD_ID}/activities`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/leads/import — CSV import
// ---------------------------------------------------------------------------

describe('POST /api/v1/leads/import', () => {
  it('imports a CSV file and returns created/duplicates/errors counts', async () => {
    // Mock csv-parse to return valid parsed rows
    (csvParseMock as jest.Mock).mockReturnValue([
      {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        source: 'MANUAL_IMPORT',
        phone: '555-0001',
      },
      {
        firstName: 'Bob',
        lastName: 'Jones',
        email: 'bob@example.com',
        source: 'WEBSITE',
        company: 'BobCo',
      },
    ]);

    // No existing leads in DB
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.lead.createMany as jest.Mock).mockResolvedValue({ count: 2 });

    const csvContent = Buffer.from(
      'firstName,lastName,email,source\nAlice,Smith,alice@example.com,MANUAL_IMPORT\nBob,Jones,bob@example.com,WEBSITE'
    );

    const res = await client
      .post('/api/v1/leads/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvContent, { filename: 'leads.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      created: 2,
      duplicates: 0,
      errors: [],
    });
  });

  it('counts existing DB records as duplicates', async () => {
    (csvParseMock as jest.Mock).mockReturnValue([
      {
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@example.com',
        source: 'MANUAL_IMPORT',
      },
    ]);

    // alice@example.com already exists in DB
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([
      { email: 'alice@example.com' },
    ]);
    (prisma.lead.createMany as jest.Mock).mockResolvedValue({ count: 0 });

    const csvContent = Buffer.from(
      'firstName,lastName,email,source\nAlice,Smith,alice@example.com,MANUAL_IMPORT'
    );

    const res = await client
      .post('/api/v1/leads/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvContent, { filename: 'leads.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({
      created: 0,
      duplicates: 1,
      errors: [],
    });
  });

  it('returns errors for rows with missing required fields', async () => {
    (csvParseMock as jest.Mock).mockReturnValue([
      {
        firstName: 'Alice',
        lastName: '',      // missing lastName
        email: 'alice@example.com',
        source: 'MANUAL_IMPORT',
      },
    ]);

    const csvContent = Buffer.from('firstName,lastName,email,source\nAlice,,alice@example.com,MANUAL_IMPORT');

    const res = await client
      .post('/api/v1/leads/import')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', csvContent, { filename: 'leads.csv', contentType: 'text/csv' });

    expect(res.status).toBe(200);
    expect(res.body.data.errors).toHaveLength(1);
    expect(res.body.data.created).toBe(0);
  });

  it('returns 400 when no file is uploaded', async () => {
    const res = await client
      .post('/api/v1/leads/import')
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when advisor (non-admin) tries to import', async () => {
    const csvContent = Buffer.from('firstName,lastName,email,source\n');

    const res = await client
      .post('/api/v1/leads/import')
      .set('Authorization', `Bearer ${advisorToken}`)
      .attach('file', csvContent, { filename: 'leads.csv', contentType: 'text/csv' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/leads/bulk/status — bulk status update
// ---------------------------------------------------------------------------

describe('POST /api/v1/leads/bulk/status', () => {
  const lead1Id = '880e8400-e29b-41d4-a716-446655440011';
  const lead2Id = '880e8400-e29b-41d4-a716-446655440012';

  it('bulk-updates status for multiple leads (admin only)', async () => {
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([
      { id: lead1Id, status: 'NEW' },
      { id: lead2Id, status: 'NEW' },
    ]);

    (prisma.$transaction as jest.Mock).mockResolvedValue([
      { count: 2 },
      { count: 2 },
    ]);

    const res = await client
      .post('/api/v1/leads/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leadIds: [lead1Id, lead2Id], status: 'CONTACTED' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({ updated: 2 });
  });

  it('returns 422 for missing leadIds', async () => {
    const res = await client
      .post('/api/v1/leads/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'CONTACTED' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for empty leadIds array', async () => {
    const res = await client
      .post('/api/v1/leads/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leadIds: [], status: 'CONTACTED' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid status', async () => {
    const res = await client
      .post('/api/v1/leads/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leadIds: [lead1Id], status: 'BAD_STATUS' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when advisor (non-admin) tries bulk update', async () => {
    const res = await client
      .post('/api/v1/leads/bulk/status')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({ leadIds: [lead1Id], status: 'CONTACTED' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 0 updated when none of the IDs belong to the org', async () => {
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([]); // no owned leads

    const res = await client
      .post('/api/v1/leads/bulk/status')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ leadIds: [lead1Id, lead2Id], status: 'CONTACTED' });

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ updated: 0 });
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/leads/:id — delete lead
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/leads/:id', () => {
  it('deletes a lead (admin only)', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(mockLead);
    (prisma.lead.delete as jest.Mock).mockResolvedValue(mockLead);

    const res = await client
      .delete(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.lead.delete as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: LEAD_ID } })
    );
  });

  it('returns 404 when lead not found', async () => {
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .delete(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${adminToken}`);

    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 403 when advisor (non-admin) tries to delete', async () => {
    const res = await client
      .delete(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Org isolation — all scoped queries use organizationId
// ---------------------------------------------------------------------------

describe('Org isolation', () => {
  it('GET /leads/:id returns 404 for lead in different org', async () => {
    // findFirst returns null because the WHERE clause includes organizationId = OTHER_ORG_ID
    // but the lead belongs to ORG_ID
    (prisma.lead.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client
      .get(`/api/v1/leads/${LEAD_ID}`)
      .set('Authorization', `Bearer ${otherOrgToken}`);

    // Verify the DB query included OTHER_ORG_ID in the filter
    const findFirstCall = (prisma.lead.findFirst as jest.Mock).mock.calls[0]?.[0];
    expect(findFirstCall?.where?.organizationId).toBe(OTHER_ORG_ID);

    expect(res.status).toBe(404);
  });

  it('GET /leads scopes query to the authenticated user org', async () => {
    (prisma.lead.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.lead.count as jest.Mock).mockResolvedValue(0);

    await client
      .get('/api/v1/leads')
      .set('Authorization', `Bearer ${otherOrgToken}`);

    const findManyCall = (prisma.lead.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findManyCall?.where?.organizationId).toBe(OTHER_ORG_ID);
  });

  it('POST /leads scopes create to the authenticated user org', async () => {
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.lead.create as jest.Mock).mockResolvedValue({
      ...mockLead,
      organizationId: OTHER_ORG_ID,
    });

    await client
      .post('/api/v1/leads')
      .set('Authorization', `Bearer ${otherOrgToken}`)
      .send({
        firstName: 'Alice',
        lastName: 'Smith',
        email: 'alice@other.com',
        source: 'MANUAL_IMPORT',
      });

    const createCall = (prisma.lead.create as jest.Mock).mock.calls[0]?.[0];
    expect(createCall?.data?.organizationId).toBe(OTHER_ORG_ID);
  });
});
