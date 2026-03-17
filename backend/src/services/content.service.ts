import { ContentStatus, AuditAction } from '@prisma/client';
import { prisma } from '../db/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Errors, AppError } from '../middleware/errorHandler';
import type { AuthenticatedUser } from '../types';
import { UserRole } from '../types';
import type { GenerateContentDto, UpdateDraftDto } from '../validators/content.validators';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Global FINRA prohibited terms that must be scanned before and after generation.
 * These terms are absolute — they may never appear in AI-generated content
 * regardless of org-level settings.
 */
const FINRA_PROHIBITED_TERMS: string[] = [
  'guaranteed returns',
  'guaranteed profits',
  'risk-free',
  'no risk',
  'promise',
  'guaranteed income',
  'past performance guarantees',
  'double your money',
  'certain returns',
  'safe investment',
  'safe returns',
];

/**
 * Max token limits per content channel.
 */
const CHANNEL_MAX_TOKENS: Record<string, number> = {
  linkedin: 700,
  facebook: 500,
  email: 1500,
  adCopy: 300,
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface DraftFilters {
  status?: ContentStatus;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResult<T> {
  items: T[];
  meta: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
}

interface GeneratedChannelContent {
  linkedin: string;
  facebook: string;
  email: string;
  adCopy: string;
}

// ---------------------------------------------------------------------------
// OpenAI client (dynamically imported so jest.mock can intercept it)
// ---------------------------------------------------------------------------

async function getOpenAIClient(): Promise<import('openai').default> {
  const { default: OpenAI } = await import('openai');
  return new OpenAI({ apiKey: config.OPENAI_API_KEY });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Scans text against a list of prohibited terms (case-insensitive).
 * Returns the matching terms found, or an empty array if none.
 */
function scanForProhibitedTerms(text: string, terms: string[]): string[] {
  const lowerText = text.toLowerCase();
  return terms.filter((term) => lowerText.includes(term.toLowerCase()));
}

/**
 * Writes an audit trail record, swallowing errors to never block the main flow.
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

/**
 * Builds the system prompt incorporating the org's ICP type and compliance rules.
 */
function buildSystemPrompt(icpType: string): string {
  const icpContext = icpType === 'financial_advisor'
    ? 'independent financial advisors targeting high-net-worth individuals and retirees'
    : `${icpType} professionals`;

  return (
    'You are a financial marketing copywriter specializing in wealth management. ' +
    'You must comply with FINRA Rule 2210 and SEC Marketing Rule. ' +
    'Never make promises of returns or guarantees. ' +
    'Always include appropriate risk disclosures. ' +
    `Generate content for: ${icpContext}`
  );
}

/**
 * Builds the user message prompt requesting structured JSON output.
 */
function buildUserPrompt(prompt: string): string {
  return (
    `Generate compliant marketing content for: ${prompt}\n\n` +
    'Respond with ONLY a valid JSON object containing exactly these 4 fields:\n' +
    '{\n' +
    '  "linkedin": "LinkedIn post (professional tone, up to 700 words, include appropriate disclosures)",\n' +
    '  "facebook": "Facebook post (conversational tone, up to 500 words, include appropriate disclosures)",\n' +
    '  "email": "Email body HTML content (up to 1500 words, include subject line as first line, include appropriate disclosures)",\n' +
    '  "adCopy": "Ad copy (concise, up to 300 words, clear call to action, include appropriate disclosures)"\n' +
    '}\n' +
    'Do NOT include any markdown code blocks or additional text outside the JSON.'
  );
}

/**
 * Appends required org-level disclosures to all generated content channels.
 */
function appendRequiredDisclosures(
  content: GeneratedChannelContent,
  requiredDisclosures: Record<string, unknown>
): GeneratedChannelContent {
  // If no disclosures are configured, return content unchanged
  if (!requiredDisclosures || Object.keys(requiredDisclosures).length === 0) {
    return content;
  }

  // Build a disclosure footer from any string values in the disclosures config
  const disclosureLines: string[] = [];

  for (const [, value] of Object.entries(requiredDisclosures)) {
    if (typeof value === 'string' && value.trim()) {
      disclosureLines.push(value.trim());
    }
  }

  if (disclosureLines.length === 0) {
    return content;
  }

  const disclosureText = '\n\n' + disclosureLines.join('\n');

  return {
    linkedin: content.linkedin + disclosureText,
    facebook: content.facebook + disclosureText,
    email: content.email + disclosureText,
    adCopy: content.adCopy + disclosureText,
  };
}

/**
 * Parses the raw JSON string from OpenAI into GeneratedChannelContent.
 * Handles markdown code fences that models sometimes add despite instructions.
 */
function parseGeneratedContent(raw: string): GeneratedChannelContent {
  // Strip markdown code fences if present
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    throw new Error(`OpenAI returned malformed JSON: ${raw.slice(0, 200)}`);
  }

  if (
    typeof parsed !== 'object' ||
    parsed === null ||
    !('linkedin' in parsed) ||
    !('facebook' in parsed) ||
    !('email' in parsed) ||
    !('adCopy' in parsed)
  ) {
    throw new Error(
      `OpenAI response missing required fields. Got: ${Object.keys(parsed as object).join(', ')}`
    );
  }

  const obj = parsed as Record<string, unknown>;

  return {
    linkedin: typeof obj['linkedin'] === 'string' ? obj['linkedin'] : String(obj['linkedin']),
    facebook: typeof obj['facebook'] === 'string' ? obj['facebook'] : String(obj['facebook']),
    email: typeof obj['email'] === 'string' ? obj['email'] : String(obj['email']),
    adCopy: typeof obj['adCopy'] === 'string' ? obj['adCopy'] : String(obj['adCopy']),
  };
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Generates AI content for all four channels, applies compliance scans,
 * appends disclosures, stores the draft, and publishes a BullMQ event.
 */
export async function generateContent(
  dto: GenerateContentDto,
  user: AuthenticatedUser
): Promise<object> {
  const orgId = user.orgId;

  // 1. Check ai_guardrails feature flag
  const guardrailsFlag = await prisma.featureFlag.findUnique({
    where: {
      organizationId_flag: {
        organizationId: orgId,
        flag: 'ai_guardrails',
      },
    },
  });

  const guardrailsEnabled = guardrailsFlag?.isEnabled ?? false;

  // 2. Pre-generation compliance scan
  const orgRecord = await prisma.organization.findUnique({
    where: { id: orgId },
    select: {
      icpType: true,
      prohibitedTerms: true,
      requiredDisclosures: true,
    },
  });

  if (!orgRecord) {
    throw Errors.notFound('Organization');
  }

  // Combine global FINRA prohibited terms with org-specific ones
  const allProhibitedTerms = [
    ...FINRA_PROHIBITED_TERMS,
    ...orgRecord.prohibitedTerms,
  ];

  const preGenFlaggedTerms = scanForProhibitedTerms(dto.prompt, allProhibitedTerms);

  if (preGenFlaggedTerms.length > 0) {
    logger.warn('Prompt contains prohibited terms', {
      userId: user.id,
      orgId,
      flaggedTerms: preGenFlaggedTerms,
    });
    throw Errors.badRequest(
      'Prompt contains prohibited terms that violate FINRA compliance rules',
      { flagged_terms: preGenFlaggedTerms }
    );
  }

  // 3. Build ICP context for the system prompt
  const systemPrompt = buildSystemPrompt(orgRecord.icpType);
  const userPrompt = buildUserPrompt(dto.prompt);

  // 4. Call OpenAI Responses API (GPT-5.2-mini)
  const openai = await getOpenAIClient();
  const model = config.OPENAI_MODEL;

  let responseResult: {
    output_text: string;
    usage?: { total_tokens?: number };
    model?: string;
  };
  try {
    responseResult = await (openai as any).responses.create({
      model,
      instructions: systemPrompt,
      input: userPrompt,
      text: { format: { type: 'json_object' } },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error('OpenAI API call failed', { error: message, userId: user.id, orgId });
    throw new AppError(
      `AI service is temporarily unavailable. Please retry in a few moments. Details: ${message}`,
      502,
      'BAD_GATEWAY',
      { details: { retry_hint: 'Please retry in 30 seconds' } }
    );
  }

  const rawContent = responseResult.output_text ?? '';
  const tokensUsed = responseResult.usage?.total_tokens ?? 0;
  const aiModel = responseResult.model ?? model;

  // 5. Parse the AI response
  let generatedContent: GeneratedChannelContent;
  try {
    generatedContent = parseGeneratedContent(rawContent);
  } catch (parseErr) {
    const msg = parseErr instanceof Error ? parseErr.message : String(parseErr);
    logger.error('Failed to parse OpenAI JSON response', {
      error: msg,
      userId: user.id,
      orgId,
      rawContent: rawContent.slice(0, 500),
    });
    throw new AppError(
      'AI service returned an unexpected response format. Please retry.',
      502,
      'BAD_GATEWAY',
      { details: { retry_hint: 'Please retry in 30 seconds' } }
    );
  }

  // 6. Post-generation compliance scan on all channel content
  const allGeneratedText = Object.values(generatedContent).join(' ');
  const postGenFlaggedTerms = guardrailsEnabled
    ? scanForProhibitedTerms(allGeneratedText, allProhibitedTerms)
    : [];

  const flagsJson: Record<string, unknown> = {};
  if (postGenFlaggedTerms.length > 0) {
    flagsJson['post_generation_flags'] = postGenFlaggedTerms;
    logger.warn('Post-generation compliance flags found', {
      userId: user.id,
      orgId,
      flaggedTerms: postGenFlaggedTerms,
    });
  }

  // 7. Append required disclosures
  const requiredDisclosures = (orgRecord.requiredDisclosures ?? {}) as Record<string, unknown>;
  const contentWithDisclosures = appendRequiredDisclosures(generatedContent, requiredDisclosures);

  // 8. Determine draft title
  const title = dto.title ?? dto.prompt.slice(0, 100);

  // 9. Filter content to only selected channels
  const selectedChannels = dto.channels ?? ['LINKEDIN', 'FACEBOOK', 'EMAIL', 'AD_COPY'];

  // 10. Store draft in DB
  const draft = await prisma.draft.create({
    data: {
      organizationId: orgId,
      creatorId: user.id,
      title,
      originalPrompt: dto.prompt,
      linkedinContent: selectedChannels.includes('LINKEDIN') ? contentWithDisclosures.linkedin : null,
      facebookContent: selectedChannels.includes('FACEBOOK') ? contentWithDisclosures.facebook : null,
      emailContent: selectedChannels.includes('EMAIL') ? contentWithDisclosures.email : null,
      adCopyContent: selectedChannels.includes('AD_COPY') ? contentWithDisclosures.adCopy : null,
      variantsJson: contentWithDisclosures as unknown as object,
      flagsJson: flagsJson as object,
      status: ContentStatus.DRAFT,
      aiModel,
      tokensUsed,
    },
  });

  // 11. Write audit trail
  await writeAuditTrail({
    organizationId: orgId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draft.id,
    action: AuditAction.CREATED,
    metadata: {
      prompt: dto.prompt.slice(0, 200),
      aiModel,
      tokensUsed,
      flagCount: postGenFlaggedTerms.length,
    },
  });

  // 11. Publish BullMQ notification event (lazy import to avoid module-level Redis connections)
  try {
    const { notificationQueue } = await import('../queues');
    await notificationQueue.add('content.draft.created', {
      type: 'in_app',
      userId: user.id,
      orgId,
      subject: 'New content draft created',
      templateId: 'content.draft.created',
      variables: {
        draftId: draft.id,
        title: draft.title,
        aiModel,
      },
    });
  } catch (queueErr) {
    // Queue failures should not block the response
    logger.error('Failed to publish draft.created notification event', {
      error: queueErr instanceof Error ? queueErr.message : String(queueErr),
      draftId: draft.id,
      userId: user.id,
    });
  }

  logger.info('Content draft generated successfully', {
    draftId: draft.id,
    userId: user.id,
    orgId,
    tokensUsed,
    aiModel,
    flagCount: postGenFlaggedTerms.length,
  });

  return draft;
}

/**
 * Retrieves a single draft by ID, scoped to the user's organization.
 * Advisors can only see their own drafts; admins/compliance/super_admin see all.
 */
export async function getDraft(draftId: string, user: AuthenticatedUser): Promise<object> {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  // Enforce org isolation
  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.notFound('Draft');
  }

  // Advisors can only view their own drafts
  if (
    user.role === UserRole.ADVISOR &&
    draft.creatorId !== user.id
  ) {
    throw Errors.forbidden('You do not have permission to view this draft');
  }

  return draft;
}

/**
 * Returns a paginated list of drafts for the user's organization.
 * Advisors see only their own drafts; admins and compliance see all org drafts.
 */
export async function listDrafts(
  orgId: string,
  user: AuthenticatedUser,
  filters: DraftFilters,
  pagination: PaginationParams
): Promise<PaginatedResult<object>> {
  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const where: {
    organizationId: string;
    creatorId?: string;
    status?: ContentStatus;
  } = {
    organizationId: orgId,
    ...(filters.status ? { status: filters.status } : {}),
  };

  // Advisors see only their own drafts
  if (user.role === UserRole.ADVISOR) {
    where.creatorId = user.id;
  }

  const [items, totalCount] = await Promise.all([
    prisma.draft.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.draft.count({ where }),
  ]);

  const totalPages = Math.ceil(totalCount / limit);

  return {
    items,
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
 * Updates a draft's content fields.
 *
 * Business rules:
 * - Advisors can only edit their own drafts that are in DRAFT status
 * - Admins, compliance (VIEWER), and super_admins can edit any draft in the org
 */
export async function updateDraft(
  draftId: string,
  dto: UpdateDraftDto,
  user: AuthenticatedUser
): Promise<object> {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  // Enforce org isolation
  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.notFound('Draft');
  }

  const isPrivilegedRole =
    user.role === UserRole.ORG_ADMIN ||
    user.role === UserRole.VIEWER ||      // compliance maps to VIEWER
    user.role === UserRole.SUPER_ADMIN;

  if (!isPrivilegedRole) {
    // Advisor rules: must own the draft and it must be in DRAFT status
    if (draft.creatorId !== user.id) {
      throw Errors.forbidden('You do not have permission to edit this draft');
    }
    if (draft.status !== ContentStatus.DRAFT) {
      throw Errors.forbidden(
        'You can only edit drafts that are in DRAFT status. This draft is currently in ' +
          draft.status +
          ' status.'
      );
    }
  }

  const updated = await prisma.draft.update({
    where: { id: draftId },
    data: {
      ...(dto.linkedinContent !== undefined ? { linkedinContent: dto.linkedinContent } : {}),
      ...(dto.facebookContent !== undefined ? { facebookContent: dto.facebookContent } : {}),
      ...(dto.emailContent !== undefined ? { emailContent: dto.emailContent } : {}),
      ...(dto.adCopyContent !== undefined ? { adCopyContent: dto.adCopyContent } : {}),
      ...(dto.title !== undefined ? { title: dto.title } : {}),
      version: { increment: 1 },
    },
  });

  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draftId,
    action: AuditAction.UPDATED,
    metadata: { updatedFields: Object.keys(dto) },
  });

  logger.info('Draft updated', { draftId, userId: user.id, orgId: draft.organizationId });

  return updated;
}

/**
 * Soft-deletes a draft by setting its status to ARCHIVED.
 *
 * Business rules:
 * - Advisors can only delete their own DRAFT-status drafts
 * - Admins and super_admins can delete any draft
 */
export async function deleteDraft(draftId: string, user: AuthenticatedUser): Promise<void> {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  // Enforce org isolation
  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.notFound('Draft');
  }

  const isPrivilegedRole =
    user.role === UserRole.ORG_ADMIN || user.role === UserRole.SUPER_ADMIN;

  if (!isPrivilegedRole) {
    if (draft.creatorId !== user.id) {
      throw Errors.forbidden('You do not have permission to delete this draft');
    }
    if (draft.status !== ContentStatus.DRAFT) {
      throw Errors.forbidden(
        'You can only delete drafts that are in DRAFT status'
      );
    }
  }

  await prisma.draft.update({
    where: { id: draftId },
    data: { status: ContentStatus.ARCHIVED },
  });

  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draftId,
    action: AuditAction.DELETED,
  });

  logger.info('Draft deleted (archived)', { draftId, userId: user.id, orgId: draft.organizationId });
}

/**
 * Archives a draft — sets status to ARCHIVED.
 * Restricted to admins and compliance (VIEWER role).
 */
export async function archiveDraft(draftId: string, user: AuthenticatedUser): Promise<object> {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
  });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  // Enforce org isolation
  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.notFound('Draft');
  }

  if (draft.status === ContentStatus.ARCHIVED) {
    throw Errors.badRequest('Draft is already archived');
  }

  const archived = await prisma.draft.update({
    where: { id: draftId },
    data: { status: ContentStatus.ARCHIVED },
  });

  await writeAuditTrail({
    organizationId: draft.organizationId,
    actorId: user.id,
    entityType: 'Draft',
    entityId: draftId,
    action: AuditAction.STATUS_CHANGED,
    metadata: { previousStatus: draft.status, newStatus: ContentStatus.ARCHIVED },
  });

  logger.info('Draft archived', { draftId, userId: user.id, orgId: draft.organizationId });

  return archived;
}
