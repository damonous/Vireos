/**
 * Server entry point.
 *
 * Responsibilities:
 *   1. Bootstrap config (validation happens on import of config/index.ts)
 *   2. Create the Express app
 *   3. Verify infrastructure connectivity (DB + Redis)
 *   4. Bind the HTTP server to the configured port
 *   5. Handle graceful shutdown on SIGTERM / SIGINT
 */

// Config must be imported first so validation runs before any other module
import { config } from './config';
import { createApp } from './app';
import { logger } from './utils/logger';
import { disconnectPrisma } from './db/client';
import { disconnectRedis } from './utils/redis';
import { closeQueues } from './queues';
import http from 'http';

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

async function bootstrap(): Promise<void> {
  logger.info('Starting Vireos API server...', {
    version: process.env['npm_package_version'] ?? 'unknown',
    nodeVersion: process.version,
    environment: config.NODE_ENV,
  });

  // Create Express application
  const app = createApp();

  // Create HTTP server (wrapping Express for graceful shutdown control)
  const server = http.createServer(app);

  // ---------------------------------------------------------------------------
  // Infrastructure health checks
  // ---------------------------------------------------------------------------

  // Verify Prisma/PostgreSQL connectivity
  try {
    const { prisma } = await import('./db/client');
    await prisma.$queryRaw`SELECT 1`;
    logger.info('PostgreSQL connection verified');
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('PostgreSQL connection failed — is the database running?', { error });
    logger.warn('Continuing startup without DB connection (will fail on first DB query)');
  }

  // Verify Redis connectivity
  try {
    const { redis } = await import('./utils/redis');
    await redis.ping();
    logger.info('Redis connection verified');
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error('Redis connection failed — is Redis running?', { error });
    logger.warn('Continuing startup without Redis connection (rate limiting and queues will fail)');
  }

  // ---------------------------------------------------------------------------
  // Start listening
  // ---------------------------------------------------------------------------

  await new Promise<void>((resolve, reject) => {
    server.listen(config.PORT, () => {
      resolve();
    });

    server.once('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        logger.error(`Port ${config.PORT} is already in use`, { error: err.message });
      } else {
        logger.error('Failed to start HTTP server', { error: err.message });
      }
      reject(err);
    });
  });

  logger.info(`Vireos API listening`, {
    port: config.PORT,
    url: `http://localhost:${config.PORT}`,
    healthCheck: `http://localhost:${config.PORT}/health`,
  });

  // ---------------------------------------------------------------------------
  // Graceful shutdown
  // ---------------------------------------------------------------------------

  let isShuttingDown = false;

  async function shutdown(signal: string): Promise<void> {
    if (isShuttingDown) {
      logger.warn('Shutdown already in progress, ignoring signal', { signal });
      return;
    }

    isShuttingDown = true;
    logger.info('Graceful shutdown initiated', { signal });

    // Step 1: Stop accepting new connections
    server.close((err) => {
      if (err) {
        logger.error('Error closing HTTP server', { error: (err as Error).message });
      } else {
        logger.info('HTTP server closed');
      }
    });

    // Step 2: Close BullMQ queues
    try {
      await closeQueues();
    } catch (err) {
      logger.error('Error closing queues', { error: (err as Error).message });
    }

    // Step 3: Disconnect Redis
    try {
      await disconnectRedis();
    } catch (err) {
      logger.error('Error disconnecting Redis', { error: (err as Error).message });
    }

    // Step 4: Disconnect Prisma
    try {
      await disconnectPrisma();
    } catch (err) {
      logger.error('Error disconnecting Prisma', { error: (err as Error).message });
    }

    logger.info('Graceful shutdown complete');
    process.exit(0);
  }

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  // Handle unhandled promise rejections — log and exit with failure
  process.on('unhandledRejection', (reason) => {
    const error = reason instanceof Error ? reason.message : String(reason);
    logger.error('Unhandled promise rejection — exiting', { error, reason });
    process.exit(1);
  });

  // Handle uncaught exceptions — log and exit with failure
  process.on('uncaughtException', (err) => {
    logger.error('Uncaught exception — exiting', {
      error: err.message,
      stack: err.stack,
    });
    process.exit(1);
  });
}

// Run
bootstrap().catch((err) => {
  console.error('Fatal error during bootstrap:', err);
  process.exit(1);
});
