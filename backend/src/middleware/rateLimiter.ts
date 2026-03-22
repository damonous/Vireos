import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { getRedisClient } from '../utils/redis';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Redis store factory
// ---------------------------------------------------------------------------

/**
 * Creates a RedisStore for express-rate-limit backed by the app's shared
 * ioredis client. Each limiter gets its own key prefix to avoid collisions.
 */
function createRedisStore(prefix: string) {
  const client = getRedisClient();
  return new RedisStore({
    // `sendCommand` bridges ioredis's `call()` to the interface
    // that rate-limit-redis expects.
    sendCommand: (...args: string[]) =>
      client.call(args[0], ...args.slice(1)) as never,
    prefix: `rl:${prefix}:`,
  });
}

// ---------------------------------------------------------------------------
// Shared handler for 429 responses
// ---------------------------------------------------------------------------

const rateLimitResponse = {
  success: false,
  error: {
    code: 'RATE_LIMITED',
    message: 'Too many requests. Please try again later.',
  },
};

// ---------------------------------------------------------------------------
// Rate limiters
// ---------------------------------------------------------------------------

/**
 * Global rate limit: 200 requests per 15-minute window per IP.
 * Applied to all routes as a baseline protection.
 */
export const globalRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 200,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('global'),
  handler: (_req, res, _next, options) => {
    logger.warn('Global rate limit hit', {
      ip: _req.ip,
      path: _req.path,
      method: _req.method,
      limit: options.limit,
    });
    res.status(429).json(rateLimitResponse);
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});

/**
 * Auth rate limit: 10 requests per 15-minute window per IP.
 * Applied to login, register, and password-reset endpoints.
 */
export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('auth'),
  handler: (_req, res, _next, options) => {
    logger.warn('Auth rate limit hit', {
      ip: _req.ip,
      path: _req.path,
      method: _req.method,
      limit: options.limit,
    });
    res.status(429).json(rateLimitResponse);
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});

/**
 * Publish rate limit: 30 requests per 15-minute window per IP.
 * Applied to content publishing endpoints.
 */
export const publishRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('publish'),
  handler: (_req, res, _next, options) => {
    logger.warn('Publish rate limit hit', {
      ip: _req.ip,
      path: _req.path,
      method: _req.method,
      limit: options.limit,
    });
    res.status(429).json(rateLimitResponse);
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});

/**
 * Webhook rate limit: 100 requests per 15-minute window per IP.
 * Applied to incoming webhook endpoints (Stripe, OAuth callbacks, etc.).
 */
export const webhookRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  store: createRedisStore('webhook'),
  handler: (_req, res, _next, options) => {
    logger.warn('Webhook rate limit hit', {
      ip: _req.ip,
      path: _req.path,
      method: _req.method,
      limit: options.limit,
    });
    res.status(429).json(rateLimitResponse);
  },
  keyGenerator: (req) => req.ip ?? 'unknown',
});
