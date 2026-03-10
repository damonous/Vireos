/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validate, validateBody, validateQuery } from '../middleware/validate';
import {
  reviewActionSchema,
  editContentSchema,
  auditTrailQuerySchema,
} from '../validators/review.validators';
import { paginationQuerySchema } from '../validators/auth.validators';
import * as reviewService from '../services/review.service';
import { AuthenticatedRequest, UserRole } from '../types';
import { z } from 'zod';

const router = Router();

// Type-cast authenticate so TypeScript accepts it in route chains.
const auth = authenticate as any;

// ---------------------------------------------------------------------------
// Role guards — reusable middleware instances
// ---------------------------------------------------------------------------

const requireComplianceOrAdmin = requireRole(
  UserRole.VIEWER,   // COMPLIANCE maps to VIEWER in the app-layer enum
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN
) as any;

const requireAdvisorOrAdmin = requireRole(
  UserRole.ADVISOR,
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN
) as any;

// ---------------------------------------------------------------------------
// GET /v1/reviews — compliance review queue
// ---------------------------------------------------------------------------

router.get(
  '/',
  auth,
  requireComplianceOrAdmin,
  validateQuery(paginationQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { page, limit } = req.query as unknown as { page: number; limit: number };

      const result = await reviewService.getReviewQueue(
        authReq.user.orgId,
        authReq.user,
        { page, limit }
      );

      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/reviews/:draftId — single draft for review
// ---------------------------------------------------------------------------

router.get(
  '/:draftId',
  auth,
  requireComplianceOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { draftId } = req.params as { draftId: string };

      const draft = await reviewService.getDraftForReview(draftId, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /v1/reviews/:draftId/submit — advisor submits draft for review
// ---------------------------------------------------------------------------

router.patch(
  '/:draftId/submit',
  auth,
  requireAdvisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { draftId } = req.params as { draftId: string };

      const draft = await reviewService.submitForReview(draftId, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /v1/reviews/:draftId/approve — compliance approves draft
// ---------------------------------------------------------------------------

router.patch(
  '/:draftId/approve',
  auth,
  requireComplianceOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { draftId } = req.params as { draftId: string };

      const draft = await reviewService.approveDraft(draftId, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /v1/reviews/:draftId/reject — compliance rejects draft (requires reason)
// ---------------------------------------------------------------------------

router.patch(
  '/:draftId/reject',
  auth,
  requireComplianceOrAdmin,
  validateBody(reviewActionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { draftId } = req.params as { draftId: string };

      const draft = await reviewService.rejectDraft(draftId, req.body, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /v1/reviews/:draftId/request-changes — compliance requests changes
// ---------------------------------------------------------------------------

router.patch(
  '/:draftId/request-changes',
  auth,
  requireComplianceOrAdmin,
  validateBody(reviewActionSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { draftId } = req.params as { draftId: string };

      const draft = await reviewService.requestChanges(draftId, req.body, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /v1/reviews/:draftId/edit — compliance edits content inline
// ---------------------------------------------------------------------------

router.patch(
  '/:draftId/edit',
  auth,
  requireComplianceOrAdmin,
  validateBody(editContentSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { draftId } = req.params as { draftId: string };

      const draft = await reviewService.editDraftContent(draftId, req.body, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

export default router;

// ---------------------------------------------------------------------------
// Audit trail router — exported separately and mounted at /api/v1/audit-trail
// ---------------------------------------------------------------------------

export const auditRouter = Router();

/**
 * GET /v1/audit-trail
 *
 * Paginated query over audit trail records.
 * Accessible by ADMIN and SUPER_ADMIN roles.
 * Super admins can pass an orgId query param to query across all orgs.
 */
auditRouter.get(
  '/',
  auth,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  validateQuery(auditTrailQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const query = req.query as unknown as z.infer<typeof auditTrailQuerySchema>;

      const result = await reviewService.getAuditTrail(
        {
          organizationId: authReq.user.orgId,
          entityType: query.entityType,
          entityId: query.entityId,
          action: query.action,
          from: query.from,
          to: query.to,
          page: query.page,
          limit: query.limit,
        },
        authReq.user
      );

      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  }
);
