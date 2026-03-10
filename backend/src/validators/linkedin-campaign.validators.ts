import { z } from 'zod';

// ---------------------------------------------------------------------------
// Step schema (shared for create/update)
// ---------------------------------------------------------------------------

const stepSchema = z.object({
  messageTemplate: z.string().min(1, 'messageTemplate is required'),
  delayDays: z
    .number({ required_error: 'delayDays is required' })
    .int()
    .min(0)
    .max(30),
});

// ---------------------------------------------------------------------------
// Create Campaign
// ---------------------------------------------------------------------------

export const createCampaignSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  steps: z
    .array(stepSchema)
    .min(1, 'At least one step is required')
    .max(5, 'Maximum 5 steps allowed'),
  targetCriteria: z.record(z.unknown()).optional(),
  dailyLimit: z.number().int().min(1).max(100).default(20),
  pauseOnReply: z.boolean().default(true),
  businessHoursOnly: z.boolean().default(true),
});

// ---------------------------------------------------------------------------
// Update Campaign (partial of create)
// ---------------------------------------------------------------------------

export const updateCampaignSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional().nullable(),
  steps: z
    .array(stepSchema)
    .min(1)
    .max(5)
    .optional(),
  targetCriteria: z.record(z.unknown()).optional(),
  dailyLimit: z.number().int().min(1).max(100).optional(),
  pauseOnReply: z.boolean().optional(),
  businessHoursOnly: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Enroll Leads
// ---------------------------------------------------------------------------

export const enrollLeadsSchema = z.object({
  leadIds: z
    .array(z.string().uuid('Each leadId must be a valid UUID'))
    .min(1, 'At least one lead ID is required')
    .max(100, 'Cannot enroll more than 100 leads at once'),
});

// ---------------------------------------------------------------------------
// List Campaigns Query
// ---------------------------------------------------------------------------

export const listCampaignsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'])
    .optional(),
});

// ---------------------------------------------------------------------------
// Detect Reply
// ---------------------------------------------------------------------------

export const detectReplySchema = z.object({
  enrollmentId: z.string().uuid('enrollmentId must be a valid UUID'),
  repliedAt: z.string().datetime({ message: 'repliedAt must be a valid ISO datetime' }),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateCampaignDto = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignDto = z.infer<typeof updateCampaignSchema>;
export type EnrollLeadsDto = z.infer<typeof enrollLeadsSchema>;
export type ListCampaignsQuery = z.infer<typeof listCampaignsQuerySchema>;
export type DetectReplyDto = z.infer<typeof detectReplySchema>;
