import { z } from 'zod';

// ---------------------------------------------------------------------------
// Billing validators
// ---------------------------------------------------------------------------

export const createCheckoutSchema = z.object({
  priceId: z.string().min(1, 'Price ID is required'),
  successUrl: z.string().url('Success URL must be a valid URL').optional(),
  cancelUrl: z.string().url('Cancel URL must be a valid URL').optional(),
});

export const purchaseCreditsSchema = z.object({
  bundleId: z.enum(['bundle-1k', 'bundle-5k', 'bundle-10k'], {
    errorMap: () => ({
      message: 'Bundle ID must be one of: bundle-1k, bundle-5k, bundle-10k',
    }),
  }),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateCheckoutDto = z.infer<typeof createCheckoutSchema>;
export type PurchaseCreditsDto = z.infer<typeof purchaseCreditsSchema>;
