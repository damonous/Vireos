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
