import { FacebookAdCampaign, CampaignStatus, LeadSource, LeadStatus, AuditAction, SocialPlatform } from '@prisma/client';
import { prisma } from '../db/client';
import { Errors } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/crypto';
import { writeAudit } from '../utils/audit';
import { AuthenticatedUser, UserRole } from '../types';
import {
  buildOffsetPaginationResult,
  calcSkip,
  OffsetPaginationResult,
} from '../utils/pagination';
import type {
  CreateAdCampaignDto,
  UpdateAdCampaignDto,
  ListAdCampaignsQuery,
  LaunchCampaignDto,
} from '../validators/facebook-ad.validators';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const FB_GRAPH_URL = 'https://graph.facebook.com/v18.0';
const FB_WEBHOOK_VERIFY_TOKEN =
  process.env['FACEBOOK_WEBHOOK_VERIFY_TOKEN'] ??
  process.env['FB_WEBHOOK_VERIFY_TOKEN'] ??
  '';
const FB_AD_ACCOUNT_ENV =
  process.env['FACEBOOK_AD_ACCOUNT_ID'] ??
  process.env['FB_AD_ACCOUNT_ID'] ??
  '';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface FacebookLeadPayload {
  object?: string;
  entry?: Array<{
    id?: string;
    changes?: Array<{
      value?: {
        leadgen_id?: string;
        form_id?: string;
        page_id?: string;
        ad_id?: string;
        campaign_id?: string;
        field_data?: Array<{ name: string; values: string[] }>;
        created_time?: number;
      };
      field?: string;
    }>;
  }>;
}

export interface IngestLeadsResult {
  leadsCreated: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Build org-scoped where clause for FacebookAdCampaign queries.
 * ADVISOR sees only their own campaigns; ADMIN/SUPER_ADMIN see all in org.
 */
function buildCampaignWhere(
  orgId: string,
  user: AuthenticatedUser,
  overrides: Record<string, unknown> = {}
): Record<string, unknown> {
  const base: Record<string, unknown> = { organizationId: orgId };

  if (user.role === UserRole.ADVISOR) {
    base['advisorId'] = user.id;
  }

  return { ...base, ...overrides };
}

function extractStoredAdAccountId(connection: { platformUsername?: string | null }): string | null {
  const value = connection.platformUsername ?? '';
  const match = value.match(/\[ad_account:([^\]]+)\]/i);
  return match?.[1] ?? null;
}

async function fetchFacebookAdAccountId(userAccessToken: string): Promise<string | null> {
  const params = new URLSearchParams({
    fields: 'id,account_id,name,account_status',
    access_token: userAccessToken,
  });

  const response = await fetch(`${FB_GRAPH_URL}/me/adaccounts?${params.toString()}`);

  if (!response.ok) {
    const errorBody = await response.text().catch(() => '');
    logger.warn('Unable to fetch Facebook ad accounts', {
      status: response.status,
      body: errorBody,
    });
    return null;
  }

  const payload = (await response.json()) as {
    data?: Array<{ id?: string; account_id?: string; account_status?: number }>;
  };

  const activeAccount = (payload.data ?? []).find((account) => account.account_status === 1)
    ?? (payload.data ?? [])[0];

  return activeAccount?.account_id ?? activeAccount?.id?.replace(/^act_/, '') ?? null;
}

// ---------------------------------------------------------------------------
// Service functions
// ---------------------------------------------------------------------------

/**
 * Creates a new Facebook Ad Campaign in DRAFT status.
 */
export async function createAdCampaign(
  dto: CreateAdCampaignDto,
  user: AuthenticatedUser
): Promise<FacebookAdCampaign> {
  if (
    user.role !== UserRole.ADVISOR &&
    user.role !== UserRole.ORG_ADMIN &&
    user.role !== UserRole.SUPER_ADMIN
  ) {
    throw Errors.forbidden('Only advisors and org admins can create ad campaigns.');
  }

  const campaign = await prisma.facebookAdCampaign.create({
    data: {
      organizationId: user.orgId,
      advisorId: user.id,
      name: dto.name,
      objective: dto.objective,
      status: CampaignStatus.DRAFT,
      budget: dto.budget ?? null,
      budgetCurrency: dto.budgetCurrency ?? 'USD',
      startDate: dto.startDate ? new Date(dto.startDate) : null,
      endDate: dto.endDate ? new Date(dto.endDate) : null,
      targetingJson: (dto.targetingJson ?? {}) as object,
    },
  });

  await writeAudit({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'FacebookAdCampaign',
    entityId: campaign.id,
    action: AuditAction.CREATED,
    metadata: { name: campaign.name, objective: campaign.objective },
  });

  logger.info('Facebook ad campaign created', {
    campaignId: campaign.id,
    orgId: user.orgId,
    advisorId: user.id,
  });

  return campaign;
}

