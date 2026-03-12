import { parse as csvParse } from 'csv-parse/sync';
import { Lead, LeadActivity, LeadStatus, LeadSource, AuditAction } from '@prisma/client';
import { prisma } from '../db/client';
import { Errors } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AuthenticatedUser, UserRole } from '../types';
import {
  buildOffsetPaginationResult,
  calcSkip,
  OffsetPaginationResult,
} from '../utils/pagination';
import type {
  CreateLeadDto,
  UpdateLeadDto,
  AddActivityDto,
  ListLeadsQuery,
} from '../validators/lead.validators';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LeadWithActivities extends Lead {
  activities: LeadActivity[];
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface ImportResult {
  created: number;
  duplicates: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// Helper: audit trail writer
// ---------------------------------------------------------------------------

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
// Helper: build org-scoped lead visibility filter
// Advisors only see leads assigned to them; Admins and above see all.
// ---------------------------------------------------------------------------

function buildLeadWhere(
  orgId: string,
  user: AuthenticatedUser,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const base: Record<string, unknown> = {
    organizationId: orgId,
  };

  // Advisors and Viewers can only see their own assigned leads
  if (user.role === UserRole.ADVISOR || user.role === UserRole.VIEWER) {
    base['assignedAdvisorId'] = user.id;
  }

  return { ...base, ...overrides };
}

// ---------------------------------------------------------------------------
// Lead Service
// ---------------------------------------------------------------------------

/**
 * Creates a new lead or upserts on duplicate email within the same org.
 */
export async function createLead(
  dto: CreateLeadDto,
  user: AuthenticatedUser
): Promise<Lead> {
  const orgId = user.orgId;
  const advisorAssignment =
    user.role === UserRole.ADVISOR || user.role === UserRole.VIEWER ? user.id : null;

  // Check for existing lead with same email in the same org (upsert behavior)
  const existing = await prisma.lead.findUnique({
    where: {
      organizationId_email: {
        organizationId: orgId,
        email: dto.email.toLowerCase(),
      },
    },
  });

  if (existing) {
    // Duplicate email in same org → update existing lead
    logger.info('Duplicate lead email detected — updating existing lead', {
      leadId: existing.id,
      orgId,
      email: dto.email,
    });

    const updated = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone ?? existing.phone,
        company: dto.company ?? existing.company,
        title: dto.title ?? existing.title,
        linkedinUrl: dto.linkedinUrl ?? existing.linkedinUrl,
        notes: dto.notes ?? existing.notes,
        customFields: (dto.customFields ?? existing.customFields) as object,
        assignedAdvisorId: existing.assignedAdvisorId ?? advisorAssignment,
      },
    });

    await writeAuditTrail({
      organizationId: orgId,
      actorId: user.id,
      entityType: 'Lead',
      entityId: updated.id,
      action: AuditAction.UPDATED,
      metadata: { reason: 'duplicate_email_upsert', email: dto.email },
    });

    return updated;
  }

  // Create new lead
  const lead = await prisma.lead.create({
    data: {
      organizationId: orgId,
      firstName: dto.firstName,
      lastName: dto.lastName,
      email: dto.email.toLowerCase(),
      phone: dto.phone ?? null,
      company: dto.company ?? null,
      title: dto.title ?? null,
      linkedinUrl: dto.linkedinUrl ?? null,
      assignedAdvisorId: advisorAssignment,
      source: dto.source,
      notes: dto.notes ?? null,
      customFields: (dto.customFields ?? {}) as object,
      status: LeadStatus.NEW,
    },
  });

  await writeAuditTrail({
    organizationId: orgId,
    actorId: user.id,
    entityType: 'Lead',
    entityId: lead.id,
    action: AuditAction.CREATED,
    metadata: {
      email: lead.email,
      source: lead.source,
    },
  });

  logger.info('Lead created', {
    leadId: lead.id,
    orgId,
    email: lead.email,
    actorId: user.id,
  });

  return lead;
}

/**
 * Retrieves a single lead with its activities. Enforces org isolation and
 * advisor visibility rules.
 */
