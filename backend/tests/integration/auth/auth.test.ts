/**
 * Integration tests for FR-001: Multi-Tenant Auth & RBAC
 *
 * Tests cover:
 *  - POST /api/v1/auth/register — happy path, duplicate email, weak password, missing fields
 *  - POST /api/v1/auth/login — happy path returns tokens, wrong password, non-existent user, account locked
 *  - POST /api/v1/auth/refresh — valid refresh token, expired refresh token, invalid token
 *  - POST /api/v1/auth/logout — authenticated, unauthenticated
 *  - GET  /api/v1/auth/me — authenticated returns user, unauthenticated 401
 *  - Account locking: 5 failed logins → 429 on 6th
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
  // Mock as a named export class (ioredis exports { Redis })
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
    auditTrail: {
      create: jest.fn().mockResolvedValue({}),
    },
  },
  default: {},
}));

import supertest from 'supertest';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { createApp } from '../../../src/app';
import { prisma } from '../../../src/db/client';

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

const mockOrg = {
  id: TEST_ORG_ID,
  name: 'Test Organization',
  slug: 'test-org',
  icpType: 'financial_advisor',
  isActive: true,
  subscriptionStatus: 'TRIALING',
  creditBalance: 0,
  settings: {},
  logoUrl: null,
  website: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

async function createMockUser(overrides: Partial<MockUser> = {}): Promise<MockUser> {
  const passwordHash = await bcrypt.hash('Password1', 12);
  return {
    ...mockUserBase,
    passwordHash,
    ...overrides,
  };
}

interface MockUser {
  id: string;
  organizationId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: 'ADVISOR' | 'ADMIN' | 'SUPER_ADMIN' | 'COMPLIANCE';
  status: 'ACTIVE' | 'INVITED' | 'LOCKED' | 'INACTIVE';
  avatarUrl: string | null;
  phone: string | null;
  failedLoginAttempts: number;
  lockedUntil: Date | null;
  lastLoginAt: Date | null;
  passwordResetToken: string | null;
  passwordResetExpiresAt: Date | null;
  emailVerifiedAt: Date | null;
  settings: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
  organization: {
    id: string;
    name: string;
    slug: string;
    subscriptionStatus: string;
  };
}

const mockUserBase: MockUser = {
  id: TEST_USER_ID,
  organizationId: TEST_ORG_ID,
  email: 'testuser@example.com',
  passwordHash: '$2a$12$placeholder', // will be replaced in createMockUser
  firstName: 'Test',
  lastName: 'User',
  role: 'ADVISOR',
  status: 'ACTIVE',
  avatarUrl: null,
  phone: null,
  failedLoginAttempts: 0,
  lockedUntil: null,
  lastLoginAt: null,
  passwordResetToken: null,
  passwordResetExpiresAt: null,
  emailVerifiedAt: null,
  settings: {},
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
  organization: {
    id: TEST_ORG_ID,
    name: 'Test Organization',
    slug: 'test-org',
    subscriptionStatus: 'TRIALING',
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRefreshToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      orgId: TEST_ORG_ID,
      role: 'advisor',
      email: 'testuser@example.com',
      type: 'refresh',
    },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function makeAccessToken(userId: string): string {
  return jwt.sign(
    {
      sub: userId,
      orgId: TEST_ORG_ID,
      role: 'advisor',
      email: 'testuser@example.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

// Reset all mocks before each test
beforeEach(() => {
  jest.clearAllMocks();
  // Default: audit trail writes always succeed
  (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/register
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/register', () => {
  it('happy path — registers a new user and returns tokens', async () => {
    const mockUser = await createMockUser({ status: 'INVITED' });
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    (prisma.user.findUnique as jest.Mock)
      .mockResolvedValueOnce(null) // email uniqueness check
      .mockResolvedValue(mockUser); // subsequent calls
    (prisma.user.create as jest.Mock).mockResolvedValue(mockUser);

    const res = await client.post('/api/v1/auth/register').send({
      email: 'testuser@example.com',
      password: 'Password1',
      firstName: 'Test',
      lastName: 'User',
      organizationId: TEST_ORG_ID,
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
      user: {
        id: TEST_USER_ID,
        email: 'testuser@example.com',
        orgId: TEST_ORG_ID,
        firstName: 'Test',
        lastName: 'User',
      },
    });
  });

  it('returns 422 for missing required fields', async () => {
    const res = await client.post('/api/v1/auth/register').send({
      email: 'testuser@example.com',
      // password, firstName, lastName, organizationId missing
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for weak password (no uppercase)', async () => {
    const res = await client.post('/api/v1/auth/register').send({
      email: 'testuser@example.com',
      password: 'password1', // no uppercase
      firstName: 'Test',
      lastName: 'User',
      organizationId: TEST_ORG_ID,
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for weak password (no number)', async () => {
    const res = await client.post('/api/v1/auth/register').send({
      email: 'testuser@example.com',
      password: 'PasswordA', // no number
      firstName: 'Test',
      lastName: 'User',
      organizationId: TEST_ORG_ID,
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for password too short', async () => {
    const res = await client.post('/api/v1/auth/register').send({
      email: 'testuser@example.com',
      password: 'P1',
      firstName: 'Test',
      lastName: 'User',
      organizationId: TEST_ORG_ID,
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid email format', async () => {
    const res = await client.post('/api/v1/auth/register').send({
      email: 'not-an-email',
      password: 'Password1',
      firstName: 'Test',
      lastName: 'User',
      organizationId: TEST_ORG_ID,
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for invalid organizationId (not a UUID)', async () => {
    const res = await client.post('/api/v1/auth/register').send({
      email: 'testuser@example.com',
      password: 'Password1',
      firstName: 'Test',
      lastName: 'User',
      organizationId: 'not-a-uuid',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 404 when organization does not exist', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client.post('/api/v1/auth/register').send({
      email: 'testuser@example.com',
      password: 'Password1',
      firstName: 'Test',
      lastName: 'User',
      organizationId: TEST_ORG_ID,
    });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 409 when email already exists', async () => {
    const mockUser = await createMockUser();
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser); // email taken

    const res = await client.post('/api/v1/auth/register').send({
      email: 'testuser@example.com',
      password: 'Password1',
      firstName: 'Test',
      lastName: 'User',
      organizationId: TEST_ORG_ID,
    });

    expect(res.status).toBe(409);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('CONFLICT');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/login
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/login', () => {
  it('happy path — returns access token, refresh token, and user data', async () => {
    const mockUser = await createMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      lastLoginAt: new Date(),
      failedLoginAttempts: 0,
    });

    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
      user: {
        id: TEST_USER_ID,
        email: 'testuser@example.com',
        orgId: TEST_ORG_ID,
      },
    });

    // Verify access token is valid
    const decoded = jwt.verify(res.body.data.accessToken, JWT_SECRET) as {
      type: string;
      sub: string;
    };
    expect(decoded.type).toBe('access');
    expect(decoded.sub).toBe(TEST_USER_ID);
  });

  it('returns 401 for wrong password', async () => {
    const mockUser = await createMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      failedLoginAttempts: 1,
    });

    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
      password: 'WrongPassword1',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for non-existent user', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client.post('/api/v1/auth/login').send({
      email: 'doesnotexist@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 for missing email', async () => {
    const res = await client.post('/api/v1/auth/login').send({
      password: 'Password1',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for missing password', async () => {
    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 429 for locked account that is still within lock period', async () => {
    const lockedUser = await createMockUser({
      status: 'LOCKED',
      lockedUntil: new Date(Date.now() + 10 * 60 * 1000), // locked for 10 more minutes
      failedLoginAttempts: 5,
    });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(lockedUser);

    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });

  it('returns 403 for inactive account', async () => {
    const inactiveUser = await createMockUser({ status: 'INACTIVE' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});

// ---------------------------------------------------------------------------
// Account locking: 5 failed logins → 429 on 6th attempt
// ---------------------------------------------------------------------------

describe('Account locking after 5 failed attempts', () => {
  it('locks account on the 5th failed attempt and returns 429', async () => {
    const mockUser = await createMockUser({
      failedLoginAttempts: 4, // 4 previous failures, this is the 5th
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      failedLoginAttempts: 5,
      status: 'LOCKED',
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    });

    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
      password: 'WrongPassword1',
    });

    // The 5th failed attempt should lock the account and return 429
    expect(res.status).toBe(429);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');

    // Verify user.update was called to lock the account
    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.status).toBe('LOCKED');
    expect(updateCall?.data?.lockedUntil).toBeDefined();
  });

  it('increments failedLoginAttempts on wrong password (before lock)', async () => {
    const mockUser = await createMockUser({ failedLoginAttempts: 2 });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      failedLoginAttempts: 3,
    });

    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
      password: 'WrongPassword1',
    });

    expect(res.status).toBe(401);

    // Verify increment was applied
    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.failedLoginAttempts).toBe(3);
  });

  it('returns 429 when already locked and lock period has not expired', async () => {
    const lockedUser = await createMockUser({
      status: 'LOCKED',
      failedLoginAttempts: 5,
      lockedUntil: new Date(Date.now() + 15 * 60 * 1000),
    });

    (prisma.user.findUnique as jest.Mock).mockResolvedValue(lockedUser);

    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(429);
    expect(res.body.error.code).toBe('TOO_MANY_REQUESTS');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/refresh
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/refresh', () => {
  it('happy path — returns new access token and refresh token for valid refresh token', async () => {
    const mockUser = await createMockUser({ status: 'ACTIVE' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const refreshToken = makeRefreshToken(TEST_USER_ID);

    const res = await client.post('/api/v1/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      accessToken: expect.any(String),
      refreshToken: expect.any(String),
      expiresIn: expect.any(Number),
    });

    // New access token should be valid
    const decoded = jwt.verify(res.body.data.accessToken, JWT_SECRET) as {
      type: string;
    };
    expect(decoded.type).toBe('access');
  });

  it('returns 401 for expired refresh token', async () => {
    // Create an already-expired token
    const expiredToken = jwt.sign(
      {
        sub: TEST_USER_ID,
        orgId: TEST_ORG_ID,
        role: 'advisor',
        email: 'testuser@example.com',
        type: 'refresh',
      },
      JWT_SECRET,
      { expiresIn: '-1s' } // already expired
    );

    const res = await client.post('/api/v1/auth/refresh').send({
      refreshToken: expiredToken,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 for invalid/malformed refresh token', async () => {
    const res = await client.post('/api/v1/auth/refresh').send({
      refreshToken: 'totally.invalid.token',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when passing an access token as refresh token', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client.post('/api/v1/auth/refresh').send({
      refreshToken: accessToken,
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 422 for missing refreshToken field', async () => {
    const res = await client.post('/api/v1/auth/refresh').send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when user account is no longer active', async () => {
    const inactiveUser = await createMockUser({ status: 'INACTIVE' });
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(inactiveUser);

    const refreshToken = makeRefreshToken(TEST_USER_ID);

    const res = await client.post('/api/v1/auth/refresh').send({ refreshToken });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/logout
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/logout', () => {
  it('happy path — authenticated user can log out', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('Logged out');

    // Verify audit trail was written
    expect(prisma.auditTrail.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'LOGGED_OUT',
          actorId: TEST_USER_ID,
        }),
      })
    );
  });

  it('returns 401 when unauthenticated (no token)', async () => {
    const res = await client.post('/api/v1/auth/logout');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when using an invalid token', async () => {
    const res = await client
      .post('/api/v1/auth/logout')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 when using a refresh token instead of access token', async () => {
    const refreshToken = makeRefreshToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/auth/logout')
      .set('Authorization', `Bearer ${refreshToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/auth/me
// ---------------------------------------------------------------------------

describe('GET /api/v1/auth/me', () => {
  it('happy path — returns authenticated user profile', async () => {
    const mockUser = await createMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_USER_ID,
      email: 'testuser@example.com',
      orgId: TEST_ORG_ID,
      firstName: 'Test',
      lastName: 'User',
      role: 'ADVISOR',
    });

    // Sensitive fields must NOT be exposed
    expect(res.body.data.passwordHash).toBeUndefined();
    expect(res.body.data.password).toBeUndefined();
  });

  it('returns 401 when unauthenticated (no Authorization header)', async () => {
    const res = await client.get('/api/v1/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 with invalid token', async () => {
    const res = await client
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer definitely.not.valid');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 401 with expired access token', async () => {
    const expiredToken = jwt.sign(
      {
        sub: TEST_USER_ID,
        orgId: TEST_ORG_ID,
        role: 'advisor',
        email: 'testuser@example.com',
        type: 'access',
      },
      JWT_SECRET,
      { expiresIn: '-1s' }
    );

    const res = await client
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/forgot-password
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/forgot-password', () => {
  it('returns 200 for existing email (does not reveal user existence)', async () => {
    const mockUser = await createMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

    const res = await client
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'testuser@example.com' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('password reset');
  });

  it('returns 200 for non-existent email (prevent enumeration)', async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'doesnotexist@example.com' });

    // Must return 200 even when user doesn't exist (prevent enumeration)
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 422 for invalid email format', async () => {
    const res = await client
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'not-an-email' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('stores a hashed reset token on the user when email exists', async () => {
    const mockUser = await createMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      passwordResetToken: 'hashed-token',
      passwordResetExpiresAt: new Date(Date.now() + 3600000),
    });

    await client
      .post('/api/v1/auth/forgot-password')
      .send({ email: 'testuser@example.com' });

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.passwordResetToken).toBeDefined();
    expect(updateCall?.data?.passwordResetExpiresAt).toBeDefined();
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/auth/reset-password
// ---------------------------------------------------------------------------

describe('POST /api/v1/auth/reset-password', () => {
  it('happy path — resets password with valid token', async () => {
    const mockUser = await createMockUser({
      passwordResetToken: 'hashed-token-value',
      passwordResetExpiresAt: new Date(Date.now() + 30 * 60 * 1000),
    });

    // findFirst returns user with valid reset token
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

    const res = await client.post('/api/v1/auth/reset-password').send({
      token: 'some-valid-raw-token',
      password: 'NewPassword2',
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('reset successfully');
  });

  it('returns 400 for invalid or expired token', async () => {
    (prisma.user.findFirst as jest.Mock).mockResolvedValue(null);

    const res = await client.post('/api/v1/auth/reset-password').send({
      token: 'invalid-or-expired-token',
      password: 'NewPassword2',
    });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 422 for missing token', async () => {
    const res = await client.post('/api/v1/auth/reset-password').send({
      password: 'NewPassword2',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for password too short', async () => {
    const res = await client.post('/api/v1/auth/reset-password').send({
      token: 'some-token',
      password: 'P1',
    });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('clears the reset token fields after successful reset', async () => {
    const mockUser = await createMockUser({
      passwordResetToken: 'some-hashed-token',
      passwordResetExpiresAt: new Date(Date.now() + 60 * 60 * 1000),
    });

    (prisma.user.findFirst as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

    await client.post('/api/v1/auth/reset-password').send({
      token: 'valid-raw-token',
      password: 'NewPassword2',
    });

    const updateCall = (prisma.user.update as jest.Mock).mock.calls[0]?.[0];
    expect(updateCall?.data?.passwordResetToken).toBeNull();
    expect(updateCall?.data?.passwordResetExpiresAt).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/auth/change-password
// ---------------------------------------------------------------------------

describe('PATCH /api/v1/auth/change-password', () => {
  it('happy path — changes password for authenticated user', async () => {
    const mockUser = await createMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue(mockUser);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Password1',
        newPassword: 'NewPassword2',
      });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('changed successfully');
  });

  it('returns 401 when current password is wrong', async () => {
    const mockUser = await createMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'WrongCurrentPassword1',
        newPassword: 'NewPassword2',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('UNAUTHORIZED');
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.patch('/api/v1/auth/change-password').send({
      currentPassword: 'Password1',
      newPassword: 'NewPassword2',
    });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  it('returns 422 for new password that is too short', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .patch('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        currentPassword: 'Password1',
        newPassword: 'P2',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Response shape validation
// ---------------------------------------------------------------------------

describe('Response shape validation', () => {
  it('login response contains all required token fields', async () => {
    const mockUser = await createMockUser();
    (prisma.user.findUnique as jest.Mock).mockResolvedValue(mockUser);
    (prisma.user.update as jest.Mock).mockResolvedValue({
      ...mockUser,
      lastLoginAt: new Date(),
    });

    const res = await client.post('/api/v1/auth/login').send({
      email: 'testuser@example.com',
      password: 'Password1',
    });

    expect(res.status).toBe(200);

    // Validate response structure matches spec
    const { data } = res.body;
    expect(data).toHaveProperty('accessToken');
    expect(data).toHaveProperty('refreshToken');
    expect(data).toHaveProperty('expiresIn');
    expect(data).toHaveProperty('user');
    expect(data.user).toHaveProperty('id');
    expect(data.user).toHaveProperty('email');
    expect(data.user).toHaveProperty('role');
    expect(data.user).toHaveProperty('orgId');
    expect(data.user).toHaveProperty('firstName');
    expect(data.user).toHaveProperty('lastName');
  });

  it('error responses have consistent shape', async () => {
    const res = await client.post('/api/v1/auth/login').send({
      email: 'invalid-email',
      password: 'pw',
    });

    expect(res.body).toHaveProperty('success', false);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toHaveProperty('code');
    expect(res.body.error).toHaveProperty('message');
  });
});
