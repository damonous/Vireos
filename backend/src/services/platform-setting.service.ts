import { z } from 'zod';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';

const CREDIT_BUNDLE_SETTING_KEY = 'billing.creditBundles';

export const creditBundleSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1, 'Bundle ID is required')
    .max(64, 'Bundle ID must be 64 characters or fewer')
    .regex(/^[a-z0-9-]+$/, 'Bundle ID may only contain lowercase letters, numbers, and hyphens'),
  label: z.string().trim().min(1, 'Bundle label is required').max(80, 'Bundle label must be 80 characters or fewer'),
  credits: z.coerce.number().int().positive('Credits must be greater than zero'),
  amount: z.coerce.number().int().nonnegative('Amount must be zero or greater'),
});

export const creditBundleConfigSchema = z
  .object({
    bundles: z.array(creditBundleSchema).min(1, 'At least one credit bundle is required'),
  })
  .superRefine((value, ctx) => {
    const seenIds = new Set<string>();

    value.bundles.forEach((bundle, index) => {
      if (seenIds.has(bundle.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['bundles', index, 'id'],
          message: 'Bundle IDs must be unique',
        });
      }
      seenIds.add(bundle.id);
    });
  });

export type CreditBundle = z.infer<typeof creditBundleSchema>;
export type CreditBundleConfig = z.infer<typeof creditBundleConfigSchema>;

export const DEFAULT_CREDIT_BUNDLES: CreditBundle[] = [
  { id: 'bundle-1k', label: '1,000 Credits', credits: 1000, amount: 9900 },
  { id: 'bundle-5k', label: '5,000 Credits', credits: 5000, amount: 39900 },
  { id: 'bundle-10k', label: '10,000 Credits', credits: 10000, amount: 69900 },
];

function normalizeCreditBundles(bundles: CreditBundle[]): CreditBundle[] {
  return [...bundles].sort((left, right) => {
    if (left.credits !== right.credits) {
      return left.credits - right.credits;
    }

    return left.id.localeCompare(right.id);
  });
}

function parseCreditBundleConfig(rawValue: unknown): CreditBundleConfig {
  if (Array.isArray(rawValue)) {
    return creditBundleConfigSchema.parse({ bundles: rawValue });
  }

  return creditBundleConfigSchema.parse(rawValue);
}

export async function getCreditBundleConfig(): Promise<{
  bundles: CreditBundle[];
  source: 'default' | 'persisted';
  updatedAt: string | null;
}> {
  const setting = await prisma.platformSetting.findUnique({
    where: { key: CREDIT_BUNDLE_SETTING_KEY },
  });

  if (!setting) {
    return {
      bundles: normalizeCreditBundles(DEFAULT_CREDIT_BUNDLES),
      source: 'default',
      updatedAt: null,
    };
  }

  try {
    const parsed = parseCreditBundleConfig(setting.value);
    return {
      bundles: normalizeCreditBundles(parsed.bundles),
      source: 'persisted',
      updatedAt: setting.updatedAt.toISOString(),
    };
  } catch (error) {
    logger.warn('Invalid persisted credit bundle config; falling back to defaults', {
      key: CREDIT_BUNDLE_SETTING_KEY,
      error: error instanceof Error ? error.message : String(error),
    });

    return {
      bundles: normalizeCreditBundles(DEFAULT_CREDIT_BUNDLES),
      source: 'default',
      updatedAt: setting.updatedAt.toISOString(),
    };
  }
}

export async function listCreditBundles(): Promise<CreditBundle[]> {
  const config = await getCreditBundleConfig();
  return config.bundles;
}

export async function findCreditBundle(bundleId: string): Promise<CreditBundle | undefined> {
  const bundles = await listCreditBundles();
  return bundles.find((bundle) => bundle.id === bundleId);
}

export async function updateCreditBundleConfig(input: CreditBundleConfig): Promise<{
  bundles: CreditBundle[];
  source: 'persisted';
  updatedAt: string;
}> {
  const parsed = creditBundleConfigSchema.parse(input);
  const bundles = normalizeCreditBundles(parsed.bundles);

  const setting = await prisma.platformSetting.upsert({
    where: { key: CREDIT_BUNDLE_SETTING_KEY },
    create: {
      key: CREDIT_BUNDLE_SETTING_KEY,
      value: { bundles },
    },
    update: {
      value: { bundles },
    },
  });

  return {
    bundles,
    source: 'persisted',
    updatedAt: setting.updatedAt.toISOString(),
  };
}
