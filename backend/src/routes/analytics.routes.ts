/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { analyticsQuerySchema, resolveDateRange } from '../validators/analytics.validators';
import * as analyticsService from '../services/analytics.service';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Type-cast authenticate so TypeScript accepts it in route chains.
const auth = authenticate as any;

// ---------------------------------------------------------------------------
// All analytics routes require authentication
// ---------------------------------------------------------------------------

router.use(auth);

// ---------------------------------------------------------------------------
// Shared query parsing helper
// ---------------------------------------------------------------------------

/**
 * Parses and validates the query string for analytics endpoints.
 * Returns a parsed DateRange, or throws a ZodError (picked up by errorHandler).
 */
function parseAnalyticsQuery(req: Request) {
  // Validate query params — parse them from req.query without assigning back
  const parsed = analyticsQuerySchema.parse({
    from: req.query['from'],
    to: req.query['to'],
    preset: req.query['preset'],
  });
  return resolveDateRange(parsed);
}

// ---------------------------------------------------------------------------
// GET /overview
// ---------------------------------------------------------------------------

router.get('/overview', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const range = parseAnalyticsQuery(req);
    const orgId = authReq.user.orgId;

    const metrics = await analyticsService.getOverview(orgId, range, authReq.user);
    res.status(200).json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /linkedin
// ---------------------------------------------------------------------------

router.get('/linkedin', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const range = parseAnalyticsQuery(req);
    const orgId = authReq.user.orgId;

    const metrics = await analyticsService.getLinkedInAnalytics(orgId, range, authReq.user);
    res.status(200).json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /facebook
// ---------------------------------------------------------------------------

router.get('/facebook', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const range = parseAnalyticsQuery(req);
    const orgId = authReq.user.orgId;

    const metrics = await analyticsService.getFacebookAnalytics(orgId, range, authReq.user);
    res.status(200).json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /email
// ---------------------------------------------------------------------------

router.get('/email', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const range = parseAnalyticsQuery(req);
    const orgId = authReq.user.orgId;

    const metrics = await analyticsService.getEmailAnalytics(orgId, range, authReq.user);
    res.status(200).json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /leads
// ---------------------------------------------------------------------------

router.get('/leads', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const range = parseAnalyticsQuery(req);
    const orgId = authReq.user.orgId;

    const metrics = await analyticsService.getLeadAnalytics(orgId, range, authReq.user);
    res.status(200).json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /prospects
// ---------------------------------------------------------------------------

router.get('/prospects', async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const range = parseAnalyticsQuery(req);
    const orgId = authReq.user.orgId;

    const metrics = await analyticsService.getProspectAnalytics(orgId, range, authReq.user);
    res.status(200).json({ success: true, data: metrics });
  } catch (err) {
    next(err);
  }
});

export default router;
