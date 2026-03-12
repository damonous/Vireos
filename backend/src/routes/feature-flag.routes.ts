/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { prisma } from '../db/client';
import { Errors } from '../middleware/errorHandler';
import { UserRole } from '../types';
import type { AuthenticatedRequest } from '../types';

const router = Router();
const auth = authenticate as any;

const listFeatureFlagsQuerySchema = z.object({
  orgId: z.string().uuid().optional(),
});

const updateFeatureFlagSchema = z.object({
  isEnabled: z.boolean(),
});

router.get(
  '/v1/feature-flags',
  auth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN) as any,
  validateQuery(listFeatureFlagsQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { orgId } = req.query as unknown as z.infer<typeof listFeatureFlagsQuerySchema>;

      const targetOrgId =
        authReq.user.role === UserRole.SUPER_ADMIN && orgId ? orgId : authReq.user.orgId;

      const flags = await prisma.featureFlag.findMany({
        where: { organizationId: targetOrgId },
        orderBy: [{ organizationId: 'asc' }, { flag: 'asc' }],
      });

      res.status(200).json({ success: true, data: flags });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/v1/feature-flags/:id',
  auth,
  requireRole(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN) as any,
  validateBody(updateFeatureFlagSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { id } = req.params as { id: string };
      const { isEnabled } = req.body as z.infer<typeof updateFeatureFlagSchema>;

      const flag = await prisma.featureFlag.findUnique({ where: { id } });
      if (!flag) {
        throw Errors.notFound('Feature flag');
      }

      if (
        authReq.user.role !== UserRole.SUPER_ADMIN &&
        flag.organizationId !== authReq.user.orgId
      ) {
        throw Errors.forbidden('You do not have permission to update this feature flag.');
      }

      const updated = await prisma.featureFlag.update({
        where: { id },
        data: { isEnabled },
      });

      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
