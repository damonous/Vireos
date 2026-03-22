import { test, expect, type Page, type Route } from 'playwright/test';
import { apiClient } from '../../src/app/lib/api-client';
import { easyModeScenarios, type EasyModeScenario } from './easy-mode.scenarios';

type Message = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

type ConversationDetail = {
  id: string;
  title: string;
  status: string;
  messages: Message[];
};

type ConversationSummary = {
  id: string;
  title: string;
  status: string;
  messageCount: number;
  updatedAt: string;
};

type MockState = {
  conversations: ConversationSummary[];
  details: Record<string, ConversationDetail>;
};

const BASELINE_CONVERSATION: ConversationDetail = {
  id: 'conv-baseline',
  title: 'Welcome Brief',
  status: 'draft_ready',
  messages: [
    {
      id: 'msg-baseline-user',
      role: 'user',
      content: 'Show me a simple marketing plan for this quarter.',
      createdAt: '2026-03-22T08:00:00.000Z',
    },
    {
      id: 'msg-baseline-assistant',
      role: 'assistant',
      content: 'Here is a simple quarterly plan with one webinar, one email sequence, and two social posts.',
      createdAt: '2026-03-22T08:00:05.000Z',
    },
  ],
};

const ADVISOR_USER = {
  id: 'user-advisor-1',
  email: 'advisor@example.com',
  firstName: 'Avery',
  lastName: 'Cole',
  role: 'advisor',
  orgId: 'org-1',
  organization: {
    id: 'org-1',
    name: 'AUMetric Wealth',
    slug: 'aumetric-wealth',
    subscriptionStatus: 'active',
  },
};

function toEnvelope(data: unknown) {
  return {
    success: true,
    data,
  };
}

function summaryFromDetail(detail: ConversationDetail): ConversationSummary {
  return {
    id: detail.id,
    title: detail.title,
    status: detail.status,
    messageCount: detail.messages.length,
    updatedAt: detail.messages[detail.messages.length - 1]?.createdAt ?? '2026-03-22T08:00:00.000Z',
  };
}

function buildInitialState(scenario: EasyModeScenario): MockState {
  const baseline = structuredClone(BASELINE_CONVERSATION);
  const state: MockState = {
    conversations: [summaryFromDetail(baseline)],
    details: { [baseline.id]: baseline },
  };

  if (scenario.mode === 'followup') {
    const existing: ConversationDetail = {
      id: `conv-${scenario.id.toLowerCase()}-existing`,
      title: scenario.title,
      status: 'draft_ready',
      messages: [
        {
          id: `msg-${scenario.id.toLowerCase()}-user-initial`,
          role: 'user',
          content: `Initial request for ${scenario.title}.`,
          createdAt: '2026-03-22T09:00:00.000Z',
        },
        {
          id: `msg-${scenario.id.toLowerCase()}-assistant-initial`,
          role: 'assistant',
          content: scenario.priorAssistantText ?? 'Previous assistant guidance.',
          createdAt: '2026-03-22T09:00:10.000Z',
        },
      ],
    };

    state.conversations = [summaryFromDetail(existing), ...state.conversations];
    state.details[existing.id] = existing;
  }

  return state;
}

function buildToolName(category: EasyModeScenario['category']): string {
  switch (category) {
    case 'analytics':
      return 'analytics_snapshot';
    case 'campaigns':
    case 'linkedin':
    case 'facebook':
      return 'campaign_planner';
    case 'compliance':
      return 'compliance_review';
    case 'leads':
    case 'prospects':
      return 'lead_pipeline_review';
    case 'email':
      return 'email_sequence_builder';
    default:
      return 'content_drafter';
  }
}

function chunkText(text: string, size = 80): string[] {
  const chunks: string[] = [];
  for (let index = 0; index < text.length; index += size) {
    chunks.push(text.slice(index, index + size));
  }
  return chunks.length > 0 ? chunks : [''];
}

function buildStreamBody(scenario: EasyModeScenario, conversationId: string, isNewConversation: boolean): string {
  const events: Record<string, unknown>[] = [];

  if (isNewConversation) {
    events.push({ event: 'conversation_created', conversationId });
  }

  const toolName = buildToolName(scenario.category);
  events.push({ event: 'tool_call_start', callId: `tool-${scenario.id.toLowerCase()}`, name: toolName });
  events.push({
    event: 'tool_call_complete',
    callId: `tool-${scenario.id.toLowerCase()}`,
    summary: `${toolName.replace(/_/g, ' ')} complete`,
  });

  for (const delta of chunkText(scenario.response)) {
    events.push({ event: 'text_delta', delta });
  }

  events.push({ event: 'done' });

  return events.map((event) => `data: ${JSON.stringify(event)}\n`).join('');
}

async function fulfillJson(route: Route, data: unknown, status = 200) {
  await route.fulfill({
    status,
    contentType: 'application/json',
    body: JSON.stringify(toEnvelope(data)),
  });
}