/**
 * Returns a single campaign. Enforces org isolation and advisor scoping.
 */
export async function getAdCampaign(
  campaignId: string,
  user: AuthenticatedUser
): Promise<FacebookAdCampaign> {
  const where = buildCampaignWhere(user.orgId, user, { id: campaignId });

  const campaign = await prisma.facebookAdCampaign.findFirst({ where });

  if (!campaign) {
    throw Errors.notFound('FacebookAdCampaign');
  }

  return campaign;
}

/**
 * Returns a paginated list of campaigns for the org.
 */
export async function listAdCampaigns(
  orgId: string,
  user: AuthenticatedUser,
  filters: Partial<ListAdCampaignsQuery>,
  pagination: { page: number; limit: number }
): Promise<OffsetPaginationResult<FacebookAdCampaign>> {
  const where = buildCampaignWhere(orgId, user);

  if (filters.status) {
    (where as Record<string, unknown>)['status'] = filters.status;
  }

  const skip = calcSkip(pagination);

  const [campaigns, totalCount] = await Promise.all([
    prisma.facebookAdCampaign.findMany({
      where,
      skip,
      take: pagination.limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.facebookAdCampaign.count({ where }),
  ]);

  return buildOffsetPaginationResult(campaigns, totalCount, pagination);
}

/**
 * Updates a campaign. Only DRAFT campaigns may be updated.
 * Advisors can only update their own; admins can update any in org.
 */
export async function updateAdCampaign(
  campaignId: string,
  dto: UpdateAdCampaignDto,
  user: AuthenticatedUser
): Promise<FacebookAdCampaign> {
  const where = buildCampaignWhere(user.orgId, user, { id: campaignId });

  const existing = await prisma.facebookAdCampaign.findFirst({ where });

  if (!existing) {
    throw Errors.notFound('FacebookAdCampaign');
  }

  if (existing.status !== CampaignStatus.DRAFT) {
    throw Errors.conflict(
      'Only DRAFT campaigns can be updated. Pause or archive the campaign first.'
    );
  }

  const updated = await prisma.facebookAdCampaign.update({
    where: { id: campaignId },
    data: {
      ...(dto.name !== undefined && { name: dto.name }),
      ...(dto.objective !== undefined && { objective: dto.objective }),
      ...(dto.budget !== undefined && { budget: dto.budget }),
      ...(dto.budgetCurrency !== undefined && { budgetCurrency: dto.budgetCurrency }),
      ...(dto.startDate !== undefined && { startDate: new Date(dto.startDate) }),
      ...(dto.endDate !== undefined && { endDate: new Date(dto.endDate) }),
      ...(dto.targetingJson !== undefined && { targetingJson: dto.targetingJson as object }),
    },
  });

  await writeAudit({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'FacebookAdCampaign',
    entityId: campaignId,
    action: AuditAction.UPDATED,
    metadata: { updatedFields: Object.keys(dto) },
  });

  return updated;
}

/**
 * Deletes a campaign. Only DRAFT campaigns may be deleted.
 */
export async function deleteAdCampaign(
  campaignId: string,
  user: AuthenticatedUser
): Promise<void> {
  const where = buildCampaignWhere(user.orgId, user, { id: campaignId });

  const existing = await prisma.facebookAdCampaign.findFirst({ where });

  if (!existing) {
    throw Errors.notFound('FacebookAdCampaign');
  }

  if (existing.status !== CampaignStatus.DRAFT) {
    throw Errors.conflict(
      'Only DRAFT campaigns can be deleted. Archive the campaign first.'
    );
  }

  await prisma.facebookAdCampaign.delete({ where: { id: campaignId } });

  await writeAudit({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'FacebookAdCampaign',
    entityId: campaignId,
    action: AuditAction.DELETED,
    metadata: { name: existing.name },
  });

  logger.info('Facebook ad campaign deleted', {
    campaignId,
    orgId: user.orgId,
    actorId: user.id,
  });
}

/**
 * Launches a campaign by calling the Facebook Marketing API.
 * Campaign must be DRAFT with name and objective set.
 * User must have an active Facebook SocialConnection.
 */
export async function launchCampaign(
  campaignId: string,
  user: AuthenticatedUser,
  dto?: LaunchCampaignDto
): Promise<FacebookAdCampaign> {
  const where = buildCampaignWhere(user.orgId, user, { id: campaignId });

  const campaign = await prisma.facebookAdCampaign.findFirst({ where });

  if (!campaign) {
    throw Errors.notFound('FacebookAdCampaign');
  }

  if (campaign.status !== CampaignStatus.DRAFT && campaign.status !== CampaignStatus.PAUSED) {
    throw Errors.conflict(
      `Campaign must be DRAFT or PAUSED to launch. Current status: ${campaign.status}`
    );
  }

  if (!campaign.name || !campaign.objective) {
    throw Errors.badRequest('Campaign must have a name and objective before launching.');
  }

  // Find active Facebook social connection for this user
  const connection = await prisma.socialConnection.findUnique({
    where: {
      userId_platform: {
        userId: user.id,
        platform: 'FACEBOOK' as SocialPlatform,
      },
    },
  });

  if (!connection || !connection.isActive) {
    throw Errors.badRequest(
      'No active Facebook connection found. Please connect your Facebook account first.'
    );
  }

  // Decrypt the access token
  const pageAccessToken = decrypt(connection.accessToken);
  const userAccessToken = connection.refreshToken ? decrypt(connection.refreshToken) : null;

  // Determine ad account ID
  const adAccountId =
    dto?.adAccountId ??
    extractStoredAdAccountId(connection) ??
    (userAccessToken ? await fetchFacebookAdAccountId(userAccessToken) : null) ??
    (FB_AD_ACCOUNT_ENV || null);

  if (!adAccountId) {
    throw Errors.badRequest(
      'Ad account ID is not available for this Facebook connection. Reconnect Facebook with ads permissions or provide adAccountId in the request.'
    );
  }

  // Call Facebook Marketing API to create campaign
  const fbPayload = {
    name: campaign.name,
    objective: campaign.objective,
    status: 'ACTIVE',
    special_ad_categories: [] as string[],
  };

  let fbResponse: Response;
  try {
    fbResponse = await fetch(
      `${FB_GRAPH_URL}/act_${adAccountId}/campaigns?access_token=${userAccessToken ?? pageAccessToken}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(fbPayload),
      }
    );
  } catch (err) {
    logger.error('Facebook Marketing API call failed', {
      campaignId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw Errors.internal('Failed to reach the Facebook Marketing API. Please try again.');
  }

  if (!fbResponse.ok) {
    let errorBody = '';
    try {
      errorBody = await fbResponse.text();
    } catch {
      // ignore
    }
    logger.error('Facebook Marketing API returned error', {
      campaignId,
      status: fbResponse.status,
      body: errorBody,
    });
    throw new Error(`Facebook API error: ${fbResponse.status} ${errorBody}`);
  }

  const fbResult = (await fbResponse.json()) as { id?: string };
  const fbCampaignId = fbResult.id ?? null;

  // Update local campaign record
  const updated = await prisma.facebookAdCampaign.update({
    where: { id: campaignId },
    data: {
      status: CampaignStatus.ACTIVE,
      fbCampaignId,
    },
  });

  await writeAudit({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'FacebookAdCampaign',
    entityId: campaignId,
    action: AuditAction.STATUS_CHANGED,
    metadata: {
      previousStatus: campaign.status,
      newStatus: CampaignStatus.ACTIVE,
      fbCampaignId,
    },
  });

  logger.info('Facebook ad campaign launched', {
    campaignId,
    fbCampaignId,
    orgId: user.orgId,
    actorId: user.id,
  });

  return updated;
}

/**
 * Pauses an active campaign by calling the Facebook Marketing API.
 */
export async function pauseCampaign(
  campaignId: string,
  user: AuthenticatedUser
): Promise<FacebookAdCampaign> {
  const where = buildCampaignWhere(user.orgId, user, { id: campaignId });

  const campaign = await prisma.facebookAdCampaign.findFirst({ where });

  if (!campaign) {
    throw Errors.notFound('FacebookAdCampaign');
  }

  if (campaign.status !== CampaignStatus.ACTIVE) {
    throw Errors.conflict(
      `Campaign must be ACTIVE to pause. Current status: ${campaign.status}`
    );
  }

  // If we have a Facebook campaign ID, call the API to pause it
  if (campaign.fbCampaignId) {
    const connection = await prisma.socialConnection.findUnique({
      where: {
        userId_platform: {
          userId: user.id,
          platform: 'FACEBOOK' as SocialPlatform,
        },
      },
    });

    if (connection && connection.isActive) {
      const accessToken = connection.refreshToken
        ? decrypt(connection.refreshToken)
        : decrypt(connection.accessToken);

      try {
        const fbResponse = await fetch(
          `${FB_GRAPH_URL}/${campaign.fbCampaignId}?access_token=${accessToken}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: 'PAUSED' }),
          }
        );

        if (!fbResponse.ok) {
          const errorBody = await fbResponse.text();
          logger.warn('Facebook pause API returned non-OK status', {
            campaignId,
            fbCampaignId: campaign.fbCampaignId,
            status: fbResponse.status,
            body: errorBody,
          });
        }
      } catch (err) {
        logger.error('Facebook pause API call failed', {
          campaignId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  const updated = await prisma.facebookAdCampaign.update({
    where: { id: campaignId },
    data: { status: CampaignStatus.PAUSED },
  });

  await writeAudit({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'FacebookAdCampaign',
    entityId: campaignId,
    action: AuditAction.STATUS_CHANGED,
    metadata: {
      previousStatus: campaign.status,
      newStatus: CampaignStatus.PAUSED,
    },
  });

  logger.info('Facebook ad campaign paused', {
    campaignId,
    orgId: user.orgId,
    actorId: user.id,
  });

  return updated;
}

/**
 * Handles the Facebook webhook GET verification challenge.
 * Verifies the hub.verify_token against the configured env var.
 * Returns the challenge string on success, throws 403 on failure.
 */
export function handleWebhookVerification(
  mode: string,
  challenge: string,
  verifyToken: string
): string {
  const expectedToken =
    process.env['FACEBOOK_WEBHOOK_VERIFY_TOKEN'] ??
    process.env['FB_WEBHOOK_VERIFY_TOKEN'] ??
    '';

  if (mode === 'subscribe' && verifyToken === expectedToken) {
    return challenge;
  }

  throw Errors.forbidden('Webhook verification failed: invalid verify_token.');
}

/**
 * Ingests lead data from a Facebook webhook leadgen event.
 * Parses field_data, finds the matching campaign, creates Lead records.
 * Always returns a result without throwing (webhook must always get 200).
 */
export async function ingestFacebookLead(
  payload: FacebookLeadPayload
): Promise<IngestLeadsResult> {
  let leadsCreated = 0;

  if (!payload.entry || !Array.isArray(payload.entry)) {
    return { leadsCreated: 0 };
  }

  for (const entry of payload.entry) {
    if (!entry.changes || !Array.isArray(entry.changes)) continue;

    for (const change of entry.changes) {
      if (!change.value) continue;

      const value = change.value;
      const pageId = value.page_id;
      const fbCampaignIdFromWebhook = value.campaign_id;

      // Find the matching campaign — try by fbCampaignId or pageId
      let campaign: FacebookAdCampaign | null = null;

      if (fbCampaignIdFromWebhook) {
        campaign = await prisma.facebookAdCampaign.findFirst({
          where: { fbCampaignId: fbCampaignIdFromWebhook },
        });
      }

      if (!campaign && pageId) {
        // Fallback: find any active campaign for this org that has a page connection
        // For MVP, we find the first ACTIVE campaign in any org (page association not stored per campaign)
        // The page_id would need to be stored in targetingJson or a separate field
        // For now, attempt to find a campaign where targetingJson contains the page_id
        campaign = await prisma.facebookAdCampaign.findFirst({
          where: {
            status: CampaignStatus.ACTIVE,
            targetingJson: {
              path: ['page_id'],
              equals: pageId,
            },
          },
        });
      }

      if (!campaign) {
        logger.warn('Facebook webhook: no matching campaign found', {
          leadgenId: value.leadgen_id,
          pageId,
          fbCampaignIdFromWebhook,
        });
        continue;
      }

      // Parse field_data for lead information
      const fieldData = value.field_data ?? [];
      const fields: Record<string, string> = {};

      for (const field of fieldData) {
        if (field.name && Array.isArray(field.values) && field.values.length > 0) {
          fields[field.name] = field.values[0] ?? '';
        }
      }

      const email = fields['email'] ?? fields['EMAIL'] ?? '';
      if (!email) {
        logger.warn('Facebook webhook: lead has no email, skipping', {
          leadgenId: value.leadgen_id,
        });
        continue;
      }

      // Parse name
      const fullName = fields['full_name'] ?? fields['name'] ?? '';
      const nameParts = fullName.trim().split(' ');
      const firstName = nameParts[0] ?? '';
      const lastName = nameParts.slice(1).join(' ') || '';

      // Upsert lead (skip if already exists for this email + org)
      try {
        const upsertResult = await prisma.lead.upsert({
          where: {
            organizationId_email: {
              organizationId: campaign.organizationId,
              email: email.toLowerCase(),
            },
          },
          create: {
            organizationId: campaign.organizationId,
            assignedAdvisorId: campaign.advisorId,
            firstName,
            lastName,
            email: email.toLowerCase(),
            source: LeadSource.FACEBOOK_ADS,
            status: LeadStatus.NEW,
            phone: fields['phone_number'] ?? fields['phone'] ?? null,
          },
          update: {
            // On duplicate, do not overwrite; just update the updatedAt
            updatedAt: new Date(),
          },
        });

        // Check if this was a new create or an update (created means leadId is a new one)
        // We track by checking if the created lead was newly inserted
        const wasCreated =
          upsertResult.createdAt.getTime() === upsertResult.updatedAt.getTime() ||
          (Date.now() - upsertResult.createdAt.getTime()) < 5000;

        if (wasCreated) {
          leadsCreated++;

          // Increment campaign leads counter
          await prisma.facebookAdCampaign.update({
            where: { id: campaign.id },
            data: { leads: { increment: 1 } },
          });

          await writeAudit({
            organizationId: campaign.organizationId,
            actorId: campaign.advisorId,
            entityType: 'Lead',
            entityId: upsertResult.id,
            action: AuditAction.CREATED,
            metadata: {
              source: LeadSource.FACEBOOK_ADS,
              leadgenId: value.leadgen_id,
              campaignId: campaign.id,
            },
          });

          // Auto-enroll in email sequence if one is ACTIVE for this org
          try {
            const activeSequence = await prisma.emailSequence.findFirst({
              where: {
                organizationId: campaign.organizationId,
                status: 'ACTIVE',
              },
            });

            if (activeSequence) {
              await prisma.emailEnrollment.create({
                data: {
                  sequenceId: activeSequence.id,
                  leadId: upsertResult.id,
                  organizationId: campaign.organizationId,
                  enrolledById: campaign.advisorId,
                  currentStep: 1,
                  status: 'ACTIVE',
                },
              });

              logger.info('Lead auto-enrolled in email sequence', {
                leadId: upsertResult.id,
                sequenceId: activeSequence.id,
                orgId: campaign.organizationId,
              });
            }
          } catch (enrollErr) {
            logger.error('Failed to auto-enroll lead in email sequence', {
              leadId: upsertResult.id,
              error: enrollErr instanceof Error ? enrollErr.message : String(enrollErr),
            });
          }

          logger.info('Facebook lead ingested', {
            leadId: upsertResult.id,
            campaignId: campaign.id,
            email: email.toLowerCase(),
          });
        }
      } catch (err) {
        logger.error('Failed to upsert Facebook lead', {
          email,
          campaignId: campaign.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return { leadsCreated };
}
