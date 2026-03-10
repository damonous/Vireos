/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../validators/auth.validators';
import * as authService from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

const router = Router();

// Type-cast authenticate so TypeScript accepts it in route chains.
// At runtime, authenticate populates req.user — subsequent handlers cast req safely.
const auth = authenticate as any;

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

router.post('/register', validateBody(registerSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ipAddress = req.ip ?? undefined;
    const tokens = await authService.register(req.body, ipAddress);
    res.status(201).json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

router.post('/login', validateBody(loginSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ipAddress = req.ip ?? undefined;
    const tokens = await authService.login(req.body, ipAddress);
    res.status(200).json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /refresh
// ---------------------------------------------------------------------------

router.post('/refresh', validateBody(refreshTokenSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken } = req.body as { refreshToken: string };
    const tokens = await authService.refreshTokens(refreshToken);
    res.status(200).json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /logout  (requires authenticate)
// ---------------------------------------------------------------------------

router.post('/logout', auth, async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const ipAddress = req.ip ?? undefined;
    await authService.logout(authReq.user.id, authReq.user.orgId, ipAddress);
    res.status(200).json({ success: true, data: { message: 'Logged out successfully.' } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /forgot-password
// ---------------------------------------------------------------------------

router.post('/forgot-password', validateBody(forgotPasswordSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email } = req.body as { email: string };
    await authService.forgotPassword(email);
    // Always return 200 to prevent user enumeration
    res.status(200).json({
      success: true,
      data: {
        message:
          'If an account with this email exists, a password reset link has been sent.',
      },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /reset-password
// ---------------------------------------------------------------------------

router.post('/reset-password', validateBody(resetPasswordSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token, password } = req.body as { token: string; password: string };
    await authService.resetPassword(token, password);
    res.status(200).json({
      success: true,
      data: { message: 'Password has been reset successfully. Please log in.' },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// PATCH /change-password  (requires authenticate)
// ---------------------------------------------------------------------------

router.patch('/change-password', auth, validateBody(changePasswordSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { currentPassword, newPassword } = req.body as {
      currentPassword: string;
      newPassword: string;
    };
    await authService.changePassword(authReq.user.id, currentPassword, newPassword);
    res.status(200).json({
      success: true,
      data: { message: 'Password changed successfully.' },
    });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// GET /me  (requires authenticate)
// ---------------------------------------------------------------------------

router.get('/me', auth, async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { prisma } = await import('../db/client');
    const { Errors } = await import('../middleware/errorHandler');

    const user = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: {
        id: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        avatarUrl: true,
        phone: true,
        organizationId: true,
        lastLoginAt: true,
        emailVerifiedAt: true,
        createdAt: true,
        updatedAt: true,
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            subscriptionStatus: true,
          },
        },
      },
    });

    if (!user) {
      return next(Errors.notFound('User'));
    }

    res.status(200).json({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        status: user.status,
        avatarUrl: user.avatarUrl,
        phone: user.phone,
        orgId: user.organizationId,
        lastLoginAt: user.lastLoginAt,
        emailVerifiedAt: user.emailVerifiedAt,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt,
        organization: user.organization,
      },
    });
  } catch (err) {
    next(err);
  }
});

export default router;
