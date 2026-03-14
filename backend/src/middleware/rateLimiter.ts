import rateLimit, { Options } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { redis } from '../utils/redis';
import { config } from '../config';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Shared options
// ---------------------------------------------------------------------------

/**
 * Standard handler for when a client exceeds the rate limit.
 * Returns a consistent JSON error shape matching our API conventions.
 */
const rateLimitHandler: Options['handler'] = (req, res) => {
  logger.warn('Rate limit exceeded', {
    ip: req.ip,
    path: req.path,
    method: req.method,
  });

  res.status(429).json({
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many requests. Please slow down and try again later.',
    },
  });
};

/**
 * Creates a Redis-backed rate-limit store using the shared IORedis client.
 * Falls back to in-memory if Redis is unavailable (logs a warning).
 */
function createRedisStore(prefix: string): RedisStore {
  return new RedisStore({
    // rate-limit-redis uses sendCommand for ioredis compatibility
    sendCommand: (...args: string[]) =>
      redis.call(args[0]!, ...args.slice(1)) as Promise<number>,
    prefix: `rl:${prefix}:`,
  });
}

// ---------------------------------------------------------------------------
// Global rate limiter
// ---------------------------------------------------------------------------

/**
 * Applies to all routes.
 * Default: 5000 requests per 15-minute window per IP.
 */
export const globalRateLimit = rateLimit({
  windowMs: config.RATE_LIMIT_GLOBAL_WINDOW_MS,
  max: config.RATE_LIMIT_GLOBAL_MAX,
  standardHeaders: 'draft-7', // RateLimit-* headers (RFC draft)
  legacyHeaders: false,
  store: createRedisStore('global'),
  handler: rateLimitHandler,
  // Trust X-Forwarded-For when behind a reverse proxy
  skipSuccessfulRequests: false,
  keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
});

// ---------------------------------------------------------------------------
// Auth endpoint rate limiter (login, register, password reset)
// ---------------------------------------------------------------------------

/**
 * Stricter limit for public authentication endpoints to prevent brute-force attacks.
 * Default: 100 requests per minute per IP.
 */
export const authRateLimit = rateLimit({
  windowMs: config.RATE_LIMIT_AUTH_WINDOW_MS,
  max: config.RATE_LIMIT_AUTH_MAX,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('auth'),
  handler: rateLimitHandler,
  keyGenerator: (req) => req.ip ?? req.socket.remoteAddress ?? 'unknown',
  // Successful auth requests should not burn quota.
  skipSuccessfulRequests: true,
  // This limiter is attached only to public auth mutation routes.
  skip: (req) => req.path === '/health',
});

// ---------------------------------------------------------------------------
// Publish endpoint rate limiter
// ---------------------------------------------------------------------------

/**
 * Rate limiter for social publishing endpoints.
 * Default: 10 requests per second per IP (600 per minute).
 * This protects against runaway automation.
 */
export const publishRateLimit = rateLimit({
  windowMs: 1_000, // 1 second
  max: 10,          // 10 requests per second
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('publish'),
  handler: rateLimitHandler,
  keyGenerator: (req) => {
    // Key by org if authenticated, otherwise by IP
    const authReq = req as { user?: { orgId?: string } };
    return authReq.user?.orgId ?? req.ip ?? 'unknown';
  },
});

// ---------------------------------------------------------------------------
// API key / webhook rate limiter
// ---------------------------------------------------------------------------

/**
 * Rate limiter for incoming webhooks (Stripe, LinkedIn, etc.).
 * Generous limit since these are server-to-server calls.
 * Default: 500 requests per minute per IP.
 */
export const webhookRateLimit = rateLimit({
  windowMs: 60_000,
  max: 500,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('webhook'),
  handler: rateLimitHandler,
});