export async function getLead(
  leadId: string,
  user: AuthenticatedUser
): Promise<LeadWithActivities> {
  const where = buildLeadWhere(user.orgId, user, { id: leadId });

  const lead = await prisma.lead.findFirst({
    where,
    include: {
      leadActivities: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  if (!lead) {
    throw Errors.notFound('Lead');
  }

  const { leadActivities, ...rest } = lead;

  return {
    ...rest,
    activities: leadActivities,
  };
}

/**
 * Lists leads for an org with optional filters and pagination.
 */
export async function listLeads(
  orgId: string,
  user: AuthenticatedUser,
  filters: Partial<ListLeadsQuery>,
  pagination: PaginationParams
): Promise<OffsetPaginationResult<Lead>> {
  const { status, source, assignedAdvisorId, search, sortBy = 'createdAt', sortOrder = 'desc' } = filters;

  const where = buildLeadWhere(orgId, user);

  if (status) {
    (where as Record<string, unknown>)['status'] = status;
  }

  if (source) {
    (where as Record<string, unknown>)['source'] = source;
  }

  if (assignedAdvisorId) {
    (where as Record<string, unknown>)['assignedAdvisorId'] = assignedAdvisorId;
  }

  if (search && search.trim().length > 0) {
    const term = search.trim();
    (where as Record<string, unknown>)['OR'] = [
      { firstName: { contains: term, mode: 'insensitive' } },
      { lastName: { contains: term, mode: 'insensitive' } },
      { email: { contains: term, mode: 'insensitive' } },
    ];
  }

  const skip = calcSkip(pagination);
  const orderBy: Record<string, string> = { [sortBy]: sortOrder };

  const [leads, totalCount] = await Promise.all([
    prisma.lead.findMany({
      where,
      skip,
      take: pagination.limit,
      orderBy,
    }),
    prisma.lead.count({ where }),
  ]);

  return buildOffsetPaginationResult(leads, totalCount, pagination);
}

/**
 * Updates a lead's fields. Enforces org isolation and advisor visibility.
 */
export async function updateLead(
  leadId: string,
  dto: UpdateLeadDto,
  user: AuthenticatedUser
): Promise<Lead> {
  // Verify lead exists and user has access
  const existing = await prisma.lead.findFirst({
    where: buildLeadWhere(user.orgId, user, { id: leadId }),
  });

  if (!existing) {
    throw Errors.notFound('Lead');
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: {
      ...(dto.firstName !== undefined && { firstName: dto.firstName }),
      ...(dto.lastName !== undefined && { lastName: dto.lastName }),
      ...(dto.email !== undefined && { email: dto.email.toLowerCase() }),
      ...(dto.phone !== undefined && { phone: dto.phone }),
      ...(dto.company !== undefined && { company: dto.company }),
      ...(dto.title !== undefined && { title: dto.title }),
      ...(dto.linkedinUrl !== undefined && { linkedinUrl: dto.linkedinUrl }),
      ...(dto.notes !== undefined && { notes: dto.notes }),
      ...(dto.customFields !== undefined && {
        customFields: dto.customFields as object,
      }),
    },
  });

  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'Lead',
    entityId: leadId,
    action: AuditAction.UPDATED,
    metadata: { updatedFields: Object.keys(dto) },
  });

  return updated;
}

/**
 * Deletes a lead (admin/super_admin only).
 */
export async function deleteLead(
  leadId: string,
  user: AuthenticatedUser
): Promise<void> {
  const lead = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: user.orgId },
  });

  if (!lead) {
    throw Errors.notFound('Lead');
  }

  await prisma.lead.delete({ where: { id: leadId } });

  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'Lead',
    entityId: leadId,
    action: AuditAction.DELETED,
    metadata: { email: lead.email },
  });

  logger.info('Lead deleted', {
    leadId,
    orgId: user.orgId,
    actorId: user.id,
  });
}

/**
 * Updates a lead's status and auto-creates a STATUS_CHANGE activity record.
 */
export async function updateStatus(
  leadId: string,
  status: LeadStatus,
  user: AuthenticatedUser
): Promise<Lead> {
  // Verify lead exists and user has access
  const existing = await prisma.lead.findFirst({
    where: buildLeadWhere(user.orgId, user, { id: leadId }),
  });

  if (!existing) {
    throw Errors.notFound('Lead');
  }

  const previousStatus = existing.status;

  // Update status in a transaction — update lead + create activity atomically
  const [updatedLead] = await prisma.$transaction([
    prisma.lead.update({
      where: { id: leadId },
      data: { status },
    }),
    prisma.leadActivity.create({
      data: {
        leadId,
        organizationId: user.orgId,
        actorId: user.id,
        type: 'STATUS_CHANGE',
        description: `Status changed from ${previousStatus} to ${status}`,
        metadata: {
          previousStatus,
          newStatus: status,
        } as object,
      },
    }),
  ]);

  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'Lead',
    entityId: leadId,
    action: AuditAction.STATUS_CHANGED,
    metadata: { previousStatus, newStatus: status },
  });

  logger.info('Lead status updated', {
    leadId,
    orgId: user.orgId,
    previousStatus,
    newStatus: status,
    actorId: user.id,
  });

  return updatedLead;
}

