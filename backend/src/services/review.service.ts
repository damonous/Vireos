import { AuditAction, ContentStatus, Draft, NotificationType, UserRole as PrismaUserRole } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { UserRole, AuthenticatedUser } from '../types';
import type { ReviewActionDto, EditContentDto } from '../validators/review.validators';

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

// ---------------------------------------------------------------------------
// Role resolution helpers
// ---------------------------------------------------------------------------

/**
 * Returns true if the application-level role represents a compliance officer.
 * In this codebase the Prisma COMPLIANCE role maps to the app-level 'viewer' role.
 */
function isComplianceOrAdmin(role: UserRole): boolean {
  return role === UserRole.VIEWER || role === UserRole.ORG_ADMIN || role === UserRole.SUPER_ADMIN;
}

function isAdvisorOrAdmin(role: UserRole): boolean {
  return role === UserRole.ADVISOR || role === UserRole.ORG_ADMIN || role === UserRole.SUPER_ADMIN;
}

// ---------------------------------------------------------------------------
// Audit trail helper
// ---------------------------------------------------------------------------

async function writeAuditTrail(params: {
  organizationId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  previousState?: Record<string, unknown> | null;
  newState?: Record<string, unknown> | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        previousState: params.previousState != null
          ? (params.previousState as object)
          : undefined,
        newState: params.newState != null
          ? (params.newState as object)
          : undefined,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    logger.error('Failed to write review audit trail', {
      error: err instanceof Error ? err.message : String(err),
      params,
    });
  }
}

// ---------------------------------------------------------------------------
// Notification helper — persists in-app notifications for relevant users.
// ---------------------------------------------------------------------------

async function sendNotification(params: {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    // Write an in-app notification record
    await prisma.notification.create({
      data: {
        organizationId: params.organizationId,
        userId: params.userId,
        type: params.type,
        title: params.title,
        body: params.body,
        metadata: (params.metadata ?? {}) as object,
      },
    });

    logger.info('NOTIFICATION: Content status notification sent', {
      userId: params.userId,
      type: params.type,
      title: params.title,
    });
  } catch (err) {
    // Notification failures must never break the main flow
    logger.warn('Failed to create notification', {
      error: err instanceof Error ? err.message : String(err),
      userId: params.userId,
      type: params.type,
    });
  }
}

/**
 * Finds compliance officers (COMPLIANCE-role users) within the organization
 * to notify on content submission.
 */
async function findComplianceOfficerIds(organizationId: string): Promise<string[]> {
  try {
    const officers = await prisma.user.findMany({
      where: {
        organizationId,
        role: { in: [PrismaUserRole.COMPLIANCE, PrismaUserRole.ADMIN] },
      },
      select: { id: true },
    });
    return officers.map((u) => u.id);
  } catch (err) {
    logger.warn('Failed to find compliance officers for notification', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
    });
    return [];
  }
}

// ---------------------------------------------------------------------------
// Serialise a Draft to a plain state snapshot for audit trail storage
// ---------------------------------------------------------------------------

function draftToState(draft: Draft): Record<string, unknown> {
  return {
    id: draft.id,
    status: draft.status,
    version: draft.version,
    reviewerId: draft.reviewerId,
    reviewNotes: draft.reviewNotes,
    linkedinContent: draft.linkedinContent,
    facebookContent: draft.facebookContent,
    emailContent: draft.emailContent,
    adCopyContent: draft.adCopyContent,
    updatedAt: draft.updatedAt?.toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Review Service
// ---------------------------------------------------------------------------

/**
 * Submits a draft for compliance review.
 *
 * Rules:
 *  - Caller must have ADVISOR, ORG_ADMIN, or SUPER_ADMIN role
 *  - Draft status must be DRAFT, NEEDS_CHANGES, or REJECTED
 *  - Sets status → PENDING_REVIEW
 *  - Writes AuditTrail with action SUBMITTED
 *  - Notifies compliance officers in the org
 */
export async function submitForReview(
  draftId: string,
  user: AuthenticatedUser
): Promise<Draft> {
  if (!isAdvisorOrAdmin(user.role)) {
    throw Errors.forbidden('Only advisors and admins can submit drafts for review');
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  // Org isolation
  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.forbidden('Access denied to this draft');
  }

  // Advisors can only submit their own drafts
  if (user.role === UserRole.ADVISOR && draft.creatorId !== user.id) {
    throw Errors.forbidden('You can only submit your own drafts');
  }

  if (
    draft.status !== ContentStatus.DRAFT &&
    draft.status !== ContentStatus.NEEDS_CHANGES &&
    draft.status !== ContentStatus.REJECTED
  ) {
    throw Errors.conflict(
      `Draft cannot be submitted for review from status "${draft.status}". ` +
      `Only DRAFT, NEEDS_CHANGES, or REJECTED drafts can be submitted.`
    );
  }

  const previousState = draftToState(draft);

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: { status: ContentStatus.PENDING_REVIEW },
  });

  const newState = draftToState(updated);

  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draft.id,
    action: AuditAction.SUBMITTED,
    previousState,
    newState,
    metadata: { previousStatus: previousState['status'], newStatus: updated.status },
  });

  // Notify compliance officers
  const officerIds = await findComplianceOfficerIds(draft.organizationId);
  for (const officerId of officerIds) {
    await sendNotification({
      organizationId: draft.organizationId,
      userId: officerId,
      type: NotificationType.CONTENT_SUBMITTED,
      title: 'New content submitted for review',
      body: `A draft titled "${draft.title}" has been submitted for compliance review.`,
      metadata: { draftId: draft.id, submittedBy: user.id },
    });
  }

  logger.info('Draft submitted for review', {
    draftId,
    submittedBy: user.id,
    orgId: draft.organizationId,
  });

  return updated;
}

