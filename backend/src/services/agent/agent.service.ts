// =============================================================================
// Agent Service — Core orchestration for Easy Mode
// =============================================================================
// Processes natural language commands via GPT-5.2 Responses API with function
// calling mapped to all existing Vireos services. This service is the single
// entry point for the Easy Mode chat interface.
// =============================================================================

import {
  AgentConversationStatus,
  AgentActionStatus,
  AuditAction,
  ContentChannel,
  ContentStatus,
} from '@prisma/client';
import { prisma } from '../../db/client';
import { config } from '../../config';
import { logger } from '../../utils/logger';
import { Errors, AppError } from '../../middleware/errorHandler';
import type { AuthenticatedUser } from '../../types';
import { AGENT_TOOLS } from './tools';
import { executeToolCall } from './tool-executor';
import { buildAgentSystemPrompt } from './system-prompt';
import type {
  ProcessCommandDto,
  AgentCommandResult,
  AgentActionResult,
  ListConversationsParams,
  SSEEmitter,
} from './types';

// ---------------------------------------------------------------------------
// OpenAI client (lazy import for test mocking)
// ---------------------------------------------------------------------------

async function getOpenAIClient(): Promise<import('openai').default> {
  const { default: OpenAI } = await import('openai');
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function writeAuditTrail(params: {
  organizationId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    logger.error('Failed to write agent audit trail', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function buildDynamicContext(user: AuthenticatedUser) {
  const [
    org,
    connections,
    userRecord,
    leadCounts,
    draftCounts,
    activeCampaignsLinkedIn,
    activeCampaignsFacebook,
    activeSequences,
    recentConversations,
  ] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: user.orgId },
      select: {
        name: true,
        creditBalance: true,
        icpType: true,
        prohibitedTerms: true,
        requiredDisclosures: true,
        subscriptionStatus: true,
      },
    }),
    prisma.socialConnection.findMany({
      where: { userId: user.id, isActive: true },
      select: { platform: true },
    }),
    prisma.user.findUnique({
      where: { id: user.id },
      select: { firstName: true, role: true },
    }),
    prisma.lead.groupBy({
      by: ['status'],
      where: { organizationId: user.orgId },
      _count: true,
    }),
    prisma.draft.groupBy({
      by: ['status'],
      where: { organizationId: user.orgId },
      _count: true,
    }),
    prisma.linkedInCampaign.findMany({
      where: { organizationId: user.orgId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { name: true, status: true, totalEnrolled: true },
      take: 5,
    }),
    prisma.facebookAdCampaign.findMany({
      where: { organizationId: user.orgId, status: { in: ['ACTIVE', 'PAUSED'] } },
      select: { name: true, status: true },
      take: 5,
    }),
    prisma.emailSequence.findMany({
      where: { organizationId: user.orgId, status: 'ACTIVE' },
      select: { name: true, totalEnrolled: true, status: true },
      take: 5,
    }),
    prisma.agentConversation.findMany({
      where: { userId: user.id, status: 'ACTIVE' },
      select: { title: true },
      orderBy: { updatedAt: 'desc' },
      take: 5,
    }),
  ]);

  // Transform groupBy results into Record<string, number>
  const leadCountsByStatus: Record<string, number> = {};
  let totalLeads = 0;
  for (const row of leadCounts) {
    leadCountsByStatus[row.status] = row._count;
    totalLeads += row._count;
  }

  const draftCountsByStatus: Record<string, number> = {};
  let totalDrafts = 0;
  for (const row of draftCounts) {
    draftCountsByStatus[row.status] = row._count;
    totalDrafts += row._count;
  }

  // Merge LinkedIn + Facebook campaigns into a single list
  const activeCampaigns = [
    ...activeCampaignsLinkedIn.map((c) => ({
      type: 'linkedin' as const,
      name: c.name,
      enrolled: c.totalEnrolled,
      status: c.status,
    })),
    ...activeCampaignsFacebook.map((c) => ({
      type: 'facebook' as const,
      name: c.name,
      status: c.status,
    })),
  ];

  return {
    orgName: org?.name ?? 'Unknown',
    userName: user.email,
    connectedPlatforms: connections.map((c) => c.platform),
    creditBalance: org?.creditBalance ?? 0,
    userFirstName: userRecord?.firstName ?? 'there',
    userRole: userRecord?.role ?? 'MEMBER',
    icpType: org?.icpType ?? '',
    prohibitedTerms: org?.prohibitedTerms ?? [],
    requiredDisclosures: org?.requiredDisclosures ?? null,
    subscriptionStatus: org?.subscriptionStatus ?? 'UNKNOWN',
    leadCountsByStatus,
    totalLeads,
    draftCountsByStatus,
    totalDrafts,
    activeCampaigns,
    activeSequences: activeSequences.map((s) => ({
      name: s.name,
      totalEnrolled: s.totalEnrolled,
      status: s.status,
    })),
    recentConversationTitles: recentConversations
      .map((c) => c.title)
      .filter((t): t is string => t !== null && t !== undefined),
  };
}

