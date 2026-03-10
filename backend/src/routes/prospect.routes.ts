/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createProspectRequestSchema,
  listRequestsQuerySchema,
  adminListRequestsQuerySchema,
} from '../validators/prospect.validators';
import * as prospectService from '../services/prospect.service';
import { Errors } from '../middleware/errorHandler';
import { AuthenticatedRequest, UserRole } from '../types';
import { ProspectRequestStatus } from '@prisma/client';

// ---------------------------------------------------------------------------
// Router setup
// ---------------------------------------------------------------------------

const router = Router();

// Multer configured for in-memory CSV uploads (no disk writes).
// 10 MB limit is generous for a prospect CSV; practical CSVs are much smaller.
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

// Cast authenticate/requireRole so TypeScript accepts them in route chains.
// At runtime they operate on the request and populate req.user.
const auth = authenticate as any;
const adminOnly = requireRole(UserRole.SUPER_ADMIN) as any;
const advisorOrAdmin = requireRole(
  UserRole.ADVISOR,
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN
) as any;

// ---------------------------------------------------------------------------
// Advisor / Org Admin routes — /v1/prospects/requests
// ---------------------------------------------------------------------------

/**
 * POST /v1/prospects/requests
 * Creates a new prospect list request for the authenticated user's org.
 * Requires ADVISOR, ORG_ADMIN, or SUPER_ADMIN role.
 */
router.post(
  '/v1/prospects/requests',
  auth,
  advisorOrAdmin,
  validateBody(createProspectRequestSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await prospectService.createRequest(req.body, authReq.user);
      res.status(201).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/prospects/requests
 * Lists prospect list requests for the authenticated user's organization.
 *
 * Note: Express 5 treats req.query as a non-writable getter so we parse the
 * raw query object directly in the handler rather than via validateQuery middleware.
 */
router.get(
  '/v1/prospects/requests',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      // Parse and validate query params inline (Express 5 req.query is read-only)
      const parseResult = listRequestsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(parseResult.error);
      }
      const { page, limit } = parseResult.data;

      const result = await prospectService.listRequests(
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

/**
 * GET /v1/prospects/requests/:id
 * Retrieves a single prospect list request by ID.
 * Enforces org isolation — only requests belonging to the user's org are accessible.
 */
router.get(
  '/v1/prospects/requests/:id',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const id = req.params['id'] as string;
      const result = await prospectService.getRequest(id, authReq.user);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /v1/prospects/requests/:id
 * Cancels a PENDING prospect list request.
 * Returns 409 if the request is not in PENDING status.
 */
router.delete(
  '/v1/prospects/requests/:id',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const id = req.params['id'] as string;
      const result = await prospectService.cancelRequest(id, authReq.user);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// Super Admin fulfillment queue — /v1/admin/prospect-requests
// ---------------------------------------------------------------------------

/**
 * GET /v1/admin/prospect-requests
 * Lists all prospect list requests across all organizations.
 * Super admin only. Supports filtering by status and orgId.
 */
router.get(
  '/v1/admin/prospect-requests',
  auth,
  adminOnly,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      // Parse and validate query params inline (Express 5 req.query is read-only)
      const parseResult = adminListRequestsQuerySchema.safeParse(req.query);
      if (!parseResult.success) {
        return next(parseResult.error);
      }
      const { page, limit, status, orgId } = parseResult.data;

      const result = await prospectService.listAllRequests(
        {
          status: status as ProspectRequestStatus | undefined,
          orgId,
        },
        { page, limit },
        authReq.user
      );

      res.status(200).json({ success: true, data: result.data, meta: result.meta });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/admin/prospect-requests/:id/upload
 * Uploads a fulfillment CSV for a prospect list request.
 * Super admin only. Parses CSV, sets creditCost, sets status = PROCESSING.
 */
router.post(
  '/v1/admin/prospect-requests/:id/upload',
  auth,
  adminOnly,
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      if (!req.file) {
        return next(
          Errors.badRequest('No CSV file provided. Upload a CSV via the "file" form field.')
        );
      }

      const id = req.params['id'] as string;
      const result = await prospectService.uploadFulfillmentCsv(
        id,
        req.file.buffer,
        authReq.user
      );

      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/admin/prospect-requests/:id/preview
 * Returns parsed lead data from the stored CSV for the advisor to review
 * before confirming the import. Request must be in PROCESSING status.
 */
router.get(
  '/v1/admin/prospect-requests/:id/preview',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const id = req.params['id'] as string;
      const result = await prospectService.previewLeads(id, authReq.user);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/admin/prospect-requests/:id/confirm
 * Confirms the import: deducts credits from the org and imports leads into the CRM.
 * Callable by advisor/admin (for their own org) or super admin.
 * Returns 402 if the organization has insufficient credits.
 */
router.post(
  '/v1/admin/prospect-requests/:id/confirm',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const id = req.params['id'] as string;
      const result = await prospectService.confirmImport(id, authReq.user);
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
