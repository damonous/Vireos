import { z } from 'zod';

// ---------------------------------------------------------------------------
// Email Template validators
// ---------------------------------------------------------------------------

export const createTemplateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name cannot exceed 200 characters'),
  subject: z
    .string()
    .min(1, 'Subject is required')
    .max(200, 'Subject cannot exceed 200 characters'),
  htmlContent: z.string().min(1, 'HTML content is required'),
  textContent: z.string().optional(),
});

export const updateTemplateSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  subject: z.string().min(1).max(200).optional(),
  htmlContent: z.string().min(1).optional(),
  textContent: z.string().optional().nullable(),
  isActive: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Email Sequence validators
// ---------------------------------------------------------------------------

export const createSequenceSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name cannot exceed 200 characters'),
  description: z.string().optional(),
  triggerType: z.enum(['MANUAL', 'LEAD_CREATED', 'PROSPECT_IMPORTED', 'FACEBOOK_LEAD']),
});

export const updateSequenceSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().optional().nullable(),
  status: z.enum(['DRAFT', 'ACTIVE', 'PAUSED', 'ARCHIVED']).optional(),
  triggerType: z.enum(['MANUAL', 'LEAD_CREATED', 'PROSPECT_IMPORTED', 'FACEBOOK_LEAD']).optional(),
});

export const addStepSchema = z.object({
  templateId: z.string().uuid('templateId must be a valid UUID'),
  delayDays: z.number().int().min(0).max(365),
  delayHours: z.number().int().min(0).max(23),
  subject: z.string().max(200).optional(),
});

export const replaceStepsSchema = z.object({
  steps: z.array(addStepSchema).max(100, 'Cannot store more than 100 sequence steps'),
});

export const enrollLeadsSchema = z.object({
  leadIds: z
    .array(z.string().uuid())
    .min(1, 'At least one lead ID is required')
    .max(1000, 'Cannot enroll more than 1000 leads at once'),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Webhook / unsubscribe validators
// ---------------------------------------------------------------------------

export const unsubscribeSchema = z.object({
  email: z.string().email('Invalid email address'),
  orgId: z.string().uuid('orgId must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateDto = z.infer<typeof updateTemplateSchema>;
export type CreateSequenceDto = z.infer<typeof createSequenceSchema>;
export type UpdateSequenceDto = z.infer<typeof updateSequenceSchema>;
export type AddStepDto = z.infer<typeof addStepSchema>;
export type ReplaceStepsDto = z.infer<typeof replaceStepsSchema>;
export type EnrollLeadsDto = z.infer<typeof enrollLeadsSchema>;
export type PaginationParams = z.infer<typeof paginationQuerySchema>;
