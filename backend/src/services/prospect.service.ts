import { parse } from 'csv-parse/sync';
import {
  ProspectListRequest,
  ProspectRequestStatus,
  SubscriptionStatus,
  AuditAction,
  LeadSource,
  CreditTransactionType,
  NotificationType,
} from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Errors, AppError } from '../middleware/errorHandler';
import { AuthenticatedUser, UserRole } from '../types';
import type {
  CreateProspectRequestDto,
  AdminListRequestsQuery,
} from '../validators/prospect.validators';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

export interface AdminRequestFilters {
  status?: ProspectRequestStatus;
  orgId?: string;
}

export interface ParsedProspect {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Writes an audit trail record. Failures are swallowed so they never break
 * the primary operation — consistent with the auth service pattern.
 */
async function writeAuditTrail(params: {
  organizationId: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit trail', {
      error: err instanceof Error ? err.message : String(err),
      params,
    });
  }
}

// ---------------------------------------------------------------------------
// Prospect Service
// ---------------------------------------------------------------------------

/**
 * Creates a new prospect list request for the requesting user's organization.
 *
 * Validates that the organization has an ACTIVE or TRIALING subscription
 * before allowing the request. Sets initial status to PENDING and notifies
 * Vireos staff via structured Winston log.
 */
export async function createRequest(
  dto: CreateProspectRequestDto,
  user: AuthenticatedUser
): Promise<ProspectListRequest> {
  // Validate subscription status
  const org = await prisma.organization.findUnique({
    where: { id: user.orgId },
    select: { id: true, name: true, subscriptionStatus: true },
  });

  if (!org) {
    throw Errors.notFound('Organization');
  }

  const allowedStatuses: SubscriptionStatus[] = [
    SubscriptionStatus.ACTIVE,
    SubscriptionStatus.TRIALING,
  ];

  if (!allowedStatuses.includes(org.subscriptionStatus)) {
    throw Errors.forbidden(
      `Prospect list requests require an active subscription. Current status: ${org.subscriptionStatus}.`
    );
  }

  // Create the request
  const request = await prisma.prospectListRequest.create({
    data: {
      organizationId: user.orgId,
      requestedById: user.id,
      criteria: dto.criteria as object,
      status: ProspectRequestStatus.PENDING,
      requestedCount: dto.requestedCount,
      notes: dto.notes ?? null,
    },
  });

  // Notify Vireos staff with full structured criteria
  logger.info('PROSPECT_REQUEST: New prospect list request submitted', {
    requestId: request.id,
    orgId: user.orgId,
    orgName: org.name,
    requestedById: user.id,
    requestedCount: dto.requestedCount,
    criteria: dto.criteria,
    notes: dto.notes ?? null,
  });

  // Write audit trail
  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'ProspectListRequest',
    entityId: request.id,
    action: AuditAction.CREATED,
    metadata: {
      requestedCount: dto.requestedCount,
      criteria: dto.criteria,
    },
  });

  return request;
}

/**
 * Lists prospect list requests scoped to the authenticated user's organization.
 */
