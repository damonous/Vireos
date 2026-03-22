import { AuditAction, ContentStatus, Draft } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { AuthenticatedUser, UserRole } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VersionDiffField {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  changed: boolean;
}

export interface VersionDiffResult {
  draftId: string;
  fromVersion: number;
  toVersion: number;
  diffs: VersionDiffField[];
}

// ---------------------------------------------------------------------------
// Content fields that are versioned
// ---------------------------------------------------------------------------

const CONTENT_FIELDS = [
  'linkedinContent',
  'facebookContent',
  'emailContent',
  'adCopyContent',
] as const;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Writes an audit trail record. Swallows errors to never block the main flow.
 */
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
    logger.error('Failed to write version audit trail', {
      error: err instanceof Error ? err.message : String(err),
      params,
    });
  }
}

/**
 * Verifies org isolation and returns the draft if accessible.
 */
async function loadDraftWithOrgCheck(
  draftId: string,
  user: AuthenticatedUser
): Promise<Draft> {
  const draft = await prisma.draft.findUnique({ where: { id: draftId } });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.notFound('Draft');
  }

  return draft;
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Snapshots the current state of a draft into a ContentVersion record.
 *
 * The version number is determined by finding the current max version for
 * the draft and incrementing by one. If no versions exist yet, starts at 1.
 *
 * @returns The created ContentVersion record.
 */
export async function createVersion(
  draft: Draft,
  userId: string,
  changeNote?: string
) {
  // Determine the next version number
  const latestVersion = await prisma.contentVersion.findFirst({
    where: { draftId: draft.id },
    orderBy: { versionNumber: 'desc' },
    select: { versionNumber: true },
  });

  const nextVersionNumber = latestVersion ? latestVersion.versionNumber + 1 : 1;

  const version = await prisma.contentVersion.create({
    data: {
      draftId: draft.id,
      versionNumber: nextVersionNumber,
      linkedinContent: draft.linkedinContent,
      facebookContent: draft.facebookContent,
      emailContent: draft.emailContent,
      adCopyContent: draft.adCopyContent,
      status: draft.status,
      createdById: userId,
      changeNote: changeNote ?? null,
    },
  });

  logger.info('Content version created', {
    draftId: draft.id,
    versionNumber: nextVersionNumber,
    createdById: userId,
  });

  return version;
}

/**
 * Returns all versions for a draft, ordered by version number descending.
 * Enforces org isolation.
 */
export async function getVersions(draftId: string, user: AuthenticatedUser) {
  // Verify access
  await loadDraftWithOrgCheck(draftId, user);

  const versions = await prisma.contentVersion.findMany({
    where: { draftId },
    orderBy: { versionNumber: 'desc' },
    include: {
      createdBy: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  return versions;
}

/**
 * Computes field-level diffs between two version numbers of a draft.
 * Enforces org isolation.
 */
export async function getVersionDiff(
  draftId: string,
  v1: number,
  v2: number,
  user: AuthenticatedUser
): Promise<VersionDiffResult> {
  // Verify access
  await loadDraftWithOrgCheck(draftId, user);

  const [version1, version2] = await Promise.all([
    prisma.contentVersion.findUnique({
      where: { draftId_versionNumber: { draftId, versionNumber: v1 } },
    }),
    prisma.contentVersion.findUnique({
      where: { draftId_versionNumber: { draftId, versionNumber: v2 } },
    }),
  ]);

  if (!version1) {
    throw Errors.notFound(`Version ${v1}`);
  }
  if (!version2) {
    throw Errors.notFound(`Version ${v2}`);
  }

  const diffs: VersionDiffField[] = CONTENT_FIELDS.map((field) => {
    const oldValue = version1[field];
    const newValue = version2[field];
    return {
      field,
      oldValue,
      newValue,
      changed: oldValue !== newValue,
    };
  });

  return {
    draftId,
    fromVersion: v1,
    toVersion: v2,
    diffs,
  };
}

/**
 * Rolls back a draft to a previous version.
 *
 * Steps:
 *  1. Verify the user has COMPLIANCE (VIEWER), ORG_ADMIN, or SUPER_ADMIN role
 *  2. Load the draft and verify org isolation
 *  3. Load the target version
 *  4. Create a snapshot of the current state before rollback
 *  5. Update the draft fields from the target version
 *  6. Write an audit trail entry
 *  7. Return the updated draft
 */
export async function rollback(
  draftId: string,
  versionNumber: number,
  user: AuthenticatedUser
) {
  // 1. Role check: only compliance (VIEWER), ORG_ADMIN, or SUPER_ADMIN
  const allowedRoles: UserRole[] = [UserRole.VIEWER, UserRole.ORG_ADMIN, UserRole.SUPER_ADMIN];
  if (!allowedRoles.includes(user.role)) {
    throw Errors.forbidden('Only compliance officers and admins can rollback content versions');
  }

  // 2. Load draft with org check
  const draft = await loadDraftWithOrgCheck(draftId, user);

  // 3. Load the target version
  const targetVersion = await prisma.contentVersion.findUnique({
    where: { draftId_versionNumber: { draftId, versionNumber } },
  });

  if (!targetVersion) {
    throw Errors.notFound(`Version ${versionNumber}`);
  }

  // 4. Snapshot current state before rollback
  await createVersion(draft, user.id, `Pre-rollback snapshot (rolling back to v${versionNumber})`);

  // 5. Update the draft with content from the target version
  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: {
      linkedinContent: targetVersion.linkedinContent,
      facebookContent: targetVersion.facebookContent,
      emailContent: targetVersion.emailContent,
      adCopyContent: targetVersion.adCopyContent,
      version: { increment: 1 },
    },
  });

  // 6. Audit trail
  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draftId,
    action: AuditAction.UPDATED,
    previousState: {
      linkedinContent: draft.linkedinContent,
      facebookContent: draft.facebookContent,
      emailContent: draft.emailContent,
      adCopyContent: draft.adCopyContent,
      version: draft.version,
    },
    newState: {
      linkedinContent: updated.linkedinContent,
      facebookContent: updated.facebookContent,
      emailContent: updated.emailContent,
      adCopyContent: updated.adCopyContent,
      version: updated.version,
    },
    metadata: {
      type: 'rollback',
      rolledBackToVersion: versionNumber,
      previousDraftVersion: draft.version,
      newDraftVersion: updated.version,
    },
  });

  logger.info('Draft rolled back to previous version', {
    draftId,
    rolledBackToVersion: versionNumber,
    userId: user.id,
    orgId: draft.organizationId,
  });

  return updated;
}
