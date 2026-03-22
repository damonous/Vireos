/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  generateContentSchema,
  updateDraftSchema,
  listDraftsQuerySchema,
  exportQuerySchema,
} from '../validators/content.validators';
import * as contentService from '../services/content.service';
import * as versionService from '../services/version.service';
import * as exportService from '../services/export.service';
import { AuthenticatedRequest } from '../types';
import { UserRole } from '../types';
import { ContentStatus, AuditAction } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';

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

// ---------------------------------------------------------------------------
// GET /drafts/:id/versions — list all versions for a draft
// ---------------------------------------------------------------------------

router.get(
  '/drafts/:id/versions',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draftId = req.params['id'] as string;
      const versions = await versionService.getVersions(draftId, authReq.user);
      res.status(200).json({ success: true, data: versions });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /drafts/:id/versions/diff?v1=X&v2=Y — diff between two versions
// ---------------------------------------------------------------------------

router.get(
  '/drafts/:id/versions/diff',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draftId = req.params['id'] as string;

      const v1 = parseInt(req.query['v1'] as string, 10);
      const v2 = parseInt(req.query['v2'] as string, 10);

      if (isNaN(v1) || isNaN(v2)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Query parameters v1 and v2 must be valid integers',
          },
        });
        return;
      }

      const diff = await versionService.getVersionDiff(draftId, v1, v2, authReq.user);
      res.status(200).json({ success: true, data: diff });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /drafts/:id/versions/:versionNumber/rollback — rollback to version
// ---------------------------------------------------------------------------

router.post(
  '/drafts/:id/versions/:versionNumber/rollback',
  auth,
  requireRole(UserRole.VIEWER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draftId = req.params['id'] as string;
      const versionNumber = parseInt(req.params['versionNumber'] as string, 10);

      if (isNaN(versionNumber)) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'Version number must be a valid integer',
          },
        });
        return;
      }

      const draft = await versionService.rollback(draftId, versionNumber, authReq.user);
      res.status(200).json({ success: true, data: draft });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /drafts/:id/export — export draft as PDF or DOCX compliance report
// ---------------------------------------------------------------------------

router.get(
  '/drafts/:id/export',
  auth,
  requireRole(
    UserRole.ORG_ADMIN,
    UserRole.VIEWER,      // compliance maps to VIEWER in the JWT
    UserRole.ADVISOR,
    UserRole.SUPER_ADMIN
  ) as any,
  validateQuery(exportQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const draftId = req.params['id'] as string;
      const format = (req.query['format'] as string) || 'pdf';

      let buffer: Buffer;
      let contentType: string;
      let fileExtension: string;

      if (format === 'docx') {
        buffer = await exportService.exportDraftToDocx(draftId, authReq.user);
        contentType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        fileExtension = 'docx';
      } else {
        buffer = await exportService.exportDraftToPdf(draftId, authReq.user);
        contentType = 'application/pdf';
        fileExtension = 'pdf';
      }

      // Write EXPORTED audit entry (fire-and-forget)
      prisma.auditTrail
        .create({
          data: {
            organizationId: authReq.user.orgId,
            actorId: authReq.user.id,
            entityType: 'Draft',
            entityId: draftId,
            action: AuditAction.EXPORTED,
            metadata: {
              format,
              exportedBy: authReq.user.email,
            },
          },
        })
        .catch((err: unknown) => {
          logger.error('Failed to write EXPORTED audit trail entry', {
            error: err instanceof Error ? err.message : String(err),
            draftId,
            userId: authReq.user.id,
          });
        });

      const safeTitle = draftId.slice(0, 8);
      res.setHeader('Content-Type', contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="compliance-export-${safeTitle}.${fileExtension}"`
      );
      res.setHeader('Content-Length', buffer.length.toString());
      res.status(200).end(buffer);
    } catch (err) {
      next(err);
    }
  }
);

export default router;
