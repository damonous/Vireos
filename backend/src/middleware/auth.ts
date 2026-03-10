import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { AppError } from './errorHandler';
import { logger } from '../utils/logger';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
  JwtPayload,
  UserRole,
} from '../types';

// ---------------------------------------------------------------------------
// authenticate — verify Bearer JWT and populate req.user
// ---------------------------------------------------------------------------

/**
 * Express middleware that verifies the Authorization Bearer token.
 *
 * On success: attaches `req.user` with `{ id, orgId, role, email }`.
 * On failure: passes an AppError to next() (caught by errorHandler).
 */
export function authenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next(
      new AppError(
        'Authorization header is missing or invalid. Expected: Bearer <token>',
        401,
        'UNAUTHORIZED'
      )
    );
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return next(new AppError('Bearer token is empty', 401, 'UNAUTHORIZED'));
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    // Ensure this is an access token, not a refresh token
    if (payload.type !== 'access') {
      return next(
        new AppError(
          'Invalid token type. Use an access token for API requests.',
          401,
          'INVALID_TOKEN'
        )
      );
    }

    const user: AuthenticatedUser = {
      id: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      email: payload.email,
    };

    req.user = user;

    logger.debug('Authenticated request', {
      userId: user.id,
      orgId: user.orgId,
      role: user.role,
      traceId: req.traceId,
    });

    next();
  } catch (err) {
    // Re-throw JWT errors so the global errorHandler can produce the right response
    next(err);
  }
}

// ---------------------------------------------------------------------------
// requireRole — RBAC role guard factory
// ---------------------------------------------------------------------------

/**
 * Middleware factory that restricts access to users with one of the specified roles.
 *
 * Must be used AFTER `authenticate` middleware.
 *
 * @example
 *   router.delete('/users/:id', authenticate, requireRole('super_admin', 'org_admin'), handler);
 */
export function requireRole(
  ...allowedRoles: UserRole[]
): (req: AuthenticatedRequest, res: Response, next: NextFunction) => void {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(
        new AppError(
          'requireRole used without authenticate middleware',
          500,
          'INTERNAL_ERROR',
          { isOperational: false }
        )
      );
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn('Role authorization denied', {
        userId: req.user.id,
        userRole: req.user.role,
        requiredRoles: allowedRoles,
        path: req.path,
        traceId: req.traceId,
      });

      return next(
        new AppError(
          `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
          403,
          'FORBIDDEN'
        )
      );
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// requireOrgAccess — org isolation guard
// ---------------------------------------------------------------------------

/**
 * Middleware that enforces organizational data isolation.
 *
 * It reads the `orgId` from:
 *   1. `req.params.orgId`
 *   2. `req.body.orgId`
 *   3. `req.query.orgId`
 *
 * Super admins bypass this check and have access to all organizations.
 *
 * Must be used AFTER `authenticate` middleware.
 */
export function requireOrgAccess(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    return next(
      new AppError(
        'requireOrgAccess used without authenticate middleware',
        500,
        'INTERNAL_ERROR',
        { isOperational: false }
      )
    );
  }

  // Super admins can access any organization
  if (req.user.role === UserRole.SUPER_ADMIN) {
    return next();
  }

  // Extract the target org ID from the request
  const targetOrgId =
    (req.params['orgId'] as string | undefined) ??
    (req.body as Record<string, unknown>)?.['orgId'] as string | undefined ??
    (req.query['orgId'] as string | undefined);

  if (!targetOrgId) {
    // No org ID in request — let the route handler handle it using req.user.orgId
    return next();
  }

  if (targetOrgId !== req.user.orgId) {
    logger.warn('Org access denied', {
      userId: req.user.id,
      userOrgId: req.user.orgId,
      requestedOrgId: targetOrgId,
      path: req.path,
      traceId: req.traceId,
    });

    return next(
      new AppError(
        'Access denied. You do not have permission to access this organization.',
        403,
        'FORBIDDEN'
      )
    );
  }

  next();
}

// ---------------------------------------------------------------------------
// optionalAuthenticate — non-blocking auth for public endpoints
// ---------------------------------------------------------------------------

/**
 * Like `authenticate`, but does NOT reject unauthenticated requests.
 * If a valid token is present, populates `req.user`; otherwise continues.
 * Useful for public endpoints that behave differently for authenticated users.
 */
export function optionalAuthenticate(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();

  if (!token) {
    return next();
  }

  try {
    const payload = jwt.verify(token, config.JWT_SECRET) as JwtPayload;

    if (payload.type === 'access') {
      req.user = {
        id: payload.sub,
        orgId: payload.orgId,
        role: payload.role,
        email: payload.email,
      };
    }
  } catch {
    // Silently ignore invalid tokens on optional auth endpoints
  }

  next();
}
