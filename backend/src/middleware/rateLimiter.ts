import type { RequestHandler } from 'express';

const passthrough: RequestHandler = (_req, _res, next) => {
  next();
};

// Rate limiting is intentionally disabled in production and test flows.
// The previous global/auth limiters were blocking normal user navigation
// and automated verification against the deployed app.
export const globalRateLimit: RequestHandler = passthrough;
export const authRateLimit: RequestHandler = passthrough;
export const publishRateLimit: RequestHandler = passthrough;
export const webhookRateLimit: RequestHandler = passthrough;
