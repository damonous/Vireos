import { AuditTrail } from '@prisma/client';
import {
  auditService,
  WriteAuditParams,
  AuditQueryFilters,
  PaginatedResult,
} from '../services/audit.service';
import { AuthenticatedUser } from '../types';
import { OffsetPaginationParams } from '../utils/pagination';

// ---------------------------------------------------------------------------
// Convenience wrappers over the AuditService singleton
// ---------------------------------------------------------------------------

/**
 * Writes an audit trail record.
 *
 * This is a fire-and-forget-safe wrapper — it NEVER throws.
 * Callers can either await it for guaranteed delivery or call without await
 * for best-effort write that does not block the response.
 *
 * @example
 *   // Fire-and-forget (non-blocking)
 *   void writeAudit({ ... });
 *
 *   // Await for guaranteed delivery before responding
 *   await writeAudit({ ... });
 */
export async function writeAudit(params: WriteAuditParams): Promise<void> {
  return auditService.write(params);
}

/**
 * Queries the audit trail with pagination and optional filters.
 * Enforces organizational isolation (super_admin may query any org).
 */
export async function queryAudit(
  orgId: string,
  filters: AuditQueryFilters,
  pagination: OffsetPaginationParams,
  user: AuthenticatedUser
): Promise<PaginatedResult<AuditTrail>> {
  return auditService.query(orgId, filters, pagination, user);
}
