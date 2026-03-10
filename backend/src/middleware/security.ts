import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';
import { config } from '../config';

// ---------------------------------------------------------------------------
// HTTPS redirect
// ---------------------------------------------------------------------------

/**
 * Redirects HTTP requests to HTTPS in production environments.
 *
 * Relies on the X-Forwarded-Proto header set by an upstream load balancer
 * or reverse proxy (nginx, AWS ALB, etc.). The app must have trust proxy
 * enabled (which app.ts already sets to 1).
 *
 * Skips the redirect in non-production environments so local dev works
 * without TLS.
 */
export function httpsRedirect(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (config.NODE_ENV !== 'production') {
    return next();
  }

  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined) ?? req.protocol;

  if (proto !== 'https') {
    const httpsUrl = `https://${req.hostname}${req.originalUrl}`;
    res.redirect(301, httpsUrl);
    return;
  }

  next();
}

// ---------------------------------------------------------------------------
// Additional security headers
// ---------------------------------------------------------------------------

/**
 * Sets security-hardening HTTP response headers beyond what Helmet provides
 * by default.
 *
 * Headers set:
 * - Permissions-Policy: restrict powerful browser APIs
 * - Cache-Control: prevent sensitive API responses from being cached
 * - X-Content-Type-Options: prevent MIME sniffing (also set by Helmet)
 * - Referrer-Policy: limit referrer information leakage
 * - X-Permitted-Cross-Domain-Policies: block Flash/PDF cross-domain requests
 */
export function securityHeaders(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Restrict powerful browser APIs not needed by a backend API
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), interest-cohort=()'
  );

  // API responses should not be cached by browsers or intermediaries
  res.setHeader(
    'Cache-Control',
    'no-store, no-cache, must-revalidate, proxy-revalidate'
  );
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');

  // Belt-and-suspenders alongside Helmet
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // Limit referrer information to same origin only
  res.setHeader('Referrer-Policy', 'same-origin');

  // Block Flash/Silverlight cross-domain requests
  res.setHeader('X-Permitted-Cross-Domain-Policies', 'none');

  next();
}

// ---------------------------------------------------------------------------
// Request ID propagation
// ---------------------------------------------------------------------------

/**
 * Ensures every request has a unique X-Request-Id header for distributed
 * tracing. If the client supplies an X-Request-Id, it is propagated;
 * otherwise a new UUID is generated.
 *
 * This complements requestLogger (which attaches traceId) by ensuring the
 * ID is available as a standard header even before the logger runs.
 */
export function requestId(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const existingId =
    (req.headers['x-request-id'] as string | undefined) ??
    (req.headers['x-trace-id'] as string | undefined);

  const id = existingId ?? uuidv4();

  // Normalise — always use x-request-id as the canonical header name
  req.headers['x-request-id'] = id;
  res.setHeader('X-Request-Id', id);

  next();
}

// ---------------------------------------------------------------------------
// OWASP suspicious request detection
// ---------------------------------------------------------------------------

/**
 * Pattern lists for common OWASP Top-10 injection vectors.
 * Detection is performed against URL query parameters and the request body.
 *
 * In MVP mode this logs a warning without blocking. A future iteration can
 * add blocking behaviour or WAF integration based on these signals.
 */

const SQL_INJECTION_PATTERNS: RegExp[] = [
  /(\bUNION\b.*\bSELECT\b)/i,
  /(\bSELECT\b.*\bFROM\b)/i,
  /(\bINSERT\b.*\bINTO\b)/i,
  /(\bDELETE\b.*\bFROM\b)/i,
  /(\bDROP\b.*\bTABLE\b)/i,
  /(\bALTER\b.*\bTABLE\b)/i,
  /(--\s*$|;\s*--)/,
  /(\bOR\b\s+[\d'"].+?=\s*[\d'"])/i,
  /(\bAND\b\s+[\d'"].+?=\s*[\d'"])/i,
  /(';\s*(DROP|DELETE|UPDATE|INSERT|EXEC)\b)/i,
  /(\/\*.*?\*\/)/,
  /(\bEXEC\b\s*\()/i,
  /(\bxp_cmdshell\b)/i,
];

const XSS_PATTERNS: RegExp[] = [
  /<script[\s\S]*?>/i,
  /<\/script>/i,
  /javascript\s*:/i,
  /on\w+\s*=\s*["']?\s*\w/i, // e.g. onclick=, onerror=
  /<\s*img[^>]+src\s*=\s*["']?\s*javascript/i,
  /<\s*iframe/i,
  /<\s*object/i,
  /<\s*embed/i,
  /expression\s*\(/i,
  /vbscript\s*:/i,
  /data\s*:\s*text\/html/i,
];

const PATH_TRAVERSAL_PATTERNS: RegExp[] = [
  /\.\.[/\\]/,
  /[/\\]\.\.[/\\]/,
  /%2e%2e[/\\%]/i,
  /%2e%2e%2f/i,
  /\.\.%2f/i,
  /\.\.%5c/i,
  /%252e%252e/i, // double-encoded
];

/**
 * Flattens a value (potentially nested) into an array of strings for pattern
 * matching. Handles strings, arrays, and plain objects (one level deep).
 */
function extractStrings(value: unknown): string[] {
  if (typeof value === 'string') {
    return [value];
  }
  if (Array.isArray(value)) {
    return value.flatMap(extractStrings);
  }
  if (value !== null && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).flatMap(
      extractStrings
    );
  }
  return [];
}

/**
 * Tests a collection of string values against a pattern list.
 * Returns the first matching pattern description or null if none match.
 */
function detectPattern(
  values: string[],
  patterns: RegExp[],
  category: string
): string | null {
  for (const val of values) {
    for (const pattern of patterns) {
      if (pattern.test(val)) {
        return `${category}: matched pattern ${pattern.source.substring(0, 60)}`;
      }
    }
  }
  return null;
}

/**
 * Basic OWASP suspicious-request detection middleware.
 *
 * Checks query parameters and request body for common SQL injection,
 * XSS, and path traversal patterns. Logs a warning when detected.
 *
 * MVP behaviour: log only, do NOT block the request.
 */
export function detectSuspiciousRequest(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const traceId = (req as unknown as { traceId?: string }).traceId;

  // Collect all string values from query params and body
  const queryValues = extractStrings(req.query);
  const bodyValues = extractStrings(req.body);
  const allValues = [...queryValues, ...bodyValues];

  if (allValues.length === 0) {
    return next();
  }

  const sqlMatch = detectPattern(allValues, SQL_INJECTION_PATTERNS, 'SQL_INJECTION');
  const xssMatch = detectPattern(allValues, XSS_PATTERNS, 'XSS');
  const pathMatch = detectPattern(allValues, PATH_TRAVERSAL_PATTERNS, 'PATH_TRAVERSAL');

  const detections: string[] = [];
  if (sqlMatch) detections.push(sqlMatch);
  if (xssMatch) detections.push(xssMatch);
  if (pathMatch) detections.push(pathMatch);

  if (detections.length > 0) {
    logger.warn('Suspicious request detected', {
      traceId,
      method: req.method,
      path: req.path,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
      detections,
    });
  }

  next();
}