/**
 * Returns the paginated list of PENDING_REVIEW drafts for the org.
 *
 * Rules:
 *  - Caller must have VIEWER (Compliance), ORG_ADMIN, or SUPER_ADMIN role
 */
export async function getReviewQueue(
  orgId: string,
  user: AuthenticatedUser,
  pagination: PaginationParams
): Promise<PaginatedResult<Draft>> {
  if (!isComplianceOrAdmin(user.role) && user.role !== UserRole.ADVISOR) {
    throw Errors.forbidden('Only advisors, compliance officers, and admins can view review items');
  }

  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  // Super admin can view all orgs, others are scoped to their org
  const whereOrgId = user.role === UserRole.SUPER_ADMIN ? orgId : user.orgId;

  const where =
    user.role === UserRole.ADVISOR
      ? {
          organizationId: whereOrgId,
          creatorId: user.id,
          status: {
            in: [
              ContentStatus.PENDING_REVIEW,
              ContentStatus.NEEDS_CHANGES,
              ContentStatus.APPROVED,
              ContentStatus.REJECTED,
            ],
          },
        }
      : {
          organizationId: whereOrgId,
          status: ContentStatus.PENDING_REVIEW,
        };

  const [drafts, totalCount] = await Promise.all([
    prisma.draft.findMany({
      where,
      orderBy: { updatedAt: 'asc' }, // oldest first — FIFO review order
      skip,
      take: limit,
    }),
    prisma.draft.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: drafts,
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
 * Returns a single draft for compliance review.
 *
 * Rules:
 *  - Caller must have VIEWER (Compliance), ORG_ADMIN, or SUPER_ADMIN role
 */
export async function getDraftForReview(
  draftId: string,
  user: AuthenticatedUser
): Promise<Draft> {
  if (!isComplianceOrAdmin(user.role)) {
    throw Errors.forbidden('Only compliance officers and admins can access drafts for review');
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.forbidden('Access denied to this draft');
  }

  return draft;
}

/**
 * Approves a PENDING_REVIEW draft.
 *
 * Rules:
 *  - Caller must have VIEWER (Compliance), ORG_ADMIN, or SUPER_ADMIN role
 *  - Draft must be in PENDING_REVIEW status
 *  - Sets status → APPROVED; assigns reviewerId
 *  - Writes AuditTrail APPROVED
 *  - Notifies the draft creator
 */
export async function approveDraft(
  draftId: string,
  user: AuthenticatedUser
): Promise<Draft> {
  if (!isComplianceOrAdmin(user.role)) {
    throw Errors.forbidden('Only compliance officers and admins can approve drafts');
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.forbidden('Access denied to this draft');
  }

  if (draft.status !== ContentStatus.PENDING_REVIEW) {
    throw Errors.conflict(
      `Draft cannot be approved from status "${draft.status}". ` +
      `Only PENDING_REVIEW drafts can be approved.`
    );
  }

  const previousState = draftToState(draft);

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: {
      status: ContentStatus.APPROVED,
      reviewerId: user.id,
    },
  });

  const newState = draftToState(updated);

  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draft.id,
    action: AuditAction.APPROVED,
    previousState,
    newState,
    metadata: { reviewerId: user.id },
  });

  // Notify the draft creator
  await sendNotification({
    organizationId: draft.organizationId,
    userId: draft.creatorId,
    type: NotificationType.CONTENT_APPROVED,
    title: 'Your content has been approved',
    body: `Your draft titled "${draft.title}" has been approved by compliance.`,
    metadata: { draftId: draft.id, reviewerId: user.id },
  });

  logger.info('Draft approved', {
    draftId,
    reviewerId: user.id,
    orgId: draft.organizationId,
  });

  return updated;
}

