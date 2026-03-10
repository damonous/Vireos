import { z } from 'zod';
import { LeadSource, LeadStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Lead validators
// ---------------------------------------------------------------------------

export const createLeadSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(100),
  lastName: z.string().min(1, 'Last name is required').max(100),
  email: z.string().email('Invalid email address'),
  phone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  linkedinUrl: z.string().url('LinkedIn URL must be a valid URL').optional(),
  source: z.nativeEnum(LeadSource, {
    errorMap: () => ({ message: 'Invalid lead source' }),
  }),
  notes: z.string().max(2000, 'Notes cannot exceed 2000 characters').optional(),
  customFields: z.record(z.unknown()).optional(),
});

export const updateLeadSchema = createLeadSchema
  .partial()
  .omit({ source: true });

export const updateStatusSchema = z.object({
  status: z.nativeEnum(LeadStatus, {
    errorMap: () => ({ message: 'Invalid lead status' }),
  }),
});

export const assignLeadSchema = z.object({
  advisorId: z.string().uuid('Advisor ID must be a valid UUID'),
});

export const addActivitySchema = z.object({
  type: z.enum([
    'NOTE',
    'STATUS_CHANGE',
    'EMAIL_SENT',
    'CALL_LOGGED',
    'MEETING_SCHEDULED',
  ]),
  description: z
    .string()
    .min(1, 'Description is required')
    .max(2000, 'Description cannot exceed 2000 characters'),
  metadata: z.record(z.unknown()).optional(),
});

export const listLeadsQuerySchema = z.object({
  status: z
    .nativeEnum(LeadStatus, { errorMap: () => ({ message: 'Invalid status' }) })
    .optional(),
  source: z
    .nativeEnum(LeadSource, { errorMap: () => ({ message: 'Invalid source' }) })
    .optional(),
  assignedAdvisorId: z
    .string()
    .uuid('Assigned advisor ID must be a valid UUID')
    .optional(),
  search: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'lastName', 'status'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
});

export const bulkUpdateStatusSchema = z.object({
  leadIds: z
    .array(z.string().uuid('Each lead ID must be a valid UUID'))
    .min(1, 'At least one lead ID is required'),
  status: z.nativeEnum(LeadStatus, {
    errorMap: () => ({ message: 'Invalid lead status' }),
  }),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateLeadDto = z.infer<typeof createLeadSchema>;
export type UpdateLeadDto = z.infer<typeof updateLeadSchema>;
export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
export type AssignLeadDto = z.infer<typeof assignLeadSchema>;
export type AddActivityDto = z.infer<typeof addActivitySchema>;
export type ListLeadsQuery = z.infer<typeof listLeadsQuerySchema>;
export type BulkUpdateStatusDto = z.infer<typeof bulkUpdateStatusSchema>;