export async function listRequests(
  orgId: string,
  user: AuthenticatedUser,
  pagination: PaginationParams
): Promise<PaginatedResult<ProspectListRequest>> {
  // Org-scoped — non-super_admin users can only see their own org's requests
  const targetOrgId =
    user.role === UserRole.SUPER_ADMIN ? orgId : user.orgId;

  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [items, totalCount] = await Promise.all([
    prisma.prospectListRequest.findMany({
      where: { organizationId: targetOrgId },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.prospectListRequest.count({
      where: { organizationId: targetOrgId },
    }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: items,
    meta: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Fetches a single prospect list request, enforcing org isolation.
 * Super admins can retrieve any request.
 */
export async function getRequest(
  requestId: string,
  user: AuthenticatedUser
): Promise<ProspectListRequest> {
  const request = await prisma.prospectListRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw Errors.notFound('ProspectListRequest');
  }

  if (
    user.role !== UserRole.SUPER_ADMIN &&
    request.organizationId !== user.orgId
  ) {
    throw Errors.forbidden('Access denied to this prospect list request.');
  }

  return request;
}

/**
 * Cancels a PENDING prospect list request.
 * Only the owning organization (advisor or admin) may cancel.
 * Super admins may cancel any pending request.
 */
export async function cancelRequest(
  requestId: string,
  user: AuthenticatedUser
): Promise<ProspectListRequest> {
  const request = await prisma.prospectListRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw Errors.notFound('ProspectListRequest');
  }

  if (
    user.role !== UserRole.SUPER_ADMIN &&
    request.organizationId !== user.orgId
  ) {
    throw Errors.forbidden('Access denied to this prospect list request.');
  }

  if (request.status !== ProspectRequestStatus.PENDING) {
    throw Errors.conflict(
      `Cannot cancel a request with status '${request.status}'. Only PENDING requests can be cancelled.`
    );
  }

  const updated = await prisma.prospectListRequest.update({
    where: { id: requestId },
    data: { status: ProspectRequestStatus.CANCELLED },
  });

  await writeAuditTrail({
    organizationId: request.organizationId,
    actorId: user.id,
    entityType: 'ProspectListRequest',
    entityId: requestId,
    action: AuditAction.STATUS_CHANGED,
    metadata: {
      previousStatus: ProspectRequestStatus.PENDING,
      newStatus: ProspectRequestStatus.CANCELLED,
    },
  });

  logger.info('Prospect list request cancelled', {
    requestId,
    orgId: request.organizationId,
    cancelledBy: user.id,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Super Admin fulfillment operations
// ---------------------------------------------------------------------------

/**
 * Lists all prospect list requests across all organizations for super admin review.
 * Supports filtering by status and orgId, with pagination.
 */
export async function listAllRequests(
  filters: AdminRequestFilters,
  pagination: PaginationParams,
  user: AuthenticatedUser
): Promise<PaginatedResult<ProspectListRequest & { organization: { name: string } }>> {
  if (user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.forbidden('Super admin access required.');
  }

  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const where = {
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.orgId ? { organizationId: filters.orgId } : {}),
  };

  const [items, totalCount] = await Promise.all([
    prisma.prospectListRequest.findMany({
      where,
      include: {
        organization: {
          select: { name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.prospectListRequest.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: items,
    meta: {
      page,
      limit,
      totalCount,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    },
  };
}

/**
 * Parses a CSV buffer into an array of prospect records.
 *
 * Expected columns: firstName, lastName, email, phone?, company?, title?, linkedinUrl?
 * Rows with missing email are silently skipped.
 */
async function parseCsvToLeads(csvBuffer: Buffer): Promise<ParsedProspect[]> {
  const records = parse(csvBuffer, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];

  const prospects: ParsedProspect[] = [];

  for (const row of records) {
    const firstName = row['firstName'] ?? row['first_name'] ?? row['First Name'] ?? '';
    const lastName = row['lastName'] ?? row['last_name'] ?? row['Last Name'] ?? '';
    const email = row['email'] ?? row['Email'] ?? '';

    // Skip rows missing required fields
    if (!firstName || !lastName || !email) {
      logger.debug('Skipping CSV row with missing required fields', {
        row,
      });
      continue;
    }

    prospects.push({
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: (row['phone'] ?? row['Phone'] ?? '').trim() || undefined,
      company: (row['company'] ?? row['Company'] ?? '').trim() || undefined,
      title: (row['title'] ?? row['Title'] ?? row['job_title'] ?? '').trim() || undefined,
      linkedinUrl:
        (row['linkedinUrl'] ?? row['linkedin_url'] ?? row['LinkedIn URL'] ?? '').trim() ||
        undefined,
    });
  }

  return prospects;
}

/**
 * Imports parsed prospect records as Lead rows for the given org and request.
 * Uses createMany with skipDuplicates so org+email unique constraint violations
 * are silently skipped (re-imports are idempotent).
 *
 * Returns the count of newly created leads.
 */
async function importLeadsFromCsv(
  requestId: string,
  leads: ParsedProspect[],
  orgId: string,
  assignedAdvisorId?: string
): Promise<number> {
  if (leads.length === 0) return 0;

  const result = await prisma.lead.createMany({
    data: leads.map((lead) => ({
      organizationId: orgId,
      assignedAdvisorId: assignedAdvisorId ?? null,
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone ?? null,
      company: lead.company ?? null,
      title: lead.title ?? null,
      linkedinUrl: lead.linkedinUrl ?? null,
      source: LeadSource.PROSPECT_FINDER,
      prospectRequestId: requestId,
    })),
    skipDuplicates: true,
  });

  return result.count;
}

/**
 * Notifies the advisor that their prospect list is ready.
 * For MVP: creates an in-app notification for all advisor/admin users in the org
 * and logs via Winston.
 */
async function notifyAdvisor(requestId: string, orgId: string): Promise<void> {
  try {
    // Find all advisors and admins in the organization to notify
    const users = await prisma.user.findMany({
      where: {
        organizationId: orgId,
        role: { in: ['ADVISOR', 'ADMIN'] },
        status: 'ACTIVE',
      },
      select: { id: true },
    });

    if (users.length > 0) {
      await prisma.notification.createMany({
        data: users.map((u) => ({
          userId: u.id,
          organizationId: orgId,
          type: NotificationType.PROSPECT_LIST_READY,
          title: 'Your prospect list is ready',
          body: 'Your requested prospect list has been fulfilled and leads have been imported into your CRM.',
          metadata: { requestId } as object,
        })),
        skipDuplicates: true,
      });
    }

    logger.info('NOTIFICATION: Prospect list ready notification sent', {
      requestId,
      orgId,
      notifiedUsers: users.length,
    });
  } catch (err) {
    // Notification failures should not break the fulfillment flow
    logger.error('Failed to send prospect list ready notification', {
      error: err instanceof Error ? err.message : String(err),
      requestId,
      orgId,
    });
  }
}

/**
 * Uploads and parses a fulfillment CSV from a super admin.
 *
 * 1. Validates caller is super_admin
 * 2. Validates request exists and is in PENDING or PROCESSING state
 * 3. Parses CSV and validates minimum required columns
 * 4. Counts records and calculates credit cost:
 *    - 1 credit per standard record
 *    - 2 credits per LinkedIn-verified record (has linkedinUrl)
 * 5. Stores parsed CSV data as base64 in csvKey (no S3 for MVP)
 * 6. Sets status = PROCESSING, fulfilledCount, creditCost, fulfilledById
 */
export async function uploadFulfillmentCsv(
  requestId: string,
  csvBuffer: Buffer,
  user: AuthenticatedUser
): Promise<ProspectListRequest> {
  if (user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.forbidden('Super admin access required.');
  }

  const request = await prisma.prospectListRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw Errors.notFound('ProspectListRequest');
  }

  if (
    request.status !== ProspectRequestStatus.PENDING &&
    request.status !== ProspectRequestStatus.PROCESSING
  ) {
    throw Errors.conflict(
      `Cannot upload CSV for a request with status '${request.status}'. Expected PENDING or PROCESSING.`
    );
  }

  // Parse the CSV
  let prospects: ParsedProspect[];
  try {
    prospects = await parseCsvToLeads(csvBuffer);
  } catch (err) {
    throw Errors.badRequest(
      `Failed to parse CSV: ${err instanceof Error ? err.message : 'Unknown parse error'}`
    );
  }

  if (prospects.length === 0) {
    throw Errors.badRequest(
      'CSV contained no valid records. Ensure columns firstName, lastName, and email are present.'
    );
  }

  // Calculate credit cost: 2 credits for LinkedIn-verified, 1 for standard
  const creditCost = prospects.reduce((total, p) => {
    return total + (p.linkedinUrl ? 2 : 1);
  }, 0);

  // Store parsed CSV data as base64 in csvKey for retrieval during confirm
  const csvBase64 = csvBuffer.toString('base64');

  const updated = await prisma.prospectListRequest.update({
    where: { id: requestId },
    data: {
      status: ProspectRequestStatus.PROCESSING,
      fulfilledById: user.id,
      fulfilledCount: prospects.length,
      creditCost,
      csvKey: csvBase64,
    },
  });

  logger.info('Fulfillment CSV uploaded', {
    requestId,
    orgId: request.organizationId,
    uploadedBy: user.id,
    recordCount: prospects.length,
    creditCost,
  });

  return updated;
}

/**
 * Returns a preview of parsed leads from the stored CSV for a PROCESSING request.
 * Used by the advisor to review leads before confirming the import and deducting credits.
 */
export async function previewLeads(
  requestId: string,
  user: AuthenticatedUser
): Promise<{ leads: ParsedProspect[]; creditCost: number; fulfilledCount: number }> {
  const request = await prisma.prospectListRequest.findUnique({
    where: { id: requestId },
  });

  if (!request) {
    throw Errors.notFound('ProspectListRequest');
  }

  if (
    user.role !== UserRole.SUPER_ADMIN &&
    request.organizationId !== user.orgId
  ) {
    throw Errors.forbidden('Access denied to this prospect list request.');
  }

  if (request.status !== ProspectRequestStatus.PROCESSING) {
    throw Errors.conflict(
      `Preview is only available for PROCESSING requests. Current status: ${request.status}`
    );
  }

  if (!request.csvKey) {
    throw Errors.internal('No CSV data found for this request.');
  }

  const csvBuffer = Buffer.from(request.csvKey, 'base64');
  const leads = await parseCsvToLeads(csvBuffer);

  return {
    leads,
    creditCost: request.creditCost,
    fulfilledCount: request.fulfilledCount,
  };
}

/**
 * Confirms the import: deducts credits and imports leads.
 *
 * 1. Validates request is PROCESSING and belongs to the calling user's org
 * 2. Checks org has sufficient creditBalance >= creditCost
 * 3. In a Prisma $transaction:
 *    - Deducts creditCost from Organization.creditBalance
 *    - Creates a CreditTransaction record of type DEBIT
 *    - Sets request status = FULFILLED, confirmedAt = now, fulfilledAt = now
 * 4. Imports leads via importLeadsFromCsv (outside the transaction to avoid long locks)
 * 5. Notifies advisor via in-app notification
 * 6. Writes AuditTrail STATUS_CHANGED
 *
 * Returns the count of newly created leads and credits deducted.
 */
export async function confirmImport(
  requestId: string,
  user: AuthenticatedUser
): Promise<{ leads: number; creditsDeducted: number }> {
  const request = await prisma.prospectListRequest.findUnique({
    where: { id: requestId },
    include: {
      organization: {
        select: { id: true, creditBalance: true, name: true },
      },
    },
  });

  if (!request) {
    throw Errors.notFound('ProspectListRequest');
  }

  if (
    user.role !== UserRole.SUPER_ADMIN &&
    request.organizationId !== user.orgId
  ) {
    throw Errors.forbidden('Access denied to this prospect list request.');
  }

  if (request.status !== ProspectRequestStatus.PROCESSING) {
    throw Errors.conflict(
      `Cannot confirm import for a request with status '${request.status}'. Expected PROCESSING.`
    );
  }

  if (!request.csvKey) {
    throw Errors.badRequest(
      'No CSV data found. The super admin must upload a fulfillment CSV before confirming.'
    );
  }

  const { creditCost, organization } = request;

  // Check credit balance is sufficient
  if (organization.creditBalance < creditCost) {
    throw new AppError(
      `Insufficient credits. Required: ${creditCost}, Available: ${organization.creditBalance}.`,
      402,
      'PAYMENT_REQUIRED'
    );
  }

  const now = new Date();

  // Atomically deduct credits and mark request fulfilled
  await prisma.$transaction(async (tx) => {
    // Deduct credits
    const updatedOrg = await tx.organization.update({
      where: { id: organization.id },
      data: {
        creditBalance: { decrement: creditCost },
      },
    });

    // Record the credit transaction
    await tx.creditTransaction.create({
      data: {
        organizationId: organization.id,
        userId: user.id,
        type: CreditTransactionType.DEBIT,
        amount: creditCost,
        balanceAfter: updatedOrg.creditBalance,
        description: `Prospect list fulfillment — request ${requestId}`,
        metadata: {
          requestId,
          fulfilledCount: request.fulfilledCount,
        } as object,
      },
    });

    // Mark request as fulfilled
    await tx.prospectListRequest.update({
      where: { id: requestId },
      data: {
        status: ProspectRequestStatus.FULFILLED,
        confirmedAt: now,
        fulfilledAt: now,
      },
    });
  });

  // Import leads outside the transaction to avoid long-held locks
  const csvBuffer = Buffer.from(request.csvKey, 'base64');
  const prospects = await parseCsvToLeads(csvBuffer);
  const leadsImported = await importLeadsFromCsv(
    requestId,
    prospects,
    organization.id,
    user.role !== UserRole.SUPER_ADMIN ? user.id : undefined
  );

  // Notify advisor
  await notifyAdvisor(requestId, organization.id);

  // Write audit trail
  await writeAuditTrail({
    organizationId: organization.id,
    actorId: user.id,
    entityType: 'ProspectListRequest',
    entityId: requestId,
    action: AuditAction.STATUS_CHANGED,
    metadata: {
      previousStatus: ProspectRequestStatus.PROCESSING,
      newStatus: ProspectRequestStatus.FULFILLED,
      leadsImported,
      creditsDeducted: creditCost,
    },
  });

  logger.info('Prospect list request confirmed and fulfilled', {
    requestId,
    orgId: organization.id,
    confirmedBy: user.id,
    leadsImported,
    creditsDeducted: creditCost,
    balanceAfter: organization.creditBalance - creditCost,
  });

  return {
    leads: leadsImported,
    creditsDeducted: creditCost,
  };
}
