import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Request logger middleware
// ---------------------------------------------------------------------------

/**
 * Attaches a unique `traceId` (UUID v4) to each incoming request and logs
 * request/response details in structured JSON format.
 *
 * The `traceId` is:
 *   - Attached to `req.traceId` for downstream use
 *   - Included in all child logger calls for distributed tracing
 *   - Returned in the `X-Trace-Id` response header
 *
 * Skips logging for health check endpoints to keep logs clean.
 */
export function requestLogger(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Generate or propagate trace ID
  const traceId =
    (req.headers['x-trace-id'] as string | undefined) ??
    (req.headers['x-request-id'] as string | undefined) ??
    uuidv4();

  // Attach to request for downstream middleware / handlers
  (req as unknown as { traceId: string }).traceId = traceId;

  // Echo back in response headers
  res.setHeader('X-Trace-Id', traceId);

  const startedAt = Date.now();

  // Skip verbose logging for health checks
  const isHealthCheck = req.path === '/health';

  if (!isHealthCheck) {
    logger.http('Incoming request', {
      traceId,
      method: req.method,
      path: req.path,
      query: Object.keys(req.query).length > 0 ? req.query : undefined,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      contentLength: req.headers['content-length'],
    });
  }

  // Log the response when it finishes
  res.on('finish', () => {
    const durationMs = Date.now() - startedAt;
    const level =
      res.statusCode >= 500
        ? 'error'
        : res.statusCode >= 400
        ? 'warn'
        : isHealthCheck
        ? 'debug'
        : 'http';

    logger[level]('Request completed', {
      traceId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs,
      ip: req.ip,
      contentLength: res.getHeader('content-length'),
    });
  });

  next();
}
