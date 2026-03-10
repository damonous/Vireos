/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole, requireOrgAccess } from '../middleware/auth';
import { validateBody, validateQuery, validateParams } from '../middleware/validate';
import { z } from 'zod';
import {
  createOrgSchema,
  updateOrgSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  paginationQuerySchema,
} from '../validators/auth.validators';
import * as orgService from '../services/organization.service';
import { AuthenticatedRequest, UserRole } from '../types';
import { UserRole as PrismaUserRole } from '@prisma/client';

const router = Router();

// Type-cast middlewares that use AuthenticatedRequest to avoid TS overload issues.
// At runtime these middlewares correctly populate/guard req.user.
const auth = authenticate as any;
const orgAccess = requireOrgAccess as any;

// Param schema for orgId and userId
const orgIdParamSchema = z.object({
  orgId: z.string().uuid('orgId must be a valid UUID'),
});

const userIdParamSchema = z.object({
  orgId: z.string().uuid('orgId must be a valid UUID'),
  userId: z.string().uuid('userId must be a valid UUID'),
});

// ---------------------------------------------------------------------------
// POST /  (super_admin only)
// ---------------------------------------------------------------------------

router.post('/',
  auth,
  requireRole(UserRole.SUPER_ADMIN) as any,
  validateBody(createOrgSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const org = await orgService.create(req.body, authReq.user.id);
      res.status(201).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:orgId  (auth + org access)
// ---------------------------------------------------------------------------

router.get('/:orgId',
  auth,
  orgAccess,
  validateParams(orgIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const orgId = req.params['orgId'] as string;
      const org = await orgService.findById(orgId, authReq.user);
      res.status(200).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /:orgId  (admin or super_admin)
// ---------------------------------------------------------------------------

router.put('/:orgId',
  auth,
  orgAccess,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  validateParams(orgIdParamSchema),
  validateBody(updateOrgSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const orgId = req.params['orgId'] as string;
      const org = await orgService.update(orgId, req.body, authReq.user);
      res.status(200).json({ success: true, data: org });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /:orgId/members  (auth + org access)
// ---------------------------------------------------------------------------

router.get('/:orgId/members',
  auth,
  orgAccess,
  validateParams(orgIdParamSchema),
  validateQuery(paginationQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const orgId = req.params['orgId'] as string;
      const result = await orgService.getMembers(
        orgId,
        authReq.user,
        req.query as unknown as { page: number; limit: number }
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /:orgId/members/invite  (admin or super_admin)
// ---------------------------------------------------------------------------

router.post('/:orgId/members/invite',
  auth,
  orgAccess,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  validateParams(orgIdParamSchema),
  validateBody(inviteMemberSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const orgId = req.params['orgId'] as string;
      const member = await orgService.inviteMember(orgId, req.body, authReq.user);
      res.status(201).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// PUT /:orgId/members/:userId/role  (admin or super_admin)
// ---------------------------------------------------------------------------

router.put('/:orgId/members/:userId/role',
  auth,
  orgAccess,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  validateParams(userIdParamSchema),
  validateBody(updateMemberRoleSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const orgId = req.params['orgId'] as string;
      const userId = req.params['userId'] as string;
      const { role } = req.body as { role: string };

      const prismaRole = role as PrismaUserRole;

      const member = await orgService.updateMemberRole(
        orgId,
        userId,
        prismaRole,
        authReq.user
      );
      res.status(200).json({ success: true, data: member });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /:orgId/members/:userId  (admin or super_admin)
// ---------------------------------------------------------------------------

router.delete('/:orgId/members/:userId',
  auth,
  orgAccess,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  validateParams(userIdParamSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const orgId = req.params['orgId'] as string;
      const userId = req.params['userId'] as string;
      await orgService.removeMember(orgId, userId, authReq.user);
      res.status(200).json({
        success: true,
        data: { message: 'Member removed successfully.' },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
