/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { prisma } from '../db/client';
import { authenticate } from '../middleware/auth';
import { AuthenticatedRequest } from '../types';

const router = Router();
const auth = authenticate as any;

router.get(
  '/',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const notifications = await prisma.notification.findMany({
        where: {
          organizationId: authReq.user.orgId,
          userId: authReq.user.id,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
      });

      res.status(200).json({ success: true, data: notifications });
    } catch (err) {
      next(err);
    }
  }
);

router.patch(
  '/:notificationId/read',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as AuthenticatedRequest;
      const notificationId = req.params['notificationId'] as string;
      const notification = await prisma.notification.findUnique({
        where: { id: notificationId },
      });

      if (!notification || notification.organizationId !== authReq.user.orgId || notification.userId !== authReq.user.id) {
        res.status(404).json({
          success: false,
          error: { code: 'NOT_FOUND', message: 'Notification not found.' },
        });
        return;
      }

      const updated = await prisma.notification.update({
        where: { id: notificationId },
        data: { isRead: true, readAt: new Date() },
      });

      res.status(200).json({ success: true, data: updated });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
