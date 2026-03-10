import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Prisma client singleton
// ---------------------------------------------------------------------------

declare global {
  // eslint-disable-next-line no-var
  var __prisma: PrismaClient | undefined;
}

/**
 * In development, we attach the Prisma client to the Node.js global object
 * so that hot-reload (ts-node-dev) does not create a new client on every
 * file change — which would exhaust the connection pool.
 *
 * In production, a module-level singleton is sufficient because the process
 * is never hot-reloaded.
 */
function createPrismaClient(): PrismaClient {
  return new PrismaClient({
    log:
      process.env['NODE_ENV'] === 'development'
        ? [
            { level: 'query', emit: 'event' },
            { level: 'info', emit: 'stdout' },
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ]
        : [
            { level: 'warn', emit: 'stdout' },
            { level: 'error', emit: 'stdout' },
          ],
    errorFormat: process.env['NODE_ENV'] === 'production' ? 'minimal' : 'pretty',
  });
}

const prisma: PrismaClient =
  global.__prisma ?? (global.__prisma = createPrismaClient());

if (process.env['NODE_ENV'] === 'development') {
  // Log slow queries in development (type assertion needed because PrismaClient
  // event types are only available after schema generation)
  (prisma as unknown as { $on: (event: string, cb: (e: { query: string; duration: number }) => void) => void })
    .$on('query', (e) => {
      if (e.duration > 200) {
        logger.warn('Slow Prisma query detected', {
          query: e.query,
          durationMs: e.duration,
        });
      }
    });
}

/**
 * Gracefully disconnect Prisma. Call this on process shutdown.
 */
export async function disconnectPrisma(): Promise<void> {
  await prisma.$disconnect();
  logger.info('Prisma disconnected');
}

export { prisma };
export default prisma;