/**
 * Rejects a PENDING_REVIEW draft.
 *
 * Rules:
 *  - Caller must have VIEWER (Compliance), ORG_ADMIN, or SUPER_ADMIN role
 *  - Draft must be in PENDING_REVIEW status
 *  - Requires a `reason` string in the DTO
 *  - Sets status → REJECTED; assigns reviewerId; stores reason in reviewNotes
 *  - Writes AuditTrail REJECTED with reason in metadata
 *  - Notifies the draft creator
 */
export async function rejectDraft(
  draftId: string,
  dto: ReviewActionDto,
  user: AuthenticatedUser
): Promise<Draft> {
  if (!isComplianceOrAdmin(user.role)) {
    throw Errors.forbidden('Only compliance officers and admins can reject drafts');
  }

  if (!dto.reason || dto.reason.trim().length === 0) {
    throw Errors.badRequest('A rejection reason is required');
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.forbidden('Access denied to this draft');
  }

  if (draft.status !== ContentStatus.PENDING_REVIEW) {
    throw Errors.conflict(
      `Draft cannot be rejected from status "${draft.status}". ` +
      `Only PENDING_REVIEW drafts can be rejected.`
    );
  }

  const previousState = draftToState(draft);

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: {
      status: ContentStatus.REJECTED,
      reviewerId: user.id,
      reviewNotes: dto.reason,
    },
  });

  const newState = draftToState(updated);

  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draft.id,
    action: AuditAction.REJECTED,
    previousState,
    newState,
    metadata: { reason: dto.reason, reviewerId: user.id },
  });

  // Notify the draft creator
  await sendNotification({
    organizationId: draft.organizationId,
    userId: draft.creatorId,
    type: NotificationType.CONTENT_REJECTED,
    title: 'Your content has been rejected',
    body: `Your draft titled "${draft.title}" was rejected. Reason: ${dto.reason}`,
    metadata: { draftId: draft.id, reviewerId: user.id, reason: dto.reason },
  });

  logger.info('Draft rejected', {
    draftId,
    reviewerId: user.id,
    orgId: draft.organizationId,
    reason: dto.reason,
  });

  return updated;
}

/**
 * Requests changes on a PENDING_REVIEW draft (returns it to the advisor for editing).
 *
 * Rules:
 *  - Caller must have VIEWER (Compliance), ORG_ADMIN, or SUPER_ADMIN role
 *  - Draft must be in PENDING_REVIEW status
 *  - Requires a `notes` string in the DTO
 *  - Sets status → NEEDS_CHANGES; sets reviewNotes = notes; assigns reviewerId
 *  - Writes AuditTrail STATUS_CHANGED
 *  - Notifies the draft creator
 */
export async function requestChanges(
  draftId: string,
  dto: ReviewActionDto,
  user: AuthenticatedUser
): Promise<Draft> {
  if (!isComplianceOrAdmin(user.role)) {
    throw Errors.forbidden('Only compliance officers and admins can request changes');
  }

  if (!dto.notes || dto.notes.trim().length === 0) {
    throw Errors.badRequest('Notes are required when requesting changes');
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.forbidden('Access denied to this draft');
  }

  if (draft.status !== ContentStatus.PENDING_REVIEW) {
    throw Errors.conflict(
      `Changes cannot be requested on draft with status "${draft.status}". ` +
      `Only PENDING_REVIEW drafts can have changes requested.`
    );
  }

  const previousState = draftToState(draft);

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: {
      status: ContentStatus.NEEDS_CHANGES,
      reviewNotes: dto.notes,
      reviewerId: user.id,
    },
  });

  const newState = draftToState(updated);

  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draft.id,
    action: AuditAction.STATUS_CHANGED,
    previousState,
    newState,
    metadata: {
      previousStatus: previousState['status'],
      newStatus: updated.status,
      notes: dto.notes,
      reviewerId: user.id,
    },
  });

  // Notify the draft creator
  await sendNotification({
    organizationId: draft.organizationId,
    userId: draft.creatorId,
    type: NotificationType.CONTENT_NEEDS_CHANGES,
    title: 'Changes requested on your content',
    body: `Changes have been requested on your draft titled "${draft.title}". Notes: ${dto.notes}`,
    metadata: { draftId: draft.id, reviewerId: user.id, notes: dto.notes },
  });

  logger.info('Changes requested on draft', {
    draftId,
    reviewerId: user.id,
    orgId: draft.organizationId,
  });

  return updated;
}

