/**
 * Unit tests for AuditService (FR-013: Observability & Audit Trail)
 *
 * Covers:
 *  - write() creates AuditTrail record with correct fields
 *  - write() does NOT throw when DB fails (error swallowed, logged)
 *  - query() returns paginated results
 *  - query() enforces org isolation for non-super_admin
 *  - query() allows super_admin to query any org
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
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    set: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
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
    auditTrail: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  },
  default: {},
}));

// ---- Mock Winston logger to verify error logging ----
jest.mock('../../../src/utils/logger', () => ({
  logger: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
  createChildLogger: jest.fn(),
  default: {
    error: jest.fn(),
    warn: jest.fn(),
    info: jest.fn(),
    debug: jest.fn(),
    http: jest.fn(),
  },
}));

import { AuditAction } from '@prisma/client';
import { prisma } from '../../../src/db/client';
import { logger } from '../../../src/utils/logger';
import { AuditService } from '../../../src/services/audit.service';
import { AuthenticatedUser, UserRole } from '../../../src/types';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const ORG_ID_2 = '660e8400-e29b-41d4-a716-446655440001';
const ACTOR_ID = '770e8400-e29b-41d4-a716-446655440002';

const superAdminUser: AuthenticatedUser = {
  id: 'super-admin-id',
  orgId: 'super-admin-org-id',
  role: UserRole.SUPER_ADMIN,
  email: 'superadmin@vireos.com',
};

const orgAdminUser: AuthenticatedUser = {
  id: ACTOR_ID,
  orgId: ORG_ID,
  role: UserRole.ORG_ADMIN,
  email: 'admin@testorg.com',
};

const advisorUser: AuthenticatedUser = {
  id: 'advisor-id',
  orgId: ORG_ID,
  role: UserRole.ADVISOR,
  email: 'advisor@testorg.com',
};

const mockAuditRecord = {
  id: 'audit-id-1',
  organizationId: ORG_ID,
  actorId: ACTOR_ID,
  entityType: 'Draft',
  entityId: 'draft-id-1',
  action: AuditAction.CREATED,
  previousState: null,
  newState: { title: 'New Draft' },
  metadata: {},
  ipAddress: '127.0.0.1',
  userAgent: 'test-agent',
  createdAt: new Date('2024-01-15T12:00:00Z'),
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

let auditService: AuditService;

beforeEach(() => {
  jest.clearAllMocks();
  auditService = new AuditService();
});

// ---------------------------------------------------------------------------
// write() tests
// ---------------------------------------------------------------------------

describe('AuditService.write()', () => {
  it('creates an AuditTrail record with all correct fields', async () => {
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue(mockAuditRecord);

    await auditService.write({
      organizationId: ORG_ID,
      actorId: ACTOR_ID,
      entityType: 'Draft',
      entityId: 'draft-id-1',
      action: AuditAction.CREATED,
      newState: { title: 'New Draft' },
      metadata: { source: 'api' },
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });

    expect(prisma.auditTrail.create).toHaveBeenCalledTimes(1);
    expect(prisma.auditTrail.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        organizationId: ORG_ID,
        actorId: ACTOR_ID,
        entityType: 'Draft',
        entityId: 'draft-id-1',
        action: AuditAction.CREATED,
        newState: { title: 'New Draft' },
        metadata: { source: 'api' },
        ipAddress: '127.0.0.1',
        userAgent: 'test-agent',
      }),
    });
  });

  it('sets actorId to null when not provided', async () => {
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue(mockAuditRecord);

    await auditService.write({
      organizationId: ORG_ID,
      entityType: 'System',
      entityId: 'system-id',
      action: AuditAction.UPDATED,
    });

    const callArg = (prisma.auditTrail.create as jest.Mock).mock.calls[0][0];
    expect(callArg.data.actorId).toBeNull();
  });

  it('sets previousState and newState correctly', async () => {
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue(mockAuditRecord);

    const previousState = { status: 'DRAFT' };
    const newState = { status: 'PUBLISHED' };

    await auditService.write({
      organizationId: ORG_ID,
      entityType: 'Draft',
      entityId: 'draft-id-1',
      action: AuditAction.STATUS_CHANGED,
      previousState,
      newState,
    });

    const callArg = (prisma.auditTrail.create as jest.Mock).mock.calls[0][0];
    expect(callArg.data.previousState).toEqual(previousState);
    expect(callArg.data.newState).toEqual(newState);
  });

  it('does NOT throw when DB write fails — error is swallowed and logged', async () => {
    const dbError = new Error('Database connection refused');
    (prisma.auditTrail.create as jest.Mock).mockRejectedValue(dbError);

    // Must not throw
    await expect(
      auditService.write({
        organizationId: ORG_ID,
        entityType: 'Draft',
        entityId: 'draft-id-1',
        action: AuditAction.CREATED,
      })
    ).resolves.toBeUndefined();
  });

  it('logs an error when DB write fails', async () => {
    const dbError = new Error('Connection pool exhausted');
    (prisma.auditTrail.create as jest.Mock).mockRejectedValue(dbError);

    await auditService.write({
      organizationId: ORG_ID,
      entityType: 'Draft',
      entityId: 'draft-id-1',
      action: AuditAction.CREATED,
    });

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('AuditService.write failed'),
      expect.objectContaining({
        error: 'Connection pool exhausted',
        organizationId: ORG_ID,
        entityType: 'Draft',
        action: AuditAction.CREATED,
      })
    );
  });

  it('does NOT throw when DB throws a non-Error value', async () => {
    (prisma.auditTrail.create as jest.Mock).mockRejectedValue('string error');

    await expect(
      auditService.write({
        organizationId: ORG_ID,
        entityType: 'Draft',
        entityId: 'draft-id-1',
        action: AuditAction.CREATED,
      })
    ).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining('AuditService.write failed'),
      expect.objectContaining({ error: 'string error' })
    );
  });

  it('uses empty object as default metadata', async () => {
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue(mockAuditRecord);

    await auditService.write({
      organizationId: ORG_ID,
      entityType: 'User',
      entityId: 'user-id-1',
      action: AuditAction.LOGGED_IN,
    });

    const callArg = (prisma.auditTrail.create as jest.Mock).mock.calls[0][0];
    expect(callArg.data.metadata).toEqual({});
  });
});

// ---------------------------------------------------------------------------
// query() tests
// ---------------------------------------------------------------------------

describe('AuditService.query()', () => {
  const pagination = { page: 1, limit: 20 };

  it('returns paginated results with correct structure', async () => {
    const records = [mockAuditRecord];
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue(records);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(1);

    const result = await auditService.query(ORG_ID, {}, pagination, orgAdminUser);

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toEqual(mockAuditRecord);
    expect(result.pagination).toMatchObject({
      page: 1,
      limit: 20,
      totalCount: 1,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    });
  });

  it('queries with the correct organizationId for non-super_admin', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    await auditService.query(ORG_ID, {}, pagination, orgAdminUser);

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.organizationId).toBe(ORG_ID);
  });

  it('enforces org isolation — non-super_admin cannot query a different org', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    // orgAdminUser belongs to ORG_ID, but we pass ORG_ID_2
    await auditService.query(ORG_ID_2, {}, pagination, orgAdminUser);

    // The where clause should use the user's own orgId, NOT ORG_ID_2
    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.organizationId).toBe(ORG_ID); // user.orgId
    expect(findManyCall.where.organizationId).not.toBe(ORG_ID_2);
  });

  it('enforces org isolation for advisor role', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    await auditService.query(ORG_ID_2, {}, pagination, advisorUser);

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.organizationId).toBe(advisorUser.orgId);
  });

  it('allows super_admin to query any org', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    // superAdminUser's own orgId is 'super-admin-org-id', but we pass ORG_ID
    await auditService.query(ORG_ID, {}, pagination, superAdminUser);

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    // super_admin query uses the provided orgId, not user.orgId
    expect(findManyCall.where.organizationId).toBe(ORG_ID);
  });

  it('applies entityType filter when provided', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    await auditService.query(
      ORG_ID,
      { entityType: 'Draft' },
      pagination,
      orgAdminUser
    );

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.entityType).toBe('Draft');
  });

  it('applies entityId filter when provided', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    await auditService.query(
      ORG_ID,
      { entityId: 'draft-id-1' },
      pagination,
      orgAdminUser
    );

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.entityId).toBe('draft-id-1');
  });

  it('applies action filter when provided', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    await auditService.query(
      ORG_ID,
      { action: AuditAction.APPROVED },
      pagination,
      orgAdminUser
    );

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.action).toBe(AuditAction.APPROVED);
  });

  it('applies actorId filter when provided', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    await auditService.query(
      ORG_ID,
      { actorId: ACTOR_ID },
      pagination,
      orgAdminUser
    );

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.actorId).toBe(ACTOR_ID);
  });

  it('applies date range filter when from and to are provided', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    const from = '2024-01-01T00:00:00.000Z';
    const to = '2024-01-31T23:59:59.999Z';

    await auditService.query(ORG_ID, { from, to }, pagination, orgAdminUser);

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.createdAt).toEqual({
      gte: new Date(from),
      lte: new Date(to),
    });
  });

  it('applies only from filter when to is not provided', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    const from = '2024-01-01T00:00:00.000Z';

    await auditService.query(ORG_ID, { from }, pagination, orgAdminUser);

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.where.createdAt).toEqual({ gte: new Date(from) });
    expect(findManyCall.where.createdAt.lte).toBeUndefined();
  });

  it('returns correct pagination meta for second page', async () => {
    const records = Array.from({ length: 10 }, (_, i) => ({
      ...mockAuditRecord,
      id: `audit-id-${i + 1}`,
    }));
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue(records);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(25);

    const result = await auditService.query(
      ORG_ID,
      {},
      { page: 2, limit: 10 },
      orgAdminUser
    );

    expect(result.pagination).toMatchObject({
      page: 2,
      limit: 10,
      totalCount: 25,
      totalPages: 3,
      hasNextPage: true,
      hasPreviousPage: true,
    });
  });

  it('orders results by createdAt descending', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    await auditService.query(ORG_ID, {}, pagination, orgAdminUser);

    const findManyCall = (prisma.auditTrail.findMany as jest.Mock).mock.calls[0][0];
    expect(findManyCall.orderBy).toEqual({ createdAt: 'desc' });
  });

  it('returns empty data array with correct meta when no records found', async () => {
    (prisma.auditTrail.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.count as jest.Mock).mockResolvedValue(0);

    const result = await auditService.query(ORG_ID, {}, pagination, orgAdminUser);

    expect(result.data).toEqual([]);
    expect(result.pagination.totalCount).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
    expect(result.pagination.hasNextPage).toBe(false);
    expect(result.pagination.hasPreviousPage).toBe(false);
  });
});
