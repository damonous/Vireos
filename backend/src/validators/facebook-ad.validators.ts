import { z } from 'zod';

// ---------------------------------------------------------------------------
// Facebook Ad Campaign validators
// ---------------------------------------------------------------------------

const adObjectiveEnum = z.enum(
  ['LEAD_GENERATION', 'BRAND_AWARENESS', 'TRAFFIC', 'CONVERSIONS'],
  { errorMap: () => ({ message: 'Invalid objective. Must be one of: LEAD_GENERATION, BRAND_AWARENESS, TRAFFIC, CONVERSIONS' }) }
);

export const createAdCampaignSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(255),
  objective: adObjectiveEnum,
  budget: z.number().positive('Budget must be a positive number').optional(),
  budgetCurrency: z.string().default('USD'),
  startDate: z.string().datetime({ message: 'startDate must be a valid ISO datetime' }).optional(),
  endDate: z.string().datetime({ message: 'endDate must be a valid ISO datetime' }).optional(),
  targetingJson: z.record(z.unknown()).optional(),
  draftId: z.string().uuid('draftId must be a valid UUID').optional(),
  adAccountId: z.string().optional(),
});

export const updateAdCampaignSchema = createAdCampaignSchema.partial();

export const listAdCampaignsQuerySchema = z.object({
  status: z
    .enum(['DRAFT', 'ACTIVE', 'PAUSED', 'COMPLETED', 'ARCHIVED'], {
      errorMap: () => ({ message: 'Invalid campaign status' }),
    })
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const facebookWebhookVerifySchema = z.object({
  'hub.mode': z.string(),
  'hub.challenge': z.string(),
  'hub.verify_token': z.string(),
});

export const launchCampaignSchema = z.object({
  adAccountId: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateAdCampaignDto = z.infer<typeof createAdCampaignSchema>;
export type UpdateAdCampaignDto = z.infer<typeof updateAdCampaignSchema>;
export type ListAdCampaignsQuery = z.infer<typeof listAdCampaignsQuerySchema>;
export type LaunchCampaignDto = z.infer<typeof launchCampaignSchema>;
