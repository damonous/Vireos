import { z } from 'zod';

// ---------------------------------------------------------------------------
// Review action validators
// ---------------------------------------------------------------------------

/**
 * Validator for reject/request-changes actions that require a reason or notes.
 */
export const reviewActionSchema = z.object({
  reason: z.string().min(1).max(1000).optional(),
  notes: z.string().min(1).max(1000).optional(),
});

/**
 * Validator for inline content edits by compliance / admin.
 */
export const editContentSchema = z.object({
  linkedinContent: z.string().max(3000).optional(),
  facebookContent: z.string().max(2000).optional(),
  emailContent: z.string().max(10000).optional(),
  adCopyContent: z.string().max(1000).optional(),
});

/**
 * Query params for the audit trail endpoint.
 */
export const auditTrailQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().optional(),
  action: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type ReviewActionDto = z.infer<typeof reviewActionSchema>;
export type EditContentDto = z.infer<typeof editContentSchema>;
export type AuditTrailQuery = z.infer<typeof auditTrailQuerySchema>;
