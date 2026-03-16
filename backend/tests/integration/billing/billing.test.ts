/**
 * Integration tests for FR-011: Billing & Credits (Stripe)
 *
 * Tests cover:
 *  - POST /api/v1/billing/checkout      — creates Stripe checkout session, returns URL
 *  - POST /api/v1/billing/portal        — creates billing portal URL
 *  - GET  /api/v1/billing/subscription  — returns subscription object
 *  - POST /api/v1/billing/credits/purchase  — creates checkout for bundle
 *  - GET  /api/v1/billing/credits/balance   — returns balance and transactions
 *  - POST /api/v1/billing/webhook       — subscription.created event → creates Subscription record
 *  - POST /api/v1/billing/webhook       — payment_intent.failed → marks PAST_DUE, creates notification
 *  - POST /api/v1/billing/webhook       — invalid signature → 400
 *  - Credit deduction: insufficient balance → 402 error
 *  - Credit deduction: atomic (balance updated correctly)
 *  - GET  /api/v1/billing/plans         — public endpoint returns plans and bundles
 *
 * Uses jest.mock to replace Stripe SDK, Prisma, and other dependencies.
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

// ---- Mock Stripe SDK ----
const mockStripeCheckoutSessionCreate = jest.fn();
const mockStripeBillingPortalCreate = jest.fn();
const mockStripeCustomersCreate = jest.fn();
const mockStripeInvoicesList = jest.fn();
const mockStripeWebhooksConstructEvent = jest.fn();
const mockStripePaymentIntentsRetrieve = jest.fn();
const mockStripeSubscriptionsMaybeStub = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    customers: {
      create: mockStripeCustomersCreate,
    },
    checkout: {
      sessions: {
        create: mockStripeCheckoutSessionCreate,
      },
    },
    billingPortal: {
      sessions: {
        create: mockStripeBillingPortalCreate,
      },
    },
    invoices: {
      list: mockStripeInvoicesList,
    },
    webhooks: {
      constructEvent: mockStripeWebhooksConstructEvent,
    },
    paymentIntents: {
      retrieve: mockStripePaymentIntentsRetrieve,
    },
    subscriptions: {
      retrieve: mockStripeSubscriptionsMaybeStub,
    },
  }));
});

// ---- Mock Prisma client ----
const mockPrismaTransaction = jest.fn();

jest.mock('../../../src/db/client', () => ({
  prisma: {
    organization: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      updateMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    subscription: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    creditTransaction: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
    notification: {
      createMany: jest.fn(),
    },
    auditTrail: {
      create: jest.fn().mockResolvedValue({}),
    },
    $transaction: mockPrismaTransaction,
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
const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

const STRIPE_CUSTOMER_ID = 'cus_test_123456';
const STRIPE_SUBSCRIPTION_ID = 'sub_test_123456';
const STRIPE_SESSION_URL = 'https://checkout.stripe.com/pay/cs_test_abc123';
const STRIPE_PORTAL_URL = 'https://billing.stripe.com/p/session/test_xyz';

const mockOrg = {
  id: TEST_ORG_ID,
  name: 'Test Organization',
  slug: 'test-org',
  icpType: 'financial_advisor',
  isActive: true,
  subscriptionStatus: 'TRIALING',
  creditBalance: 500,
  stripeCustomerId: STRIPE_CUSTOMER_ID,
  stripeSubscriptionId: null,
  settings: {},
  logoUrl: null,
  website: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockOrgNoCustomer = {
  ...mockOrg,
  stripeCustomerId: null,
};

const mockSubscription = {
  id: 'sub-db-id-123',
  organizationId: TEST_ORG_ID,
  stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
  stripePriceId: 'price_individual',
  status: 'ACTIVE',
  planName: 'Individual',
  currentPeriodStart: new Date('2024-01-01'),
  currentPeriodEnd: new Date('2024-02-01'),
  cancelAtPeriodEnd: false,
  cancelledAt: null,
  trialEndsAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockCreditTransactions = [
  {
    id: 'tx-1',
    organizationId: TEST_ORG_ID,
    userId: TEST_USER_ID,
    type: 'PURCHASE',
    amount: 1000,
    balanceAfter: 1500,
    description: 'Credit purchase: 1,000 Credits',
    metadata: {},
    createdAt: new Date('2024-01-15'),
  },
  {
    id: 'tx-2',
    organizationId: TEST_ORG_ID,
    userId: TEST_USER_ID,
    type: 'DEBIT',
    amount: -500,
    balanceAfter: 500,
    description: 'Prospect list deduction',
    metadata: {},
    createdAt: new Date('2024-01-20'),
  },
];

const mockAdminUser = {
  id: TEST_USER_ID,
  organizationId: TEST_ORG_ID,
  email: 'admin@example.com',
  role: 'ADMIN',
  status: 'ACTIVE',
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeAccessToken(
  userId: string,
  role: string = 'org_admin',
  orgId: string = TEST_ORG_ID
): string {
  return jwt.sign(
    {
      sub: userId,
      orgId,
      role,
      email: 'admin@example.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

function makeAdvisorToken(): string {
  return makeAccessToken(TEST_USER_ID, 'advisor');
}

function makeSuperAdminToken(): string {
  return makeAccessToken(TEST_USER_ID, 'super_admin');
}

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
// GET /api/v1/billing/plans  (public)
// ---------------------------------------------------------------------------

describe('GET /api/v1/billing/plans', () => {
  it('returns available plans and credit bundles without authentication', async () => {
    const res = await client.get('/api/v1/billing/plans');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('plans');
    expect(res.body.data).toHaveProperty('bundles');
    expect(Array.isArray(res.body.data.plans)).toBe(true);
    expect(Array.isArray(res.body.data.bundles)).toBe(true);
    expect(res.body.data.bundles).toHaveLength(3);

    // Verify bundle structure
    const bundle1k = res.body.data.bundles.find((b: { id: string }) => b.id === 'bundle-1k');
    expect(bundle1k).toBeDefined();
    expect(bundle1k.credits).toBe(1000);
    expect(bundle1k.amount).toBe(9900);
    expect(bundle1k.label).toBe('1,000 Credits');
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/billing/checkout
// ---------------------------------------------------------------------------

describe('POST /api/v1/billing/checkout', () => {
  it('creates a Stripe checkout session and returns the URL', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    mockStripeCheckoutSessionCreate.mockResolvedValue({
      id: 'cs_test_abc123',
      url: STRIPE_SESSION_URL,
    });

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ priceId: 'price_individual' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('url', STRIPE_SESSION_URL);
    expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: STRIPE_CUSTOMER_ID,
        mode: 'subscription',
        line_items: expect.arrayContaining([
          expect.objectContaining({ price: 'price_individual', quantity: 1 }),
        ]),
      })
    );
  });

  it('creates a Stripe customer if one does not exist', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrgNoCustomer);
    (prisma.organization.update as jest.Mock).mockResolvedValue({
      ...mockOrgNoCustomer,
      stripeCustomerId: STRIPE_CUSTOMER_ID,
    });
    mockStripeCustomersCreate.mockResolvedValue({ id: STRIPE_CUSTOMER_ID });
    mockStripeCheckoutSessionCreate.mockResolvedValue({
      id: 'cs_test_new',
      url: STRIPE_SESSION_URL,
    });

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ priceId: 'price_individual' });

    expect(res.status).toBe(200);
    expect(mockStripeCustomersCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: mockOrgNoCustomer.name,
        metadata: expect.objectContaining({ organizationId: TEST_ORG_ID }),
      })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client
      .post('/api/v1/billing/checkout')
      .send({ priceId: 'price_individual' });

    expect(res.status).toBe(401);
  });

  it('returns 403 for advisor role (insufficient permissions)', async () => {
    const token = makeAdvisorToken();
    const res = await client
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({ priceId: 'price_individual' });

    expect(res.status).toBe(403);
  });

  it('returns 422 for missing priceId', async () => {
    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .post('/api/v1/billing/checkout')
      .set('Authorization', `Bearer ${token}`)
      .send({});

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/billing/portal
// ---------------------------------------------------------------------------

describe('POST /api/v1/billing/portal', () => {
  it('creates a billing portal session and returns the URL', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    mockStripeBillingPortalCreate.mockResolvedValue({
      id: 'bps_test_123',
      url: STRIPE_PORTAL_URL,
    });

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .post('/api/v1/billing/portal')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('url', STRIPE_PORTAL_URL);
    expect(mockStripeBillingPortalCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: STRIPE_CUSTOMER_ID,
      })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.post('/api/v1/billing/portal');
    expect(res.status).toBe(401);
  });

  it('returns 403 for advisor role', async () => {
    const token = makeAdvisorToken();
    const res = await client
      .post('/api/v1/billing/portal')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('works for super_admin role', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    mockStripeBillingPortalCreate.mockResolvedValue({
      id: 'bps_test_super',
      url: STRIPE_PORTAL_URL,
    });

    const token = makeSuperAdminToken();
    const res = await client
      .post('/api/v1/billing/portal')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveProperty('url');
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/billing/subscription
// ---------------------------------------------------------------------------

describe('GET /api/v1/billing/subscription', () => {
  it('returns the subscription object for the organization', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: mockSubscription.id,
      organizationId: TEST_ORG_ID,
      status: 'ACTIVE',
      planName: 'Individual',
    });
  });

  it('returns null data when no subscription exists', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(null);

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toBeNull();
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/billing/subscription');
    expect(res.status).toBe(401);
  });

  it('returns subscription data for advisor role (read-only access)', async () => {
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
    const token = makeAdvisorToken();
    const res = await client
      .get('/api/v1/billing/subscription')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: mockSubscription.id,
      organizationId: TEST_ORG_ID,
      status: 'ACTIVE',
    });
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/billing/credits/purchase
// ---------------------------------------------------------------------------

describe('POST /api/v1/billing/credits/purchase', () => {
  it('creates a one-time checkout session for a credit bundle', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    mockStripeCheckoutSessionCreate.mockResolvedValue({
      id: 'cs_credit_test',
      url: STRIPE_SESSION_URL,
    });

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .post('/api/v1/billing/credits/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ bundleId: 'bundle-1k' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveProperty('url', STRIPE_SESSION_URL);
    expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: expect.objectContaining({
          type: 'credit_purchase',
          bundleId: 'bundle-1k',
          credits: '1000',
        }),
      })
    );
  });

  it('returns 422 for invalid bundle ID', async () => {
    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .post('/api/v1/billing/credits/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ bundleId: 'bundle-invalid' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('creates correct price_data for bundle-5k', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    mockStripeCheckoutSessionCreate.mockResolvedValue({
      id: 'cs_5k',
      url: STRIPE_SESSION_URL,
    });

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    await client
      .post('/api/v1/billing/credits/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ bundleId: 'bundle-5k' });

    expect(mockStripeCheckoutSessionCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        line_items: expect.arrayContaining([
          expect.objectContaining({
            price_data: expect.objectContaining({
              unit_amount: 39900,
            }),
          }),
        ]),
        metadata: expect.objectContaining({
          bundleId: 'bundle-5k',
          credits: '5000',
        }),
      })
    );
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client
      .post('/api/v1/billing/credits/purchase')
      .send({ bundleId: 'bundle-1k' });
    expect(res.status).toBe(401);
  });

  it('returns 403 for advisor role', async () => {
    const token = makeAdvisorToken();
    const res = await client
      .post('/api/v1/billing/credits/purchase')
      .set('Authorization', `Bearer ${token}`)
      .send({ bundleId: 'bundle-1k' });
    expect(res.status).toBe(403);
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/billing/credits/balance
// ---------------------------------------------------------------------------

describe('GET /api/v1/billing/credits/balance', () => {
  it('returns the balance and recent transactions for org_admin', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      creditBalance: 500,
    });
    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue(
      mockCreditTransactions
    );

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .get('/api/v1/billing/credits/balance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      balance: 500,
      transactions: expect.arrayContaining([
        expect.objectContaining({ type: 'PURCHASE' }),
        expect.objectContaining({ type: 'DEBIT' }),
      ]),
    });
  });

  it('returns the balance for advisor role (read-only access)', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      creditBalance: 250,
    });
    (prisma.creditTransaction.findMany as jest.Mock).mockResolvedValue([]);

    const token = makeAdvisorToken();
    const res = await client
      .get('/api/v1/billing/credits/balance')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data.balance).toBe(250);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/billing/credits/balance');
    expect(res.status).toBe(401);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/billing/webhook — subscription.created
// ---------------------------------------------------------------------------

describe('POST /api/v1/billing/webhook — subscription events', () => {
  it('subscription.created → creates Subscription record and updates org', async () => {
    const stripeSubEvent: Record<string, unknown> = {
      id: 'evt_sub_created',
      type: 'customer.subscription.created',
      data: {
        object: {
          id: STRIPE_SUBSCRIPTION_ID,
          customer: STRIPE_CUSTOMER_ID,
          status: 'active',
          items: {
            data: [{ price: { id: 'price_individual' } }],
          },
          current_period_start: Math.floor(Date.now() / 1000) - 86400,
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          cancel_at_period_end: false,
          trial_end: null,
          canceled_at: null,
        },
      },
    };

    mockStripeWebhooksConstructEvent.mockReturnValue(stripeSubEvent);
    (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
      id: TEST_ORG_ID,
    });
    (prisma.subscription.upsert as jest.Mock).mockResolvedValue(mockSubscription);
    (prisma.organization.update as jest.Mock).mockResolvedValue(mockOrg);

    const res = await client
      .post('/api/v1/billing/webhook')
      .set('stripe-signature', 'valid-sig')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{"type":"customer.subscription.created"}'));

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toEqual({ received: true });

    // Verify subscription was upserted
    expect(prisma.subscription.upsert as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID },
        create: expect.objectContaining({
          organizationId: TEST_ORG_ID,
          stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
          status: 'ACTIVE',
          planName: 'Individual',
        }),
      })
    );

    // Verify org subscription status was updated
    expect(prisma.organization.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_ORG_ID },
        data: expect.objectContaining({
          subscriptionStatus: 'ACTIVE',
          stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID,
        }),
      })
    );
  });

  it('subscription.updated → updates existing Subscription record', async () => {
    const stripeSubUpdatedEvent: Record<string, unknown> = {
      id: 'evt_sub_updated',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: STRIPE_SUBSCRIPTION_ID,
          customer: STRIPE_CUSTOMER_ID,
          status: 'past_due',
          items: {
            data: [{ price: { id: 'price_individual' } }],
          },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          cancel_at_period_end: false,
          trial_end: null,
          canceled_at: null,
        },
      },
    };

    mockStripeWebhooksConstructEvent.mockReturnValue(stripeSubUpdatedEvent);
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
    (prisma.subscription.update as jest.Mock).mockResolvedValue({
      ...mockSubscription,
      status: 'PAST_DUE',
    });
    (prisma.organization.update as jest.Mock).mockResolvedValue({
      ...mockOrg,
      subscriptionStatus: 'PAST_DUE',
    });

    const res = await client
      .post('/api/v1/billing/webhook')
      .set('stripe-signature', 'valid-sig')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(prisma.subscription.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID },
        data: expect.objectContaining({ status: 'PAST_DUE' }),
      })
    );
  });

  it('subscription.deleted → marks subscription as CANCELLED', async () => {
    const stripeSubDeletedEvent: Record<string, unknown> = {
      id: 'evt_sub_deleted',
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: STRIPE_SUBSCRIPTION_ID,
          customer: STRIPE_CUSTOMER_ID,
          status: 'canceled',
          items: { data: [{ price: { id: 'price_individual' } }] },
          current_period_start: Math.floor(Date.now() / 1000),
          current_period_end: Math.floor(Date.now() / 1000) + 2592000,
          cancel_at_period_end: false,
          trial_end: null,
          canceled_at: Math.floor(Date.now() / 1000),
        },
      },
    };

    mockStripeWebhooksConstructEvent.mockReturnValue(stripeSubDeletedEvent);
    (prisma.subscription.findUnique as jest.Mock).mockResolvedValue(mockSubscription);
    (prisma.subscription.update as jest.Mock).mockResolvedValue({
      ...mockSubscription,
      status: 'CANCELLED',
    });
    (prisma.organization.update as jest.Mock).mockResolvedValue({
      ...mockOrg,
      subscriptionStatus: 'CANCELLED',
    });

    const res = await client
      .post('/api/v1/billing/webhook')
      .set('stripe-signature', 'valid-sig')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);
    expect(prisma.subscription.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { stripeSubscriptionId: STRIPE_SUBSCRIPTION_ID },
        data: expect.objectContaining({ status: 'CANCELLED' }),
      })
    );
    expect(prisma.organization.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ subscriptionStatus: 'CANCELLED' }),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/billing/webhook — payment_intent.payment_failed
// ---------------------------------------------------------------------------

describe('POST /api/v1/billing/webhook — payment_intent.payment_failed event', () => {
  it('marks org as PAST_DUE and creates PAYMENT_FAILED notifications for admin users', async () => {
    const paymentFailedEvent: Record<string, unknown> = {
      id: 'evt_pi_failed',
      type: 'payment_intent.payment_failed',
      data: {
        object: {
          id: 'pi_test_failed',
          customer: STRIPE_CUSTOMER_ID,
          amount: 2990,
          currency: 'usd',
          status: 'requires_payment_method',
          last_payment_error: {
            message: 'Your card was declined.',
          },
        },
      },
    };

    mockStripeWebhooksConstructEvent.mockReturnValue(paymentFailedEvent);
    (prisma.organization.findFirst as jest.Mock).mockResolvedValue({
      id: TEST_ORG_ID,
    });
    (prisma.organization.update as jest.Mock).mockResolvedValue({
      ...mockOrg,
      subscriptionStatus: 'PAST_DUE',
    });
    (prisma.subscription.updateMany as jest.Mock).mockResolvedValue({ count: 1 });
    (prisma.user.findMany as jest.Mock).mockResolvedValue([mockAdminUser]);
    (prisma.notification.createMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await client
      .post('/api/v1/billing/webhook')
      .set('stripe-signature', 'valid-sig')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(200);

    // Org should be marked PAST_DUE
    expect(prisma.organization.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_ORG_ID },
        data: expect.objectContaining({ subscriptionStatus: 'PAST_DUE' }),
      })
    );

    // Subscription should also be updated to PAST_DUE
    expect(prisma.subscription.updateMany as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { organizationId: TEST_ORG_ID },
        data: expect.objectContaining({ status: 'PAST_DUE' }),
      })
    );

    // Notifications should be created for admin users
    expect(prisma.notification.createMany as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.arrayContaining([
          expect.objectContaining({
            userId: TEST_USER_ID,
            organizationId: TEST_ORG_ID,
            type: 'PAYMENT_FAILED',
            title: 'Payment Failed',
          }),
        ]),
      })
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/billing/webhook — invalid signature
// ---------------------------------------------------------------------------

describe('POST /api/v1/billing/webhook — invalid signature', () => {
  it('returns 400 when Stripe signature verification fails', async () => {
    mockStripeWebhooksConstructEvent.mockImplementation(() => {
      throw new Error('No signatures found matching the expected signature for payload');
    });

    const res = await client
      .post('/api/v1/billing/webhook')
      .set('stripe-signature', 'invalid-sig')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{"type":"customer.subscription.created"}'));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when stripe-signature header is missing', async () => {
    const res = await client
      .post('/api/v1/billing/webhook')
      .set('Content-Type', 'application/octet-stream')
      .send(Buffer.from('{}'));

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Credit deduction — insufficient balance → 402
// ---------------------------------------------------------------------------

describe('Credit deduction', () => {
  it('returns 402 when insufficient credits via the service', async () => {
    // Test the deductCredits service function directly by testing the behavior
    // through a mocked $transaction that simulates low balance
    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      // Simulate what the transaction would do with insufficient balance
      const mockTx = {
        organization: {
          findUnique: jest.fn().mockResolvedValue({ creditBalance: 100 }),
          update: jest.fn(),
        },
        creditTransaction: {
          create: jest.fn(),
        },
      };
      return fn(mockTx);
    });

    const { deductCredits } = await import('../../../src/services/billing.service');

    await expect(
      deductCredits(TEST_ORG_ID, 500, 'Test deduction')
    ).rejects.toMatchObject({
      statusCode: 402,
      code: 'PAYMENT_REQUIRED',
    });
  });

  it('atomically updates balance and creates CreditTransaction on deduct', async () => {
    const mockTxOrg = { creditBalance: 1000 };
    const mockUpdatedOrg = { creditBalance: 700 };
    const mockNewTransaction = {
      id: 'tx-new-1',
      organizationId: TEST_ORG_ID,
      type: 'DEBIT',
      amount: -300,
      balanceAfter: 700,
      description: 'Test deduction',
    };

    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      const mockTx = {
        organization: {
          findUnique: jest.fn().mockResolvedValue(mockTxOrg),
          update: jest.fn().mockResolvedValue(mockUpdatedOrg),
        },
        creditTransaction: {
          create: jest.fn().mockResolvedValue(mockNewTransaction),
        },
      };
      return fn(mockTx);
    });

    const { deductCredits } = await import('../../../src/services/billing.service');

    const result = await deductCredits(TEST_ORG_ID, 300, 'Test deduction', TEST_USER_ID);

    expect(result).toMatchObject({
      type: 'DEBIT',
      amount: -300,
      balanceAfter: 700,
    });

    // Verify $transaction was called (guaranteeing atomicity)
    expect(mockPrismaTransaction).toHaveBeenCalled();
  });

  it('atomically updates balance and creates CreditTransaction on addCredits', async () => {
    const mockTxOrg = { creditBalance: 500 };
    const mockUpdatedOrg = { creditBalance: 1500 };
    const mockNewTransaction = {
      id: 'tx-new-2',
      organizationId: TEST_ORG_ID,
      type: 'PURCHASE',
      amount: 1000,
      balanceAfter: 1500,
      description: 'Credit purchase',
    };

    mockPrismaTransaction.mockImplementation(async (fn: Function) => {
      const mockTx = {
        organization: {
          findUnique: jest.fn().mockResolvedValue(mockTxOrg),
          update: jest.fn().mockResolvedValue(mockUpdatedOrg),
        },
        creditTransaction: {
          create: jest.fn().mockResolvedValue(mockNewTransaction),
        },
      };
      return fn(mockTx);
    });

    const { addCredits } = await import('../../../src/services/billing.service');

    const result = await addCredits(TEST_ORG_ID, 1000, 'Credit purchase', TEST_USER_ID);

    expect(result).toMatchObject({
      type: 'PURCHASE',
      amount: 1000,
      balanceAfter: 1500,
    });

    expect(mockPrismaTransaction).toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/billing/invoices
// ---------------------------------------------------------------------------

describe('GET /api/v1/billing/invoices', () => {
  it('returns list of Stripe invoices for the organization', async () => {
    const mockInvoices = [
      {
        id: 'in_test_1',
        amount_due: 2990,
        status: 'paid',
        created: 1700000000,
        customer: STRIPE_CUSTOMER_ID,
      },
    ];

    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      stripeCustomerId: STRIPE_CUSTOMER_ID,
    });
    mockStripeInvoicesList.mockResolvedValue({ data: mockInvoices });

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .get('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0]).toMatchObject({ id: 'in_test_1', status: 'paid' });
  });

  it('returns empty array when org has no Stripe customer', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      stripeCustomerId: null,
    });

    const token = makeAccessToken(TEST_USER_ID, 'org_admin');
    const res = await client
      .get('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([]);
  });

  it('returns 401 when unauthenticated', async () => {
    const res = await client.get('/api/v1/billing/invoices');
    expect(res.status).toBe(401);
  });

  it('returns invoices for advisor role (read-only access)', async () => {
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue(mockOrg);
    mockStripeInvoicesList.mockResolvedValue({
      data: [
        {
          id: 'in_test_1',
          status: 'paid',
          amount_paid: 29900,
          currency: 'usd',
          created: 1_706_000_000,
        },
      ],
    });
    const token = makeAdvisorToken();
    const res = await client
      .get('/api/v1/billing/invoices')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data[0]).toMatchObject({ id: 'in_test_1', status: 'paid' });
  });
});