/**
 * Allows a compliance officer or admin to edit draft content inline while
 * in PENDING_REVIEW status.
 *
 * Rules:
 *  - Caller must have VIEWER (Compliance), ORG_ADMIN, or SUPER_ADMIN role
 *  - Advisors are DENIED edit access once a draft is in PENDING_REVIEW (403)
 *  - Draft must be in PENDING_REVIEW status
 *  - Increments the version counter
 *  - Writes AuditTrail UPDATED with previousState snapshot
 */
export async function editDraftContent(
  draftId: string,
  dto: EditContentDto,
  user: AuthenticatedUser
): Promise<Draft> {
  // Advisors cannot edit after submission
  if (user.role === UserRole.ADVISOR) {
    throw Errors.forbidden('Advisors cannot edit a draft that is pending review');
  }

  if (!isComplianceOrAdmin(user.role)) {
    throw Errors.forbidden('Only compliance officers and admins can edit draft content during review');
  }

  const draft = await prisma.draft.findUnique({ where: { id: draftId } });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.forbidden('Access denied to this draft');
  }

  if (draft.status !== ContentStatus.PENDING_REVIEW) {
    throw Errors.conflict(
      `Draft content can only be edited inline when status is PENDING_REVIEW. ` +
      `Current status: "${draft.status}".`
    );
  }

  const previousState = draftToState(draft);

  // Build update payload — only include fields provided in the DTO
  const updateData: Partial<{
    linkedinContent: string | null;
    facebookContent: string | null;
    emailContent: string | null;
    adCopyContent: string | null;
    version: number;
  }> = {
    version: draft.version + 1,
  };

  if (dto.linkedinContent !== undefined) updateData.linkedinContent = dto.linkedinContent;
  if (dto.facebookContent !== undefined) updateData.facebookContent = dto.facebookContent;
  if (dto.emailContent !== undefined) updateData.emailContent = dto.emailContent;
  if (dto.adCopyContent !== undefined) updateData.adCopyContent = dto.adCopyContent;

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: updateData,
  });

  const newState = draftToState(updated);

  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draft.id,
    action: AuditAction.UPDATED,
    previousState,
    newState,
    metadata: {
      editedFields: Object.keys(dto).filter(
        (k) => dto[k as keyof EditContentDto] !== undefined
      ),
      versionBefore: draft.version,
      versionAfter: updated.version,
    },
  });

  logger.info('Draft content edited by reviewer', {
    draftId,
    editorId: user.id,
    orgId: draft.organizationId,
    newVersion: updated.version,
  });

  return updated;
}

// ---------------------------------------------------------------------------
// Audit trail query
// ---------------------------------------------------------------------------

export interface AuditTrailQueryParams {
  organizationId: string;
  entityType?: string;
  entityId?: string;
  action?: string;
  from?: string;
  to?: string;
  page: number;
  limit: number;
}

export interface PaginatedAuditResult {
  data: Array<{
    id: string;
    organizationId: string;
    actorId: string | null;
    entityType: string;
    entityId: string;
    action: string;
    previousState: unknown;
    newState: unknown;
    metadata: unknown;
    ipAddress: string | null;
    userAgent: string | null;
    createdAt: Date;
  }>;
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

/**
 * Returns a paginated list of AuditTrail records.
 *
 * Super admins can pass any orgId and query across all organisations.
 * Regular admins are scoped to their own organisation.
 */
export async function getAuditTrail(
  params: AuditTrailQueryParams,
  user: AuthenticatedUser
): Promise<PaginatedAuditResult> {
  // Scope: super_admin may query any org; others are restricted to their own org
  const orgId =
    user.role === UserRole.SUPER_ADMIN ? params.organizationId : user.orgId;

  const { page, limit } = params;
  const skip = (page - 1) * limit;

  // Build dynamic where clause
  const where: Record<string, unknown> = { organizationId: orgId };

  if (params.entityType) where['entityType'] = params.entityType;
  if (params.entityId) where['entityId'] = params.entityId;
  if (params.action) where['action'] = params.action as AuditAction;

  if (params.from || params.to) {
    where['createdAt'] = {
      ...(params.from ? { gte: new Date(params.from) } : {}),
      ...(params.to ? { lte: new Date(params.to) } : {}),
    };
  }

  const [records, totalCount] = await Promise.all([
    prisma.auditTrail.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip,
      take: limit,
    }),
    prisma.auditTrail.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    data: records,
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
