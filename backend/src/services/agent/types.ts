// =============================================================================
// Agent Service Types
// =============================================================================

import type { ToolExecutionResult } from './tool-executor';

export interface ProcessCommandDto {
  command: string;
  conversationId?: string;
}

export interface AgentActionResult extends ToolExecutionResult {
  functionName: string;
  durationMs?: number;
}

export interface AgentCommandResult {
  conversationId: string;
  assistantMessage: string;
  actions: AgentActionResult[];
  suggestions: string[];
  messageCount: number;
}

export interface ListConversationsParams {
  page: number;
  limit: number;
  status?: string;
}

// ---------------------------------------------------------------------------
// SSE Streaming Types
// ---------------------------------------------------------------------------

export type SSEEvent =
  | { event: 'conversation_created'; conversationId: string }
  | { event: 'thinking' }
  | { event: 'text_delta'; delta: string }
  | { event: 'tool_call_start'; callId: string; name: string; args: Record<string, unknown> }
  | { event: 'tool_call_complete'; callId: string; name: string; success: boolean; summary: string }
  | { event: 'done'; conversationId: string; assistantMessage: string; actions: AgentActionResult[]; suggestions: string[]; messageCount: number }
  | { event: 'error'; message: string };

export type SSEEmitter = (event: SSEEvent) => void;