// ---------------------------------------------------------------------------
// Extract function calls from GPT-5.2 response output
// ---------------------------------------------------------------------------

function extractFunctionCalls(output: unknown[]): Array<{ id: string; name: string; arguments: string }> {
  const calls: Array<{ id: string; name: string; arguments: string }> = [];
  if (!Array.isArray(output)) return calls;

  for (const item of output) {
    const obj = item as Record<string, unknown>;
    if (obj.type === 'function_call') {
      calls.push({
        id: (obj.call_id ?? obj.id ?? '') as string,
        name: obj.name as string,
        arguments: obj.arguments as string,
      });
    }
  }
  return calls;
}

function extractTextContent(output: unknown[]): string {
  if (!Array.isArray(output)) return '';
  const parts: string[] = [];
  for (const item of output) {
    const obj = item as Record<string, unknown>;
    if (obj.type === 'message') {
      const content = obj.content as unknown[];
      if (Array.isArray(content)) {
        for (const c of content) {
          const part = c as Record<string, unknown>;
          if (part.type === 'output_text' || part.type === 'text') {
            parts.push(part.text as string);
          }
        }
      }
    }
  }
  return parts.join('\n');
}

function buildDeterministicActionSummary(actions: AgentActionResult[]): string {
  return actions
    .map((action) =>
      action.success
        ? `Completed: ${action.summary}`
        : `Could not complete ${action.functionName.replace(/_/g, ' ')}: ${action.error ?? action.summary}`
    )
    .join('\n');
}

