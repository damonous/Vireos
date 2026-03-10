import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// AppError — operational errors with HTTP status
// ---------------------------------------------------------------------------

export class AppError extends Error {
  public readonly statusCode: number;
  public readonly code: string;
  /**
   * `isOperational = true` means this is an expected, user-facing error
   * (e.g. validation failure, 404). `false` means it is a programming error
   * that should page on-call.
   */
  public readonly isOperational: boolean;
  public readonly details?: unknown;

  constructor(
    message: string,
    statusCode = 500,
    code = 'INTERNAL_ERROR',
    options: { isOperational?: boolean; details?: unknown } = {}
  ) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = options.isOperational ?? statusCode < 500;
    this.details = options.details;

    // Maintain proper prototype chain for instanceof checks
    Object.setPrototypeOf(this, new.target.prototype);

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

// ---------------------------------------------------------------------------
// Common error factory helpers
// ---------------------------------------------------------------------------

export const Errors = {
  badRequest: (message: string, details?: unknown) =>
    new AppError(message, 400, 'BAD_REQUEST', { details }),

  unauthorized: (message = 'Authentication required') =>
    new AppError(message, 401, 'UNAUTHORIZED'),

  forbidden: (message = 'Access denied') =>
    new AppError(message, 403, 'FORBIDDEN'),

  notFound: (resource = 'Resource') =>
    new AppError(`${resource} not found`, 404, 'NOT_FOUND'),

  conflict: (message: string, details?: unknown) =>
    new AppError(message, 409, 'CONFLICT', { details }),

  unprocessable: (message: string, details?: unknown) =>
    new AppError(message, 422, 'UNPROCESSABLE_ENTITY', { details }),

  tooManyRequests: (message = 'Too many requests') =>
    new AppError(message, 429, 'TOO_MANY_REQUESTS'),

  internal: (message = 'An unexpected error occurred') =>
    new AppError(message, 500, 'INTERNAL_ERROR', { isOperational: false }),
} as const;

// ---------------------------------------------------------------------------
// Global error handler middleware
// ---------------------------------------------------------------------------

/**
 * Express 5 compatible global error handler.
 * Must be registered LAST, after all routes.
 * Signature requires all 4 parameters to be recognised as error middleware.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction
): void {
  const traceId = (req as { traceId?: string }).traceId;

  // ---- Zod validation errors -----------------------------------------------
  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
      code: e.code,
    }));

    logger.warn('Validation error', { traceId, details, path: req.path });

    res.status(422).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details,
      },
    });
    return;
  }

  // ---- Operational AppErrors ------------------------------------------------
  if (err instanceof AppError) {
    const logMeta = {
      traceId,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
      ...(err.details ? { details: err.details } : {}),
    };

    if (err.statusCode >= 500) {
      logger.error(err.message, { ...logMeta, stack: err.stack });
    } else {
      logger.warn(err.message, logMeta);
    }

    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
        ...(err.details !== undefined ? { details: err.details } : {}),
      },
    });
    return;
  }

  // ---- JWT / jsonwebtoken errors --------------------------------------------
  if (err instanceof Error && err.name === 'JsonWebTokenError') {
    logger.warn('Invalid JWT', { traceId, message: err.message, path: req.path });
    res.status(401).json({
      success: false,
      error: { code: 'INVALID_TOKEN', message: 'Invalid or malformed token' },
    });
    return;
  }

  if (err instanceof Error && err.name === 'TokenExpiredError') {
    logger.warn('Expired JWT', { traceId, path: req.path });
    res.status(401).json({
      success: false,
      error: { code: 'TOKEN_EXPIRED', message: 'Token has expired' },
    });
    return;
  }

  // ---- Prisma known errors -------------------------------------------------
  // P2002 = unique constraint violation
  if (
    err instanceof Error &&
    'code' in err &&
    (err as { code: string }).code === 'P2002'
  ) {
    const prismaErr = err as { code: string; meta?: { target?: string[] } };
    const fields = prismaErr.meta?.target?.join(', ') ?? 'unknown field';
    logger.warn('Prisma unique constraint violation', { traceId, fields, path: req.path });
    res.status(409).json({
      success: false,
      error: {
        code: 'CONFLICT',
        message: `A record with this ${fields} already exists`,
      },
    });
    return;
  }

  // P2025 = record not found
  if (
    err instanceof Error &&
    'code' in err &&
    (err as { code: string }).code === 'P2025'
  ) {
    logger.warn('Prisma record not found', { traceId, path: req.path });
    res.status(404).json({
      success: false,
      error: { code: 'NOT_FOUND', message: 'The requested record was not found' },
    });
    return;
  }

  // ---- Unknown / programming errors ----------------------------------------
  const unknownErr = err instanceof Error ? err : new Error(String(err));

  logger.error('Unhandled error', {
    traceId,
    message: unknownErr.message,
    stack: unknownErr.stack,
    path: req.path,
    method: req.method,
  });

  // Never expose internal details in production
  const message =
    process.env['NODE_ENV'] === 'production'
      ? 'An unexpected error occurred'
      : unknownErr.message;

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message,
    },
  });
}
