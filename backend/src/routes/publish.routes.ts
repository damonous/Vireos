/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import { publishSchema, listPublishJobsQuerySchema } from '../validators/publish.validators';
import * as publishService from '../services/publish.service';
import { AuthenticatedRequest, UserRole } from '../types';

const router = Router();

// Cast authenticate for use in route chains
const auth = authenticate as any;
const advisorOrAdmin = requireRole(
  UserRole.ADVISOR,
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN
) as any;
const allRoles = requireRole(
  UserRole.ADVISOR,
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.VIEWER
) as any;

// ---------------------------------------------------------------------------
// POST /v1/publish — create a publish job (advisor, admin)
// ---------------------------------------------------------------------------

router.post(
  '/',
  auth,
  advisorOrAdmin,
  validateBody(publishSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const dto = req.body as import('../validators/publish.validators').PublishDto;

      const job = dto.scheduledAt
        ? await publishService.schedulePost(dto, authReq.user)
        : await publishService.publishNow(dto, authReq.user);

      res.status(201).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/publish — list publish jobs for org (all roles)
// ---------------------------------------------------------------------------

router.get(
  '/',
  auth,
  allRoles,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      // Parse and validate query params inline (Express 5 does not support req.query assignment)
      const parseResult = listPublishJobsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        next(parseResult.error);
        return;
      }
      const query = parseResult.data;

      const result = await publishService.listJobs(
        authReq.user.orgId,
        authReq.user,
        { page: query.page, limit: query.limit }
      );

      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/publish/:jobId — get a specific publish job (all roles)
// ---------------------------------------------------------------------------

router.get(
  '/:jobId',
  auth,
  allRoles,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const jobId = req.params['jobId'] as string;

      const job = await publishService.getJob(jobId, authReq.user);
      res.status(200).json({ success: true, data: job });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /v1/publish/:jobId — cancel a publish job (advisor own, admin any)
// ---------------------------------------------------------------------------

router.delete(
  '/:jobId',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const jobId = req.params['jobId'] as string;

      await publishService.cancelJob(jobId, authReq.user);
      res.status(200).json({
        success: true,
        data: { message: 'Publish job cancelled successfully.' },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
