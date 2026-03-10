import supertest, { SuperTest, Test } from 'supertest';
import { Application } from 'express';
import jwt from 'jsonwebtoken';
import { AuthenticatedUser, UserRole, JwtPayload } from '../../src/types';

// ---------------------------------------------------------------------------
// App factory for tests
// ---------------------------------------------------------------------------

let testApp: Application | null = null;

/**
 * Returns a cached Express app instance for testing.
 * Avoids creating a new app for every test, improving performance.
 */
export function getTestApp(): Application {
  if (!testApp) {
    // Ensure env vars are set before creating app
    const { createApp } = require('../../src/app');
    testApp = createApp();
  }
  return testApp;
}

/**
 * Resets the cached app instance. Call this in afterAll if tests
 * modify global state.
 */
export function resetTestApp(): void {
  testApp = null;
}

// ---------------------------------------------------------------------------
// Supertest client factory
// ---------------------------------------------------------------------------

/**
 * Returns a Supertest client bound to the test Express app.
 * Use this in test files to make HTTP requests without binding a port.
 *
 * @example
 *   const client = getTestClient();
 *   const res = await client.get('/health').expect(200);
 */
export function getTestClient(): SuperTest<Test> {
  return supertest(getTestApp());
}

// ---------------------------------------------------------------------------
// JWT token generation for tests
// ---------------------------------------------------------------------------

/**
 * Generates a valid test JWT access token for the given user.
 * Uses the JWT_SECRET from process.env (set in tests/setup.ts).
 */
export function generateTestToken(
  user: Partial<AuthenticatedUser> & { id: string }
): string {
  const secret = process.env['JWT_SECRET'] ?? 'test_secret';

  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    orgId: user.orgId ?? 'test-org-id',
    role: user.role ?? UserRole.ADVISOR,
    email: user.email ?? `${user.id}@test.vireos.com`,
    type: 'access',
  };

  return jwt.sign(payload, secret, { expiresIn: '1h' });
}

/**
 * Generates a test JWT refresh token.
 */
export function generateTestRefreshToken(
  user: Partial<AuthenticatedUser> & { id: string }
): string {
  const secret = process.env['JWT_SECRET'] ?? 'test_secret';

  const payload: Omit<JwtPayload, 'iat' | 'exp'> = {
    sub: user.id,
    orgId: user.orgId ?? 'test-org-id',
    role: user.role ?? UserRole.ADVISOR,
    email: user.email ?? `${user.id}@test.vireos.com`,
    type: 'refresh',
  };

  return jwt.sign(payload, secret, { expiresIn: '7d' });
}

// ---------------------------------------------------------------------------
// Pre-built test user fixtures
// ---------------------------------------------------------------------------

export const testUsers = {
  superAdmin: {
    id: 'super-admin-user-id',
    orgId: 'super-admin-org-id',
    role: UserRole.SUPER_ADMIN,
    email: 'superadmin@vireos.com',
  } as AuthenticatedUser,

  orgAdmin: {
    id: 'org-admin-user-id',
    orgId: 'test-org-id-1',
    role: UserRole.ORG_ADMIN,
    email: 'admin@testorg.com',
  } as AuthenticatedUser,

  advisor: {
    id: 'advisor-user-id',
    orgId: 'test-org-id-1',
    role: UserRole.ADVISOR,
    email: 'advisor@testorg.com',
  } as AuthenticatedUser,

  viewer: {
    id: 'viewer-user-id',
    orgId: 'test-org-id-1',
    role: UserRole.VIEWER,
    email: 'viewer@testorg.com',
  } as AuthenticatedUser,

  differentOrg: {
    id: 'different-org-user-id',
    orgId: 'test-org-id-2',
    role: UserRole.ADVISOR,
    email: 'advisor@differentorg.com',
  } as AuthenticatedUser,
} as const;

/**
 * Returns authorization headers for the given test user.
 *
 * @example
 *   const res = await client
 *     .get('/api/v1/posts')
 *     .set(authHeaders(testUsers.advisor));
 */
export function authHeaders(user: AuthenticatedUser): { Authorization: string } {
  return { Authorization: `Bearer ${generateTestToken(user)}` };
}
