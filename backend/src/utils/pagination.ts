import { z } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CursorPaginationParams {
  cursor?: string;
  limit: number;
  direction: 'forward' | 'backward';
}

export interface CursorPaginationResult<T> {
  data: T[];
  pagination: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    nextCursor: string | null;
    previousCursor: string | null;
    totalCount?: number;
  };
}

export interface OffsetPaginationParams {
  page: number;
  limit: number;
}

export interface OffsetPaginationResult<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

// ---------------------------------------------------------------------------
// Zod schemas for query parsing
// ---------------------------------------------------------------------------

export const cursorPaginationQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  direction: z.enum(['forward', 'backward']).default('forward'),
});

export const offsetPaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Cursor helpers
// ---------------------------------------------------------------------------

/**
 * Encodes a cursor value (typically a database ID or timestamp) to base64.
 * This keeps API responses opaque and forward-compatible.
 */
export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/**
 * Decodes a base64url-encoded cursor back to its original string value.
 * Returns null if the cursor is invalid or cannot be decoded.
 */
export function decodeCursor(cursor: string): string | null {
  try {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8');
    if (!decoded) return null;
    return decoded;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Prisma cursor pagination helper
// ---------------------------------------------------------------------------

/**
 * Builds the Prisma `cursor`, `take`, and `skip` arguments for cursor-based
 * pagination using a unique field (e.g., `id` or `createdAt`).
 *
 * @param params - Parsed pagination parameters
 * @param cursorField - The unique field name used as cursor (default: 'id')
 */
export function buildPrismaCursorArgs(
  params: CursorPaginationParams,
  cursorField: string = 'id'
): {
  cursor?: Record<string, string>;
  take: number;
  skip?: number;
} {
  const { cursor, limit, direction } = params;
  const take = direction === 'backward' ? -limit : limit;

  if (!cursor) {
    return { take };
  }

  const decodedCursor = decodeCursor(cursor);
  if (!decodedCursor) {
    return { take };
  }

  return {
    cursor: { [cursorField]: decodedCursor },
    take,
    // Skip the cursor record itself
    skip: 1,
  };
}

/**
 * Wraps a list of Prisma results in a cursor pagination envelope.
 * Fetches one extra record (`limit + 1`) to determine `hasNextPage`.
 *
 * @param records - Raw records from Prisma (should include limit+1 items)
 * @param limit - The page size requested by the client
 * @param idField - The field to encode as the cursor (default: 'id')
 */
export function buildCursorPaginationResult<T extends Record<string, unknown>>(
  records: T[],
  limit: number,
  idField: keyof T = 'id' as keyof T
): CursorPaginationResult<T> {
  const hasNextPage = records.length > limit;
  const data = hasNextPage ? records.slice(0, limit) : records;

  const nextCursor =
    hasNextPage && data.length > 0
      ? encodeCursor(String(data[data.length - 1]![idField]))
      : null;

  const previousCursor =
    data.length > 0 ? encodeCursor(String(data[0]![idField])) : null;

  return {
    data,
    pagination: {
      hasNextPage,
      hasPreviousPage: false, // Requires separate count query; set by caller
      nextCursor,
      previousCursor,
    },
  };
}

// ---------------------------------------------------------------------------
// Offset pagination helper
// ---------------------------------------------------------------------------

/**
 * Wraps a list of records and total count in an offset pagination envelope.
 *
 * @param data - The records for the current page
 * @param totalCount - Total number of matching records across all pages
 * @param params - The pagination parameters used for this query
 */
export function buildOffsetPaginationResult<T>(
  data: T[],
  totalCount: number,
  params: OffsetPaginationParams
): OffsetPaginationResult<T> {
  const { page, limit } = params;
  const totalPages = Math.ceil(totalCount / limit);

  return {
    data,
    pagination: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Calculates the Prisma `skip` value for offset-based pagination.
 */
export function calcSkip(params: OffsetPaginationParams): number {
  return (params.page - 1) * params.limit;
}
