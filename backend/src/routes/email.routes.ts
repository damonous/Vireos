/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody, validateQuery } from '../middleware/validate';
import {
  createTemplateSchema,
  updateTemplateSchema,
  createSequenceSchema,
  updateSequenceSchema,
  addStepSchema,
  enrollLeadsSchema,
  paginationQuerySchema,
  unsubscribeSchema,
} from '../validators/email.validators';
import { emailTemplateService } from '../services/email-template.service';
import { emailSequenceService } from '../services/email-sequence.service';
import { emailService } from '../services/email.service';
import { AuthenticatedRequest, UserRole } from '../types';
import type { SendGridWebhookEvent } from '../services/email.service';

const router = Router();

// Type-cast middleware so TypeScript accepts it in route chains.
const auth = authenticate as any;
const adminOrAdvisor = requireRole(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.ADVISOR) as any;
const adminOnly = requireRole(UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN) as any;

// =============================================================================
// Email Templates
// =============================================================================

/**
 * POST /v1/email/templates
 * Create a new email template.
 */
router.post(
  '/templates',
  auth,
  adminOrAdvisor,
  validateBody(createTemplateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const template = await emailTemplateService.createTemplate(req.body, authReq.user);
      res.status(201).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/email/templates
 * List email templates for the authenticated user's org.
 */
router.get(
  '/templates',
  auth,
  validateQuery(paginationQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await emailTemplateService.listTemplates(
        authReq.user.orgId,
        authReq.user,
        req.query as any
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/email/templates/:id
 * Get a single email template by ID.
 */
router.get(
  '/templates/:id',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const template = await emailTemplateService.getTemplate(
        req.params['id'] as string,
        authReq.user
      );
      res.status(200).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /v1/email/templates/:id
 * Update an email template.
 */
router.put(
  '/templates/:id',
  auth,
  adminOrAdvisor,
  validateBody(updateTemplateSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const template = await emailTemplateService.updateTemplate(
        req.params['id'] as string,
        req.body,
        authReq.user
      );
      res.status(200).json({ success: true, data: template });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * DELETE /v1/email/templates/:id
 * Delete an email template (admin only).
 */
router.delete(
  '/templates/:id',
  auth,
  adminOnly,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      await emailTemplateService.deleteTemplate(req.params['id'] as string, authReq.user);
      res.status(200).json({ success: true, data: { message: 'Template deleted successfully.' } });
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// Email Sequences
// =============================================================================

/**
 * POST /v1/email/sequences
 * Create a new email drip sequence.
 */
router.post(
  '/sequences',
  auth,
  adminOrAdvisor,
  validateBody(createSequenceSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const sequence = await emailSequenceService.createSequence(req.body, authReq.user);
      res.status(201).json({ success: true, data: sequence });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/email/sequences
 * List email sequences for the authenticated user's org.
 */
router.get(
  '/sequences',
  auth,
  validateQuery(paginationQuerySchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await emailSequenceService.listSequences(
        authReq.user.orgId,
        authReq.user,
        req.query as any
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * GET /v1/email/sequences/:id
 * Get a single sequence with its steps.
 */
router.get(
  '/sequences/:id',
  auth,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const sequence = await emailSequenceService.getSequence(
        req.params['id'] as string,
        authReq.user
      );
      res.status(200).json({ success: true, data: sequence });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * PUT /v1/email/sequences/:id
 * Update a sequence's metadata or status.
 */
router.put(
  '/sequences/:id',
  auth,
  adminOrAdvisor,
  validateBody(updateSequenceSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const sequence = await emailSequenceService.updateSequence(
        req.params['id'] as string,
        req.body,
        authReq.user
      );
      res.status(200).json({ success: true, data: sequence });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/email/sequences/:id/steps
 * Add a step to a sequence.
 */
router.post(
  '/sequences/:id/steps',
  auth,
  adminOrAdvisor,
  validateBody(addStepSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const step = await emailSequenceService.addStep(
        req.params['id'] as string,
        req.body,
        authReq.user
      );
      res.status(201).json({ success: true, data: step });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/email/sequences/:id/enroll
 * Enroll one or more leads into a sequence.
 */
router.post(
  '/sequences/:id/enroll',
  auth,
  validateBody(enrollLeadsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { leadIds } = req.body as { leadIds: string[] };
      const sequenceId = req.params['id'] as string;

      if (leadIds.length === 1) {
        // Single lead enrollment
        const enrollment = await emailSequenceService.enrollLead(
          sequenceId,
          leadIds[0]!,
          authReq.user
        );
        res.status(201).json({ success: true, data: enrollment });
      } else {
        // Bulk enrollment
        const result = await emailSequenceService.enrollMultipleLeads(
          sequenceId,
          leadIds,
          authReq.user
        );
        res.status(200).json({ success: true, data: result });
      }
    } catch (err) {
      next(err);
    }
  }
);

// =============================================================================
// Webhooks (public — no auth)
// =============================================================================

/**
 * POST /v1/email/webhook/sendgrid
 * SendGrid event webhook. Processes delivery, open, click, bounce, spam events.
 * This endpoint must be public — SendGrid does not send auth headers.
 */
router.post(
  '/webhook/sendgrid',
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const events = req.body as SendGridWebhookEvent[];
      const eventArray = Array.isArray(events) ? events : [events as SendGridWebhookEvent];
      await emailService.handleWebhook(eventArray);
      // Always respond 200 quickly to prevent SendGrid retries
      res.status(200).json({ success: true, data: { processed: eventArray.length } });
    } catch (err) {
      next(err);
    }
  }
);

/**
 * POST /v1/email/unsubscribe
 * Unsubscribe handler. Called by unsubscribe links in emails.
 * Public endpoint — no authentication required.
 */
router.post(
  '/unsubscribe',
  validateBody(unsubscribeSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { email, orgId } = req.body as { email: string; orgId: string };
      await emailSequenceService.handleUnsubscribe(email, orgId);
      res.status(200).json({
        success: true,
        data: { message: 'You have been unsubscribed successfully.' },
      });
    } catch (err) {
      next(err);
    }
  }
);

export default router;
