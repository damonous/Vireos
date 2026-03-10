/**
 * Integration tests for FR-012/FR-013: Health endpoints
 *
 * Tests cover:
 *  - GET /health         — returns 200 with status/version
 *  - GET /health/ready   — returns 200 when DB+Redis healthy, 503 when DB fails
 *  - GET /health/live    — always 200
 *  - GET /metrics        — 401 without auth, 200 with super_admin token
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
const mockRedisPing = jest.fn().mockResolvedValue('PONG');
const mockRedisInstance = {
  on: jest.fn().mockReturnThis(),
  quit: jest.fn().mockResolvedValue(undefined),
  call: jest.fn().mockResolvedValue(0),
  ping: mockRedisPing,
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue('OK'),
  del: jest.fn().mockResolvedValue(1),
  incr: jest.fn().mockResolvedValue(1),
  expire: jest.fn().mockResolvedValue(1),
};

jest.mock('ioredis', () => {
  const RedisMock = jest.fn().mockImplementation(() => mockRedisInstance);
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
const mockQueryRaw = jest.fn().mockResolvedValue([{ '?column?': 1 }]);

jest.mock('../../../src/db/client', () => ({
  prisma: {
    $queryRaw: mockQueryRaw,
    auditTrail: {
      create: jest.fn().mockResolvedValue({}),
      findMany: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    },
    organization: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  },
  default: {},
}));

import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/client';

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

function makeToken(role: string, orgId = 'test-org-id'): string {
  return jwt.sign(
    {
      sub: 'user-id-123',
      orgId,
      role,
      email: 'user@test.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: DB and Redis healthy
  mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
  mockRedisPing.mockResolvedValue('PONG');
});

// ---------------------------------------------------------------------------
// GET /health
// ---------------------------------------------------------------------------

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await client.get('/health');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns version field', async () => {
    const res = await client.get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('version');
    expect(typeof res.body.version).toBe('string');
  });

  it('returns timestamp field as ISO-8601 string', async () => {
    const res = await client.get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timestamp');
    expect(() => new Date(res.body.timestamp)).not.toThrow();
    expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);
  });

  it('returns environment field', async () => {
    const res = await client.get('/health');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('environment');
  });

  it('does not require authentication', async () => {
    const res = await client.get('/health');
    // Must succeed without any Authorization header
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /health/live
// ---------------------------------------------------------------------------

describe('GET /health/live', () => {
  it('always returns 200 with status ok', async () => {
    const res = await client.get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns timestamp', async () => {
    const res = await client.get('/health/live');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('timestamp');
  });

  it('does not require authentication', async () => {
    const res = await client.get('/health/live');
    expect(res.status).toBe(200);
  });

  it('returns 200 even when DB mock would fail (liveness ignores dependencies)', async () => {
    // liveness should not perform DB checks at all
    mockQueryRaw.mockRejectedValue(new Error('DB down'));

    const res = await client.get('/health/live');
    expect(res.status).toBe(200);
  });
});

// ---------------------------------------------------------------------------
// GET /health/ready
// ---------------------------------------------------------------------------

describe('GET /health/ready', () => {
  it('returns 200 when both DB and Redis are healthy', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedisPing.mockResolvedValue('PONG');

    const res = await client.get('/health/ready');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('ok');
  });

  it('returns check results for database and redis', async () => {
    const res = await client.get('/health/ready');

    expect(res.body).toHaveProperty('checks');
    expect(res.body.checks).toHaveProperty('database');
    expect(res.body.checks).toHaveProperty('redis');
    expect(res.body.checks.database.status).toBe('ok');
    expect(res.body.checks.redis.status).toBe('ok');
  });

  it('returns 503 when DB check fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('ECONNREFUSED'));
    mockRedisPing.mockResolvedValue('PONG');

    const res = await client.get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database.status).toBe('fail');
    expect(res.body.checks.redis.status).toBe('ok');
  });

  it('returns 503 when Redis check fails', async () => {
    mockQueryRaw.mockResolvedValue([{ '?column?': 1 }]);
    mockRedisPing.mockRejectedValue(new Error('Redis connection refused'));

    const res = await client.get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database.status).toBe('ok');
    expect(res.body.checks.redis.status).toBe('fail');
  });

  it('returns 503 when both DB and Redis fail', async () => {
    mockQueryRaw.mockRejectedValue(new Error('DB down'));
    mockRedisPing.mockRejectedValue(new Error('Redis down'));

    const res = await client.get('/health/ready');

    expect(res.status).toBe(503);
    expect(res.body.status).toBe('degraded');
    expect(res.body.checks.database.status).toBe('fail');
    expect(res.body.checks.redis.status).toBe('fail');
  });

  it('returns version field', async () => {
    const res = await client.get('/health/ready');
    expect(res.body).toHaveProperty('version');
  });

  it('returns timestamp field', async () => {
    const res = await client.get('/health/ready');
    expect(res.body).toHaveProperty('timestamp');
  });

  it('does not require authentication', async () => {
    const res = await client.get('/health/ready');
    // Must not require auth even when healthy
    expect(res.status).not.toBe(401);
  });

  it('includes fail detail message when DB fails', async () => {
    mockQueryRaw.mockRejectedValue(new Error('connection timeout'));

    const res = await client.get('/health/ready');

    expect(res.body.checks.database.status).toBe('fail');
    expect(res.body.checks.database).toHaveProperty('detail');
    expect(typeof res.body.checks.database.detail).toBe('string');
  });
});

// ---------------------------------------------------------------------------
// GET /metrics
// ---------------------------------------------------------------------------

describe('GET /metrics', () => {
  it('returns 401 without authentication', async () => {
    const res = await client.get('/metrics');
    expect(res.status).toBe(401);
  });

  it('returns 403 for non-super_admin roles', async () => {
    const token = makeToken('org_admin');

    const res = await client
      .get('/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 403 for advisor role', async () => {
    const token = makeToken('advisor');

    const res = await client
      .get('/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(403);
  });

  it('returns 200 with metrics snapshot for super_admin', async () => {
    const token = makeToken('super_admin');

    const res = await client
      .get('/metrics')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('uptimeMs');
    expect(res.body.data).toHaveProperty('activeConnections');
    expect(res.body.data).toHaveProperty('errorRate5xx');
    expect(res.body.data).toHaveProperty('errorRate4xx');
    expect(res.body.data).toHaveProperty('routes');
    expect(Array.isArray(res.body.data.routes)).toBe(true);
  });
});
