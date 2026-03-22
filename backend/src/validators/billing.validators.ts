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

export const creditTransactionsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  type: z.enum(['PURCHASE', 'DEBIT', 'REFUND', 'ADJUSTMENT']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>;
export type PurchaseCreditsDto = z.infer<typeof purchaseCreditsSchema>;
export type UpdateCreditBundlesDto = z.infer<typeof updateCreditBundlesSchema>;
export type CreditTransactionsQueryDto = z.infer<typeof creditTransactionsQuerySchema>;
