/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import * as socialConnectionService from '../services/social-connection.service';
import { Errors } from '../middleware/errorHandler';
import { AuthenticatedRequest, UserRole } from '../types';

const router = Router();

// Cast authenticate for use in route chains
const auth = authenticate as any;
const advisorOrAdmin = requireRole(
  UserRole.ADVISOR,
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN
) as any;
const allRoles = requireRole(
  UserRole.ADVISOR,
  UserRole.ORG_ADMIN,
  UserRole.SUPER_ADMIN,
  UserRole.VIEWER
) as any;

// ---------------------------------------------------------------------------
// GET /v1/oauth/linkedin — get LinkedIn authorization URL (advisor, admin)
// ---------------------------------------------------------------------------

router.get(
  '/linkedin',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const url = socialConnectionService.getAuthorizationUrl(
        'LINKEDIN',
        authReq.user.id,
        authReq.user.orgId
      );
      res.status(200).json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/oauth/linkedin/callback — OAuth callback (public)
// ---------------------------------------------------------------------------

router.get(
  '/linkedin/callback',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code, state, error, error_description } = req.query as Record<
        string,
        string | undefined
      >;

      // Handle OAuth error from LinkedIn (e.g., user denied access)
      if (error) {
        throw Errors.badRequest(
          `LinkedIn OAuth error: ${error}. ${error_description ?? ''}`
        );
      }

      if (!code || !state) {
        throw Errors.badRequest('Missing code or state parameter in LinkedIn callback.');
      }

      const connection = await socialConnectionService.handleCallback(
        'LINKEDIN',
        code,
        state
      );

      res.status(200).json({
        success: true,
        data: {
          connectionId: connection.id,
          platform: connection.platform,
          platformUsername: connection.platformUsername,
          message: 'LinkedIn account connected successfully.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/oauth/facebook — get Facebook authorization URL (advisor, admin)
// ---------------------------------------------------------------------------

router.get(
  '/facebook',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const url = socialConnectionService.getAuthorizationUrl(
        'FACEBOOK',
        authReq.user.id,
        authReq.user.orgId
      );
      res.status(200).json({ success: true, data: { url } });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/oauth/facebook/callback — OAuth callback (public)
// ---------------------------------------------------------------------------

router.get(
  '/facebook/callback',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { code, state, error, error_description } = req.query as Record<
        string,
        string | undefined
      >;

      if (error) {
        throw Errors.badRequest(
          `Facebook OAuth error: ${error}. ${error_description ?? ''}`
        );
      }

      if (!code || !state) {
        throw Errors.badRequest('Missing code or state parameter in Facebook callback.');
      }

      const connection = await socialConnectionService.handleCallback(
        'FACEBOOK',
        code,
        state
      );

      res.status(200).json({
        success: true,
        data: {
          connectionId: connection.id,
          platform: connection.platform,
          platformUsername: connection.platformUsername,
          message: 'Facebook account connected successfully.',
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// DELETE /v1/oauth/:platform — disconnect a social connection (advisor, admin)
// ---------------------------------------------------------------------------

router.delete(
  '/:platform',
  auth,
  advisorOrAdmin,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const platform = req.params['platform'] as string;

      const platformUpper = (platform ?? '').toUpperCase() as 'LINKEDIN' | 'FACEBOOK';

      if (platformUpper !== 'LINKEDIN' && platformUpper !== 'FACEBOOK') {
        throw Errors.badRequest(
          `Invalid platform: ${platform}. Must be 'linkedin' or 'facebook'.`
        );
      }

      // Find the connection for this user + platform
      const connection = await socialConnectionService.getConnection(
        authReq.user.id,
        platformUpper
      );

      if (!connection) {
        throw Errors.notFound(`${platformUpper} connection`);
      }

      await socialConnectionService.disconnect(connection.id, authReq.user);

      res.status(200).json({
        success: true,
        data: {
          message: `${platformUpper} account disconnected successfully.`,
        },
      });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/oauth/connections — list connections for user (all roles)
// ---------------------------------------------------------------------------

router.get(
  '/connections',
  auth,
  allRoles,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;

      const connections = await socialConnectionService.listConnections(
        authReq.user.id,
        authReq.user.orgId
      );

      // Omit encrypted token fields from the response
      const safeConnections = connections.map((c) => ({
        id: c.id,
        platform: c.platform,
        platformUserId: c.platformUserId,
        platformUsername: c.platformUsername,
        scopes: c.scopes,
        isActive: c.isActive,
        tokenExpiresAt: c.tokenExpiresAt,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      }));

      res.status(200).json({ success: true, data: safeConnections });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
