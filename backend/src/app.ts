import express, { Application, Request, Response, NextFunction } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'fs';
import path from 'path';
import { config } from './config';
import { requestLogger } from './middleware/requestLogger';
import { globalRateLimit } from './middleware/rateLimiter';
import { errorHandler } from './middleware/errorHandler';
import { httpsRedirect, securityHeaders, detectSuspiciousRequest } from './middleware/security';
import { trackMetrics } from './middleware/metricsCollector';
import router from './routes';
import { logger } from './utils/logger';

// ---------------------------------------------------------------------------
// App factory
// ---------------------------------------------------------------------------

/**
 * Creates and configures the Express application.
 *
 * Separating app creation from server startup (server.ts) enables clean
 * testing with supertest without binding a real port.
 */
export function createApp(): Application {
  const app = express();
  const frontendDistDir = path.resolve(config.FRONTEND_DIST_DIR);
  const frontendIndexFile = path.join(frontendDistDir, 'index.html');
  const hasFrontendBundle = fs.existsSync(frontendIndexFile);

  // ---- Trust proxy (for accurate IP behind nginx/load balancer) ----------
  // Set to 1 to trust the first proxy. Adjust if behind multiple proxies.
  app.set('trust proxy', 1);

  // ---- HTTPS redirect (production only) ------------------------------------
  // Redirects HTTP → HTTPS based on X-Forwarded-Proto from the load balancer.
  app.use(httpsRedirect);

  // ---- Security headers (Helmet) -----------------------------------------
  app.use(
    helmet({
      // Allow inline scripts in development (for potential API explorer)
      contentSecurityPolicy: config.NODE_ENV === 'production',
      crossOriginEmbedderPolicy: config.NODE_ENV === 'production',
    })
  );

  // ---- Additional security headers beyond Helmet defaults -----------------
  app.use(securityHeaders);

  // ---- CORS ----------------------------------------------------------------
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow requests with no origin (mobile apps, curl, server-to-server)
        if (!origin) {
          return callback(null, true);
        }

        if (config.CORS_ORIGINS.includes(origin)) {
          return callback(null, true);
        }

        logger.warn('CORS blocked request from origin', { origin });
        callback(new Error(`CORS: Origin ${origin} not allowed`));
      },
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: [
        'Content-Type',
        'Authorization',
        'X-Trace-Id',
        'X-Request-Id',
        'stripe-signature',
      ],
      exposedHeaders: ['X-Trace-Id', 'X-Request-Id', 'RateLimit-Limit', 'RateLimit-Remaining'],
      maxAge: 86400, // 24 hours preflight cache
    })
  );

  // ---- Request parsing -----------------------------------------------------
  // JSON body — 10mb limit for content with embedded images/data URIs
  app.use(express.json({ limit: '10mb' }));

  // URL-encoded form data (OAuth redirects, Stripe webhooks)
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // ---- Request logging & tracing ------------------------------------------
  app.use(requestLogger);

  // ---- Metrics collection --------------------------------------------------
  // Applied after logging so all requests (including rate-limited) are tracked.
  app.use(trackMetrics);

  // ---- Suspicious request detection (OWASP) --------------------------------
  // Log-only for MVP — detects SQL injection, XSS, path traversal.
  app.use(detectSuspiciousRequest);

  // ---- Global rate limiting ------------------------------------------------
  // Applied AFTER logging so rate-limited requests are still recorded
  app.use(globalRateLimit);

  // ---- Routes --------------------------------------------------------------
  app.use(router);

  // ---- Frontend static files (single-container deployment) -----------------
  if (hasFrontendBundle) {
    app.use(express.static(frontendDistDir, { index: false }));

    // SPA fallback for all non-API routes
    app.get('/{*path}', (req: Request, res: Response, next: NextFunction) => {
      if (
        req.path.startsWith('/api') ||
        req.path.startsWith('/health') ||
        req.path.startsWith('/metrics')
      ) {
        return next();
      }

      res.sendFile(frontendIndexFile);
    });
  }

  // ---- 404 catch-all for non-API routes -----------------------------------
  app.use((req: Request, res: Response) => {
    if (
      hasFrontendBundle &&
      !req.path.startsWith('/api') &&
      !req.path.startsWith('/health') &&
      !req.path.startsWith('/metrics')
    ) {
      res.sendFile(frontendIndexFile);
      return;
    }

    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found.',
      },
    });
  });

  // ---- Global error handler ------------------------------------------------
  // Must be registered LAST, after all routes and middleware.
  // Express 5 forwards async errors automatically; no need for express-async-errors.
  app.use(
    (err: unknown, req: Request, res: Response, next: NextFunction) => {
      errorHandler(err, req, res, next);
    }
  );

  return app;
}
