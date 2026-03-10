/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router, Request, Response, NextFunction } from 'express';
import express from 'express';
import { authenticate, requireRole } from '../middleware/auth';
import { validateBody } from '../middleware/validate';
import {
  createCheckoutSchema,
  purchaseCreditsSchema,
} from '../validators/billing.validators';
import * as billingService from '../services/billing.service';
import { AuthenticatedRequest, UserRole } from '../types';

const router = Router();

// Type-cast authenticate so TypeScript accepts it in route chains.
const auth = authenticate as any;

// ---------------------------------------------------------------------------
// POST /v1/billing/checkout  (admin, super_admin)
// ---------------------------------------------------------------------------

router.post(
  '/checkout',
  auth,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  validateBody(createCheckoutSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { priceId } = req.body as { priceId: string };
      const result = await billingService.createCheckoutSession(
        authReq.user.orgId,
        priceId,
        authReq.user
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/billing/portal  (admin, super_admin)
// ---------------------------------------------------------------------------

router.post(
  '/portal',
  auth,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await billingService.createBillingPortalSession(
        authReq.user.orgId,
        authReq.user
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/billing/subscription  (admin, super_admin)
// ---------------------------------------------------------------------------

router.get(
  '/subscription',
  auth,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const subscription = await billingService.getSubscription(
        authReq.user.orgId,
        authReq.user
      );
      res.status(200).json({ success: true, data: subscription });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/billing/credits/purchase  (admin, super_admin)
// ---------------------------------------------------------------------------

router.post(
  '/credits/purchase',
  auth,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  validateBody(purchaseCreditsSchema),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const { bundleId } = req.body as { bundleId: string };
      const result = await billingService.purchaseCredits(
        authReq.user.orgId,
        bundleId as billingService.CreditBundleId,
        authReq.user
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/billing/credits/balance  (admin, advisor, compliance — read-only)
// ---------------------------------------------------------------------------

router.get(
  '/credits/balance',
  auth,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN, UserRole.ADVISOR, UserRole.VIEWER) as any,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const result = await billingService.getCreditBalance(
        authReq.user.orgId,
        authReq.user
      );
      res.status(200).json({ success: true, data: result });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/billing/invoices  (admin, super_admin)
// ---------------------------------------------------------------------------

router.get(
  '/invoices',
  auth,
  requireRole(UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN) as any,
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const authReq = req as unknown as AuthenticatedRequest;
      const invoices = await billingService.getInvoices(
        authReq.user.orgId,
        authReq.user
      );
      res.status(200).json({ success: true, data: invoices });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// POST /v1/billing/webhook  (PUBLIC — Stripe webhook, raw body, HMAC only)
// ---------------------------------------------------------------------------

router.post(
  '/webhook',
  // Apply express.raw() BEFORE the global JSON parser processes this route.
  // This captures the raw Buffer needed for Stripe signature verification.
  express.raw({ type: '*/*' }),
  async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const signature = req.headers['stripe-signature'] as string | undefined;

      if (!signature) {
        res.status(400).json({
          success: false,
          error: { code: 'BAD_REQUEST', message: 'Missing stripe-signature header' },
        });
        return;
      }

      // req.body is a Buffer because express.raw() was applied above
      const rawBody: Buffer = req.body as Buffer;

      await billingService.handleWebhook(rawBody, signature);

      res.status(200).json({ success: true, data: { received: true } });
    } catch (err) {
      next(err);
    }
  }
);

// ---------------------------------------------------------------------------
// GET /v1/billing/plans  (PUBLIC)
// ---------------------------------------------------------------------------

router.get('/plans', (_req: Request, res: Response): void => {
  const plans = Object.entries(billingService.PLANS).map(([key, plan]) => ({
    id: key,
    name: plan.name,
    priceId: plan.priceId,
    amount: plan.amount,
  }));

  const bundles = Object.entries(billingService.CREDIT_BUNDLES).map(
    ([id, bundle]) => ({
      id,
      label: bundle.label,
      credits: bundle.credits,
      amount: bundle.amount,
    })
  );

  res.status(200).json({
    success: true,
    data: { plans, bundles },
  });
});

export default router;