async function installMocks(page: Page, scenario: EasyModeScenario) {
  const state = buildInitialState(scenario);

  await page.addInitScript(
    ({ keys, user }) => {
      localStorage.setItem(keys.accessToken, 'test-access-token');
      localStorage.setItem(keys.refreshToken, 'test-refresh-token');
      localStorage.setItem(keys.expiresAt, String(Date.now() + 3_600_000));
      localStorage.setItem(keys.user, JSON.stringify(user));
    },
    { keys: apiClient.keys, user: ADVISOR_USER }
  );

  await page.route('**/api/v1/**', async (route) => {
    const request = route.request();
    const url = new URL(request.url());
    const path = url.pathname;

    if (path === '/api/v1/auth/me' && request.method() === 'GET') {
      await fulfillJson(route, ADVISOR_USER);
      return;
    }

    if (path === '/api/v1/auth/logout' && request.method() === 'POST') {
      await fulfillJson(route, { ok: true });
      return;
    }

    if (path === '/api/v1/auth/refresh' && request.method() === 'POST') {
      await fulfillJson(route, { accessToken: 'test-access-token', refreshToken: 'test-refresh-token' });
      return;
    }

    if (path === '/api/v1/agent/conversations' && request.method() === 'GET') {
      await fulfillJson(route, state.conversations);
      return;
    }

    if (path.startsWith('/api/v1/agent/conversations/') && request.method() === 'GET') {
      const conversationId = path.split('/').pop() ?? '';
      const detail = state.details[conversationId];
      if (!detail) {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            success: false,
            error: { code: 'NOT_FOUND', message: 'Conversation not found' },
          }),
        });
        return;
      }
      await fulfillJson(route, detail);
      return;
    }

    if (path === '/api/v1/agent/command/stream' && request.method() === 'POST') {
      const payload = JSON.parse(request.postData() ?? '{}') as { command?: string; conversationId?: string };
      const conversationId = payload.conversationId ?? `conv-${scenario.id.toLowerCase()}-new`;
      const isNewConversation = !payload.conversationId;
      const now = '2026-03-22T10:00:00.000Z';

      const existingDetail = state.details[conversationId];
      const userMessage: Message = {
        id: `msg-${scenario.id.toLowerCase()}-user`,
        role: 'user',
        content: payload.command ?? scenario.ask,
        createdAt: now,
      };
      const assistantMessage: Message = {
        id: `msg-${scenario.id.toLowerCase()}-assistant`,
        role: 'assistant',
        content: scenario.response,
        createdAt: '2026-03-22T10:00:05.000Z',
      };

      const detail: ConversationDetail = existingDetail
        ? {
            ...existingDetail,
            title: scenario.title,
            messages: [...existingDetail.messages, userMessage, assistantMessage],
          }
        : {
            id: conversationId,
            title: scenario.title,
            status: 'draft_ready',
            messages: [userMessage, assistantMessage],
          };

      state.details[conversationId] = detail;

      const summary = summaryFromDetail(detail);
      const existingIndex = state.conversations.findIndex((conversation) => conversation.id === conversationId);
      if (existingIndex >= 0) {
        state.conversations.splice(existingIndex, 1);
      }
      state.conversations.unshift(summary);

      await route.fulfill({
        status: 200,
        contentType: 'text/event-stream',
        headers: {
          'Cache-Control': 'no-cache',
          Connection: 'keep-alive',
        },
        body: buildStreamBody(scenario, conversationId, isNewConversation),
      });
      return;
    }

    await route.fulfill({
      status: 404,
      contentType: 'application/json',
      body: JSON.stringify({
        success: false,
        error: { code: 'UNHANDLED_ROUTE', message: `Unhandled mock route: ${request.method()} ${path}` },
      }),
    });
  });
}

async function bootEasyMode(page: Page, scenario: EasyModeScenario) {
  await installMocks(page, scenario);
  await page.goto('/easy');
  await expect(page.getByPlaceholder('Ask Vireos AI to help with your marketing...')).toBeVisible();
}

async function submitAsk(page: Page, scenario: EasyModeScenario) {
  if (scenario.mode !== 'followup') {
    await page.getByRole('button', { name: 'New Chat' }).first().click();
    await expect(page.getByText('How can I help you today?')).toBeVisible();
  }

  const composer = page.getByPlaceholder('Ask Vireos AI to help with your marketing...');

  if (scenario.quickActionLabel) {
    await page.getByRole('button', { name: scenario.quickActionLabel }).click();
    await expect(composer).toHaveValue(scenario.ask);
  } else {
    await composer.fill(scenario.ask);
  }

  await composer.press('Enter');
}

async function assertScenario(page: Page, scenario: EasyModeScenario) {
  for (const snippet of scenario.expectedText) {
    await expect(page.getByText(snippet, { exact: false }).first()).toBeVisible();
  }

  if (scenario.mode === 'followup' && scenario.priorAssistantText) {
    await expect(page.getByText(scenario.priorAssistantText, { exact: false }).first()).toBeVisible();
  }

  if (scenario.bulletItems) {
    for (const item of scenario.bulletItems) {
      await expect(page.locator('ul li').filter({ hasText: item }).first()).toBeVisible();
    }
  }

  if (scenario.orderedItems) {
    for (const item of scenario.orderedItems) {
      await expect(page.locator('ol li').filter({ hasText: item }).first()).toBeVisible();
    }
  }

  if (scenario.link) {
    const link = page.getByRole('link', { name: scenario.link.label }).first();
    await expect(link).toBeVisible();
    await expect(link).toHaveAttribute('href', scenario.link.href);
  }

  if (scenario.codeSnippet) {
    await expect(page.locator('pre code').first()).toContainText(scenario.codeSnippet);
  }

  await expect(page.locator('button').filter({ hasText: scenario.title }).first()).toBeVisible();
}

test.describe('Easy Mode advisor asks', () => {
  for (const scenario of easyModeScenarios) {
    test(`${scenario.id} ${scenario.ask}`, async ({ page }) => {
      await bootEasyMode(page, scenario);
      await submitAsk(page, scenario);
      await assertScenario(page, scenario);
    });
  }
});
