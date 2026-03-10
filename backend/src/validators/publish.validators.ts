import { z } from 'zod';
import { ContentChannel } from '@prisma/client';

// ---------------------------------------------------------------------------
// Publish validators
// ---------------------------------------------------------------------------

export const publishSchema = z.object({
  draftId: z.string().uuid('draftId must be a valid UUID'),
  channel: z.nativeEnum(ContentChannel, {
    errorMap: () => ({
      message: `channel must be one of: ${Object.values(ContentChannel).join(', ')}`,
    }),
  }),
  scheduledAt: z
    .string()
    .datetime({ message: 'scheduledAt must be a valid ISO 8601 datetime string' })
    .optional()
    .refine(
      (val) => {
        if (!val) return true;
        return new Date(val) > new Date();
      },
      { message: 'scheduledAt must be a future date/time' }
    ),
});

export const listPublishJobsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['QUEUED', 'PROCESSING', 'PUBLISHED', 'FAILED', 'CANCELLED'])
    .optional(),
});

// ---------------------------------------------------------------------------
// Types inferred from schemas
// ---------------------------------------------------------------------------

export type PublishDto = z.infer<typeof publishSchema>;
export type ListPublishJobsQuery = z.infer<typeof listPublishJobsQuerySchema>;
