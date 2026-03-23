/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction, CookieOptions } from 'express';
import { authenticate } from '../middleware/auth';
import { authRateLimit } from '../middleware/rateLimiter';
import { validateBody } from '../middleware/validate';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updateProfileSchema,
} from '../validators/auth.validators';
import * as authService from '../services/auth.service';
import { AuthenticatedRequest } from '../types';

const router = Router();

// ---------------------------------------------------------------------------
// Cookie configuration for HttpOnly secure auth tokens
// ---------------------------------------------------------------------------

const ACCESS_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 15 * 60 * 1000, // 15 minutes
  path: '/',
};

const REFRESH_TOKEN_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'lax',
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  path: '/api/v1/auth',
};

/**
 * Sets access_token and refresh_token HttpOnly cookies on the response.
 */
function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string }
): void {
  res.cookie('access_token', tokens.accessToken, ACCESS_TOKEN_COOKIE_OPTIONS);
  res.cookie('refresh_token', tokens.refreshToken, REFRESH_TOKEN_COOKIE_OPTIONS);
}

// Type-cast authenticate so TypeScript accepts it in route chains.
// At runtime, authenticate populates req.user — subsequent handlers cast req safely.
const auth = authenticate as any;

// ---------------------------------------------------------------------------
// POST /register
// ---------------------------------------------------------------------------

router.post('/register', authRateLimit, validateBody(registerSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ipAddress = req.ip ?? undefined;
    const tokens = await authService.register(req.body, ipAddress);
    setAuthCookies(res, tokens);
    res.status(201).json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /login
// ---------------------------------------------------------------------------

router.post('/login', authRateLimit, validateBody(loginSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const ipAddress = req.ip ?? undefined;
    const tokens = await authService.login(req.body, ipAddress);
    setAuthCookies(res, tokens);
    res.status(200).json({ success: true, data: tokens });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /refresh
// ---------------------------------------------------------------------------

router.post('/refresh', authRateLimit, async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Accept refresh token from request body (existing behavior) or from HttpOnly cookie
    const bodyToken = (req.body as { refreshToken?: string })?.refreshToken;
    const cookieToken = req.cookies?.refresh_token as string | undefined;
    const refreshToken = bodyToken || cookieToken;

    if (!refreshToken) {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Refresh token is required (in body or cookie).',
        },
      });
      return;
    }

    const tokens = await authService.refreshTokens(refreshToken);
    setAuthCookies(res, tokens);
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
    res.clearCookie('access_token', { path: '/' });
    res.clearCookie('refresh_token', { path: '/api/v1/auth' });
    res.status(200).json({ success: true, data: { message: 'Logged out successfully.' } });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// POST /forgot-password
// ---------------------------------------------------------------------------

router.post('/forgot-password', authRateLimit, validateBody(forgotPasswordSchema), async (
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

router.post('/reset-password', authRateLimit, validateBody(resetPasswordSchema), async (
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
// PATCH /me  (requires authenticate) — update own profile
// ---------------------------------------------------------------------------

router.patch('/me', auth, validateBody(updateProfileSchema), async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { prisma } = await import('../db/client');

    const { firstName, lastName, phone, settings } = req.body as {
      firstName?: string;
      lastName?: string;
      phone?: string | null;
      settings?: Record<string, unknown>;
    };

    // Build the update payload — only include fields that were provided
    const updateData: Record<string, unknown> = {};
    if (firstName !== undefined) updateData.firstName = firstName;
    if (lastName !== undefined) updateData.lastName = lastName;
    if (phone !== undefined) updateData.phone = phone;

    // Merge settings: read existing user settings, spread new values on top
    if (settings !== undefined) {
      const existingUser = await prisma.user.findUnique({
        where: { id: authReq.user.id },
        select: { settings: true },
      });
      const existingSettings =
        existingUser?.settings && typeof existingUser.settings === 'object'
          ? (existingUser.settings as Record<string, unknown>)
          : {};
      updateData.settings = { ...existingSettings, ...settings };
    }

    const user = await prisma.user.update({
      where: { id: authReq.user.id },
      data: updateData,
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
        settings: true,
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
        settings: user.settings,
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

// ---------------------------------------------------------------------------
// PATCH /me/settings  (requires authenticate) — update user settings (e.g. preferredMode)
// ---------------------------------------------------------------------------

router.patch('/me/settings', auth, async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authReq = req as unknown as AuthenticatedRequest;
    const { prisma } = await import('../db/client');

    const body = req.body as Record<string, unknown>;
    const { preferredMode } = body;

    // Validate preferredMode if provided
    if (preferredMode !== undefined && preferredMode !== 'easy' && preferredMode !== 'boss') {
      res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'preferredMode must be "easy" or "boss".',
        },
      });
      return;
    }

    // Merge incoming keys into existing settings
    const existingUser = await prisma.user.findUnique({
      where: { id: authReq.user.id },
      select: { settings: true },
    });
    const existingSettings =
      existingUser?.settings && typeof existingUser.settings === 'object'
        ? (existingUser.settings as Record<string, unknown>)
        : {};

    const newSettings = { ...existingSettings, ...body } as Record<string, unknown>;

    const user = await prisma.user.update({
      where: { id: authReq.user.id },
      data: { settings: newSettings as any },
      select: { settings: true },
    });

    res.status(200).json({ success: true, data: { settings: user.settings } });
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
        settings: true,
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
        settings: user.settings,
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
