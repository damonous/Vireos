/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response } from 'express';
import { version } from '../../package.json';
import { prisma } from '../db/client';
import { redis } from '../utils/redis';
import { getMetrics } from '../middleware/metricsCollector';
import { authenticate, requireRole } from '../middleware/auth';
import { UserRole } from '../types';
import { logger } from '../utils/logger';

// ---------------------------------------------------------------------------
// Health router
// ---------------------------------------------------------------------------

const router = Router();

// ---------------------------------------------------------------------------
// GET /health/live — liveness probe
// ---------------------------------------------------------------------------

/**
 * Liveness probe: returns 200 if the Node.js process is running and the
 * event loop is responsive. Never performs external I/O so it always
 * succeeds as long as the process has not crashed.
 *
 * Used by Kubernetes / Docker health checks to determine whether the
 * container should be restarted.
 */
router.get('/health/live', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// GET /health/ready — readiness probe
// ---------------------------------------------------------------------------

/**
 * Readiness probe: checks connectivity to all required external dependencies
 * (database and Redis). Returns 200 only when all checks pass; 503 when
 * one or more checks fail.
 *
 * Used by load balancers to determine whether this instance should receive
 * traffic. A failing readiness check removes the pod from the LB pool while
 * keeping it alive (unlike a failing liveness probe which causes a restart).
 */
router.get('/health/ready', async (_req: Request, res: Response) => {
  const checks: Record<string, { status: 'ok' | 'fail'; detail?: string }> =
    {};

  // ---- Database check -------------------------------------------------------
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks['database'] = { status: 'ok' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Health readiness check — database failed', { error: message });
    checks['database'] = { status: 'fail', detail: 'Database query failed' };
  }

  // ---- Redis check ----------------------------------------------------------
  try {
    const pong = await redis.ping();
    if (pong === 'PONG') {
      checks['redis'] = { status: 'ok' };
    } else {
      checks['redis'] = {
        status: 'fail',
        detail: `Unexpected PING response: ${String(pong)}`,
      };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Health readiness check — redis failed', { error: message });
    checks['redis'] = { status: 'fail', detail: 'Redis ping failed' };
  }

  // ---- Aggregate result -----------------------------------------------------
  const allHealthy = Object.values(checks).every((c) => c.status === 'ok');
  const httpStatus = allHealthy ? 200 : 503;

  res.status(httpStatus).json({
    status: allHealthy ? 'ok' : 'degraded',
    timestamp: new Date().toISOString(),
    version,
    checks,
  });
});

// ---------------------------------------------------------------------------
// GET /health — basic public status check
// ---------------------------------------------------------------------------

/**
 * Basic health check. Always returns 200 with version and timestamp.
 * This endpoint is intentionally lightweight; it does not perform DB or
 * Redis checks (use /health/ready for that).
 */
router.get('/health', (_req: Request, res: Response) => {
  res.status(200).json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version,
    environment: process.env['NODE_ENV'] ?? 'unknown',
  });
});

// ---------------------------------------------------------------------------
// GET /metrics — super_admin only Prometheus-compatible snapshot
// ---------------------------------------------------------------------------

/**
 * Returns the current in-memory metrics snapshot.
 * Restricted to super_admin to prevent exposing operational data to
 * regular users.
 */
router.get(
  '/metrics',
  authenticate as any,
  requireRole(UserRole.SUPER_ADMIN) as any,
  (_req: Request, res: Response) => {
    const snapshot = getMetrics();
    res.status(200).json({
      success: true,
      data: snapshot,
    });
  }
);

export default router;
