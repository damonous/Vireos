import { z } from 'zod';
import { creditBundleConfigSchema } from '../services/platform-setting.service';

// ---------------------------------------------------------------------------
// Billing validators
// ---------------------------------------------------------------------------

export const createCheckoutSchema = z.object({
  additionalSeats: z.number().int().min(0).default(0),
});

export const purchaseCreditsSchema = z.object({
  bundleId: z.string().trim().min(1, 'Bundle ID is required'),
});

export const updateCreditBundlesSchema = creditBundleConfigSchema;

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>;
export type PurchaseCreditsDto = z.infer<typeof purchaseCreditsSchema>;
export type UpdateCreditBundlesDto = z.infer<typeof updateCreditBundlesSchema>;