/**
 * Assigns a lead to an advisor (admin/super_admin only).
 */
export async function assignLead(
  leadId: string,
  advisorId: string,
  user: AuthenticatedUser
): Promise<Lead> {
  // Verify lead exists in the org
  const existing = await prisma.lead.findFirst({
    where: { id: leadId, organizationId: user.orgId },
  });

  if (!existing) {
    throw Errors.notFound('Lead');
  }

  // Verify the advisor exists in the same org
  const advisor = await prisma.user.findFirst({
    where: { id: advisorId, organizationId: user.orgId },
  });

  if (!advisor) {
    throw Errors.notFound('Advisor');
  }

  const updated = await prisma.lead.update({
    where: { id: leadId },
    data: { assignedAdvisorId: advisorId },
  });

  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'Lead',
    entityId: leadId,
    action: AuditAction.UPDATED,
    metadata: {
      field: 'assignedAdvisorId',
      previousValue: existing.assignedAdvisorId,
      newValue: advisorId,
    },
  });

  logger.info('Lead assigned', {
    leadId,
    advisorId,
    orgId: user.orgId,
    actorId: user.id,
  });

  return updated;
}

/**
 * Adds a manual activity record to a lead.
 */
export async function addActivity(
  leadId: string,
  dto: AddActivityDto,
  user: AuthenticatedUser
): Promise<LeadActivity> {
  // Verify lead exists and user has access
  const lead = await prisma.lead.findFirst({
    where: buildLeadWhere(user.orgId, user, { id: leadId }),
  });

  if (!lead) {
    throw Errors.notFound('Lead');
  }

  const activity = await prisma.leadActivity.create({
    data: {
      leadId,
      organizationId: user.orgId,
      actorId: user.id,
      type: dto.type,
      description: dto.description,
      metadata: (dto.metadata ?? {}) as object,
    },
  });

  logger.info('Lead activity added', {
    activityId: activity.id,
    leadId,
    type: dto.type,
    orgId: user.orgId,
    actorId: user.id,
  });

  return activity;
}

/**
 * Returns paginated activities for a lead.
 */
