/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import { prisma } from '../db/client';
import { UserRole } from '../types';
import { updateCreditBundlesSchema } from '../validators/billing.validators';
import * as platformSettingService from '../services/platform-setting.service';

const router = Router();
const auth = authenticate as any;

const listUsersQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  search: z.string().trim().optional(),
  orgId: z.string().uuid().optional(),
  role: z.enum(['SUPER_ADMIN', 'ADMIN', 'ADVISOR', 'COMPLIANCE']).optional(),
  status: z.enum(['ACTIVE', 'INACTIVE', 'INVITED', 'LOCKED']).optional(),
});

const listTokenUsageQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  orgId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

router.get(
  '/v1/admin/users',
  auth,
  requireRole(UserRole.SUPER_ADMIN) as any,
  validateQuery(listUsersQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, search, orgId, role, status } =
        req.query as unknown as z.infer<typeof listUsersQuerySchema>;

      const skip = (page - 1) * limit;

      const where = {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
        ...(search
          ? {
              OR: [
                { email: { contains: search, mode: 'insensitive' as const } },
                { firstName: { contains: search, mode: 'insensitive' as const } },
                { lastName: { contains: search, mode: 'insensitive' as const } },
              ],
            }
          : {}),
      };

      const [items, total] = await Promise.all([
        prisma.user.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            organizationId: true,
            email: true,
            firstName: true,
            lastName: true,
            role: true,
            status: true,
            lastLoginAt: true,
            createdAt: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
          },
        }),
        prisma.user.count({ where }),
      ]);

      res.status(200).json({
        success: true,
        data: items,
        meta: {
          page,
          limit,
          totalCount: total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPreviousPage: page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/v1/admin/billing/summary',
  auth,
  requireRole(UserRole.SUPER_ADMIN) as any,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const [
        organizationsTotal,
        trialingOrgs,
        activeOrgs,
        pastDueOrgs,
        cancelledOrgs,
        totalCreditBalance,
        subscriptions,
      ] = await Promise.all([
        prisma.organization.count(),
        prisma.organization.count({ where: { subscriptionStatus: 'TRIALING' } }),
        prisma.organization.count({ where: { subscriptionStatus: 'ACTIVE' } }),
        prisma.organization.count({ where: { subscriptionStatus: 'PAST_DUE' } }),
        prisma.organization.count({ where: { subscriptionStatus: 'CANCELLED' } }),
        prisma.organization.aggregate({ _sum: { creditBalance: true } }),
        prisma.subscription.findMany({
          orderBy: { updatedAt: 'desc' },
          take: 50,
          select: {
            id: true,
            organizationId: true,
            planName: true,
            status: true,
            currentPeriodEnd: true,
            updatedAt: true,
            organization: {
              select: {
                name: true,
                slug: true,
              },
            },
          },
        }),
      ]);

      res.status(200).json({
        success: true,
        data: {
          kpis: {
            organizationsTotal,
            trialingOrgs,
            activeOrgs,
            pastDueOrgs,
            cancelledOrgs,
            totalCreditBalance: totalCreditBalance._sum.creditBalance ?? 0,
          },
          subscriptions,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/v1/admin/billing/credit-bundles',
  auth,
  requireRole(UserRole.SUPER_ADMIN) as any,
  async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await platformSettingService.getCreditBundleConfig();
      res.status(200).json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }
);

router.put(
  '/v1/admin/billing/credit-bundles',
  auth,
  requireRole(UserRole.SUPER_ADMIN) as any,
  validateBody(updateCreditBundlesSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const config = await platformSettingService.updateCreditBundleConfig(
        req.body as z.infer<typeof updateCreditBundlesSchema>
      );
      res.status(200).json({ success: true, data: config });
    } catch (err) {
      next(err);
    }
  }
);

router.get(
  '/v1/admin/token-usage',
  auth,
  requireRole(UserRole.SUPER_ADMIN) as any,
  validateQuery(listTokenUsageQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit, orgId, userId } =
        req.query as unknown as z.infer<typeof listTokenUsageQuerySchema>;
      const skip = (page - 1) * limit;

      const where = {
        ...(orgId ? { organizationId: orgId } : {}),
        ...(userId ? { creatorId: userId } : {}),
      };

      const [drafts, total, totals, organizations, users] = await Promise.all([
        prisma.draft.findMany({
          where,
          skip,
          take: limit,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            title: true,
            originalPrompt: true,
            tokensUsed: true,
            createdAt: true,
            organizationId: true,
            creatorId: true,
            organization: {
              select: {
                id: true,
                name: true,
                slug: true,
              },
            },
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        }),
        prisma.draft.count({ where }),
        prisma.draft.aggregate({
          where,
          _sum: { tokensUsed: true },
        }),
        prisma.draft.groupBy({
          by: ['organizationId'],
          where,
          _sum: { tokensUsed: true },
        }),
        prisma.draft.groupBy({
          by: ['creatorId'],
          where,
          _sum: { tokensUsed: true },
        }),
      ]);

      const organizationIds = organizations.map((item) => item.organizationId);
      const userIds = users.map((item) => item.creatorId);

      const [organizationRows, userRows] = await Promise.all([
        organizationIds.length
          ? prisma.organization.findMany({
              where: { id: { in: organizationIds } },
              select: { id: true, name: true, slug: true },
            })
          : Promise.resolve([]),
        userIds.length
          ? prisma.user.findMany({
              where: { id: { in: userIds } },
              select: { id: true, firstName: true, lastName: true, email: true },
            })
          : Promise.resolve([]),
      ]);

      const orgLookup = new Map(organizationRows.map((row) => [row.id, row]));
      const userLookup = new Map(userRows.map((row) => [row.id, row]));

      res.status(200).json({
        success: true,
        data: {
          items: drafts,
          summary: {
            totalTokensUsed: totals._sum.tokensUsed ?? 0,
            byOrganization: organizations.map((entry) => ({
              organizationId: entry.organizationId,
              tokensUsed: entry._sum.tokensUsed ?? 0,
              organization: orgLookup.get(entry.organizationId) ?? null,
            })),
            byUser: users.map((entry) => ({
              userId: entry.creatorId,
              tokensUsed: entry._sum.tokensUsed ?? 0,
              user: userLookup.get(entry.creatorId) ?? null,
            })),
          },
        },
        meta: {
          page,
          limit,
          totalCount: total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: skip + limit < total,
          hasPreviousPage: page > 1,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
