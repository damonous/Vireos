import Stripe from 'stripe';
import {
  Organization,
  Subscription,
  CreditTransaction,
  SubscriptionStatus,
  CreditTransactionType,
  NotificationType,
  UserRole as PrismaUserRole,
} from '@prisma/client';
import { prisma } from '../db/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { UserRole } from '../types';
import type { AuthenticatedUser } from '../types';
import { findCreditBundle } from './platform-setting.service';

// ---------------------------------------------------------------------------
// Stripe client
// ---------------------------------------------------------------------------

const stripe = new Stripe(config.STRIPE_SECRET_KEY, {
  apiVersion: '2024-06-20' as Stripe.LatestApiVersion,
});

export type CreditBundleId = string;

// ---------------------------------------------------------------------------
// Pricing & Plan constants
// ---------------------------------------------------------------------------

export const PRICING = {
  basePriceId: process.env['STRIPE_PRICE_INDIVIDUAL'] ?? 'price_individual',
  seatPriceId: process.env['STRIPE_PRICE_TEAM'] ?? 'price_team',
  contactPriceId: process.env['STRIPE_PRICE_EXTRA_CONTACT'] ?? 'price_extra_contact',
  includedSeats: 3,
  baseAmount: 29900,
  seatAmount: 5000,
  contactAmount: 50,
  freeContacts: 500,
} as const;

export const PLANS = {
  platform: {
    priceId: PRICING.basePriceId,
    name: 'Vireos Platform',
    amount: 29900,
    features: [
      '$299/mo base platform (includes 3 users)',
      '$50/mo per additional user',
      '500 free contacts in first year',
      '$0.50/mo per additional contact',
      'AI content generation',
      'LinkedIn & Facebook publishing',
      'Compliance review workflow',
      'Email campaigns',
      'Analytics & reports',
    ],
  },
} as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps a Stripe subscription status string to our Prisma SubscriptionStatus enum.
 */
function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'past_due':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
    case 'cancelled':
      return SubscriptionStatus.CANCELLED;
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'incomplete':
    case 'incomplete_expired':
    case 'unpaid':
      return SubscriptionStatus.INCOMPLETE;
    default:
      return SubscriptionStatus.INCOMPLETE;
  }
}

// ---------------------------------------------------------------------------
// Authorization helpers
// ---------------------------------------------------------------------------

const ADMIN_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];
const READ_ROLES: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.ADVISOR, UserRole.VIEWER];

function requireAdminRole(user: AuthenticatedUser): void {
  if (!ADMIN_ROLES.includes(user.role)) {
    throw Errors.forbidden('Admin role required for this billing operation');
  }
}

function requireReadRole(user: AuthenticatedUser): void {
  if (!READ_ROLES.includes(user.role)) {
    throw Errors.forbidden('Insufficient permissions to access billing information');
  }
}

// ---------------------------------------------------------------------------
// BillingService
// ---------------------------------------------------------------------------

/**
 * Returns the Stripe customer ID for the organization, creating a new
 * Stripe customer record if one does not yet exist.
 */
export async function getOrCreateCustomer(org: Organization): Promise<string> {
  if (org.stripeCustomerId) {
    return org.stripeCustomerId;
  }

  logger.info('Creating Stripe customer for organization', { orgId: org.id, name: org.name });

  const customer = await stripe.customers.create({
    name: org.name,
    metadata: {
      organizationId: org.id,
      slug: org.slug,
    },
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });

  logger.info('Stripe customer created', { orgId: org.id, customerId: customer.id });

  return customer.id;
}

/**
 * Creates a Stripe Checkout session for the Vireos Platform subscription.
 * Builds multi-line-item checkout: base plan + optional additional seats.
 */
