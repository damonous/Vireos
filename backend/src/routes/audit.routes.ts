/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuditAction } from '@prisma/client';
import { authenticate, requireRole } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { queryAudit } from '../utils/audit';
import { AuthenticatedRequest, UserRole } from '../types';

// ---------------------------------------------------------------------------
// Audit router
// ---------------------------------------------------------------------------

const router = Router();

// Type-cast middlewares that use AuthenticatedRequest to avoid TS overload
// issues (same pattern used in org.routes.ts).
const auth = authenticate as any;

// ---- Query params schema ---------------------------------------------------

const auditQuerySchema = z.object({
  entityType: z.string().optional(),
  entityId: z.string().uuid('entityId must be a UUID').optional(),
  action: z.nativeEnum(AuditAction).optional(),
  actorId: z.string().uuid('actorId must be a UUID').optional(),
  from: z
    .string()
    .datetime({ message: 'from must be an ISO-8601 datetime string' })
    .optional(),
  to: z
    .string()
    .datetime({ message: 'to must be an ISO-8601 datetime string' })
    .optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

type AuditQuery = z.infer<typeof auditQuerySchema>;

// ---------------------------------------------------------------------------
// GET /v1/audit
// ---------------------------------------------------------------------------

/**
 * Returns a paginated audit trail for the authenticated user's organisation.
 *
 * Access: admin and super_admin only.
 * super_admin may pass `orgId` as a query param to inspect other orgs.
 * All other roles are locked to their own organisation.
 *
 * Query params:
 *   entityType?  — filter by entity type (e.g. "Draft", "User")
 *   entityId?    — filter by entity UUID
 *   action?      — filter by AuditAction enum value
 *   actorId?     — filter by actor user UUID
 *   from?        — ISO-8601 datetime lower bound on createdAt
 *   to?          — ISO-8601 datetime upper bound on createdAt
 *   page         — page number (default 1)
 *   limit        — page size (default 20, max 100)
 */
router.get(
  '/v1/audit',
  auth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.VIEWER) as any,
  validate({ query: auditQuerySchema }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const user = authReq.user;
      const query = req.query as unknown as AuditQuery;

      // super_admin may query any org via query param, otherwise use user's org
      const orgId =
        user.role === UserRole.SUPER_ADMIN &&
        typeof req.query['orgId'] === 'string'
          ? req.query['orgId']
          : user.orgId;

      const filters = {
        entityType: query.entityType,
        entityId: query.entityId,
        action: query.action,
        actorId: query.actorId,
        from: query.from,
        to: query.to,
      };

      const pagination = {
        page: query.page,
        limit: query.limit,
      };

      const result = await queryAudit(orgId, filters, pagination, user);

      res.status(200).json({
        success: true,
        data: result.data,
        meta: result.pagination,
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
