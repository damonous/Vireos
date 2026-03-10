import { Redis } from 'ioredis';
import { logger } from './logger';

// ---------------------------------------------------------------------------
// Singleton Redis client
// ---------------------------------------------------------------------------

let redisClient: Redis | null = null;

export function getRedisClient(): Redis {
  if (redisClient) {
    return redisClient;
  }

  const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

  redisClient = new Redis(redisUrl, {
    // Reconnect with exponential backoff, capped at 30 seconds
    retryStrategy(times) {
      const delay = Math.min(times * 50, 30_000);
      logger.warn(`Redis reconnecting, attempt ${times}, delay ${delay}ms`);
      return delay;
    },
    // Fail immediately on critical errors (auth failures, etc.)
    reconnectOnError(err) {
      const targetErrors = ['READONLY', 'ECONNREFUSED', 'ENOTFOUND'];
      if (targetErrors.some((e) => err.message.includes(e))) {
        return true;
      }
      return false;
    },
    // Lazy connect — don't attempt until first command
    lazyConnect: false,
    // Command queue max length during disconnection
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });

  redisClient.on('connect', () => {
    logger.info('Redis connected');
  });

  redisClient.on('ready', () => {
    logger.info('Redis ready');
  });

  redisClient.on('error', (err: Error) => {
    logger.error('Redis client error', { error: err.message });
  });

  redisClient.on('close', () => {
    logger.warn('Redis connection closed');
  });

  redisClient.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  redisClient.on('end', () => {
    logger.warn('Redis connection ended');
  });

  return redisClient;
}

/**
 * Gracefully disconnect the Redis client.
 * Call this during application shutdown.
 */
export async function disconnectRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
    logger.info('Redis disconnected gracefully');
  }
}

// Export a ready-to-use singleton — imported by queues, rate limiters, etc.
export const redis = getRedisClient();

export default redis;
