import { Router, Request, Response } from 'express';
import { version } from '../../package.json';
import { authRateLimit } from '../middleware/rateLimiter';
import authRoutes from './auth.routes';
import orgRoutes from './org.routes';
import analyticsRoutes from './analytics.routes';
import billingRoutes from './billing.routes';
import reviewRoutes, { auditRouter } from './review.routes';
import leadRoutes from './lead.routes';
import contentRoutes from './content.routes';
import emailRoutes from './email.routes';
import publishRoutes from './publish.routes';
import oauthRoutes from './oauth.routes';
import prospectRoutes from './prospect.routes';
import healthRoutes from './health.routes';
import auditRoutes from './audit.routes';
import facebookAdRoutes from './facebook-ad.routes';
import linkedinCampaignRoutes from './linkedin-campaign.routes';
import agentRoutes from './agent.routes';
import adminRoutes from './admin.routes';
import featureFlagRoutes from './feature-flag.routes';
import notificationRoutes from './notification.routes';

// ---------------------------------------------------------------------------
// Root router
// ---------------------------------------------------------------------------

const router = Router();

// ---------------------------------------------------------------------------
// Health & metrics routes (public + super_admin)
// ---------------------------------------------------------------------------

/**
 * Health and observability endpoints.
 *   GET /health         — basic status (public)
 *   GET /health/live    — liveness probe (public)
 *   GET /health/ready   — DB + Redis readiness probe (public)
 *   GET /metrics        — metrics snapshot (super_admin only)
 */
router.use(healthRoutes);

// ---------------------------------------------------------------------------
// Legacy health check (kept for backward-compat — healthRoutes takes priority)
// ---------------------------------------------------------------------------

// Intentionally removed: health.routes.ts now owns GET /health.

// ---------------------------------------------------------------------------
// API v1 routes
// ---------------------------------------------------------------------------

/**
 * Authentication & user management
 * POST   /api/v1/auth/register
 * POST   /api/v1/auth/login
 * POST   /api/v1/auth/refresh
 * POST   /api/v1/auth/logout
 * POST   /api/v1/auth/forgot-password
 * POST   /api/v1/auth/reset-password
 * PATCH  /api/v1/auth/change-password
 * GET    /api/v1/auth/me
 */
router.use('/api/v1/auth', authRateLimit, authRoutes);

/**
 * Organization management
 * POST   /api/v1/organizations
 * GET    /api/v1/organizations/:orgId
 * PUT    /api/v1/organizations/:orgId
 * GET    /api/v1/organizations/:orgId/members
 * POST   /api/v1/organizations/:orgId/members/invite
 * PUT    /api/v1/organizations/:orgId/members/:userId/role
 * DELETE /api/v1/organizations/:orgId/members/:userId
 */
router.use('/api/v1/organizations', orgRoutes);

/**
 * Content library (AI-generated posts, templates)
 * POST   /api/v1/content/generate
 * GET    /api/v1/content/library
 * POST   /api/v1/content/library
 * PUT    /api/v1/content/library/:id
 * DELETE /api/v1/content/library/:id
 */
router.use('/api/v1/content', contentRoutes);

/**
 * Lead management & pipeline (FR-008)
 */
router.use('/api/v1/leads', leadRoutes);

/**
 * Analytics & reporting
 */
router.use('/api/v1/analytics', analyticsRoutes);

/**
 * Social Publishing Engine (FR-004)
 */
router.use('/api/v1/publish', publishRoutes);

/**
 * OAuth integrations (LinkedIn, Facebook)
 */
router.use('/api/v1/oauth', oauthRoutes);

/**
 * Subscription & billing
 */
router.use('/api/v1/billing', billingRoutes);

/**
 * Compliance review workflow (FR-003)
 */
router.use('/api/v1/reviews', reviewRoutes);

/**
 * Audit trail from review workflow (FR-003)
 * GET    /api/v1/audit-trail
 */
router.use('/api/v1/audit-trail', auditRouter);

/**
 * Audit trail — FR-012/FR-013 (Security Baseline + Observability)
 * GET    /api/v1/audit
 */
router.use('/api', auditRoutes);

/**
 * Prospect Finder Module (FR-007)
 */
router.use('/api', prospectRoutes);

/**
 * Email marketing & sequences (FR-009)
 */
router.use('/api/v1/email', emailRoutes);

/**
 * Facebook Ads with Lead Capture (FR-006)
 */
router.use('/api', facebookAdRoutes);

/**
 * LinkedIn Messaging Campaigns (FR-005)
 * POST   /api/v1/linkedin/campaigns
 * GET    /api/v1/linkedin/campaigns
 * GET    /api/v1/linkedin/campaigns/:campaignId
 * PUT    /api/v1/linkedin/campaigns/:campaignId
 * DELETE /api/v1/linkedin/campaigns/:campaignId
 * POST   /api/v1/linkedin/campaigns/:campaignId/activate
 * POST   /api/v1/linkedin/campaigns/:campaignId/pause
 * POST   /api/v1/linkedin/campaigns/:campaignId/enrollments
 * POST   /api/v1/linkedin/webhook/reply
 */
router.use('/api', linkedinCampaignRoutes);

/**
 * Agentic AI Easy Mode (FR-015)
 * POST   /api/v1/agent/command
 * GET    /api/v1/agent/conversations
 * GET    /api/v1/agent/conversations/:id
 * PATCH  /api/v1/agent/conversations/:id/archive
 */
router.use('/api/v1/agent', agentRoutes);
router.use('/api', adminRoutes);
router.use('/api', featureFlagRoutes);
router.use('/api/v1/notifications', notificationRoutes);

// ---------------------------------------------------------------------------
// 404 catch-all for undefined API routes
// ---------------------------------------------------------------------------

router.use('/api/{*path}', (_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'The requested API endpoint does not exist.',
    },
  });
});

export default router;
