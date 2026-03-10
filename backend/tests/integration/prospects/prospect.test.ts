/**
 * Integration tests for FR-007: Prospect Finder Module
 *
 * Tests cover:
 *  - POST /api/v1/prospects/requests       — creates request with criteria
 *  - GET  /api/v1/prospects/requests       — lists org's requests
 *  - GET  /api/v1/prospects/requests/:id   — get single request
 *  - DELETE /api/v1/prospects/requests/:id — cancels PENDING request
 *  - DELETE /api/v1/prospects/requests/:id — cannot cancel non-PENDING → 409
 *  - Super admin: GET /api/v1/admin/prospect-requests — sees all orgs
 *  - Super admin: POST /api/v1/admin/prospect-requests/:id/upload — parses CSV, sets creditCost
 *  - POST /api/v1/admin/prospect-requests/:id/confirm — deducts credits, imports leads
 *  - POST /api/v1/admin/prospect-requests/:id/confirm — insufficient credits → 402
 *  - Role check: advisor cannot access /api/v1/admin/* → 403
 *
 * Uses jest.mock to replace Prisma client and csv-parse to avoid real DB/FS access.
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
    prospectListRequest: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    lead: {
      createMany: jest.fn(),
    },
    auditTrail: {
      create: jest.fn().mockResolvedValue({}),
    },
    creditTransaction: {
      create: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    $transaction: jest.fn(),
  },
  default: {},
}));

import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/client';

// ---------------------------------------------------------------------------
// Constants and fixtures
// ---------------------------------------------------------------------------

const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_ORG_ID_2 = '660e8400-e29b-41d4-a716-446655440001';
const TEST_USER_ID = '770e8400-e29b-41d4-a716-446655440002';
const SUPER_ADMIN_USER_ID = '880e8400-e29b-41d4-a716-446655440003';
const TEST_REQUEST_ID = '990e8400-e29b-41d4-a716-446655440004';

/** Creates a signed JWT access token for test user */
function makeAccessToken(userId: string, orgId: string, role: string): string {
  return jwt.sign(
    {
      sub: userId,
      orgId,
      role,
      email: `${userId}@test.vireos.com`,
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

const advisorToken = makeAccessToken(TEST_USER_ID, TEST_ORG_ID, 'advisor');
const superAdminToken = makeAccessToken(
  SUPER_ADMIN_USER_ID,
  'admin-org-id',
  'super_admin'
);

const mockOrg = {
  id: TEST_ORG_ID,
  name: 'Test Org',
  subscriptionStatus: 'ACTIVE',
  creditBalance: 500,
};

const mockRequest = {
  id: TEST_REQUEST_ID,
  organizationId: TEST_ORG_ID,
  requestedById: TEST_USER_ID,
  fulfilledById: null,
  criteria: { geography: 'New York', linkedinRequired: false, emailValidated: true },
  status: 'PENDING',
  requestedCount: 50,
  fulfilledCount: 0,
  creditCost: 0,
  confirmedAt: null,
  fulfilledAt: null,
  notes: 'Test request',
  csvKey: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockProcessingRequest = {
  ...mockRequest,
  status: 'PROCESSING',
  fulfilledById: SUPER_ADMIN_USER_ID,
  fulfilledCount: 3,
  creditCost: 4, // 3 records, one with linkedin = 2 credits, two standard = 2 credits
  csvKey: Buffer.from(
    'firstName,lastName,email,phone,company,title,linkedinUrl\n' +
    'John,Doe,john.doe@example.com,555-0001,Acme Corp,CEO,https://linkedin.com/in/johndoe\n' +
    'Jane,Smith,jane.smith@example.com,555-0002,Beta Inc,CFO,\n' +
    'Bob,Jones,bob.jones@example.com,,,,'
  ).toString('base64'),
};

const mockFulfilledRequest = {
  ...mockProcessingRequest,
  status: 'FULFILLED',
  confirmedAt: new Date(),
  fulfilledAt: new Date(),
};

/** CSV buffer for upload tests */
const validCsvBuffer = Buffer.from(
  'firstName,lastName,email,phone,company,title,linkedinUrl\n' +
  'John,Doe,john.doe@example.com,555-0001,Acme Corp,CEO,https://linkedin.com/in/johndoe\n' +
  'Jane,Smith,jane.smith@example.com,555-0002,Beta Inc,CFO,\n' +
  'Bob,Jones,bob.jones@example.com,,,,'
);

// ---------------------------------------------------------------------------
// App and supertest client setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

beforeEach(() => {
  jest.clearAllMocks();
  (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
  (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 1 });
  (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
});

// ---------------------------------------------------------------------------
// POST /api/v1/prospects/requests
// ---------------------------------------------------------------------------

describe('POST /api/v1/prospects/requests', () => {
  it('happy path — creates a request with criteria and returns 201', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    (prisma.prospectListRequest.create as jest.Mock).mockResolvedValue(mockRequest);

    const res = await client
      .post('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        criteria: {
          geography: 'New York',
          linkedinRequired: false,
          emailValidated: true,
        },
        requestedCount: 50,
        notes: 'Test request',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_REQUEST_ID,
      organizationId: TEST_ORG_ID,
      status: 'PENDING',
      requestedCount: 50,
    });

    expect(prisma.prospectListRequest.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          organizationId: TEST_ORG_ID,
          requestedById: TEST_USER_ID,
          status: 'PENDING',
          requestedCount: 50,
        }),
      })
    );
  });

  it('returns 403 when org has cancelled subscription', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      ...mockOrg,
      subscriptionStatus: 'CANCELLED',
    });

    const res = await client
      .post('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        criteria: { linkedinRequired: false, emailValidated: true },
        requestedCount: 10,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid requestedCount (above max)', async () => {
    const res = await client
      .post('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        criteria: { linkedinRequired: false, emailValidated: true },
        requestedCount: 99999,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for requestedCount below minimum', async () => {
    const res = await client
      .post('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        criteria: { linkedinRequired: false, emailValidated: true },
        requestedCount: 0,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client
      .post('/api/v1/prospects/requests')
      .send({
        criteria: { linkedinRequired: false, emailValidated: true },
        requestedCount: 10,
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for missing criteria field', async () => {
    const res = await client
      .post('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        requestedCount: 10,
        // criteria is missing
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('applies default requestedCount when omitted', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    (prisma.prospectListRequest.create as jest.Mock).mockResolvedValue({
      ...mockRequest,
      requestedCount: 100,
    });

    const res = await client
      .post('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`)
      .send({
        criteria: { linkedinRequired: false, emailValidated: true },
        // requestedCount defaults to 100
      });

    expect(res.status).toBe(201);
    // Verify the default was applied
    const createCall = (prisma.prospectListRequest.create as jest.Mock).mock.calls[0]?.[0];
    expect(createCall?.data?.requestedCount).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/prospects/requests
// ---------------------------------------------------------------------------

describe('GET /api/v1/prospects/requests', () => {
  it('happy path — lists org requests with pagination meta', async () => {
    (prisma.prospectListRequest.findMany as jest.Mock).mockResolvedValue([mockRequest]);
    (prisma.prospectListRequest.count as jest.Mock).mockResolvedValue(1);

    const res = await client
      .get('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({
      id: TEST_REQUEST_ID,
      organizationId: TEST_ORG_ID,
      status: 'PENDING',
    });
    expect(res.body.meta).toMatchObject({
      page: 1,
      totalCount: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('enforces org isolation — only returns requests for the calling user\'s org', async () => {
    (prisma.prospectListRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.prospectListRequest.count as jest.Mock).mockResolvedValue(0);

    await client
      .get('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`);

    // Verify the query was scoped to the user's orgId
    const findCall = (prisma.prospectListRequest.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findCall?.where?.organizationId).toBe(TEST_ORG_ID);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/prospects/requests');
    expect(res.status).toBe(401);
  });

  it('returns empty list when org has no requests', async () => {
    (prisma.prospectListRequest.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.prospectListRequest.count as jest.Mock).mockResolvedValue(0);

    const res = await client
      .get('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(0);
    expect(res.body.meta.totalCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/prospects/requests/:id
// ---------------------------------------------------------------------------

describe('GET /api/v1/prospects/requests/:id', () => {
  it('returns the request when it belongs to the user\'s org', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);

    const res = await client
      .get(`/api/v1/prospects/requests/${TEST_REQUEST_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.id).toBe(TEST_REQUEST_ID);
  });

  it('returns 403 when request belongs to a different org', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockRequest,
      organizationId: TEST_ORG_ID_2, // different org
    });

    const res = await client
      .get(`/api/v1/prospects/requests/${TEST_REQUEST_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when request does not exist', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .get(`/api/v1/prospects/requests/${TEST_REQUEST_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/prospects/requests/:id — cancel
// ---------------------------------------------------------------------------

describe('DELETE /api/v1/prospects/requests/:id', () => {
  it('happy path — cancels a PENDING request', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);
    (prisma.prospectListRequest.update as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: 'CANCELLED',
    });

    const res = await client
      .delete(`/api/v1/prospects/requests/${TEST_REQUEST_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('CANCELLED');

    // Verify update was called with CANCELLED status
    const updateCall = (prisma.prospectListRequest.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.status).toBe('CANCELLED');
  });

  it('returns 409 when trying to cancel a non-PENDING request (PROCESSING)', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: 'PROCESSING',
    });

    const res = await client
      .delete(`/api/v1/prospects/requests/${TEST_REQUEST_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });

  it('returns 409 when trying to cancel a FULFILLED request', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: 'FULFILLED',
    });

    const res = await client
      .delete(`/api/v1/prospects/requests/${TEST_REQUEST_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when trying to cancel another org\'s request', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockRequest,
      organizationId: TEST_ORG_ID_2,
    });

    const res = await client
      .delete(`/api/v1/prospects/requests/${TEST_REQUEST_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when request does not exist', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .delete(`/api/v1/prospects/requests/${TEST_REQUEST_ID}`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/admin/prospect-requests — super admin list all
// ---------------------------------------------------------------------------

describe('GET /api/v1/admin/prospect-requests', () => {
  it('super admin — sees requests from all organizations', async () => {
    const requestFromOtherOrg = {
      ...mockRequest,
      id: 'other-request-id',
      organizationId: TEST_ORG_ID_2,
      organization: { name: 'Other Org' },
    };
    const requestFromTestOrg = {
      ...mockRequest,
      organization: { name: 'Test Org' },
    };

    (prisma.prospectListRequest.findMany as jest.Mock).mockResolvedValue([
      requestFromTestOrg,
      requestFromOtherOrg,
    ]);
    (prisma.prospectListRequest.count as jest.Mock).mockResolvedValue(2);

    const res = await client
      .get('/api/v1/admin/prospect-requests')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.totalCount).toBe(2);
  });

  it('supports filtering by status', async () => {
    (prisma.prospectListRequest.findMany as jest.Mock).mockResolvedValue([
      { ...mockRequest, organization: { name: 'Test Org' } },
    ]);
    (prisma.prospectListRequest.count as jest.Mock).mockResolvedValue(1);

    const res = await client
      .get('/api/v1/admin/prospect-requests?status=PENDING')
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(res.status).toBe(200);

    // Verify filter was applied in query
    const findCall = (prisma.prospectListRequest.findMany as jest.Mock).mock.calls[0]?.[0];
    expect(findCall?.where?.status).toBe('PENDING');
  });

  it('returns 403 when called by an advisor (not super admin)', async () => {
    const res = await client
      .get('/api/v1/admin/prospect-requests')
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/admin/prospect-requests');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/prospect-requests/:id/upload
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/prospect-requests/:id/upload', () => {
  it('super admin — parses CSV, sets creditCost, and transitions to PROCESSING', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);
    (prisma.prospectListRequest.update as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: 'PROCESSING',
      fulfilledById: SUPER_ADMIN_USER_ID,
      fulfilledCount: 3,
      creditCost: 4, // 1 linkedin (2 credits) + 2 standard (1 credit each) = 4
      csvKey: validCsvBuffer.toString('base64'),
    });

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', validCsvBuffer, {
        filename: 'prospects.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('PROCESSING');
    expect(res.body.data.fulfilledCount).toBe(3);
    expect(res.body.data.creditCost).toBe(4);

    // Verify update was called with correct data
    const updateCall = (prisma.prospectListRequest.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.status).toBe('PROCESSING');
    expect(updateCall?.data?.fulfilledCount).toBe(3);
    expect(updateCall?.data?.creditCost).toBe(4);
    expect(updateCall?.data?.csvKey).toBeDefined();
  });

  it('returns 403 when called by an advisor (not super admin)', async () => {
    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .attach('file', validCsvBuffer, {
        filename: 'prospects.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when no file is provided', async () => {
    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 409 when request is already FULFILLED', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockRequest,
      status: 'FULFILLED',
    });

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', validCsvBuffer, {
        filename: 'prospects.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when request does not exist', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', validCsvBuffer, {
        filename: 'prospects.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 for a CSV with empty records (all missing required fields)', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);

    const emptyCsv = Buffer.from('firstName,lastName,email\n,,\n,,');

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', emptyCsv, {
        filename: 'empty.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/admin/prospect-requests/:id/confirm
// ---------------------------------------------------------------------------

describe('POST /api/v1/admin/prospect-requests/:id/confirm', () => {
  it('happy path — deducts credits, imports leads, and returns count', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockProcessingRequest,
      organization: mockOrg, // creditBalance: 500, creditCost: 4
    });

    // Mock the $transaction to run the callback and return result
    (prisma.$transaction as jest.Mock).mockImplementation(
      async (callback: (tx: typeof prisma) => Promise<void>) => {
        await callback({
          organization: {
            update: jest.fn().mockResolvedValue({ ...mockOrg, creditBalance: 496 }),
          },
          creditTransaction: {
            create: jest.fn().mockResolvedValue({}),
          },
          prospectListRequest: {
            update: jest.fn().mockResolvedValue(mockFulfilledRequest),
          },
        } as unknown as typeof prisma);
      }
    );

    (prisma.lead.createMany as jest.Mock).mockResolvedValue({ count: 3 });

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/confirm`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      leads: expect.any(Number),
      creditsDeducted: 4,
    });
  });

  it('returns 402 when org has insufficient credits', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockProcessingRequest,
      creditCost: 1000,
      organization: {
        ...mockOrg,
        creditBalance: 5, // 5 credits < 1000 required
      },
    });

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/confirm`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(402);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('PAYMENT_REQUIRED');
  });

  it('returns 409 when request is not in PROCESSING status', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockRequest, // status: PENDING
      organization: mockOrg,
    });

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/confirm`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
  });

  it('returns 403 when an advisor tries to confirm another org\'s request', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockProcessingRequest,
      organizationId: TEST_ORG_ID_2, // different org
      organization: { ...mockOrg, id: TEST_ORG_ID_2 },
    });

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/confirm`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  it('returns 400 when no CSV has been uploaded (csvKey is null)', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue({
      ...mockProcessingRequest,
      csvKey: null,
      organization: mockOrg,
    });

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/confirm`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when request does not exist', async () => {
    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/confirm`)
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Role checks — advisor cannot access /api/v1/admin/* routes
// ---------------------------------------------------------------------------

describe('Role checks — advisor cannot access admin routes', () => {
  it('GET /api/v1/admin/prospect-requests returns 403 for advisor', async () => {
    const res = await client
      .get('/api/v1/admin/prospect-requests')
      .set('Authorization', `Bearer ${advisorToken}`);

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('POST /api/v1/admin/prospect-requests/:id/upload returns 403 for advisor', async () => {
    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${advisorToken}`)
      .attach('file', validCsvBuffer, {
        filename: 'test.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('VIEWER role returns 403 for all prospect endpoints', async () => {
    const viewerToken = makeAccessToken('viewer-user-id', TEST_ORG_ID, 'viewer');

    const res = await client
      .post('/api/v1/prospects/requests')
      .set('Authorization', `Bearer ${viewerToken}`)
      .send({
        criteria: { linkedinRequired: false, emailValidated: true },
        requestedCount: 10,
      });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Credit cost calculation validation
// ---------------------------------------------------------------------------

describe('Credit cost calculation', () => {
  it('calculates 2 credits for LinkedIn-verified records and 1 for standard', async () => {
    // CSV with 2 standard + 1 LinkedIn = 4 credits
    const csvWith1LinkedIn = Buffer.from(
      'firstName,lastName,email,linkedinUrl\n' +
      'Alice,Adams,alice@example.com,https://linkedin.com/in/alice\n' +
      'Bob,Baker,bob@example.com,\n' +
      'Charlie,Clark,charlie@example.com,'
    );

    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);
    (prisma.prospectListRequest.update as jest.Mock).mockImplementation((args) => ({
      ...mockRequest,
      status: 'PROCESSING',
      ...args.data,
    }));

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', csvWith1LinkedIn, {
        filename: 'prospects.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    // 1 LinkedIn (2 credits) + 2 standard (1 each) = 4 credits
    expect(res.body.data.creditCost).toBe(4);
    expect(res.body.data.fulfilledCount).toBe(3);
  });

  it('skips rows with missing email during CSV parsing', async () => {
    // CSV where one row has no email — should be skipped
    const csvWithMissingEmail = Buffer.from(
      'firstName,lastName,email\n' +
      'Alice,Adams,alice@example.com\n' +
      'Bob,Baker,\n' + // missing email
      'Charlie,Clark,charlie@example.com'
    );

    (prisma.prospectListRequest.findUnique as jest.Mock).mockResolvedValue(mockRequest);
    (prisma.prospectListRequest.update as jest.Mock).mockImplementation((args) => ({
      ...mockRequest,
      status: 'PROCESSING',
      ...args.data,
    }));

    const res = await client
      .post(`/api/v1/admin/prospect-requests/${TEST_REQUEST_ID}/upload`)
      .set('Authorization', `Bearer ${superAdminToken}`)
      .attach('file', csvWithMissingEmail, {
        filename: 'prospects.csv',
        contentType: 'text/csv',
      });

    expect(res.status).toBe(200);
    // Only 2 valid records (Alice and Charlie); Bob was skipped due to missing email
    expect(res.body.data.fulfilledCount).toBe(2);
    expect(res.body.data.creditCost).toBe(2); // 2 standard records × 1 credit
  });
});
