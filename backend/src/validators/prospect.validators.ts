import { z } from 'zod';

// ---------------------------------------------------------------------------
// Prospect request creation schema
// ---------------------------------------------------------------------------

export const createProspectRequestSchema = z.object({
  criteria: z.object({
    geography: z.string().optional(),
    netWorthRange: z
      .object({
        min: z.number().optional(),
        max: z.number().optional(),
      })
      .optional(),
    employer: z.string().optional(),
    industry: z.string().optional(),
    occupation: z.string().optional(),
    linkedinRequired: z.boolean().default(false),
    emailValidated: z.boolean().default(true),
  }),
  requestedCount: z.number().min(1).max(10000).default(100),
  notes: z.string().max(1000).optional(),
});

// ---------------------------------------------------------------------------
// Admin filter schema for listing all requests
// ---------------------------------------------------------------------------

export const adminListRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z
    .enum(['PENDING', 'PROCESSING', 'FULFILLED', 'CANCELLED'])
    .optional(),
  orgId: z.string().uuid().optional(),
});

// ---------------------------------------------------------------------------
// Pagination schema for org-scoped list
// ---------------------------------------------------------------------------

export const listRequestsQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Types inferred from schemas
// ---------------------------------------------------------------------------

export type CreateProspectRequestDto = z.infer<typeof createProspectRequestSchema>;
export type AdminListRequestsQuery = z.infer<typeof adminListRequestsQuerySchema>;
export type ListRequestsQuery = z.infer<typeof listRequestsQuerySchema>;
