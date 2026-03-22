import { ContentStatus, AuditAction, NotificationType, UserRole as PrismaUserRole } from '@prisma/client';
import { prisma } from '../db/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Errors, AppError } from '../middleware/errorHandler';
import type { AuthenticatedUser } from '../types';
import { UserRole } from '../types';
import type { GenerateContentDto, UpdateDraftDto } from '../validators/content.validators';
import { createVersion } from './version.service';

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
 * Hard character limits per content channel before persistence.
 * These are intentionally conservative to keep advisor-facing output usable.
 */
const CHANNEL_MAX_CHARS: Record<keyof GeneratedChannelContent, number> = {
  linkedin: 1300,
  facebook: 1500,
  email: 2200,
  adCopy: 500,
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
  const negationPattern =
    /\b(avoid|avoids|avoiding|without|omit|excluding|exclude|excluded|never use|do not use|don't use|must not use|should not use|prohibited|restricted|forbidden|ban|banned|no)\b/;

  return terms.filter((term) => {
    const normalizedTerm = term.toLowerCase().trim();
    const escapedTerm = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = new RegExp(`\\b${escapedTerm}(?:s)?\\b`, 'gi');

    let match: RegExpExecArray | null;
    while ((match = pattern.exec(lowerText)) !== null) {
      const contextStart = Math.max(0, match.index - 160);
      const prefix = lowerText.slice(contextStart, match.index);
      const clauseStart = Math.max(
        prefix.lastIndexOf('.'),
        prefix.lastIndexOf('!'),
        prefix.lastIndexOf('?'),
        prefix.lastIndexOf('\n'),
        prefix.lastIndexOf(':'),
        prefix.lastIndexOf(';')
      );
      const localClause = prefix.slice(clauseStart + 1).trim();

      // Allow prompts that mention prohibited terms only to forbid them,
      // e.g. "avoid guaranteed returns" or "no promises/guarantees".
      if (negationPattern.test(localClause)) {
        continue;
      }

      return true;
    }

    return false;
  });
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

  const appendChannelDisclosure = (channelContent: string, disclosure: unknown): string => {
    if (typeof disclosure !== 'string' || !disclosure.trim()) {
      return channelContent;
    }

    const normalizedDisclosure = disclosure.trim();
    if (channelContent.toLowerCase().includes(normalizedDisclosure.toLowerCase())) {
      return channelContent;
    }

    return `${channelContent}\n\n${normalizedDisclosure}`;
  };

  return {
    linkedin: appendChannelDisclosure(content.linkedin, requiredDisclosures['linkedin']),
    facebook: appendChannelDisclosure(content.facebook, requiredDisclosures['facebook']),
    email: appendChannelDisclosure(content.email, requiredDisclosures['email']),
    adCopy: appendChannelDisclosure(content.adCopy, requiredDisclosures['adCopy']),
  };
}

function normalizeWhitespace(text: string): string {
  return text
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function dedupeConsecutiveLines(text: string): string {
  const deduped: string[] = [];
  for (const rawLine of text.split('\n')) {
    const line = rawLine.trimEnd();
    const previous = deduped[deduped.length - 1];
    if (line && previous?.trim() === line.trim()) {
      continue;
    }
    deduped.push(line);
  }
  return deduped.join('\n').trim();
}

function truncateAtSentenceBoundary(text: string, maxChars: number): string {
  if (text.length <= maxChars) {
    return text;
  }

  const candidate = text.slice(0, maxChars).trim();
  const lastBoundary = Math.max(
    candidate.lastIndexOf('. '),
    candidate.lastIndexOf('! '),
    candidate.lastIndexOf('? '),
    candidate.lastIndexOf('\n\n')
  );

  if (lastBoundary >= Math.floor(maxChars * 0.6)) {
    return candidate.slice(0, lastBoundary + 1).trim();
  }

  return `${candidate.slice(0, Math.max(0, maxChars - 1)).trimEnd()}…`;
}

function enforceChannelLimit(
  channelContent: string,
  maxChars: number,
  disclosure: unknown
): string {
  const cleaned = dedupeConsecutiveLines(normalizeWhitespace(channelContent));
  if (cleaned.length <= maxChars) {
    return cleaned;
  }

  const normalizedDisclosure =
    typeof disclosure === 'string' && disclosure.trim()
      ? normalizeWhitespace(disclosure)
      : '';

  if (!normalizedDisclosure || !cleaned.toLowerCase().includes(normalizedDisclosure.toLowerCase())) {
    return truncateAtSentenceBoundary(cleaned, maxChars);
  }

  const contentWithoutDisclosure = cleaned
    .replace(new RegExp(`${normalizedDisclosure.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    .trimEnd();
  const reservedChars = normalizedDisclosure.length + 2;
  const maxBodyChars = Math.max(80, maxChars - reservedChars);
  const truncatedBody = truncateAtSentenceBoundary(contentWithoutDisclosure, maxBodyChars);

  return `${truncatedBody}\n\n${normalizedDisclosure}`.trim();
}

function enforceChannelContentLimits(
  content: GeneratedChannelContent,
  requiredDisclosures: Record<string, unknown>
): GeneratedChannelContent {
  return {
    linkedin: enforceChannelLimit(
      content.linkedin,
      CHANNEL_MAX_CHARS.linkedin,
      requiredDisclosures['linkedin']
    ),
    facebook: enforceChannelLimit(
      content.facebook,
      CHANNEL_MAX_CHARS.facebook,
      requiredDisclosures['facebook']
    ),
    email: enforceChannelLimit(
      content.email,
      CHANNEL_MAX_CHARS.email,
      requiredDisclosures['email']
    ),
    adCopy: enforceChannelLimit(
      content.adCopy,
      CHANNEL_MAX_CHARS.adCopy,
      requiredDisclosures['adCopy']
    ),
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
// Notification helpers (mirrors review.service.ts patterns)
// ---------------------------------------------------------------------------

/**
 * Finds compliance officers (COMPLIANCE or ADMIN role) within the organization.
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
    logger.warn('Failed to find compliance officers for auto-flag notification', {
      error: err instanceof Error ? err.message : String(err),
      organizationId,
    });
    return [];
  }
}

/**
 * Persists an in-app notification for a single user. Fire-and-forget safe.
 */
async function sendNotification(params: {
  organizationId: string;
  userId: string;
  type: NotificationType;
  title: string;
  body: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
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
    logger.info('NOTIFICATION: Auto-flag notification sent', {
      userId: params.userId,
      type: params.type,
      title: params.title,
    });
  } catch (err) {
    logger.warn('Failed to create auto-flag notification', {
      error: err instanceof Error ? err.message : String(err),
      userId: params.userId,
      type: params.type,
    });
  }
}

/**
 * Notifies compliance officers that a draft was auto-flagged and routed
 * to PENDING_REVIEW. Runs fire-and-forget so it never blocks the response.
 */
function notifyComplianceOfAutoFlag(
  organizationId: string,
  draftId: string,
  draftTitle: string,
  creatorId: string,
  flaggedTerms: string[]
): void {
  // Fire-and-forget — we intentionally do not await this
  void (async () => {
    try {
      const officerIds = await findComplianceOfficerIds(organizationId);
      for (const officerId of officerIds) {
        await sendNotification({
          organizationId,
          userId: officerId,
          type: NotificationType.CONTENT_SUBMITTED,
          title: 'Auto-flagged content requires review',
          body:
            `A draft titled "${draftTitle}" was auto-flagged for prohibited terms ` +
            `(${flaggedTerms.join(', ')}) and routed to compliance review.`,
          metadata: { draftId, creatorId, flaggedTerms, autoFlagged: true },
        });
      }
    } catch (err) {
      logger.warn('Failed to notify compliance officers of auto-flagged draft', {
        error: err instanceof Error ? err.message : String(err),
        draftId,
        organizationId,
      });
    }
  })();
}

// ---------------------------------------------------------------------------
// Compliance scoring
// ---------------------------------------------------------------------------

/**
 * Calculates a deterministic compliance score between 0.0 and 1.0 based on:
 * - Prohibited terms found: subtract 0.15 per flagged term (min 0.0)
 * - Missing disclosures: subtract 0.2 if org has required disclosures but they are absent
 * - Short content: subtract 0.1 if any channel content is less than 50 chars
 */
export function calculateComplianceScore(params: {
  flaggedTermCount: number;
  hasRequiredDisclosures: boolean;
  disclosuresAppended: boolean;
  channelContents: (string | null)[];
}): number {
  let score = 1.0;

  // Penalty for prohibited terms: -0.15 per term
  score -= params.flaggedTermCount * 0.15;

  // Penalty for missing disclosures: -0.2 if org requires them but they were not appended
  if (params.hasRequiredDisclosures && !params.disclosuresAppended) {
    score -= 0.2;
  }

  // Penalty for short content: -0.1 if any selected channel has content < 50 chars
  const hasShortContent = params.channelContents
    .filter((c): c is string => c !== null)
    .some((c) => c.length < 50);
  if (hasShortContent) {
    score -= 0.1;
  }

  // Clamp to [0.0, 1.0]
  return Math.max(0.0, Math.min(1.0, parseFloat(score.toFixed(4))));
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
  const normalizedContent = enforceChannelContentLimits(contentWithDisclosures, requiredDisclosures);

  // 8. Determine draft title
  const title = dto.title ?? dto.prompt.slice(0, 100);

  // 9. Filter content to only selected channels
  const selectedChannels = dto.channels ?? ['LINKEDIN', 'FACEBOOK', 'EMAIL', 'AD_COPY'];

  // 9a. Calculate compliance score
  const hasRequiredDisclosures =
    requiredDisclosures !== null &&
    typeof requiredDisclosures === 'object' &&
    Object.values(requiredDisclosures).some(
      (v) => typeof v === 'string' && v.trim().length > 0
    );

  // Disclosures are considered appended if the org has them configured and
  // the appendRequiredDisclosures function was called (it always is at step 7).
  // The function only skips appending if the disclosure is already present,
  // so we treat disclosures as appended when they are configured.
  const disclosuresAppended = hasRequiredDisclosures;

  const selectedChannelContents: (string | null)[] = [
    selectedChannels.includes('LINKEDIN') ? contentWithDisclosures.linkedin : null,
    selectedChannels.includes('FACEBOOK') ? contentWithDisclosures.facebook : null,
    selectedChannels.includes('EMAIL') ? contentWithDisclosures.email : null,
    selectedChannels.includes('AD_COPY') ? contentWithDisclosures.adCopy : null,
  ];

  const complianceScore = calculateComplianceScore({
    flaggedTermCount: postGenFlaggedTerms.length,
    hasRequiredDisclosures,
    disclosuresAppended,
    channelContents: selectedChannelContents,
  });

  // 10. Determine draft status — auto-route to PENDING_REVIEW if flagged OR low score
  const autoFlagged = postGenFlaggedTerms.length > 0;
  const lowComplianceScore = complianceScore < 0.7;
  const draftStatus = autoFlagged || lowComplianceScore
    ? ContentStatus.PENDING_REVIEW
    : ContentStatus.DRAFT;

  if (flagsJson && lowComplianceScore && !autoFlagged) {
    flagsJson['low_compliance_score'] = complianceScore;
  }

  // 11. Store draft in DB
  const draft = await prisma.draft.create({
    data: {
      organizationId: orgId,
      creatorId: user.id,
      title,
      originalPrompt: dto.prompt,
      linkedinContent: selectedChannels.includes('LINKEDIN') ? normalizedContent.linkedin : null,
      facebookContent: selectedChannels.includes('FACEBOOK') ? normalizedContent.facebook : null,
      emailContent: selectedChannels.includes('EMAIL') ? normalizedContent.email : null,
      adCopyContent: selectedChannels.includes('AD_COPY') ? normalizedContent.adCopy : null,
      variantsJson: normalizedContent as unknown as object,
      flagsJson: flagsJson as object,
      status: draftStatus,
      complianceScore,
      aiModel,
      tokensUsed,
    },
  });

  // 12. Write audit trail — CREATED
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
      complianceScore,
    },
  });

  // 13. If auto-flagged or low compliance score, write a SUBMITTED audit entry and notify compliance
  if (autoFlagged) {
    await writeAuditTrail({
      organizationId: orgId,
      actorId: user.id,
      entityType: 'Draft',
      entityId: draft.id,
      action: AuditAction.SUBMITTED,
      metadata: {
        autoFlagged: true,
        flaggedTerms: postGenFlaggedTerms,
        complianceScore,
        previousStatus: null,
        newStatus: ContentStatus.PENDING_REVIEW,
      },
    });

    // Fire-and-forget: notify compliance officers
    notifyComplianceOfAutoFlag(orgId, draft.id, title, user.id, postGenFlaggedTerms);

    logger.info('Draft auto-flagged and routed to PENDING_REVIEW', {
      draftId: draft.id,
      userId: user.id,
      orgId,
      flaggedTerms: postGenFlaggedTerms,
      complianceScore,
    });
  } else if (lowComplianceScore) {
    // Low score but no flagged terms — still route to review
    await writeAuditTrail({
      organizationId: orgId,
      actorId: user.id,
      entityType: 'Draft',
      entityId: draft.id,
      action: AuditAction.SUBMITTED,
      metadata: {
        autoFlagged: false,
        lowComplianceScore: true,
        complianceScore,
        previousStatus: null,
        newStatus: ContentStatus.PENDING_REVIEW,
      },
    });

    logger.info('Draft routed to PENDING_REVIEW due to low compliance score', {
      draftId: draft.id,
      userId: user.id,
      orgId,
      complianceScore,
    });
  }

  // 14. Publish BullMQ notification event (lazy import to avoid module-level Redis connections)
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
    complianceScore,
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

  // Snapshot current state before overwriting
  await createVersion(draft, user.id, 'Pre-edit snapshot (advisor/admin content update)');

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
