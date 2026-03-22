process.env['NODE_ENV'] = 'test';
process.env['JWT_SECRET'] =
  'test_jwt_secret_that_is_long_enough_to_satisfy_minimum_requirement_12345678';
process.env['JWT_EXPIRES_IN'] = '15m';
process.env['JWT_REFRESH_EXPIRES_IN'] = '7d';
process.env['ENCRYPTION_KEY'] = 'a'.repeat(64);
process.env['DATABASE_URL'] = 'postgresql://test:test@localhost:5432/test';
process.env['REDIS_URL'] = 'redis://localhost:6379/1';
process.env['OPENAI_API_KEY'] = 'sk-test-fake-key-for-testing';

const mockResponsesCreate = jest.fn();
const mockExecuteToolCall = jest.fn();

jest.mock('openai', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    responses: {
      create: mockResponsesCreate,
    },
  })),
}));

jest.mock('../../../src/services/agent/tool-executor', () => ({
  executeToolCall: (...args: unknown[]) => mockExecuteToolCall(...args),
}));

jest.mock('../../../src/db/client', () => ({
  prisma: {
    featureFlag: {
      findUnique: jest.fn(),
    },
    agentConversation: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    agentMessage: {
      create: jest.fn(),
    },
    agentAction: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    organization: {
      findUnique: jest.fn(),
    },
    socialConnection: {
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
    lead: {
      groupBy: jest.fn(),
    },
    draft: {
      groupBy: jest.fn(),
      findMany: jest.fn(),
    },
    linkedInCampaign: {
      findMany: jest.fn(),
    },
    facebookAdCampaign: {
      findMany: jest.fn(),
    },
    emailSequence: {
      findMany: jest.fn(),
    },
    auditTrail: {
      create: jest.fn(),
    },
  },
}));

import { processCommand } from '../../../src/services/agent/agent.service';
import { prisma } from '../../../src/db/client';

const TEST_USER = {
  id: 'advisor-user-id',
  orgId: 'org-1',
  role: 'advisor',
  email: 'advisor@example.com',
};

const TEST_CONVERSATION = {
  id: 'conversation-1',
  userId: TEST_USER.id,
  organizationId: TEST_USER.orgId,
  status: 'ACTIVE',
  messageCount: 2,
  lastResponseId: 'resp-prev',
};

describe('Agent service deterministic publish execution', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    (prisma.featureFlag.findUnique as jest.Mock).mockResolvedValue({ isEnabled: true });
    (prisma.agentConversation.findUnique as jest.Mock).mockResolvedValue(TEST_CONVERSATION);
    (prisma.agentConversation.update as jest.Mock).mockResolvedValue({});
    (prisma.agentConversation.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.agentMessage.create as jest.Mock).mockResolvedValue({});
    (prisma.agentAction.create as jest.Mock).mockResolvedValue({ id: 'action-1' });
    (prisma.agentAction.update as jest.Mock).mockResolvedValue({});
    (prisma.agentAction.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.organization.findUnique as jest.Mock).mockResolvedValue({
      name: 'Test Org',
      creditBalance: 100,
      icpType: 'retirement',
      prohibitedTerms: [],
      requiredDisclosures: [],
      subscriptionStatus: 'ACTIVE',
    });
    (prisma.socialConnection.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      firstName: 'Avery',
      role: 'ADVISOR',
    });
    (prisma.lead.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.draft.groupBy as jest.Mock).mockResolvedValue([]);
    (prisma.linkedInCampaign.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.facebookAdCampaign.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.emailSequence.findMany as jest.Mock).mockResolvedValue([]);
    (prisma.auditTrail.create as jest.Mock).mockResolvedValue({});
  });

  it('resolves the requested draft and publishes it directly without calling OpenAI', async () => {
    (prisma.draft.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'draft-market',
        title: 'Market Volatility Update',
        status: 'APPROVED',
        originalPrompt: 'Create a market volatility update for cautious investors.',
        updatedAt: new Date('2026-03-22T10:00:00Z'),
      },
      {
        id: 'draft-other',
        title: 'Quarterly Planning Checklist',
        status: 'APPROVED',
        originalPrompt: 'Quarterly planning ideas',
        updatedAt: new Date('2026-03-20T10:00:00Z'),
      },
    ]);

    mockExecuteToolCall.mockResolvedValue({
      success: true,
      data: { id: 'publish-job-1', status: 'QUEUED' },
      summary: 'Publishing to LINKEDIN now. Job ID: publish-job-1.',
      entityType: 'PublishJob',
      entityId: 'publish-job-1',
    });

    const result = await processCommand(
      {
        conversationId: TEST_CONVERSATION.id,
        command: 'Publish my market volatility draft to LinkedIn right now.',
      },
      TEST_USER as any
    );

    expect(mockExecuteToolCall).toHaveBeenCalledWith(
      'publish_now',
      { draftId: 'draft-market', channel: 'LINKEDIN' },
      TEST_USER
    );
    expect(mockResponsesCreate).not.toHaveBeenCalled();
    expect(result.assistantMessage).toContain('Started publishing "Market Volatility Update" to LinkedIn');
    expect(result.actions).toHaveLength(1);
    expect(result.actions[0]?.functionName).toBe('publish_now');
  });

  it('returns a grounded blocker when the resolved draft is not approved', async () => {
    (prisma.agentAction.findMany as jest.Mock).mockResolvedValue([
      { entityId: 'draft-webinar' },
    ]);
    (prisma.draft.findMany as jest.Mock)
      .mockResolvedValueOnce([
        {
          id: 'draft-webinar',
          title: 'Webinar Invitation',
          status: 'PENDING_REVIEW',
          originalPrompt: 'Create a webinar invitation for pre-retirees.',
          updatedAt: new Date('2026-03-22T11:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([
        {
          id: 'draft-webinar',
          title: 'Webinar Invitation',
          status: 'PENDING_REVIEW',
          originalPrompt: 'Create a webinar invitation for pre-retirees.',
          updatedAt: new Date('2026-03-22T11:00:00Z'),
        },
      ]);

    mockExecuteToolCall.mockResolvedValue({
      success: false,
      summary: 'Failed to execute publish_now: Draft must be in APPROVED status to publish. Current status: PENDING_REVIEW',
      error: 'Draft must be in APPROVED status to publish. Current status: PENDING_REVIEW',
    });

    const result = await processCommand(
      {
        conversationId: TEST_CONVERSATION.id,
        command: 'Publish that webinar invitation draft to Facebook now.',
      },
      TEST_USER as any
    );

    expect(mockExecuteToolCall).toHaveBeenCalledWith(
      'publish_now',
      { draftId: 'draft-webinar', channel: 'FACEBOOK' },
      TEST_USER
    );
    expect(mockResponsesCreate).not.toHaveBeenCalled();
    expect(result.assistantMessage).toContain('Webinar Invitation');
    expect(result.assistantMessage).toContain('PENDING_REVIEW');
    expect(result.assistantMessage).toContain('APPROVED before publishing');
    expect(result.assistantMessage).toContain('wait for compliance approval');
  });

  it('returns the next compliance step when the target draft is still a draft', async () => {
    (prisma.draft.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'draft-market',
        title: 'Post-Fix Market Volatility Check',
        status: 'DRAFT',
        originalPrompt: 'Create a market volatility update for cautious investors.',
        updatedAt: new Date('2026-03-22T12:00:00Z'),
      },
    ]);

    mockExecuteToolCall.mockResolvedValue({
      success: false,
      summary: 'Failed to execute publish_now: Draft must be in APPROVED status to publish. Current status: DRAFT',
      error: 'Draft must be in APPROVED status to publish. Current status: DRAFT',
    });

    const result = await processCommand(
      {
        conversationId: TEST_CONVERSATION.id,
        command: 'Publish my post-fix market volatility check draft to LinkedIn right now.',
      },
      TEST_USER as any
    );

    expect(mockExecuteToolCall).toHaveBeenCalledWith(
      'publish_now',
      { draftId: 'draft-market', channel: 'LINKEDIN' },
      TEST_USER
    );
    expect(result.assistantMessage).toContain('still DRAFT');
    expect(result.assistantMessage).toContain('submit it for compliance review');
  });

  it('tells the user to connect the social account when the publish is blocked by a missing connection', async () => {
    (prisma.draft.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'draft-approved',
        title: 'Approved Retirement Update',
        status: 'APPROVED',
        originalPrompt: 'Create an approved retirement planning update.',
        updatedAt: new Date('2026-03-22T12:00:00Z'),
      },
    ]);

    mockExecuteToolCall.mockResolvedValue({
      success: false,
      summary: 'Failed to execute publish_now: No active LINKEDIN connection found. Please connect your LINKEDIN account first.',
      error: 'No active LINKEDIN connection found. Please connect your LINKEDIN account first.',
    });

    const result = await processCommand(
      {
        conversationId: TEST_CONVERSATION.id,
        command: 'Publish my approved retirement update draft to LinkedIn right now.',
      },
      TEST_USER as any
    );

    expect(mockExecuteToolCall).toHaveBeenCalledWith(
      'publish_now',
      { draftId: 'draft-approved', channel: 'LINKEDIN' },
      TEST_USER
    );
    expect(result.assistantMessage).toContain('no active LinkedIn connection');
    expect(result.assistantMessage).toContain('connect LinkedIn in Settings');
  });

  it('asks for clarification instead of publishing the wrong draft when multiple title matches exist', async () => {
    (prisma.draft.findMany as jest.Mock).mockResolvedValue([
      {
        id: 'draft-1',
        title: 'Market Volatility Update',
        status: 'APPROVED',
        originalPrompt: 'Create a market volatility update for cautious investors.',
        updatedAt: new Date('2026-03-22T12:00:00Z'),
      },
      {
        id: 'draft-2',
        title: 'Market Volatility Update',
        status: 'DRAFT',
        originalPrompt: 'Create a market volatility update for business owners.',
        updatedAt: new Date('2026-03-22T13:00:00Z'),
      },
    ]);

    const result = await processCommand(
      {
        conversationId: TEST_CONVERSATION.id,
        command: 'Publish "Market Volatility Update" to LinkedIn right now.',
      },
      TEST_USER as any
    );

    expect(mockExecuteToolCall).not.toHaveBeenCalled();
    expect(mockResponsesCreate).not.toHaveBeenCalled();
    expect(result.actions).toHaveLength(0);
    expect(result.assistantMessage).toContain('multiple drafts matching "Market Volatility Update"');
    expect(result.assistantMessage).toContain('"Market Volatility Update" (APPROVED)');
    expect(result.assistantMessage).toContain('"Market Volatility Update" (DRAFT)');
  });
});
