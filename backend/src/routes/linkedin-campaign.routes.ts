/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createCampaignSchema,
  updateCampaignSchema,
  enrollLeadsSchema,
  listCampaignsQuerySchema,
  detectReplySchema,
} from '../validators/linkedin-campaign.validators';
import { linkedinCampaignService } from '../services/linkedin-campaign.service';
import { AuthenticatedRequest, UserRole } from '../types';

const router = Router();

// Type-cast middleware so TypeScript accepts it in route chains.
const auth = authenticate as any;
const advisorOrAdmin = requireRole(
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.ADVISOR
) as any;
const allRoles = requireRole(
  UserRole.SUPER_ADMIN,
  UserRole.ORG_ADMIN,
  UserRole.ADVISOR,
  UserRole.VIEWER
) as any;

// =============================================================================
// Campaign CRUD
// =============================================================================

/**
 * POST /v1/linkedin/campaigns
 * Create a new LinkedIn messaging campaign.
 */
router.post(
  '/v1/linkedin/campaigns',
  auth,
  advisorOrAdmin,
  validateBody(createCampaignSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await linkedinCampaignService.createCampaign(
        req.body,
        authReq.user
      );
      res.status(201).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/linkedin/campaigns
 * List campaigns (paginated) with optional status filter.
 */
router.get(
  '/v1/linkedin/campaigns',
  auth,
  allRoles,
  validateQuery(listCampaignsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const query = req.query as any;
      const result = await linkedinCampaignService.listCampaigns(
        authReq.user.orgId,
        authReq.user,
        query
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/linkedin/campaigns/:campaignId
 * Get a single campaign by ID.
 */
router.get(
  '/v1/linkedin/campaigns/:campaignId',
  auth,
  allRoles,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await linkedinCampaignService.getCampaign(
        req.params['campaignId'] as string,
        authReq.user
      );
      res.status(200).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /v1/linkedin/campaigns/:campaignId
 * Update a DRAFT campaign.
 */
router.put(
  '/v1/linkedin/campaigns/:campaignId',
  auth,
  advisorOrAdmin,
  validateBody(updateCampaignSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await linkedinCampaignService.updateCampaign(
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

/**
 * DELETE /v1/linkedin/campaigns/:campaignId
 * Delete a DRAFT campaign.
 */
router.delete(
  '/v1/linkedin/campaigns/:campaignId',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      await linkedinCampaignService.deleteCampaign(
        req.params['campaignId'] as string,
        authReq.user
      );
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// Campaign lifecycle
// =============================================================================

/**
 * POST /v1/linkedin/campaigns/:campaignId/activate
 * Transition DRAFT → ACTIVE.
 */
router.post(
  '/v1/linkedin/campaigns/:campaignId/activate',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await linkedinCampaignService.activateCampaign(
        req.params['campaignId'] as string,
        authReq.user
      );
      res.status(200).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/linkedin/campaigns/:campaignId/pause
 * Transition ACTIVE → PAUSED.
 */
router.post(
  '/v1/linkedin/campaigns/:campaignId/pause',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const campaign = await linkedinCampaignService.pauseCampaign(
        req.params['campaignId'] as string,
        authReq.user
      );
      res.status(200).json({ success: true, data: campaign });
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// Enrollments
// =============================================================================

/**
 * POST /v1/linkedin/campaigns/:campaignId/enrollments
 * Enroll leads into an ACTIVE campaign.
 */
router.post(
  '/v1/linkedin/campaigns/:campaignId/enrollments',
  auth,
  advisorOrAdmin,
  validateBody(enrollLeadsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { leadIds } = req.body as { leadIds: string[] };
      const result = await linkedinCampaignService.enrollLeads(
        req.params['campaignId'] as string,
        leadIds,
        authReq.user
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// Webhooks (public — no auth)
// =============================================================================

/**
 * POST /v1/linkedin/webhook/reply
 * Reply detection webhook. Public endpoint — no JWT required.
 * Called when a lead replies to a LinkedIn outreach message.
 */
router.post(
  '/v1/linkedin/webhook/reply',
  validateBody(detectReplySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Webhook handler: no authenticated user — use a system user object
      const systemUser = {
        id: 'system',
        orgId: 'system',
        role: UserRole.SUPER_ADMIN,
        email: 'system@vireos.internal',
      };

      const { enrollmentId, repliedAt } = req.body as {
        enrollmentId: string;
        repliedAt: string;
      };

      const enrollment = await linkedinCampaignService.detectReply(
        enrollmentId,
        repliedAt,
        systemUser
      );

      res.status(200).json({ success: true, data: enrollment });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
