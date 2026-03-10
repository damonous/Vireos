/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  generateContentSchema,
  updateDraftSchema,
  listDraftsQuerySchema,
} from '../validators/content.validators';
import * as contentService from '../services/content.service';
import { AuthenticatedRequest } from '../types';
import { UserRole } from '../types';
import { ContentStatus } from '@prisma/client';

const router = Router();

// Type-cast authenticate so TypeScript accepts it in route chains.
// At runtime, authenticate populates req.user — subsequent handlers cast req safely.
const auth = authenticate as any;

// ---------------------------------------------------------------------------
// POST /generate — generate AI content (all authenticated non-viewer roles)
// ---------------------------------------------------------------------------

router.post(
  '/generate',
  auth,
  requireRole(
    UserRole.ADVISOR,
    UserRole.ORG_ADMIN,
    UserRole.VIEWER,      // compliance maps to VIEWER in the JWT
    UserRole.SUPER_ADMIN
  ) as any,
  validateBody(generateContentSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draft = await contentService.generateContent(req.body, authReq.user);
      res.status(201).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /drafts — list drafts (scoped to org, advisors see only own)
// ---------------------------------------------------------------------------

router.get(
  '/drafts',
  auth,
  validateQuery(listDraftsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      const status = req.query['status'] as ContentStatus | undefined;
      const page = req.query['page'] ? parseInt(req.query['page'] as string, 10) : 1;
      const limit = req.query['limit'] ? parseInt(req.query['limit'] as string, 10) : 20;

      const filters: contentService.DraftFilters = {
        ...(status ? { status } : {}),
      };

      const pagination: contentService.PaginationParams = { page, limit };

      const result = await contentService.listDrafts(
        authReq.user.orgId,
        authReq.user,
        filters,
        pagination
      );

      res.status(200).json({
        success: true,
        data: result.items,
        meta: result.meta,
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /drafts/:id — get a single draft
// ---------------------------------------------------------------------------

router.get(
  '/drafts/:id',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draftId = req.params['id'] as string;
      const draft = await contentService.getDraft(draftId, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /drafts/:id — update a draft
// ---------------------------------------------------------------------------

router.put(
  '/drafts/:id',
  auth,
  validateBody(updateDraftSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draftId = req.params['id'] as string;
      const draft = await contentService.updateDraft(draftId, req.body, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /drafts/:id — soft-delete a draft (status → ARCHIVED)
// ---------------------------------------------------------------------------

router.delete(
  '/drafts/:id',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draftId = req.params['id'] as string;
      await contentService.deleteDraft(draftId, authReq.user);
      res.status(200).json({
        success: true,
        data: { message: 'Draft archived successfully' },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /drafts/:id/archive — explicit archive (admin, compliance, super_admin)
// ---------------------------------------------------------------------------

router.patch(
  '/drafts/:id/archive',
  auth,
  requireRole(UserRole.ORG_ADMIN, UserRole.VIEWER, UserRole.SUPER_ADMIN) as any,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draftId = req.params['id'] as string;
      const draft = await contentService.archiveDraft(draftId, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