export async function getActivities(
  leadId: string,
  user: AuthenticatedUser,
  pagination: PaginationParams
): Promise<OffsetPaginationResult<LeadActivity>> {
  // Verify lead exists and user has access
  const lead = await prisma.lead.findFirst({
    where: buildLeadWhere(user.orgId, user, { id: leadId }),
  });

  if (!lead) {
    throw Errors.notFound('Lead');
  }

  const skip = calcSkip(pagination);

  const [activities, totalCount] = await Promise.all([
    prisma.leadActivity.findMany({
      where: { leadId, organizationId: user.orgId },
      skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.leadActivity.count({
      where: { leadId, organizationId: user.orgId },
    }),
  ]);

  return buildOffsetPaginationResult(activities, totalCount, pagination);
}

// ---------------------------------------------------------------------------
// CSV import
// ---------------------------------------------------------------------------

interface CsvRow {
  firstName?: string;
  first_name?: string;
  lastName?: string;
  last_name?: string;
  email?: string;
  phone?: string;
  company?: string;
  title?: string;
  linkedinUrl?: string;
  linkedin_url?: string;
  source?: string;
  notes?: string;
}

/**
 * Imports leads from a CSV buffer. Parses, validates, deduplicates, and
 * batch-inserts. Returns counts of created, duplicates, and errors.
 */
export async function importLeads(
  csvBuffer: Buffer,
  orgId: string,
  user: AuthenticatedUser
): Promise<ImportResult> {
  const errors: string[] = [];
  let created = 0;
  let duplicates = 0;

  // Parse the CSV
  let rows: CsvRow[];
  try {
    rows = csvParse(csvBuffer, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    }) as CsvRow[];
  } catch (err) {
    throw Errors.badRequest(
      `CSV parsing failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  if (rows.length === 0) {
    return { created: 0, duplicates: 0, errors: ['CSV file is empty'] };
  }

  // Collect all valid leads and duplicates
  const validLeads: Array<{
    organizationId: string;
    firstName: string;
    lastName: string;
    email: string;
    phone: string | null;
    company: string | null;
    title: string | null;
    linkedinUrl: string | null;
    source: LeadSource;
    notes: string | null;
    customFields: object;
    status: LeadStatus;
  }> = [];

  const emailsSeen = new Set<string>();

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNum = i + 2; // 1-indexed + header row

    // Normalize column names (support both camelCase and snake_case)
    const firstName = row.firstName ?? row.first_name ?? '';
    const lastName = row.lastName ?? row.last_name ?? '';
    const email = row.email ?? '';
    const phone = row.phone ?? null;
    const company = row.company ?? null;
    const title = row.title ?? null;
    const linkedinUrl = row.linkedinUrl ?? row.linkedin_url ?? null;
    const sourceRaw = (row.source ?? 'MANUAL_IMPORT').toUpperCase();
    const notes = row.notes ?? null;

    // Validate required fields
    if (!firstName.trim()) {
      errors.push(`Row ${rowNum}: firstName is required`);
      continue;
    }

    if (!lastName.trim()) {
      errors.push(`Row ${rowNum}: lastName is required`);
      continue;
    }

    if (!email.trim()) {
      errors.push(`Row ${rowNum}: email is required`);
      continue;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      errors.push(`Row ${rowNum}: invalid email "${email}"`);
      continue;
    }

    // Validate source enum
    if (!Object.values(LeadSource).includes(sourceRaw as LeadSource)) {
      errors.push(
        `Row ${rowNum}: invalid source "${row.source}". Valid values: ${Object.values(LeadSource).join(', ')}`
      );
      continue;
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Track intra-batch duplicates
    if (emailsSeen.has(normalizedEmail)) {
      duplicates++;
      continue;
    }
    emailsSeen.add(normalizedEmail);

    validLeads.push({
      organizationId: orgId,
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: normalizedEmail,
      phone: phone && phone.trim() ? phone.trim() : null,
      company: company && company.trim() ? company.trim() : null,
      title: title && title.trim() ? title.trim() : null,
      linkedinUrl: linkedinUrl && linkedinUrl.trim() ? linkedinUrl.trim() : null,
      source: sourceRaw as LeadSource,
      notes: notes && notes.trim() ? notes.trim() : null,
      customFields: {},
      status: LeadStatus.NEW,
    });
  }

  if (validLeads.length === 0) {
    return { created, duplicates, errors };
  }

  // Find existing emails in this org to detect DB-level duplicates
  const emailsToInsert = validLeads.map((l) => l.email);
  const existingLeads = await prisma.lead.findMany({
    where: {
      organizationId: orgId,
      email: { in: emailsToInsert },
    },
    select: { email: true },
  });

  const existingEmailSet = new Set(existingLeads.map((l) => l.email));

  const newLeads = validLeads.filter((l) => {
    if (existingEmailSet.has(l.email)) {
      duplicates++;
      return false;
    }
    return true;
  });

  if (newLeads.length > 0) {
    const result = await prisma.lead.createMany({
      data: newLeads,
      skipDuplicates: true,
    });
    created = result.count;
  }

  // Write audit trail for the import
  await writeAuditTrail({
    organizationId: orgId,
    actorId: user.id,
    entityType: 'Lead',
    entityId: orgId,
    action: AuditAction.CREATED,
    metadata: {
      action: 'csv_import',
      created,
      duplicates,
      errorCount: errors.length,
    },
  });

  logger.info('Lead CSV import complete', {
    orgId,
    actorId: user.id,
    created,
    duplicates,
    errors: errors.length,
  });

  return { created, duplicates, errors };
}

/**
 * Bulk-updates the status of multiple leads. Restricted to leads within the
 * caller's org.
 */
export async function bulkUpdateStatus(
  leadIds: string[],
  status: LeadStatus,
  user: AuthenticatedUser
): Promise<{ updated: number }> {
  // Verify all leads belong to the user's org
  const ownedLeads = await prisma.lead.findMany({
    where: {
      id: { in: leadIds },
      organizationId: user.orgId,
    },
    select: { id: true, status: true },
  });

  if (ownedLeads.length === 0) {
    return { updated: 0 };
  }

  const ownedIds = ownedLeads.map((l) => l.id);

  // Update statuses and create activity records in a transaction
  const activityData = ownedLeads.map((l) => ({
    leadId: l.id,
    organizationId: user.orgId,
    actorId: user.id,
    type: 'STATUS_CHANGE',
    description: `Status changed from ${l.status} to ${status}`,
    metadata: { previousStatus: l.status, newStatus: status } as object,
  }));

  await prisma.$transaction([
    prisma.lead.updateMany({
      where: { id: { in: ownedIds } },
      data: { status },
    }),
    prisma.leadActivity.createMany({
      data: activityData,
    }),
  ]);

  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'Lead',
    entityId: user.orgId,
    action: AuditAction.STATUS_CHANGED,
    metadata: {
      action: 'bulk_status_update',
      leadIds: ownedIds,
      newStatus: status,
      count: ownedIds.length,
    },
  });

  logger.info('Bulk lead status update', {
    orgId: user.orgId,
    actorId: user.id,
    count: ownedIds.length,
    newStatus: status,
  });

  return { updated: ownedIds.length };
}
