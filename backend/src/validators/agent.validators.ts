import { z } from 'zod';
import { AgentConversationStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Agent validators
// ---------------------------------------------------------------------------

export const processCommandSchema = z.object({
  command: z
    .string()
    .min(3, 'Command must be at least 3 characters')
    .max(2000, 'Command cannot exceed 2000 characters'),
  conversationId: z.string().uuid('Invalid conversation ID').optional(),
});

export const listConversationsQuerySchema = z.object({
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
  status: z.nativeEnum(AgentConversationStatus).optional(),
});

// ---------------------------------------------------------------------------
// Types inferred from schemas
// ---------------------------------------------------------------------------

export type ProcessCommandInput = z.infer<typeof processCommandSchema>;
export type ListConversationsQuery = z.infer<typeof listConversationsQuerySchema>;
