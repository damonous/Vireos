// =============================================================================
// Agent Service — Core orchestration for Easy Mode
// =============================================================================
// Processes natural language commands via GPT-5.2 Responses API with function
// calling mapped to all existing Vireos services. This service is the single
// entry point for the Easy Mode chat interface.
// =============================================================================

import { AgentConversationStatus, AgentActionStatus, AuditAction } from '@prisma/client';
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
  const [org, connections, balance] = await Promise.all([
    prisma.organization.findUnique({
      where: { id: user.orgId },
      select: { name: true, creditBalance: true },
    }),
    prisma.socialConnection.findMany({
      where: { userId: user.id, isActive: true },
      select: { platform: true },
    }),
    Promise.resolve(0), // placeholder — creditBalance from org
  ]);

  return {
    orgName: org?.name ?? 'Unknown',
    userName: user.email,
    connectedPlatforms: connections.map((c) => c.platform),
    creditBalance: org?.creditBalance ?? balance,
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

      const startMs = Date.now();

      // Create AgentAction record
      const actionRecord = await prisma.agentAction.create({
        data: {
          conversationId: conversation.id,
          organizationId: user.orgId,
          userId: user.id,
          functionName: call.name,
          functionArgs: parsedArgs as object,
          status: AgentActionStatus.IN_PROGRESS,
        },
      });

      // Execute the tool
      const result = await executeToolCall(call.name, parsedArgs, user);
      const durationMs = Date.now() - startMs;

      // Update action record
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

      actions.push({
        ...result,
        functionName: call.name,
        durationMs,
      });
    }

    // Send tool results back to GPT-5.2 for summary
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
      // If summary fails, build message from action results
      assistantMessage = actions
        .map((a) => (a.success ? `✓ ${a.summary}` : `✗ ${a.summary}`))
        .join('\n');
    }
  } else {
    // Plain text response (no function calls)
    assistantMessage = response.output_text ?? extractTextContent(response.output) ?? '';
  }

  // 7. Save assistant message
  const tokensUsed = response.usage?.total_tokens ?? 0;

  await prisma.agentMessage.create({
    data: {
      conversationId: conversation.id,
      role: 'assistant',
      content: assistantMessage,
      responseId: response.id,
      tokensUsed,
    },
  });

  // 8. Update conversation
  await prisma.agentConversation.update({
    where: { id: conversation.id },
    data: {
      lastResponseId: response.id,
      messageCount: { increment: 2 }, // user + assistant
      totalTokensUsed: { increment: tokensUsed },
      // Set title from first user message if not yet set
      ...(conversation.messageCount === 0
        ? { title: dto.command.slice(0, 100) }
        : {}),
    },
  });

  // 9. Audit trail
  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'AgentConversation',
    entityId: conversation.id,
    action: AuditAction.UPDATED,
    metadata: {
      command: dto.command.slice(0, 200),
      actionsExecuted: actions.map((a) => a.functionName),
      tokensUsed,
    },
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
