import { AuditAction, AuditTrail } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { AuthenticatedUser, UserRole } from '../types';
import {
  OffsetPaginationParams,
  OffsetPaginationResult,
  buildOffsetPaginationResult,
  calcSkip,
} from '../utils/pagination';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WriteAuditParams {
  organizationId: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  previousState?: object;
  newState?: object;
  metadata?: object;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditQueryFilters {
  entityType?: string;
  entityId?: string;
  action?: AuditAction;
  actorId?: string;
  from?: string;
  to?: string;
}

export type PaginatedResult<T> = OffsetPaginationResult<T>;

// ---------------------------------------------------------------------------
// AuditService
// ---------------------------------------------------------------------------

/**
 * Service responsible for writing and querying the immutable audit trail.
 *
 * Key properties:
 * - write() NEVER throws — any errors are caught and logged internally.
 *   Audit writes must not interrupt the main business flow.
 * - query() enforces organizational isolation. super_admin may query any org.
 */
export class AuditService {
  /**
   * Writes a single audit trail record to the database.
   *
   * This method is safe to call without awaiting in fire-and-forget style.
   * If called with await, it still resolves without throwing even if the DB
   * write fails.
   */
  async write(params: WriteAuditParams): Promise<void> {
    try {
      await prisma.auditTrail.create({
        data: {
          organizationId: params.organizationId,
          actorId: params.actorId ?? null,
          entityType: params.entityType,
          entityId: params.entityId,
          action: params.action,
          previousState: params.previousState ?? undefined,
          newState: params.newState ?? undefined,
          metadata: params.metadata ?? {},
          ipAddress: params.ipAddress ?? null,
          userAgent: params.userAgent ?? null,
        },
      });
    } catch (err) {
      // Audit writes must NEVER propagate errors to the caller.
      // Log the failure so it can be investigated, but swallow the error.
      logger.error('AuditService.write failed — audit record not persisted', {
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
        organizationId: params.organizationId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
      });
    }
  }

  /**
   * Queries the audit trail for a given organization with optional filters
   * and offset-based pagination.
   *
   * Org isolation rules:
   * - super_admin: can query any org (orgId param is honoured as-is)
   * - all other roles: orgId is forced to user.orgId, ignoring the param
   */
  async query(
    orgId: string,
    filters: AuditQueryFilters,
    pagination: OffsetPaginationParams,
    user: AuthenticatedUser
  ): Promise<PaginatedResult<AuditTrail>> {
    // Enforce org isolation: non-super-admins are locked to their own org
    const effectiveOrgId =
      user.role === UserRole.SUPER_ADMIN ? orgId : user.orgId;

    // Build dynamic where clause from filters
    const where: Record<string, unknown> = {
      organizationId: effectiveOrgId,
    };

    if (filters.entityType) {
      where['entityType'] = filters.entityType;
    }

    if (filters.entityId) {
      where['entityId'] = filters.entityId;
    }

    if (filters.action) {
      where['action'] = filters.action;
    }

    if (filters.actorId) {
      where['actorId'] = filters.actorId;
    }

    // Date range filter on createdAt
    if (filters.from || filters.to) {
      const createdAt: Record<string, Date> = {};
      if (filters.from) {
        createdAt['gte'] = new Date(filters.from);
      }
      if (filters.to) {
        createdAt['lte'] = new Date(filters.to);
      }
      where['createdAt'] = createdAt;
    }

    const skip = calcSkip(pagination);

    const [records, totalCount] = await Promise.all([
      prisma.auditTrail.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: pagination.limit,
      }),
      prisma.auditTrail.count({ where }),
    ]);

    return buildOffsetPaginationResult(records, totalCount, pagination);
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const auditService = new AuditService();
