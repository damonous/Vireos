import { Request, Response, NextFunction } from 'express';

// ---------------------------------------------------------------------------
// In-memory metrics store
// ---------------------------------------------------------------------------

/**
 * Simple in-memory metrics store — Prometheus-compatible labels without
 * requiring the Prometheus client library for MVP.
 *
 * Keys are `METHOD:normalised_route:statusCode` strings.
 */
interface MetricsStore {
  /** Counter: http_requests_total by method, route, and status code */
  requestsTotal: Map<string, number>;
  /** Accumulated sum for computing mean request duration (milliseconds) */
  durationTotalMs: Map<string, number>;
  /** Number of samples for each duration bucket (used for mean) */
  durationCount: Map<string, number>;
  /** Current number of in-flight requests */
  activeConnections: number;
  /** Total 5xx responses seen */
  errorRate5xx: number;
  /** Total 4xx responses seen */
  errorRate4xx: number;
  /** Timestamp when this metrics snapshot was last reset */
  startedAt: number;
}

const metrics: MetricsStore = {
  requestsTotal: new Map(),
  durationTotalMs: new Map(),
  durationCount: new Map(),
  activeConnections: 0,
  errorRate5xx: 0,
  errorRate4xx: 0,
  startedAt: Date.now(),
};

// ---------------------------------------------------------------------------
// Route normalisation
// ---------------------------------------------------------------------------

/**
 * Collapses UUIDs, numeric IDs, and other dynamic segments in a path so that
 * metrics are grouped by route pattern, not by individual resource IDs.
 *
 * Examples:
 *   /api/v1/users/123              → /api/v1/users/:id
 *   /api/v1/orgs/550e8400-…/members → /api/v1/orgs/:id/members
 */
function normaliseRoute(path: string): string {
  return path
    // Replace UUID segments
    .replace(
      /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
      ':id'
    )
    // Replace purely numeric segments
    .replace(/\/\d+(?=\/|$)/g, '/:id')
    // Collapse multiple slashes
    .replace(/\/+/g, '/');
}

// ---------------------------------------------------------------------------
// Middleware
// ---------------------------------------------------------------------------

/**
 * Prometheus-style request metrics collection middleware.
 *
 * Tracks:
 * - http_requests_total (counter by method, normalised route, status code)
 * - http_request_duration_ms (histogram approximation via sum + count)
 * - active_connections (gauge of in-flight requests)
 * - 5xx / 4xx error rates (aggregated counters)
 */
export function trackMetrics(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const startedAt = Date.now();
  metrics.activeConnections += 1;

  res.on('finish', () => {
    metrics.activeConnections = Math.max(0, metrics.activeConnections - 1);

    const durationMs = Date.now() - startedAt;
    const route = normaliseRoute(req.path);
    const key = `${req.method}:${route}:${res.statusCode}`;

    // Increment total requests counter
    metrics.requestsTotal.set(key, (metrics.requestsTotal.get(key) ?? 0) + 1);

    // Accumulate duration for mean calculation
    metrics.durationTotalMs.set(
      key,
      (metrics.durationTotalMs.get(key) ?? 0) + durationMs
    );
    metrics.durationCount.set(
      key,
      (metrics.durationCount.get(key) ?? 0) + 1
    );

    // Error rate tracking
    if (res.statusCode >= 500) {
      metrics.errorRate5xx += 1;
    } else if (res.statusCode >= 400) {
      metrics.errorRate4xx += 1;
    }
  });

  next();
}

// ---------------------------------------------------------------------------
// Snapshot export
// ---------------------------------------------------------------------------

interface MetricEntry {
  method: string;
  route: string;
  statusCode: number;
  requestsTotal: number;
  meanDurationMs: number;
}

interface MetricsSnapshot {
  uptimeMs: number;
  activeConnections: number;
  errorRate5xx: number;
  errorRate4xx: number;
  routes: MetricEntry[];
}

/**
 * Returns a plain-object snapshot of the current in-memory metrics.
 * Suitable for serialising to JSON in a /metrics endpoint.
 */
export function getMetrics(): MetricsSnapshot {
  const routes: MetricEntry[] = [];

  for (const [key, total] of metrics.requestsTotal.entries()) {
    const [method, route, statusCodeStr] = key.split(':') as [
      string,
      string,
      string
    ];
    const statusCode = parseInt(statusCodeStr ?? '0', 10);
    const totalMs = metrics.durationTotalMs.get(key) ?? 0;
    const count = metrics.durationCount.get(key) ?? 1;

    routes.push({
      method: method ?? 'UNKNOWN',
      route: route ?? '/',
      statusCode,
      requestsTotal: total,
      meanDurationMs: Math.round(totalMs / count),
    });
  }

  // Sort by most requests first for readability
  routes.sort((a, b) => b.requestsTotal - a.requestsTotal);

  return {
    uptimeMs: Date.now() - metrics.startedAt,
    activeConnections: metrics.activeConnections,
    errorRate5xx: metrics.errorRate5xx,
    errorRate4xx: metrics.errorRate4xx,
    routes,
  };
}

/**
 * Resets the in-memory metrics store. Useful for testing.
 */
export function resetMetrics(): void {
  metrics.requestsTotal.clear();
  metrics.durationTotalMs.clear();
  metrics.durationCount.clear();
  metrics.activeConnections = 0;
  metrics.errorRate5xx = 0;
  metrics.errorRate4xx = 0;
  metrics.startedAt = Date.now();
}
