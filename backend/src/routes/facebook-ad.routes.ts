/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createAdCampaignSchema,
  updateAdCampaignSchema,
  listAdCampaignsQuerySchema,
  launchCampaignSchema,
} from '../validators/facebook-ad.validators';
import * as fbAdService from '../services/facebook-ad.service';
import { AuthenticatedRequest, UserRole } from '../types';
import { logger } from '../utils/logger';

const router = Router();

// Type-cast middleware for Express 5 compatibility
const auth = authenticate as any;

// Role guards
const advisorOrAdmin = [
  authenticate as any,
  requireRole(UserRole.ADVISOR, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
];

// ---------------------------------------------------------------------------
// POST /v1/facebook/campaigns — create campaign (ADVISOR, ORG_ADMIN)
// ---------------------------------------------------------------------------

router.post(
  '/v1/facebook/campaigns',
  ...advisorOrAdmin,
  validateBody(createAdCampaignSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await fbAdService.createAdCampaign(req.body, authReq.user);
      res.status(201).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/facebook/campaigns — list campaigns (all authenticated roles)
// ---------------------------------------------------------------------------

router.get(
  '/v1/facebook/campaigns',
  auth,
  validateQuery(listAdCampaignsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const query = req.query as any;

      const pagination = { page: query.page, limit: query.limit };
      const filters = { status: query.status };

      const result = await fbAdService.listAdCampaigns(
        authReq.user.orgId,
        authReq.user,
        filters,
        pagination
      );

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/facebook/campaigns/:campaignId — get one (all authenticated roles)
// ---------------------------------------------------------------------------

router.get(
  '/v1/facebook/campaigns/:campaignId',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await fbAdService.getAdCampaign(
        req.params['campaignId'] as string,
        authReq.user
      );
      res.status(200).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /v1/facebook/campaigns/:campaignId — update (ADVISOR owns-only, ADMIN any)
// ---------------------------------------------------------------------------

router.put(
  '/v1/facebook/campaigns/:campaignId',
  ...advisorOrAdmin,
  validateBody(updateAdCampaignSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await fbAdService.updateAdCampaign(
        req.params['campaignId'] as string,
        req.body,
        authReq.user
      );
      res.status(200).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /v1/facebook/campaigns/:campaignId — delete (ADVISOR owns-only, ADMIN any)
// ---------------------------------------------------------------------------

router.delete(
  '/v1/facebook/campaigns/:campaignId',
  ...advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      await fbAdService.deleteAdCampaign(
        req.params['campaignId'] as string,
        authReq.user
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/facebook/campaigns/:campaignId/launch — launch (ADVISOR, ADMIN)
// ---------------------------------------------------------------------------

router.post(
  '/v1/facebook/campaigns/:campaignId/launch',
  ...advisorOrAdmin,
  validateBody(launchCampaignSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await fbAdService.launchCampaign(
        req.params['campaignId'] as string,
        authReq.user,
        req.body
      );
      res.status(200).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/facebook/campaigns/:campaignId/pause — pause (ADVISOR, ADMIN)
// ---------------------------------------------------------------------------

router.post(
  '/v1/facebook/campaigns/:campaignId/pause',
  ...advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await fbAdService.pauseCampaign(
        req.params['campaignId'] as string,
        authReq.user
      );
      res.status(200).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/facebook/webhook — Facebook webhook verification (public, no JWT)
// ---------------------------------------------------------------------------

router.get(
  '/v1/facebook/webhook',
  async (req: Request, res: Response): Promise<void> => {
    try {
      const mode = req.query['hub.mode'] as string ?? '';
      const challenge = req.query['hub.challenge'] as string ?? '';
      const verifyToken = req.query['hub.verify_token'] as string ?? '';

      const responseChallenge = fbAdService.handleWebhookVerification(
        mode,
        challenge,
        verifyToken
      );

      res.status(200).send(responseChallenge);
    } catch {
      res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Webhook verification failed: invalid verify_token.',
        },
      });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/facebook/webhook — Facebook webhook event receiver (public, no JWT)
// MUST always return 200 to Facebook, even if processing fails.
// ---------------------------------------------------------------------------

router.post(
  '/v1/facebook/webhook',
  async (req: Request, res: Response): Promise<void> => {
    // Immediately acknowledge to Facebook
    res.status(200).json({ received: true });

    // Process asynchronously (fire-and-forget) — do not block the response
    const payload = req.body as fbAdService.FacebookLeadPayload;

    setImmediate(async () => {
      try {
        const result = await fbAdService.ingestFacebookLead(payload);
        logger.info('Facebook webhook processed', { leadsCreated: result.leadsCreated });
      } catch (err) {
        logger.error('Facebook webhook processing failed', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    });
  }
);

export default router;