export async function createCheckoutSession(
  orgId: string,
  additionalSeats: number,
  user: AuthenticatedUser
): Promise<{ url: string }> {
  requireAdminRole(user);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw Errors.notFound('Organization');
  }

  const customerId = await getOrCreateCustomer(org);

  const successUrl =
    `${config.API_BASE_URL}/home?subscription=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    `${config.API_BASE_URL}/billing?checkout=cancelled`;

  const lineItems: Array<{ price: string; quantity: number }> = [
    { price: PRICING.basePriceId, quantity: 1 },
  ];

  if (additionalSeats > 0) {
    lineItems.push({ price: PRICING.seatPriceId, quantity: additionalSeats });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'subscription',
    payment_method_types: ['card'],
    line_items: lineItems,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organizationId: orgId,
      userId: user.id,
      type: 'subscription',
      additionalSeats: String(additionalSeats),
    },
  });

  if (!session.url) {
    throw Errors.internal('Stripe did not return a checkout URL');
  }

  logger.info('Checkout session created', {
    orgId,
    sessionId: session.id,
    additionalSeats,
  });

  return { url: session.url };
}

/**
 * Creates a Stripe Billing Portal session so admins can manage their subscription.
 * Returns the portal URL for redirection.
 */
export async function createBillingPortalSession(
  orgId: string,
  user: AuthenticatedUser
): Promise<{ url: string }> {
  requireAdminRole(user);

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw Errors.notFound('Organization');
  }

  const customerId = await getOrCreateCustomer(org);

  const returnUrl = `${config.API_BASE_URL}/billing?portal=returned`;

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  logger.info('Billing portal session created', { orgId, sessionId: session.id });

  return { url: session.url };
}

/**
 * Returns the current Subscription record for the organization, or null if none exists.
 */
export async function getSubscription(
  orgId: string,
  user: AuthenticatedUser
): Promise<Subscription | null> {
  requireReadRole(user);

  const subscription = await prisma.subscription.findUnique({
    where: { organizationId: orgId },
  });

  return reconcileSubscription(orgId, subscription);
}

/**
 * Creates a Stripe Checkout session for a one-time credit bundle purchase.
 * Credits are added to the organization balance when the webhook confirms payment.
 */
export async function purchaseCredits(
  orgId: string,
  bundleId: CreditBundleId,
  user: AuthenticatedUser
): Promise<{ url: string }> {
  requireAdminRole(user);

  const bundle = await findCreditBundle(bundleId);
  if (!bundle) {
    throw Errors.badRequest(`Invalid bundle ID: ${bundleId}`);
  }

  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw Errors.notFound('Organization');
  }

  const customerId = await getOrCreateCustomer(org);

  const successUrl =
    `${config.API_BASE_URL}/billing?checkout=success&session_id={CHECKOUT_SESSION_ID}`;
  const cancelUrl =
    `${config.API_BASE_URL}/billing?checkout=cancelled`;

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: 'payment',
    payment_method_types: ['card'],
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: bundle.label,
            description: `${bundle.credits.toLocaleString()} credits for ${org.name}`,
          },
          unit_amount: bundle.amount,
        },
        quantity: 1,
      },
    ],
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      organizationId: orgId,
      userId: user.id,
      type: 'credit_purchase',
      bundleId,
      credits: String(bundle.credits),
    },
  });

  if (!session.url) {
    throw Errors.internal('Stripe did not return a checkout URL');
  }

  logger.info('Credit purchase checkout session created', {
    orgId,
    bundleId,
    credits: bundle.credits,
    sessionId: session.id,
  });

  return { url: session.url };
}

/**
 * Returns the current credit balance and recent transaction history for an organization.
 */
export async function getCreditBalance(
  orgId: string,
  user: AuthenticatedUser
): Promise<{ balance: number; transactions: CreditTransaction[] }> {
  requireReadRole(user);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { creditBalance: true },
  });

  if (!org) {
    throw Errors.notFound('Organization');
  }

  const transactions = await prisma.creditTransaction.findMany({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  return { balance: org.creditBalance, transactions };
}

/**
 * Atomically deducts credits from an organization's balance.
 *
 * - Verifies sufficient balance first; throws 402 Payment Required if insufficient.
 * - Decrements Organization.creditBalance and creates a CreditTransaction in a
 *   single Prisma $transaction to guarantee atomicity.
 */
export async function deductCredits(
  orgId: string,
  amount: number,
  description: string,
  userId?: string,
  metadata?: object
): Promise<CreditTransaction> {
  if (amount <= 0) {
    throw Errors.badRequest('Deduction amount must be greater than zero');
  }

  // Use a Prisma interactive transaction to ensure atomicity
  return prisma.$transaction(async (tx) => {
    // Lock the organization row and check balance
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { creditBalance: true },
    });

    if (!org) {
      throw Errors.notFound('Organization');
    }

    const currentBalance = org.creditBalance;
    if (currentBalance < amount) {
      const insufficientErr = Object.assign(
        new Error(
          `Insufficient credits. Required: ${amount}, available: ${currentBalance}`
        ),
        {
          name: 'AppError',
          statusCode: 402,
          code: 'PAYMENT_REQUIRED',
          isOperational: true,
          details: { required: amount, available: currentBalance },
        }
      );
      throw insufficientErr;
    }

    const newBalance = org.creditBalance - amount;

    // Update balance atomically
    await tx.organization.update({
      where: { id: orgId },
      data: { creditBalance: newBalance },
    });

    // Record the transaction
    const transaction = await tx.creditTransaction.create({
      data: {
        organizationId: orgId,
        userId: userId ?? null,
        type: CreditTransactionType.DEBIT,
        amount: -amount,
        balanceAfter: newBalance,
        description,
        metadata: (metadata ?? {}) as object,
      },
    });

    logger.info('Credits deducted', {
      orgId,
      amount,
      newBalance,
      transactionId: transaction.id,
    });

    return transaction;
  });
}

/**
 * Atomically adds credits to an organization's balance.
 *
 * Increments Organization.creditBalance and creates a CreditTransaction in a
 * single Prisma $transaction to guarantee atomicity.
 */
export async function addCredits(
  orgId: string,
  amount: number,
  description: string,
  userId?: string,
  metadata?: object
): Promise<CreditTransaction> {
  if (amount <= 0) {
    throw Errors.badRequest('Credit amount must be greater than zero');
  }

  return prisma.$transaction(async (tx) => {
    const org = await tx.organization.findUnique({
      where: { id: orgId },
      select: { creditBalance: true },
    });

    if (!org) {
      throw Errors.notFound('Organization');
    }

    const newBalance = org.creditBalance + amount;

    await tx.organization.update({
      where: { id: orgId },
      data: { creditBalance: newBalance },
    });

    const transaction = await tx.creditTransaction.create({
      data: {
        organizationId: orgId,
        userId: userId ?? null,
        type: CreditTransactionType.PURCHASE,
        amount,
        balanceAfter: newBalance,
        description,
        metadata: (metadata ?? {}) as object,
      },
    });

    logger.info('Credits added', {
      orgId,
      amount,
      newBalance,
      transactionId: transaction.id,
    });

    return transaction;
  });
}

/**
 * Retrieves the list of Stripe invoices for the organization's customer.
 */
export async function getInvoices(
  orgId: string,
  user: AuthenticatedUser
): Promise<Stripe.Invoice[]> {
  requireReadRole(user);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { stripeCustomerId: true },
  });

  if (!org) {
    throw Errors.notFound('Organization');
  }

  if (!org.stripeCustomerId) {
    // No Stripe customer yet — return empty list
    return [];
  }

  const invoiceList = await stripe.invoices.list({
    customer: org.stripeCustomerId,
    limit: 24,
  });

  return invoiceList.data;
}

// ---------------------------------------------------------------------------
// Webhook handler
// ---------------------------------------------------------------------------

/**
 * Handles incoming Stripe webhook events.
 *
 * Verifies the HMAC signature, then dispatches to the appropriate handler
 * for each event type. Unknown event types are logged and ignored gracefully.
 */
export async function handleWebhook(
  rawBody: Buffer,
  signature: string
): Promise<void> {
  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      signature,
      config.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.warn('Stripe webhook signature verification failed', { message });
    throw Errors.badRequest(`Webhook signature verification failed: ${message}`);
  }

  logger.info('Processing Stripe webhook event', {
    eventId: event.id,
    eventType: event.type,
  });

  try {
    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case 'payment_intent.payment_failed':
        await handlePaymentIntentFailed(event.data.object as Stripe.PaymentIntent);
        break;

      default:
        logger.debug('Unhandled Stripe webhook event type', { eventType: event.type });
        break;
    }
  } catch (err) {
    logger.error('Error processing Stripe webhook event', {
      eventId: event.id,
      eventType: event.type,
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Webhook event handlers
// ---------------------------------------------------------------------------

async function handleSubscriptionCreated(sub: Stripe.Subscription): Promise<void> {
  const orgId = await resolveOrgIdFromCustomer(sub.customer as string);
  if (!orgId) {
    logger.warn('subscription.created: no org found for customer', {
      customerId: sub.customer,
    });
    return;
  }

  await persistSubscriptionSnapshot(orgId, sub);

  logger.info('Subscription created', { orgId, subscriptionId: sub.id, status: sub.status });
}

async function handleSubscriptionUpdated(sub: Stripe.Subscription): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  if (!existing) {
    // Subscription not in our DB — treat as a create
    await handleSubscriptionCreated(sub);
    return;
  }

  const priceId = sub.items.data[0]?.price.id ?? existing.stripePriceId;
  const planName = resolvePlanName(priceId);
  const newStatus = mapStripeStatus(sub.status);

  // Calculate total seats from subscription items
  const seatItem = sub.items.data.find((item) => item.price.id === PRICING.seatPriceId);
  const extraSeats = seatItem?.quantity ?? 0;
  const totalSeats = PRICING.includedSeats + extraSeats;

  await prisma.subscription.update({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status: newStatus,
      stripePriceId: priceId,
      planName,
      seatQuantity: totalSeats,
      currentPeriodStart: new Date((sub.current_period_start ?? 0) * 1000),
      currentPeriodEnd: new Date((sub.current_period_end ?? 0) * 1000),
      cancelAtPeriodEnd: sub.cancel_at_period_end,
      cancelledAt:
        sub.canceled_at ? new Date(sub.canceled_at * 1000) : existing.cancelledAt,
      trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : existing.trialEndsAt,
    },
  });

  await prisma.organization.update({
    where: { id: existing.organizationId },
    data: { subscriptionStatus: newStatus, seatLimit: totalSeats },
  });

  logger.info('Subscription updated', {
    orgId: existing.organizationId,
    subscriptionId: sub.id,
    status: sub.status,
  });
}

async function handleSubscriptionDeleted(sub: Stripe.Subscription): Promise<void> {
  const existing = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId: sub.id },
  });

  if (!existing) {
    logger.warn('subscription.deleted: subscription not found in DB', {
      subscriptionId: sub.id,
    });
    return;
  }

  await prisma.subscription.update({
    where: { stripeSubscriptionId: sub.id },
    data: {
      status: SubscriptionStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelAtPeriodEnd: false,
    },
  });

  await prisma.organization.update({
    where: { id: existing.organizationId },
    data: { subscriptionStatus: SubscriptionStatus.CANCELLED },
  });

  logger.info('Subscription cancelled', {
    orgId: existing.organizationId,
    subscriptionId: sub.id,
  });
}

async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice): Promise<void> {
  // Only process credit purchase payments (not subscription renewals)
  const sessionId = invoice.metadata?.['checkout_session_id'] as string | undefined;

  // Check if there is a completed checkout session metadata indicating a credit purchase
  // Stripe attaches metadata via checkout session to the payment intent
  const paymentIntentId =
    typeof invoice.payment_intent === 'string'
      ? invoice.payment_intent
      : invoice.payment_intent?.id;

  if (!paymentIntentId) {
    return;
  }

  let checkoutMetadata: Stripe.Metadata | null = null;

  // Look up the payment intent to retrieve the checkout session metadata
  try {
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
    // Check metadata on the payment intent directly
    if (paymentIntent.metadata?.['type'] === 'credit_purchase') {
      checkoutMetadata = paymentIntent.metadata;
    }
  } catch (err) {
    logger.warn('Could not retrieve payment intent for invoice', {
      paymentIntentId,
      error: err instanceof Error ? err.message : String(err),
    });
    return;
  }

  if (!checkoutMetadata) {
    // Not a credit purchase — skip
    logger.debug('invoice.payment_succeeded: not a credit purchase, skipping', {
      invoiceId: invoice.id,
      sessionId,
    });
    return;
  }

  const orgId = checkoutMetadata['organizationId'];
  const bundleId = checkoutMetadata['bundleId'] as CreditBundleId | undefined;
  const creditsStr = checkoutMetadata['credits'];
  const userId = checkoutMetadata['userId'] as string | undefined;

  if (!orgId || !bundleId || !creditsStr) {
    logger.warn('invoice.payment_succeeded: missing metadata for credit purchase', {
      invoiceId: invoice.id,
      checkoutMetadata,
    });
    return;
  }

  const credits = parseInt(creditsStr, 10);
  if (isNaN(credits) || credits <= 0) {
    logger.warn('invoice.payment_succeeded: invalid credits value in metadata', {
      invoiceId: invoice.id,
      creditsStr,
    });
    return;
  }

  const bundle = await findCreditBundle(bundleId);
  const description = bundle
    ? `Credit purchase: ${bundle.label}`
    : `Credit purchase: ${credits} credits`;

  await addCredits(orgId, credits, description, userId, {
    invoiceId: invoice.id,
    paymentIntentId,
    bundleId,
  });

  logger.info('Credits added from invoice payment', {
    orgId,
    credits,
    bundleId,
    invoiceId: invoice.id,
  });
}

async function handlePaymentIntentFailed(paymentIntent: Stripe.PaymentIntent): Promise<void> {
  logger.warn('Payment intent failed', {
    paymentIntentId: paymentIntent.id,
    customerId: paymentIntent.customer,
    amount: paymentIntent.amount,
    currency: paymentIntent.currency,
    lastPaymentError: paymentIntent.last_payment_error?.message,
  });

  const customerId =
    typeof paymentIntent.customer === 'string'
      ? paymentIntent.customer
      : paymentIntent.customer?.id;

  if (!customerId) {
    return;
  }

  const orgId = await resolveOrgIdFromCustomer(customerId);
  if (!orgId) {
    logger.warn('payment_intent.failed: no org found for customer', { customerId });
    return;
  }

  // Update organization subscription status to PAST_DUE
  await prisma.organization.update({
    where: { id: orgId },
    data: { subscriptionStatus: SubscriptionStatus.PAST_DUE },
  });

  // Also update the Subscription record if it exists
  await prisma.subscription.updateMany({
    where: { organizationId: orgId },
    data: { status: SubscriptionStatus.PAST_DUE },
  });

  // Find all admin users in the organization to notify
  const adminUsers = await prisma.user.findMany({
    where: {
      organizationId: orgId,
      role: { in: [PrismaUserRole.ADMIN, PrismaUserRole.SUPER_ADMIN] },
    },
    select: { id: true },
  });

  // Create a PAYMENT_FAILED notification for each admin user
  if (adminUsers.length > 0) {
    await prisma.notification.createMany({
      data: adminUsers.map((u) => ({
        userId: u.id,
        organizationId: orgId,
        type: NotificationType.PAYMENT_FAILED,
        title: 'Payment Failed',
        body:
          'A payment failed for your organization. Please update your payment method to continue using Vireos.',
        metadata: {
          paymentIntentId: paymentIntent.id,
          amount: paymentIntent.amount,
          currency: paymentIntent.currency,
          errorMessage: paymentIntent.last_payment_error?.message ?? null,
        },
      })),
    });
  }

  logger.warn('Organization marked PAST_DUE due to payment failure', {
    orgId,
    paymentIntentId: paymentIntent.id,
    adminUsersNotified: adminUsers.length,
  });
}

function buildSubscriptionSnapshot(
  orgId: string,
  sub: Stripe.Subscription
): Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'> {
  const priceId = sub.items.data[0]?.price.id ?? '';
  const planName = resolvePlanName(priceId);

  // Calculate total seats from subscription items
  const seatItem = sub.items.data.find((item) => item.price.id === PRICING.seatPriceId);
  const extraSeats = seatItem?.quantity ?? 0;
  const totalSeats = PRICING.includedSeats + extraSeats;

  return {
    organizationId: orgId,
    stripeSubscriptionId: sub.id,
    stripePriceId: priceId,
    seatQuantity: totalSeats,
    status: mapStripeStatus(sub.status),
    planName,
    currentPeriodStart: new Date((sub.current_period_start ?? 0) * 1000),
    currentPeriodEnd: new Date((sub.current_period_end ?? 0) * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end,
    cancelledAt: sub.canceled_at ? new Date(sub.canceled_at * 1000) : null,
    trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
  };
}

async function persistSubscriptionSnapshot(
  orgId: string,
  sub: Stripe.Subscription
): Promise<Subscription> {
  const snapshot = buildSubscriptionSnapshot(orgId, sub);

  const subscription = await prisma.subscription.upsert({
    where: { organizationId: orgId },
    create: snapshot,
    update: snapshot,
  });

  // Update org seatLimit and set subscriptionStartedAt (once, on first subscription)
  const orgUpdateData: Record<string, unknown> = {
    subscriptionStatus: snapshot.status,
    stripeSubscriptionId: snapshot.stripeSubscriptionId,
    seatLimit: snapshot.seatQuantity,
  };

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { subscriptionStartedAt: true },
  });
  if (org && !org.subscriptionStartedAt) {
    orgUpdateData['subscriptionStartedAt'] = new Date();
  }

  await prisma.organization.update({
    where: { id: orgId },
    data: orgUpdateData,
  });

  return subscription;
}

async function reconcileSubscription(
  orgId: string,
  localSubscription: Subscription | null
): Promise<Subscription | null> {
  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      id: true,
      stripeCustomerId: true,
      stripeSubscriptionId: true,
    },
  });

  if (!org) {
    throw Errors.notFound('Organization');
  }

  const stripeSubscriptionId = org.stripeSubscriptionId ?? localSubscription?.stripeSubscriptionId;
  if (stripeSubscriptionId) {
    try {
      const stripeSubscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      return persistSubscriptionSnapshot(orgId, stripeSubscription);
    } catch (err) {
      logger.warn('Failed to retrieve Stripe subscription directly, falling back to customer list', {
        orgId,
        stripeSubscriptionId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (!org.stripeCustomerId) {
    return localSubscription;
  }

  try {
    const subscriptionList = await stripe.subscriptions.list({
      customer: org.stripeCustomerId,
      status: 'all',
      limit: 10,
    });

    const activeLikeSubscription = subscriptionList.data.find((sub) =>
      ['active', 'trialing', 'past_due', 'unpaid', 'incomplete'].includes(sub.status)
    );
    const stripeSubscription = activeLikeSubscription ?? subscriptionList.data[0] ?? null;

    if (!stripeSubscription) {
      return localSubscription;
    }

    return persistSubscriptionSnapshot(orgId, stripeSubscription);
  } catch (err) {
    logger.warn('Failed to reconcile Stripe subscription from customer list', {
      orgId,
      stripeCustomerId: org.stripeCustomerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return localSubscription;
  }
}

// ---------------------------------------------------------------------------
// Private helpers
// ---------------------------------------------------------------------------

/**
 * Resolves the internal organization ID from a Stripe customer ID.
 */
async function resolveOrgIdFromCustomer(customerId: string): Promise<string | null> {
  const org = await prisma.organization.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });
  return org?.id ?? null;
}

/**
 * Returns a usage summary for the organization: seats and contacts.
 */
export async function getUsageSummary(
  orgId: string,
  user: AuthenticatedUser
): Promise<{
  seats: { used: number; limit: number; additionalAvailable: number };
  contacts: { total: number; freeLimit: number; overage: number; isFirstYear: boolean };
}> {
  requireReadRole(user);

  const org = await prisma.organization.findUnique({
    where: { id: orgId },
    select: { seatLimit: true, freeContactLimit: true, subscriptionStartedAt: true },
  });

  if (!org) {
    throw Errors.notFound('Organization');
  }

  const [userCount, leadCount] = await Promise.all([
    prisma.user.count({ where: { organizationId: orgId } }),
    prisma.lead.count({ where: { organizationId: orgId } }),
  ]);

  const isFirstYear = org.subscriptionStartedAt
    ? new Date().getTime() - org.subscriptionStartedAt.getTime() < 365 * 24 * 60 * 60 * 1000
    : true;

  const freeLimit = isFirstYear ? org.freeContactLimit : 0;
  const overage = Math.max(0, leadCount - freeLimit);

  return {
    seats: {
      used: userCount,
      limit: org.seatLimit,
      additionalAvailable: Math.max(0, org.seatLimit - userCount),
    },
    contacts: {
      total: leadCount,
      freeLimit,
      overage,
      isFirstYear,
    },
  };
}

/**
 * Resolves a human-readable plan name from a Stripe price ID.
 */
function resolvePlanName(priceId: string): string {
  if (priceId === PRICING.basePriceId) return 'Vireos Platform';
  if (priceId === PRICING.seatPriceId) return 'Additional Seat';
  if (priceId === PRICING.contactPriceId) return 'Extra Contact';

  for (const [, plan] of Object.entries(PLANS)) {
    if (plan.priceId === priceId) {
      return plan.name;
    }
  }
  // Fallback — use the price ID itself
  return priceId;
}