function buildDeterministicLeadListSummary(actions: AgentActionResult[]): string | null {
  if (actions.length === 0 || !actions.every((action) => action.functionName === 'list_leads')) {
    return null;
  }

  const uniqueLeads = new Map<
    string,
    { name: string; status?: string; source?: string; notes?: string }
  >();
  let emptyBuckets = 0;

  for (const action of actions) {
    const payload = action.data as
      | {
          data?: Array<{
            id?: string;
            firstName?: string;
            lastName?: string;
            status?: string;
            source?: string;
            notes?: string;
          }>;
        }
      | undefined;

    const leads = payload?.data ?? [];
    if (leads.length === 0) {
      emptyBuckets += 1;
      continue;
    }

    for (const lead of leads) {
      const id = lead.id ?? `${lead.firstName ?? ''}:${lead.lastName ?? ''}`;
      if (!id || uniqueLeads.has(id)) {
        continue;
      }

      uniqueLeads.set(id, {
        name: `${lead.firstName ?? ''} ${lead.lastName ?? ''}`.trim(),
        status: lead.status,
        source: lead.source,
        notes: lead.notes,
      });
    }
  }

  if (uniqueLeads.size === 0) {
    return 'No matching leads need attention right now.';
  }

  const leadLines = Array.from(uniqueLeads.values())
    .slice(0, 3)
    .map((lead) => {
      const qualifiers = [lead.status, lead.source].filter(Boolean).join(' | ');
      const note = lead.notes ? ` — ${lead.notes}` : '';
      return `- ${lead.name}${qualifiers ? ` (${qualifiers})` : ''}${note}`;
    });

  const extraLeadCount = uniqueLeads.size - leadLines.length;

  return [
    `Leads needing attention now: ${uniqueLeads.size}`,
    ...leadLines,
    extraLeadCount > 0 ? `- Plus ${extraLeadCount} additional matching lead(s)` : null,
    emptyBuckets > 0 ? `- ${emptyBuckets} lead query bucket(s) returned no matches` : null,
    'Next step: first-touch NEW leads, follow up CONTACTED leads, and push ENGAGED leads toward a scheduled meeting.',
  ]
    .filter((line): line is string => Boolean(line))
    .join('\n');
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function platformLabel(channel: ContentChannel): string {
  return channel === ContentChannel.LINKEDIN ? 'LinkedIn' : 'Facebook';
}

function detectPublishChannel(command: string): ContentChannel | null {
  const normalized = normalizeSearchText(command);
  if (normalized.includes('linkedin')) {
    return ContentChannel.LINKEDIN;
  }
  if (normalized.includes('facebook')) {
    return ContentChannel.FACEBOOK;
  }
  return null;
}

function isDeterministicPublishNowCommand(command: string): boolean {
  const normalized = normalizeSearchText(command);
  if (!normalized.includes('publish')) {
    return false;
  }
  if (normalized.includes('schedule')) {
    return false;
  }
  if (normalized.includes('when should i publish') || normalized.includes('how do i publish')) {
    return false;
  }
  return detectPublishChannel(command) !== null;
}

function cleanupDraftSearchHint(value: string): string {
  return value
    .replace(/\b(right now|now|immediately|today|please)\b/gi, ' ')
    .replace(/\b(post|content|draft)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractDraftSearchHint(command: string): string | null {
  const quoted = command.match(/["“”]([^"“”]{3,120})["“”]/);
  if (quoted?.[1]) {
    return cleanupDraftSearchHint(quoted[1]);
  }

  const draftMatch = command.match(/\b(?:my|the)\s+(.+?)\s+draft\b/i);
  if (draftMatch?.[1]) {
    return cleanupDraftSearchHint(draftMatch[1]);
  }

  const publishMatch = command.match(/\bpublish\s+(.+?)\s+to\s+(?:linkedin|facebook)\b/i);
  if (publishMatch?.[1]) {
    return cleanupDraftSearchHint(publishMatch[1]);
  }

  return null;
}

type PublishTargetDraft = {
  id: string;
  title: string;
  status: ContentStatus;
  originalPrompt: string;
  updatedAt: Date;
};

type PublishDraftResolution =
  | { kind: 'resolved'; draft: PublishTargetDraft }
  | { kind: 'ambiguous'; searchHint: string; candidates: PublishTargetDraft[] }
  | { kind: 'unresolved'; searchHint: string | null };

async function findRecentConversationDraft(conversationId: string): Promise<PublishTargetDraft | null> {
  const recentDraftActions = await prisma.agentAction.findMany({
    where: {
      conversationId,
      entityType: 'Draft',
      entityId: { not: null },
      status: AgentActionStatus.COMPLETED,
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
    select: { entityId: true },
  });

  const draftIds = recentDraftActions
    .map((action) => action.entityId)
    .filter((id): id is string => Boolean(id));

  if (draftIds.length === 0) {
    return null;
  }

  const drafts = await prisma.draft.findMany({
    where: { id: { in: draftIds } },
    select: {
      id: true,
      title: true,
      status: true,
      originalPrompt: true,
      updatedAt: true,
    },
  });

  const draftMap = new Map(drafts.map((draft) => [draft.id, draft]));
  for (const draftId of draftIds) {
    const draft = draftMap.get(draftId);
    if (draft) {
      return draft;
    }
  }

  return null;
}

function scoreDraftCandidate(
  draft: PublishTargetDraft,
  searchHint: string,
  preferredDraftId?: string | null
): number {
  const normalizedHint = normalizeSearchText(searchHint);
  if (!normalizedHint) {
    return preferredDraftId && draft.id === preferredDraftId ? 100 : 0;
  }

  const title = normalizeSearchText(draft.title);
  const prompt = normalizeSearchText(draft.originalPrompt);
  const tokens = normalizedHint
    .split(' ')
    .filter((token) => token.length > 2);

  let score = 0;
  if (title === normalizedHint) {
    score += 30;
  } else if (title.includes(normalizedHint)) {
    score += 18;
  }

  if (prompt.includes(normalizedHint)) {
    score += 10;
  }

  for (const token of tokens) {
    if (title.includes(token)) {
      score += 4;
    }
    if (prompt.includes(token)) {
      score += 2;
    }
  }

  if (preferredDraftId && draft.id === preferredDraftId) {
    score += 6;
  }

  return score;
}

async function resolvePublishTargetDraft(
  command: string,
  conversationId: string,
  user: AuthenticatedUser
): Promise<PublishDraftResolution> {
  const recentConversationDraft = await findRecentConversationDraft(conversationId);
  const searchHint = extractDraftSearchHint(command);
  const normalizedHint = searchHint ? normalizeSearchText(searchHint) : '';

  if (!searchHint && recentConversationDraft) {
    return { kind: 'resolved', draft: recentConversationDraft };
  }

  if (!searchHint) {
    return { kind: 'unresolved', searchHint: null };
  }

  const candidates = await prisma.draft.findMany({
    where: {
      organizationId: user.orgId,
      status: { not: ContentStatus.ARCHIVED },
    },
    select: {
      id: true,
      title: true,
      status: true,
      originalPrompt: true,
      updatedAt: true,
    },
    orderBy: { updatedAt: 'desc' },
    take: 50,
  });

  const ranked = candidates
    .map((draft) => ({
      draft,
      score: scoreDraftCandidate(draft, searchHint, recentConversationDraft?.id),
    }))
    .filter((candidate) => candidate.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return right.draft.updatedAt.getTime() - left.draft.updatedAt.getTime();
    });

  if (ranked.length === 0) {
    return recentConversationDraft
      ? { kind: 'resolved', draft: recentConversationDraft }
      : { kind: 'unresolved', searchHint };
  }

  const [top] = ranked;
  if (!top) {
    return recentConversationDraft
      ? { kind: 'resolved', draft: recentConversationDraft }
      : { kind: 'unresolved', searchHint };
  }

  const exactTitleMatches = ranked.filter(
    ({ draft }) => normalizeSearchText(draft.title) === normalizedHint
  );
  if (exactTitleMatches.length === 1) {
    return { kind: 'resolved', draft: exactTitleMatches[0].draft };
  }
  if (exactTitleMatches.length > 1) {
    return {
      kind: 'ambiguous',
      searchHint,
      candidates: exactTitleMatches
        .map(({ draft }) => draft)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, 3),
    };
  }

  const titleContainsMatches = ranked.filter(({ draft }) =>
    normalizeSearchText(draft.title).includes(normalizedHint)
  );
  if (titleContainsMatches.length === 1) {
    return { kind: 'resolved', draft: titleContainsMatches[0].draft };
  }
  if (titleContainsMatches.length > 1) {
    return {
      kind: 'ambiguous',
      searchHint,
      candidates: titleContainsMatches
        .map(({ draft }) => draft)
        .sort((left, right) => right.updatedAt.getTime() - left.updatedAt.getTime())
        .slice(0, 3),
    };
  }

  return { kind: 'resolved', draft: top.draft };
}

async function executeTrackedToolCall(params: {
  conversationId: string;
  user: AuthenticatedUser;
  toolName: string;
  args: Record<string, unknown>;
  emit?: SSEEmitter;
  callId?: string;
}): Promise<AgentActionResult> {
  const { conversationId, user, toolName, args, emit, callId } = params;
  const effectiveCallId = callId ?? `deterministic-${toolName}-${Date.now()}`;

  if (emit) {
    emit({ event: 'tool_call_start', callId: effectiveCallId, name: toolName, args });
  }

  const startMs = Date.now();
  const actionRecord = await prisma.agentAction.create({
    data: {
      conversationId,
      organizationId: user.orgId,
      userId: user.id,
      functionName: toolName,
      functionArgs: args as object,
      status: AgentActionStatus.IN_PROGRESS,
    },
  });

  const result = await executeToolCall(toolName, args, user);
  const durationMs = Date.now() - startMs;

  await prisma.agentAction.update({
    where: { id: actionRecord.id },
    data: {
      status: result.success ? AgentActionStatus.COMPLETED : AgentActionStatus.FAILED,
      resultSummary: result.summary,
      resultData: result.data ? (result.data as object) : undefined,
      errorMessage: result.error ?? null,
      entityType: result.entityType ?? null,
      entityId: result.entityId ?? null,
      durationMs,
    },
  });

  if (emit) {
    emit({
      event: 'tool_call_complete',
      callId: effectiveCallId,
      name: toolName,
      success: result.success,
      summary: result.summary,
    });
  }

  return {
    ...result,
    functionName: toolName,
    durationMs,
  };
}

function buildDeterministicPublishSummary(
  action: AgentActionResult,
  draft: PublishTargetDraft,
  channel: ContentChannel
): string {
  const label = platformLabel(channel);

  if (action.success) {
    const jobId = (action.data as { id?: string } | undefined)?.id;
    return jobId
      ? `Started publishing "${draft.title}" to ${label}. Publish job ${jobId} is queued now.`
      : `Started publishing "${draft.title}" to ${label}.`;
  }

  const error = action.error ?? action.summary;

  if (/Draft must be in APPROVED status to publish/i.test(error)) {
    if (draft.status === ContentStatus.DRAFT) {
      return `I tried to publish "${draft.title}" to ${label}, but it is still DRAFT. Drafts must be APPROVED before publishing. Next step: submit it for compliance review, then publish it after approval.`;
    }

    if (draft.status === ContentStatus.PENDING_REVIEW) {
      return `I tried to publish "${draft.title}" to ${label}, but it is still PENDING_REVIEW. Drafts must be APPROVED before publishing. Next step: wait for compliance approval, then publish it.`;
    }

    if (draft.status === ContentStatus.NEEDS_CHANGES) {
      return `I tried to publish "${draft.title}" to ${label}, but it is in NEEDS_CHANGES. Drafts must be APPROVED before publishing. Next step: update the draft, resubmit it for review, and publish after approval.`;
    }

    return `I tried to publish "${draft.title}" to ${label}, but it is still ${draft.status}. Drafts must be APPROVED before publishing.`;
  }

  if (/No active .* connection found/i.test(error)) {
    return `I tried to publish "${draft.title}" to ${label}, but there is no active ${label} connection for your account. Next step: connect ${label} in Settings, then try the publish again.`;
  }

  return `I tried to publish "${draft.title}" to ${label}, but the platform rejected the request: ${error}`;
}

function buildAmbiguousPublishTargetSummary(
  searchHint: string,
  channel: ContentChannel,
  candidates: PublishTargetDraft[]
): string {
  const label = platformLabel(channel);
  const candidateLines = candidates
    .map((draft) => `- "${draft.title}" (${draft.status})`)
    .join('\n');

  return [
    `I found multiple drafts matching "${searchHint}" and I do not want to publish the wrong one to ${label}.`,
    candidateLines,
    `Reply with the exact draft title you want me to publish to ${label}.`,
  ].join('\n');
}

function buildUnresolvedPublishTargetSummary(channel: ContentChannel): string {
  const label = platformLabel(channel);
  return `I could not identify a single draft to publish to ${label}. Reply with the exact draft title, or reference the draft we just worked on in this conversation.`;
}

async function tryHandleDeterministicPublishNow(params: {
  command: string;
  conversationId: string;
  user: AuthenticatedUser;
  emit?: SSEEmitter;
}): Promise<{ assistantMessage: string; actions: AgentActionResult[] } | null> {
  const { command, conversationId, user, emit } = params;

  if (!isDeterministicPublishNowCommand(command)) {
    return null;
  }

  const channel = detectPublishChannel(command);
  if (!channel) {
    return null;
  }

  const resolution = await resolvePublishTargetDraft(command, conversationId, user);
  if (resolution.kind === 'ambiguous') {
    return {
      assistantMessage: buildAmbiguousPublishTargetSummary(
        resolution.searchHint,
        channel,
        resolution.candidates
      ),
      actions: [],
    };
  }
  if (resolution.kind === 'unresolved') {
    return {
      assistantMessage: buildUnresolvedPublishTargetSummary(channel),
      actions: [],
    };
  }
  const draft = resolution.draft;

  const action = await executeTrackedToolCall({
    conversationId,
    user,
    toolName: 'publish_now',
    args: { draftId: draft.id, channel },
    emit,
  });

  return {
    assistantMessage: buildDeterministicPublishSummary(action, draft, channel),
    actions: [action],
  };
}

async function persistConversationTurn(params: {
  conversationId: string;
  conversationMessageCount: number;
  command: string;
  assistantMessage: string;
  responseId?: string | null;
  tokensUsed: number;
  actions: AgentActionResult[];
  user: AuthenticatedUser;
}): Promise<void> {
  const {
    conversationId,
    conversationMessageCount,
    command,
    assistantMessage,
    responseId,
    tokensUsed,
    actions,
    user,
  } = params;

  await prisma.agentMessage.create({
    data: {
      conversationId,
      role: 'assistant',
      content: assistantMessage,
      responseId: responseId ?? undefined,
      tokensUsed,
    },
  });

  await prisma.agentConversation.update({
    where: { id: conversationId },
    data: {
      lastResponseId: responseId ?? undefined,
      messageCount: { increment: 2 },
      totalTokensUsed: { increment: tokensUsed },
      ...(conversationMessageCount === 0
        ? { title: command.slice(0, 100) }
        : {}),
    },
  });

  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'AgentConversation',
    entityId: conversationId,
    action: AuditAction.UPDATED,
    metadata: {
      command: command.slice(0, 200),
      actionsExecuted: actions.map((action) => action.functionName),
      tokensUsed,
    },
  });
}

// ---------------------------------------------------------------------------
// Main: processCommand
// ---------------------------------------------------------------------------

export async function processCommand(
  dto: ProcessCommandDto,
  user: AuthenticatedUser
): Promise<AgentCommandResult> {
  // 1. Check easy_mode feature flag
  const flag = await prisma.featureFlag.findUnique({
    where: {
      organizationId_flag: {
        organizationId: user.orgId,
        flag: 'easy_mode',
      },
    },
  });

  if (!flag?.isEnabled) {
    throw Errors.forbidden('Easy Mode is not enabled for your organization. Contact your admin to enable it.');
  }

  // 2. Load or create conversation
  let conversation;
  if (dto.conversationId) {
    conversation = await prisma.agentConversation.findUnique({
      where: { id: dto.conversationId },
    });

    if (!conversation) {
      throw Errors.notFound('Conversation');
    }
    if (conversation.userId !== user.id) {
      throw Errors.forbidden('You do not have access to this conversation.');
    }
    if (conversation.status !== AgentConversationStatus.ACTIVE) {
      throw Errors.badRequest('This conversation is no longer active.');
    }
    if (conversation.messageCount >= config.AGENT_MAX_CONVERSATION_TURNS * 2) {
      throw Errors.badRequest(
        'This conversation has reached the maximum number of messages. Please start a new conversation.'
      );
    }
  } else {
    conversation = await prisma.agentConversation.create({
      data: {
        organizationId: user.orgId,
        userId: user.id,
        title: dto.command.slice(0, 100),
        status: AgentConversationStatus.ACTIVE,
      },
    });
  }

  // 3. Save user message
  await prisma.agentMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'user',
      content: dto.command,
    },
  });

  // 4. Build system prompt with dynamic context
  const ctx = await buildDynamicContext(user);
  const systemPrompt = buildAgentSystemPrompt(ctx);

  const deterministicPublish = await tryHandleDeterministicPublishNow({
    command: dto.command,
    conversationId: conversation.id,
    user,
  });

  if (deterministicPublish) {
    await persistConversationTurn({
      conversationId: conversation.id,
      conversationMessageCount: conversation.messageCount,
      command: dto.command,
      assistantMessage: deterministicPublish.assistantMessage,
      responseId: null,
      tokensUsed: 0,
      actions: deterministicPublish.actions,
      user,
    });

    return {
      conversationId: conversation.id,
      assistantMessage: deterministicPublish.assistantMessage,
      actions: deterministicPublish.actions,
      suggestions: buildSuggestions(deterministicPublish.actions),
      messageCount: conversation.messageCount + 2,
    };
  }

  // 5. Call GPT-5.2 Responses API
  const openai = await getOpenAIClient();

  let response: any;
  try {
    response = await (openai as any).responses.create({
      model: config.OPENAI_AGENT_MODEL,
      instructions: systemPrompt,
      input: dto.command,
      tools: AGENT_TOOLS,
      previous_response_id: conversation.lastResponseId ?? undefined,
      reasoning: { effort: config.AGENT_REASONING_EFFORT },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('GPT-5.2 agent call failed', { error: message, userId: user.id });

    await prisma.agentConversation.update({
      where: { id: conversation.id },
      data: { status: AgentConversationStatus.FAILED },
    });

    throw new AppError(
      'AI agent is temporarily unavailable. Please try again.',
      502,
      'BAD_GATEWAY'
    );
  }

  // 6. Process response — handle function calls or text
  const functionCalls = extractFunctionCalls(response.output);
  const actions: AgentActionResult[] = [];
  let assistantMessage = '';

  if (functionCalls.length > 0) {
    // Execute function calls (up to AGENT_MAX_ACTIONS_PER_TURN)
    const callsToExecute = functionCalls.slice(0, config.AGENT_MAX_ACTIONS_PER_TURN);

    for (const call of callsToExecute) {
      let parsedArgs: Record<string, unknown> = {};
      try {
        parsedArgs = JSON.parse(call.arguments);
      } catch {
        logger.warn('Failed to parse function call arguments', { callId: call.id, name: call.name });
      }

      actions.push(
        await executeTrackedToolCall({
          conversationId: conversation.id,
          user,
          toolName: call.name,
          args: parsedArgs,
          callId: call.id,
        })
      );
    }

    // Send tool results back to GPT-5.2 for summary
    const deterministicLeadSummary = buildDeterministicLeadListSummary(actions);

    if (deterministicLeadSummary) {
      assistantMessage = deterministicLeadSummary;
    } else if (actions.some((action) => !action.success)) {
      assistantMessage = buildDeterministicActionSummary(actions);
    } else {
      const toolResults = actions.map((a, i) => ({
        type: 'function_call_output' as const,
        call_id: functionCalls[i]!.id,
        output: JSON.stringify({ success: a.success, summary: a.summary, data: a.data }),
      }));

      try {
        const summaryResponse = await (openai as any).responses.create({
          model: config.OPENAI_AGENT_MODEL,
          instructions: systemPrompt,
          input: toolResults,
          previous_response_id: response.id,
          reasoning: { effort: 'low' },
        });

        assistantMessage = summaryResponse.output_text ?? extractTextContent(summaryResponse.output) ?? '';
      } catch {
        assistantMessage = buildDeterministicActionSummary(actions);
      }
    }
  } else {
    // Plain text response (no function calls)
    assistantMessage = response.output_text ?? extractTextContent(response.output) ?? '';
  }

  const tokensUsed = response.usage?.total_tokens ?? 0;
  await persistConversationTurn({
    conversationId: conversation.id,
    conversationMessageCount: conversation.messageCount,
    command: dto.command,
    assistantMessage,
    responseId: response.id,
    tokensUsed,
    actions,
    user,
  });

  // 10. Build suggestions based on actions taken
  const suggestions = buildSuggestions(actions);

  return {
    conversationId: conversation.id,
    assistantMessage,
    actions,
    suggestions,
    messageCount: conversation.messageCount + 2,
  };
}

// ---------------------------------------------------------------------------
// Main: processCommandStream (SSE streaming variant)
// ---------------------------------------------------------------------------

export async function processCommandStream(
  dto: ProcessCommandDto,
  user: AuthenticatedUser,
  emit: SSEEmitter
): Promise<void> {
  try {
    // 1. Check easy_mode feature flag
    const flag = await prisma.featureFlag.findUnique({
      where: {
        organizationId_flag: {
          organizationId: user.orgId,
          flag: 'easy_mode',
        },
      },
    });

    if (!flag?.isEnabled) {
      emit({ event: 'error', message: 'Easy Mode is not enabled for your organization. Contact your admin to enable it.' });
      return;
    }

    // 2. Load or create conversation
    let conversation;
    if (dto.conversationId) {
      conversation = await prisma.agentConversation.findUnique({
        where: { id: dto.conversationId },
      });

      if (!conversation) {
        emit({ event: 'error', message: 'Conversation not found.' });
        return;
      }
      if (conversation.userId !== user.id) {
        emit({ event: 'error', message: 'You do not have access to this conversation.' });
        return;
      }
      if (conversation.status !== AgentConversationStatus.ACTIVE) {
        emit({ event: 'error', message: 'This conversation is no longer active.' });
        return;
      }
      if (conversation.messageCount >= config.AGENT_MAX_CONVERSATION_TURNS * 2) {
        emit({ event: 'error', message: 'This conversation has reached the maximum number of messages. Please start a new conversation.' });
        return;
      }
    } else {
      conversation = await prisma.agentConversation.create({
        data: {
          organizationId: user.orgId,
          userId: user.id,
          title: dto.command.slice(0, 100),
          status: AgentConversationStatus.ACTIVE,
        },
      });
    }

    emit({ event: 'conversation_created', conversationId: conversation.id });

    // 3. Save user message
    await prisma.agentMessage.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: dto.command,
      },
    });

    // 4. Build system prompt with dynamic context
    const ctx = await buildDynamicContext(user);
    const systemPrompt = buildAgentSystemPrompt(ctx);

    emit({ event: 'thinking' });

    const deterministicPublish = await tryHandleDeterministicPublishNow({
      command: dto.command,
      conversationId: conversation.id,
      user,
      emit,
    });

    if (deterministicPublish) {
      emit({ event: 'text_delta', delta: deterministicPublish.assistantMessage });

      await persistConversationTurn({
        conversationId: conversation.id,
        conversationMessageCount: conversation.messageCount,
        command: dto.command,
        assistantMessage: deterministicPublish.assistantMessage,
        responseId: null,
        tokensUsed: 0,
        actions: deterministicPublish.actions,
        user,
      });

      emit({
        event: 'done',
        conversationId: conversation.id,
        assistantMessage: deterministicPublish.assistantMessage,
        actions: deterministicPublish.actions,
        suggestions: buildSuggestions(deterministicPublish.actions),
        messageCount: conversation.messageCount + 2,
      });
      return;
    }

    // 5. Call GPT-5.2 Responses API with streaming
    const openai = await getOpenAIClient();

    let response: any;
    let finalResponseId: string | null = null;
    let streamedText = '';
    try {
      const stream = await (openai as any).responses.create({
        model: config.OPENAI_AGENT_MODEL,
        instructions: systemPrompt,
        input: dto.command,
        tools: AGENT_TOOLS,
        previous_response_id: conversation.lastResponseId ?? undefined,
        reasoning: { effort: config.AGENT_REASONING_EFFORT },
        stream: true,
      });

      for await (const event of stream) {
        logger.debug(`SSE stream event type=${event.type}`);
        if (event.type === 'response.output_text.delta') {
          streamedText += event.delta;
          emit({ event: 'text_delta', delta: event.delta });
        } else if (event.type === 'response.completed') {
          response = event.response;
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error('GPT-5.2 agent streaming call failed', { error: message, userId: user.id });

      await prisma.agentConversation.update({
        where: { id: conversation.id },
        data: { status: AgentConversationStatus.FAILED },
      });

      emit({ event: 'error', message: 'AI agent is temporarily unavailable. Please try again.' });
      return;
    }

    if (!response) {
      emit({ event: 'error', message: 'AI agent did not return a response.' });
      return;
    }

    finalResponseId = response.id ?? null;

    // 6. Process response — handle function calls or text
    const functionCalls = extractFunctionCalls(response.output);
    const actions: AgentActionResult[] = [];
    let assistantMessage = '';

    if (functionCalls.length > 0) {
      const callsToExecute = functionCalls.slice(0, config.AGENT_MAX_ACTIONS_PER_TURN);

      for (const call of callsToExecute) {
        let parsedArgs: Record<string, unknown> = {};
        try {
          parsedArgs = JSON.parse(call.arguments);
        } catch {
          logger.warn('Failed to parse function call arguments', { callId: call.id, name: call.name });
        }
        actions.push(
          await executeTrackedToolCall({
            conversationId: conversation.id,
            user,
            toolName: call.name,
            args: parsedArgs,
            emit,
            callId: call.id,
          })
        );
      }

      const deterministicLeadSummary = buildDeterministicLeadListSummary(actions);

      if (deterministicLeadSummary) {
        assistantMessage = deterministicLeadSummary;
        emit({ event: 'text_delta', delta: assistantMessage });
      } else if (actions.some((action) => !action.success)) {
        assistantMessage = buildDeterministicActionSummary(actions);
        emit({ event: 'text_delta', delta: assistantMessage });
      } else {
        const toolResults = actions.map((a, i) => ({
          type: 'function_call_output' as const,
          call_id: functionCalls[i]!.id,
          output: JSON.stringify({ success: a.success, summary: a.summary, data: a.data }),
        }));

        try {
          const summaryStream = await (openai as any).responses.create({
            model: config.OPENAI_AGENT_MODEL,
            instructions: systemPrompt,
            input: toolResults,
            previous_response_id: response.id,
            reasoning: { effort: 'low' },
            stream: true,
          });

          let summaryResponse: any = null;
          for await (const event of summaryStream) {
            if (event.type === 'response.output_text.delta') {
              assistantMessage += event.delta;
              emit({ event: 'text_delta', delta: event.delta });
            } else if (event.type === 'response.completed') {
              summaryResponse = event.response;
            }
          }

          if (!assistantMessage && summaryResponse) {
            assistantMessage = summaryResponse.output_text ?? extractTextContent(summaryResponse.output) ?? '';
          }
          if (summaryResponse?.id) {
            finalResponseId = summaryResponse.id;
          }
        } catch {
          assistantMessage = buildDeterministicActionSummary(actions);
          emit({ event: 'text_delta', delta: assistantMessage });
        }
      }
    } else {
      // Plain text — already streamed above
      assistantMessage = streamedText || (response.output_text ?? extractTextContent(response.output) ?? '');
    }

    const tokensUsed = response.usage?.total_tokens ?? 0;
    await persistConversationTurn({
      conversationId: conversation.id,
      conversationMessageCount: conversation.messageCount,
      command: dto.command,
      assistantMessage,
      responseId: finalResponseId ?? response.id,
      tokensUsed,
      actions,
      user,
    });

    // 10. Build suggestions and emit done
    const suggestions = buildSuggestions(actions);

    emit({
      event: 'done',
      conversationId: conversation.id,
      assistantMessage,
      actions,
      suggestions,
      messageCount: conversation.messageCount + 2,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'An unexpected error occurred.';
    logger.error('processCommandStream failed', { error: message, userId: user.id });
    emit({ event: 'error', message });
  }
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

function buildSuggestions(actions: AgentActionResult[]): string[] {
  const suggestions: string[] = [];

  for (const action of actions) {
    switch (action.functionName) {
      case 'generate_content':
        suggestions.push('Submit this draft for compliance review');
        suggestions.push('View the draft in Boss Mode');
        break;
      case 'submit_for_review':
        suggestions.push('Check the review queue status');
        suggestions.push('Create more content');
        break;
      case 'publish_now':
        suggestions.push('View publish job status');
        suggestions.push('Publish another approved draft');
        break;
      case 'schedule_publish':
        suggestions.push('View publish job status');
        suggestions.push('Adjust the scheduled time if needed');
        break;
      case 'create_lead':
        suggestions.push('Enroll this lead in an email sequence');
        suggestions.push('View all leads');
        break;
      case 'create_linkedin_campaign':
        suggestions.push('Activate this campaign');
        suggestions.push('Enroll leads in this campaign');
        break;
      case 'create_facebook_ad':
        suggestions.push('Launch this ad campaign');
        suggestions.push('View campaign analytics');
        break;
    }
  }

  if (suggestions.length === 0) {
    suggestions.push('Create marketing content');
    suggestions.push('View my analytics');
    suggestions.push('Manage my leads');
  }

  return suggestions.slice(0, 3);
}

// ---------------------------------------------------------------------------
// Conversation management
// ---------------------------------------------------------------------------

export async function listConversations(
  user: AuthenticatedUser,
  params: ListConversationsParams
) {
  const { page, limit, status } = params;
  const skip = (page - 1) * limit;

  const where: Record<string, unknown> = {
    userId: user.id,
    organizationId: user.orgId,
  };

  if (status) {
    where['status'] = status;
  }

  const [items, totalCount] = await Promise.all([
    prisma.agentConversation.findMany({
      where,
      skip,
      take: limit,
      orderBy: { updatedAt: 'desc' },
      select: {
        id: true,
        title: true,
        status: true,
        messageCount: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.agentConversation.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    items,
    meta: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

export async function getConversation(conversationId: string, user: AuthenticatedUser) {
  const conversation = await prisma.agentConversation.findUnique({
    where: { id: conversationId },
    include: {
      messages: {
        orderBy: { createdAt: 'asc' },
      },
      actions: {
        orderBy: { createdAt: 'asc' },
      },
    },
  });

  if (!conversation) {
    throw Errors.notFound('Conversation');
  }

  if (conversation.userId !== user.id && conversation.organizationId !== user.orgId) {
    throw Errors.notFound('Conversation');
  }

  return conversation;
}

export async function archiveConversation(conversationId: string, user: AuthenticatedUser) {
  const conversation = await prisma.agentConversation.findUnique({
    where: { id: conversationId },
  });

  if (!conversation) {
    throw Errors.notFound('Conversation');
  }

  if (conversation.userId !== user.id) {
    throw Errors.forbidden('You do not have access to this conversation.');
  }

  const archived = await prisma.agentConversation.update({
    where: { id: conversationId },
    data: { status: AgentConversationStatus.ARCHIVED },
  });

  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'AgentConversation',
    entityId: conversationId,
    action: AuditAction.STATUS_CHANGED,
    metadata: { previousStatus: conversation.status, newStatus: 'ARCHIVED' },
  });

  return archived;
}
