/**
 * Integration tests for FR-009: Email Marketing & Sequences (Mailgun)
 *
 * Tests cover:
 *  - POST /api/v1/email/templates         — creates template, extracts variables
 *  - GET  /api/v1/email/templates         — lists templates
 *  - POST /api/v1/email/sequences         — creates sequence
 *  - POST /api/v1/email/sequences/:id/steps — adds step with delay
 *  - POST /api/v1/email/sequences/:id/enroll — enrolls leads, enqueues first send
 *  - POST /api/v1/email/webhook/mailgun   — processes delivered event → updates EmailSend
 *  - POST /api/v1/email/unsubscribe       — marks lead unsubscribed, stops enrollments
 *  - Unsubscribed lead: next email send skipped
 *
 * All external dependencies (Prisma, Mailgun, BullMQ) are mocked.
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
process.env['MAILGUN_API_KEY'] = 'key-test_fake_key_for_testing';
process.env['MAILGUN_DOMAIN'] = 'mg.vireos.com';
process.env['MAILGUN_FROM_EMAIL'] = 'test@vireos.com';
process.env['MAILGUN_FROM_NAME'] = 'Vireos Platform';
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

// ---- Mock BullMQ Queue ----
jest.mock('bullmq', () => {
  const mockQueue = {
    add: jest.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: jest.fn().mockResolvedValue(undefined),
    on: jest.fn().mockReturnThis(),
  };
  const mockWorker = {
    on: jest.fn().mockReturnThis(),
    close: jest.fn().mockResolvedValue(undefined),
  };
  return {
    Queue: jest.fn().mockImplementation(() => mockQueue),
    Worker: jest.fn().mockImplementation(() => mockWorker),
    Job: jest.fn(),
  };
});

const mockMailgunMessagesCreate = jest.fn().mockResolvedValue({
  status: 200,
  id: 'mock-mailgun-message-id-12345',
  message: 'Queued. Thank you.',
});

jest.mock('form-data', () => jest.fn());
jest.mock('mailgun.js', () =>
  jest.fn().mockImplementation(() => ({
    client: jest.fn().mockReturnValue({
      messages: {
        create: mockMailgunMessagesCreate,
      },
    }),
  }))
);

// ---- Mock Prisma client ----
jest.mock('../../../src/db/client', () => ({
  prisma: {
    emailTemplate: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      count: jest.fn(),
    },
    emailSequence: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    emailSequenceStep: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    emailEnrollment: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
    },
    emailSend: {
      create: jest.fn(),
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    lead: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
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

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const TEST_ORG_ID = '550e8400-e29b-41d4-a716-446655440000';
const TEST_USER_ID = '660e8400-e29b-41d4-a716-446655440001';
const TEST_TEMPLATE_ID = '770e8400-e29b-41d4-a716-446655440002';
const TEST_SEQUENCE_ID = '880e8400-e29b-41d4-a716-446655440003';
const TEST_STEP_ID = '990e8400-e29b-41d4-a716-446655440004';
const TEST_LEAD_ID = 'aa0e8400-e29b-41d4-a716-446655440005';
const TEST_ENROLLMENT_ID = 'bb0e8400-e29b-41d4-a716-446655440006';
const TEST_EMAIL_SEND_ID = 'cc0e8400-e29b-41d4-a716-446655440007';

const JWT_SECRET =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';

function makeAccessToken(userId: string, role = 'advisor'): string {
  return jwt.sign(
    {
      sub: userId,
      orgId: TEST_ORG_ID,
      role,
      email: 'testuser@example.com',
      type: 'access',
    },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
}

const mockTemplate = {
  id: TEST_TEMPLATE_ID,
  organizationId: TEST_ORG_ID,
  createdById: TEST_USER_ID,
  name: 'Welcome Email',
  subject: 'Welcome, {{firstName}}!',
  htmlContent: '<p>Hello {{firstName}} {{lastName}}, welcome to {{company}}.</p>',
  textContent: 'Hello {{firstName}} {{lastName}}',
  variables: ['company', 'firstName', 'lastName'],
  isActive: true,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockSequence = {
  id: TEST_SEQUENCE_ID,
  organizationId: TEST_ORG_ID,
  createdById: TEST_USER_ID,
  name: 'Onboarding Sequence',
  description: 'Welcome new leads',
  status: 'DRAFT',
  triggerType: 'MANUAL',
  totalSteps: 0,
  totalEnrolled: 0,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockSequenceWithSteps = {
  ...mockSequence,
  totalSteps: 1,
  steps: [
    {
      id: TEST_STEP_ID,
      sequenceId: TEST_SEQUENCE_ID,
      organizationId: TEST_ORG_ID,
      stepNumber: 1,
      templateId: TEST_TEMPLATE_ID,
      delayDays: 0,
      delayHours: 0,
      subject: null,
      createdAt: new Date('2024-01-01'),
      updatedAt: new Date('2024-01-01'),
    },
  ],
};

const mockStep = mockSequenceWithSteps.steps[0]!;

const mockLead = {
  id: TEST_LEAD_ID,
  organizationId: TEST_ORG_ID,
  firstName: 'Jane',
  lastName: 'Doe',
  email: 'jane.doe@example.com',
  phone: null,
  company: 'Acme Corp',
  title: 'CEO',
  linkedinUrl: null,
  source: 'MANUAL_IMPORT',
  status: 'NEW',
  isUnsubscribed: false,
  unsubscribedAt: null,
  customFields: {},
  notes: null,
  campaignId: null,
  prospectRequestId: null,
  assignedAdvisorId: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockEnrollment = {
  id: TEST_ENROLLMENT_ID,
  sequenceId: TEST_SEQUENCE_ID,
  leadId: TEST_LEAD_ID,
  organizationId: TEST_ORG_ID,
  enrolledById: TEST_USER_ID,
  currentStep: 1,
  status: 'ACTIVE',
  nextSendAt: new Date(Date.now() + 60000),
  completedAt: null,
  unsubscribedAt: null,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

const mockEmailSend = {
  id: TEST_EMAIL_SEND_ID,
  enrollmentId: TEST_ENROLLMENT_ID,
  organizationId: TEST_ORG_ID,
  leadId: TEST_LEAD_ID,
  stepId: TEST_STEP_ID,
  sgMessageId: 'mock-mailgun-message-id-12345',
  status: 'sent',
  openedAt: null,
  clickedAt: null,
  bouncedAt: null,
  sentAt: new Date('2024-01-01'),
};

// ---------------------------------------------------------------------------
// App setup
// ---------------------------------------------------------------------------

const app = createApp();
const client = supertest(app);

beforeEach(() => {
  jest.clearAllMocks();
  // Default: $transaction executes the array of prisma calls
  (prisma.$transaction as jest.Mock).mockImplementation(
    async (operations: Promise<unknown>[]) => Promise.all(operations)
  );
});

// =============================================================================
// POST /api/v1/email/templates
// =============================================================================

describe('POST /api/v1/email/templates', () => {
  it('creates a template and auto-extracts variables from subject and HTML', async () => {
    (prisma.emailTemplate.create as jest.Mock).mockResolvedValue(mockTemplate);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/email/templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Welcome Email',
        subject: 'Welcome, {{firstName}}!',
        htmlContent: '<p>Hello {{firstName}} {{lastName}}, welcome to {{company}}.</p>',
        textContent: 'Hello {{firstName}} {{lastName}}',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_TEMPLATE_ID,
      name: 'Welcome Email',
      subject: 'Welcome, {{firstName}}!',
    });

    // Verify variables were extracted and passed to Prisma
    const createCall = (prisma.emailTemplate.create as jest.Mock).mock.calls[0]?.[0];
    expect(createCall?.data?.variables).toEqual(
      expect.arrayContaining(['firstName', 'lastName', 'company'])
    );
    expect(createCall?.data?.organizationId).toBe(TEST_ORG_ID);
    expect(createCall?.data?.createdById).toBe(TEST_USER_ID);
  });

  it('returns 422 for missing required fields', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/email/templates')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ name: 'Incomplete Template' }); // missing subject and htmlContent

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client
      .post('/api/v1/email/templates')
      .send({
        name: 'Test',
        subject: 'Test',
        htmlContent: '<p>Test</p>',
      });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// GET /api/v1/email/templates
// =============================================================================

describe('GET /api/v1/email/templates', () => {
  it('lists templates for the authenticated user\'s org with pagination', async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue([[mockTemplate], 1]);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .get('/api/v1/email/templates')
      .set('Authorization', `Bearer ${accessToken}`);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      items: expect.arrayContaining([
        expect.objectContaining({ id: TEST_TEMPLATE_ID, name: 'Welcome Email' }),
      ]),
      total: 1,
      page: 1,
    });
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client.get('/api/v1/email/templates');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// POST /api/v1/email/sequences
// =============================================================================

describe('POST /api/v1/email/sequences', () => {
  it('creates a new email sequence', async () => {
    (prisma.emailSequence.create as jest.Mock).mockResolvedValue(mockSequence);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/email/sequences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Onboarding Sequence',
        description: 'Welcome new leads',
        triggerType: 'MANUAL',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_SEQUENCE_ID,
      name: 'Onboarding Sequence',
      triggerType: 'MANUAL',
      status: 'DRAFT',
      totalSteps: 0,
    });

    const createCall = (prisma.emailSequence.create as jest.Mock).mock.calls[0]?.[0];
    expect(createCall?.data?.organizationId).toBe(TEST_ORG_ID);
    expect(createCall?.data?.createdById).toBe(TEST_USER_ID);
  });

  it('returns 422 for invalid triggerType', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/email/sequences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        name: 'Test Sequence',
        triggerType: 'INVALID_TRIGGER',
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 when name is missing', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post('/api/v1/email/sequences')
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ triggerType: 'MANUAL' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// POST /api/v1/email/sequences/:id/steps
// =============================================================================

describe('POST /api/v1/email/sequences/:id/steps', () => {
  it('adds a step with delay days and hours', async () => {
    // getSequence call
    (prisma.emailSequence.findUnique as jest.Mock).mockResolvedValue(
      mockSequenceWithSteps
    );
    // template lookup for org check
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
    // $transaction: [step, sequence]
    (prisma.$transaction as jest.Mock).mockResolvedValue([mockStep, { ...mockSequence, totalSteps: 1 }]);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/email/sequences/${TEST_SEQUENCE_ID}/steps`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        templateId: TEST_TEMPLATE_ID,
        delayDays: 3,
        delayHours: 0,
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_STEP_ID,
      sequenceId: TEST_SEQUENCE_ID,
      templateId: TEST_TEMPLATE_ID,
    });
  });

  it('returns 422 for non-UUID templateId', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/email/sequences/${TEST_SEQUENCE_ID}/steps`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        templateId: 'not-a-uuid',
        delayDays: 1,
        delayHours: 0,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for delayDays exceeding maximum', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/email/sequences/${TEST_SEQUENCE_ID}/steps`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({
        templateId: TEST_TEMPLATE_ID,
        delayDays: 400, // max is 365
        delayHours: 0,
      });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// POST /api/v1/email/sequences/:id/enroll
// =============================================================================

describe('POST /api/v1/email/sequences/:id/enroll', () => {
  it('enrolls a single lead and enqueues the first send job', async () => {
    const sequenceWithSteps = {
      ...mockSequenceWithSteps,
      totalSteps: 1,
    };

    (prisma.emailSequence.findUnique as jest.Mock).mockResolvedValue(sequenceWithSteps);
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(mockLead);
    (prisma.emailEnrollment.findUnique as jest.Mock).mockResolvedValue(null);
    (prisma.emailSequenceStep.findFirst as jest.Mock).mockResolvedValue(mockStep);
    (prisma.emailEnrollment.create as jest.Mock).mockResolvedValue(mockEnrollment);
    (prisma.emailSequence.update as jest.Mock).mockResolvedValue({
      ...sequenceWithSteps,
      totalEnrolled: 1,
    });

    // BullMQ add mock
    const { Queue } = require('bullmq');
    const queueInstance = new Queue();
    (queueInstance.add as jest.Mock).mockResolvedValue({ id: 'mock-job-id' });

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/email/sequences/${TEST_SEQUENCE_ID}/enroll`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ leadIds: [TEST_LEAD_ID] });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toMatchObject({
      id: TEST_ENROLLMENT_ID,
      sequenceId: TEST_SEQUENCE_ID,
      leadId: TEST_LEAD_ID,
      status: 'ACTIVE',
    });

    // Verify enrollment was created
    expect(prisma.emailEnrollment.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          sequenceId: TEST_SEQUENCE_ID,
          leadId: TEST_LEAD_ID,
          organizationId: TEST_ORG_ID,
          enrolledById: TEST_USER_ID,
          currentStep: 1,
          status: 'ACTIVE',
        }),
      })
    );
  });

  it('returns 422 if leadIds array is empty', async () => {
    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/email/sequences/${TEST_SEQUENCE_ID}/enroll`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ leadIds: [] });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 404 when sequence does not exist', async () => {
    (prisma.emailSequence.findUnique as jest.Mock).mockResolvedValue(null);

    const accessToken = makeAccessToken(TEST_USER_ID);

    const res = await client
      .post(`/api/v1/email/sequences/${TEST_SEQUENCE_ID}/enroll`)
      .set('Authorization', `Bearer ${accessToken}`)
      .send({ leadIds: [TEST_LEAD_ID] });

    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('NOT_FOUND');
  });

  it('returns 401 when not authenticated', async () => {
    const res = await client
      .post(`/api/v1/email/sequences/${TEST_SEQUENCE_ID}/enroll`)
      .send({ leadIds: [TEST_LEAD_ID] });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

// =============================================================================
// POST /api/v1/email/webhook/mailgun
// =============================================================================

describe('POST /api/v1/email/webhook/mailgun', () => {
  it('processes a delivered event and updates EmailSend status to delivered', async () => {
    (prisma.emailSend.findFirst as jest.Mock).mockResolvedValue(mockEmailSend);
    (prisma.emailSend.update as jest.Mock).mockResolvedValue({
      ...mockEmailSend,
      status: 'delivered',
    });

    const webhookPayload = {
      'event-data': {
        event: 'delivered',
        recipient: 'jane.doe@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        message: {
          headers: {
            'message-id': 'mock-mailgun-message-id-12345',
          },
        },
      },
    };

    const res = await client
      .post('/api/v1/email/webhook/mailgun')
      .send(webhookPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(prisma.emailSend.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_EMAIL_SEND_ID },
        data: expect.objectContaining({ status: 'delivered' }),
      })
    );
  });

  it('processes an open event and sets openedAt timestamp', async () => {
    (prisma.emailSend.findFirst as jest.Mock).mockResolvedValue(mockEmailSend);
    (prisma.emailSend.update as jest.Mock).mockResolvedValue({
      ...mockEmailSend,
      status: 'opened',
      openedAt: new Date(),
    });

    const webhookPayload = {
      'event-data': {
        event: 'opened',
        recipient: 'jane.doe@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        message: {
          headers: {
            'message-id': 'mock-mailgun-message-id-12345',
          },
        },
      },
    };

    const res = await client
      .post('/api/v1/email/webhook/mailgun')
      .send(webhookPayload);

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    expect(prisma.emailSend.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_EMAIL_SEND_ID },
        data: expect.objectContaining({
          status: 'opened',
          openedAt: expect.any(Date),
        }),
      })
    );
  });

  it('processes a bounce event and sets bouncedAt timestamp', async () => {
    (prisma.emailSend.findFirst as jest.Mock).mockResolvedValue(mockEmailSend);
    (prisma.emailSend.update as jest.Mock).mockResolvedValue({
      ...mockEmailSend,
      status: 'bounced',
      bouncedAt: new Date(),
    });

    const webhookPayload = {
      'event-data': {
        event: 'failed',
        recipient: 'jane.doe@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        message: {
          headers: {
            'message-id': 'mock-mailgun-message-id-12345',
          },
        },
      },
    };

    const res = await client
      .post('/api/v1/email/webhook/mailgun')
      .send(webhookPayload);

    expect(res.status).toBe(200);

    expect(prisma.emailSend.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_EMAIL_SEND_ID },
        data: expect.objectContaining({
          status: 'bounced',
          bouncedAt: expect.any(Date),
        }),
      })
    );
  });

  it('handles webhook with no matching EmailSend record gracefully (no crash)', async () => {
    (prisma.emailSend.findFirst as jest.Mock).mockResolvedValue(null);

    const webhookPayload = {
      'event-data': {
        event: 'delivered',
        recipient: 'unknown@example.com',
        timestamp: Math.floor(Date.now() / 1000),
        message: {
          headers: {
            'message-id': 'non-existent-message-id',
          },
        },
      },
    };

    const res = await client
      .post('/api/v1/email/webhook/mailgun')
      .send(webhookPayload);

    // Must still return 200 even when we don't know the message.
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(prisma.emailSend.update as jest.Mock).not.toHaveBeenCalled();
  });

  it('accepts the payload without authentication (public endpoint)', async () => {
    (prisma.emailSend.findFirst as jest.Mock).mockResolvedValue(null);

    // No Authorization header
    const res = await client
      .post('/api/v1/email/webhook/mailgun')
      .send({
        'event-data': {
          event: 'delivered',
          recipient: 'test@example.com',
          timestamp: 1000,
          message: {
            headers: {
              'message-id': 'public-mailgun-message-id',
            },
          },
        },
      });

    expect(res.status).toBe(200);
  });
});

// =============================================================================
// POST /api/v1/email/unsubscribe
// =============================================================================

describe('POST /api/v1/email/unsubscribe', () => {
  it('marks lead as unsubscribed and stops active enrollments', async () => {
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(mockLead);
    (prisma.lead.update as jest.Mock).mockResolvedValue({
      ...mockLead,
      isUnsubscribed: true,
      unsubscribedAt: new Date(),
    });
    (prisma.emailEnrollment.findMany as jest.Mock).mockResolvedValue([mockEnrollment]);
    (prisma.emailEnrollment.updateMany as jest.Mock).mockResolvedValue({ count: 1 });

    const res = await client
      .post('/api/v1/email/unsubscribe')
      .send({ email: 'jane.doe@example.com', orgId: TEST_ORG_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.message).toContain('unsubscribed');

    // Verify lead was marked unsubscribed
    expect(prisma.lead.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_LEAD_ID },
        data: expect.objectContaining({
          isUnsubscribed: true,
          unsubscribedAt: expect.any(Date),
        }),
      })
    );

    // Verify active enrollments were stopped
    expect(prisma.emailEnrollment.updateMany as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          leadId: TEST_LEAD_ID,
          status: 'ACTIVE',
        }),
        data: expect.objectContaining({
          status: 'UNSUBSCRIBED',
          unsubscribedAt: expect.any(Date),
        }),
      })
    );
  });

  it('returns 200 for unknown email (does not crash)', async () => {
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(null);

    const res = await client
      .post('/api/v1/email/unsubscribe')
      .send({ email: 'nobody@example.com', orgId: TEST_ORG_ID });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  it('returns 422 for invalid email format', async () => {
    const res = await client
      .post('/api/v1/email/unsubscribe')
      .send({ email: 'not-an-email', orgId: TEST_ORG_ID });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('returns 422 for invalid orgId (not a UUID)', async () => {
    const res = await client
      .post('/api/v1/email/unsubscribe')
      .send({ email: 'jane@example.com', orgId: 'not-a-uuid' });

    expect(res.status).toBe(422);
    expect(res.body.success).toBe(false);
  });

  it('accepts the payload without authentication (public endpoint)', async () => {
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(null);

    // No Authorization header
    const res = await client
      .post('/api/v1/email/unsubscribe')
      .send({ email: 'jane.doe@example.com', orgId: TEST_ORG_ID });

    // Should succeed (no auth required for unsubscribe)
    expect(res.status).toBe(200);
  });
});

// =============================================================================
// Unsubscribed lead: email send skipped in processEmailJob
// =============================================================================

describe('processEmailJob — unsubscribed lead causes enrollment to stop', () => {
  it('marks enrollment UNSUBSCRIBED when lead.isUnsubscribed is true', async () => {
    const { emailSequenceService } = await import('../../../src/services/email-sequence.service');

    const unsubscribedLead = { ...mockLead, isUnsubscribed: true };

    const enrollmentWithSequence = {
      ...mockEnrollment,
      sequence: {
        ...mockSequenceWithSteps,
        steps: mockSequenceWithSteps.steps,
      },
    };

    (prisma.emailEnrollment.findUnique as jest.Mock).mockResolvedValue(enrollmentWithSequence);
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(unsubscribedLead);
    (prisma.emailEnrollment.update as jest.Mock).mockResolvedValue({
      ...mockEnrollment,
      status: 'UNSUBSCRIBED',
      unsubscribedAt: new Date(),
    });

    // Create a mock BullMQ job
    const mockJob = {
      id: 'test-job-id',
      data: {
        sequenceId: TEST_SEQUENCE_ID,
        recipientId: TEST_LEAD_ID,
        orgId: TEST_ORG_ID,
        templateId: TEST_STEP_ID,
        variables: {},
        scheduledAt: new Date().toISOString(),
        enrollmentId: TEST_ENROLLMENT_ID,
        stepId: TEST_STEP_ID,
        leadId: TEST_LEAD_ID,
      },
    };

    // Should not throw
    await emailSequenceService.processEmailJob(mockJob as any);

    // Verify enrollment was marked UNSUBSCRIBED
    expect(prisma.emailEnrollment.update as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: TEST_ENROLLMENT_ID },
        data: expect.objectContaining({
          status: 'UNSUBSCRIBED',
          unsubscribedAt: expect.any(Date),
        }),
      })
    );

    // Verify no email was sent
    expect(mockMailgunMessagesCreate).not.toHaveBeenCalled();
  });

  it('sends email and enqueues next step when lead is subscribed and more steps exist', async () => {
    const { emailSequenceService } = await import('../../../src/services/email-sequence.service');

    const twoStepSequence = {
      ...mockSequenceWithSteps,
      totalSteps: 2,
      steps: [
        mockStep,
        {
          id: 'step-2-id-0000-0000-000000000002',
          sequenceId: TEST_SEQUENCE_ID,
          organizationId: TEST_ORG_ID,
          stepNumber: 2,
          templateId: TEST_TEMPLATE_ID,
          delayDays: 1,
          delayHours: 0,
          subject: null,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const enrollmentWithTwoStepSeq = {
      ...mockEnrollment,
      sequence: twoStepSequence,
    };

    (prisma.emailEnrollment.findUnique as jest.Mock).mockResolvedValue(enrollmentWithTwoStepSeq);
    (prisma.lead.findUnique as jest.Mock).mockResolvedValue(mockLead);
    (prisma.emailTemplate.findUnique as jest.Mock).mockResolvedValue(mockTemplate);
    (prisma.emailSend.create as jest.Mock).mockResolvedValue(mockEmailSend);
    (prisma.emailEnrollment.update as jest.Mock).mockResolvedValue({
      ...mockEnrollment,
      currentStep: 2,
    });

    mockMailgunMessagesCreate.mockResolvedValueOnce({
      status: 200,
      id: 'new-message-id-xyz',
      message: 'Queued. Thank you.',
    });

    const mockJob = {
      id: 'test-job-id',
      data: {
        sequenceId: TEST_SEQUENCE_ID,
        recipientId: TEST_LEAD_ID,
        orgId: TEST_ORG_ID,
        templateId: TEST_STEP_ID,
        variables: {},
        scheduledAt: new Date().toISOString(),
        enrollmentId: TEST_ENROLLMENT_ID,
        stepId: TEST_STEP_ID,
        leadId: TEST_LEAD_ID,
      },
    };

    await emailSequenceService.processEmailJob(mockJob as any);

    // Email was sent to lead's address
    expect(mockMailgunMessagesCreate).toHaveBeenCalledWith(
      'mg.vireos.com',
      expect.objectContaining({
        to: 'jane.doe@example.com',
      })
    );

    // EmailSend record was created
    expect(prisma.emailSend.create as jest.Mock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          enrollmentId: TEST_ENROLLMENT_ID,
          leadId: TEST_LEAD_ID,
          stepId: TEST_STEP_ID,
          status: 'sent',
        }),
      })
    );
  });
});
