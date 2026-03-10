import { z } from 'zod';
import { ContentStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Content validators
// ---------------------------------------------------------------------------

export const generateContentSchema = z.object({
  prompt: z.string().min(10, 'Prompt must be at least 10 characters').max(1000, 'Prompt cannot exceed 1000 characters'),
  channels: z.array(z.enum(['LINKEDIN', 'FACEBOOK', 'EMAIL', 'AD_COPY'])).optional(),
  title: z.string().min(1).max(200).optional(),
});

export const updateDraftSchema = z.object({
  linkedinContent: z.string().max(3000).optional(),
  facebookContent: z.string().max(2000).optional(),
  emailContent: z.string().max(10000).optional(),
  adCopyContent: z.string().max(1000).optional(),
  title: z.string().max(200).optional(),
});

export const listDraftsQuerySchema = z.object({
  status: z.nativeEnum(ContentStatus).optional(),
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Types inferred from schemas
// ---------------------------------------------------------------------------

export type GenerateContentDto = z.infer<typeof generateContentSchema>;
export type UpdateDraftDto = z.infer<typeof updateDraftSchema>;
export type ListDraftsQuery = z.infer<typeof listDraftsQuerySchema>;
