import { z } from 'zod';

// ---------------------------------------------------------------------------
// Analytics query validator
// ---------------------------------------------------------------------------

export const analyticsQuerySchema = z.object({
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  preset: z.enum(['7d', '14d', '30d', 'this_month', 'last_month']).optional(),
});

export type AnalyticsQuery = z.infer<typeof analyticsQuerySchema>;

export interface DateRange {
  from: Date;
  to: Date;
}

// ---------------------------------------------------------------------------
// Date helpers (no external deps)
// ---------------------------------------------------------------------------

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0, 0);
}

function endOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
}

/**
 * Resolves a DateRange from validated query parameters.
 * Priority: preset > from/to pair > default (last 30 days)
 */
export function resolveDateRange(query: AnalyticsQuery): DateRange {
  const now = new Date();

  if (query.preset) {
    switch (query.preset) {
      case '7d':
        return {
          from: new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000),
          to: now,
        };
      case '14d':
        return {
          from: new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000),
          to: now,
        };
      case '30d':
        return {
          from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
          to: now,
        };
      case 'this_month':
        return {
          from: startOfMonth(now),
          to: endOfMonth(now),
        };
      case 'last_month': {
        const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        return {
          from: startOfMonth(lastMonth),
          to: endOfMonth(lastMonth),
        };
      }
    }
  }

  if (query.from && query.to) {
    return {
      from: new Date(query.from),
      to: new Date(query.to),
    };
  }

  // Default: last 30 days
  return {
    from: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
    to: now,
  };
}
