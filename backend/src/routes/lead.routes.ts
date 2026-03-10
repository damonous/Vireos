/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createLeadSchema,
  updateLeadSchema,
  updateStatusSchema,
  assignLeadSchema,
  addActivitySchema,
  listLeadsQuerySchema,
  bulkUpdateStatusSchema,
} from '../validators/lead.validators';
import * as leadService from '../services/lead.service';
import { AuthenticatedRequest, UserRole } from '../types';

const router = Router();

// Type-cast authenticate so TypeScript accepts it in route chains.
const auth = authenticate as any;
const adminOnly = [
  authenticate as any,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
];

// Multer configured for in-memory CSV uploads (max 10 MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (
      file.mimetype === 'text/csv' ||
      file.mimetype === 'application/vnd.ms-excel' ||
      file.originalname.endsWith('.csv')
    ) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are accepted'));
    }
  },
});

// Inline pagination schema for activity list endpoint
const activityPaginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// POST /v1/leads — create a lead (all roles)
// ---------------------------------------------------------------------------

router.post(
  '/',
  auth,
  validateBody(createLeadSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const lead = await leadService.createLead(req.body, authReq.user);
      res.status(201).json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/leads — list leads with filters (all roles, scoped)
// ---------------------------------------------------------------------------

router.get(
  '/',
  auth,
  validateQuery(listLeadsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const query = req.query as any;

      const pagination = { page: query.page, limit: query.limit };
      const filters = {
        status: query.status,
        source: query.source,
        assignedAdvisorId: query.assignedAdvisorId,
        search: query.search,
        sortBy: query.sortBy,
        sortOrder: query.sortOrder,
      };

      const result = await leadService.listLeads(
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
// POST /v1/leads/import — CSV upload (admin, super_admin)
// NOTE: Must be registered BEFORE /:id routes to avoid param capture
// ---------------------------------------------------------------------------

router.post(
  '/import',
  ...adminOnly,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      if (!req.file) {
        res.status(400).json({
          success: false,
          error: {
            code: 'BAD_REQUEST',
            message: 'No CSV file uploaded. Use multipart/form-data with field name "file".',
          },
        });
        return;
      }

      const result = await leadService.importLeads(
        req.file.buffer,
        authReq.user.orgId,
        authReq.user
      );

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/leads/bulk/status — bulk status update (admin, super_admin)
// NOTE: Must be registered BEFORE /:id routes
// ---------------------------------------------------------------------------

router.post(
  '/bulk/status',
  ...adminOnly,
  validateBody(bulkUpdateStatusSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { leadIds, status } = req.body;
      const result = await leadService.bulkUpdateStatus(
        leadIds,
        status,
        authReq.user
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/leads/:id — get single lead with activities (all roles, scoped)
// ---------------------------------------------------------------------------

router.get(
  '/:id',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const lead = await leadService.getLead(req.params['id'] as string, authReq.user);
      res.status(200).json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /v1/leads/:id — update lead (all roles)
// ---------------------------------------------------------------------------

router.put(
  '/:id',
  auth,
  validateBody(updateLeadSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const lead = await leadService.updateLead(
        req.params['id'] as string,
        req.body,
        authReq.user
      );
      res.status(200).json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /v1/leads/:id — delete lead (admin, super_admin)
// ---------------------------------------------------------------------------

router.delete(
  '/:id',
  ...adminOnly,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      await leadService.deleteLead(req.params['id'] as string, authReq.user);
      res.status(200).json({ success: true, data: { message: 'Lead deleted successfully.' } });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /v1/leads/:id/status — update status (all roles)
// ---------------------------------------------------------------------------

router.patch(
  '/:id/status',
  auth,
  validateBody(updateStatusSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { status } = req.body;
      const lead = await leadService.updateStatus(
        req.params['id'] as string,
        status,
        authReq.user
      );
      res.status(200).json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PATCH /v1/leads/:id/assign — assign lead to advisor (admin, super_admin)
// ---------------------------------------------------------------------------

router.patch(
  '/:id/assign',
  ...adminOnly,
  validateBody(assignLeadSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { advisorId } = req.body;
      const lead = await leadService.assignLead(
        req.params['id'] as string,
        advisorId,
        authReq.user
      );
      res.status(200).json({ success: true, data: lead });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/leads/:id/activities — list activities (all roles)
// ---------------------------------------------------------------------------

router.get(
  '/:id/activities',
  auth,
  validateQuery(activityPaginationSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const query = req.query as any;
      const pagination = { page: query.page ?? 1, limit: query.limit ?? 20 };
      const result = await leadService.getActivities(
        req.params['id'] as string,
        authReq.user,
        pagination
      );
      res.status(200).json({ success: true, ...result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/leads/:id/activities — add activity (all roles)
// ---------------------------------------------------------------------------

router.post(
  '/:id/activities',
  auth,
  validateBody(addActivitySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const activity = await leadService.addActivity(
        req.params['id'] as string,
        req.body,
        authReq.user
      );
      res.status(201).json({ success: true, data: activity });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
