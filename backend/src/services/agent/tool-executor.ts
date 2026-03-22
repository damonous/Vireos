// =============================================================================
// Agent Tool Executor — Dispatches GPT-5.2 function calls to Vireos services
// =============================================================================
// This module receives tool name + args from GPT-5.2, validates, calls the
// corresponding service with user context (for org isolation + RBAC), and
// returns a structured result. It never contains business logic — it always
// delegates to existing services.
// =============================================================================

import { logger } from '../../utils/logger';
import type { AuthenticatedUser } from '../../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ToolExecutionResult {
  success: boolean;
  data?: unknown;
  summary: string;
  entityType?: string;
  entityId?: string;
  bossModePath?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Service imports (lazy to avoid circular deps and keep startup fast)
// ---------------------------------------------------------------------------

async function getContentService() {
  return import('../content.service');
}

async function getReviewService() {
  return import('../review.service');
}

async function getPublishService() {
  return import('../publish.service');
}

async function getLeadService() {
  return import('../lead.service');
}

async function getProspectService() {
  return import('../prospect.service');
}

async function getLinkedInCampaignService() {
  const mod = await import('../linkedin-campaign.service');
  return mod.linkedinCampaignService;
}

async function getEmailSequenceService() {
  const mod = await import('../email-sequence.service');
  return mod.emailSequenceService;
}

async function getAnalyticsService() {
  return import('../analytics.service');
}

async function getBillingService() {
  return import('../billing.service');
}

async function getFacebookAdService() {
  return import('../facebook-ad.service');
}

// ---------------------------------------------------------------------------
// Date range helper for analytics
// ---------------------------------------------------------------------------

function resolveDateRange(period?: string): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  const days = period === '7d' ? 7 : period === '90d' ? 90 : 30;
  from.setDate(from.getDate() - days);
  return { from, to };
}

// ---------------------------------------------------------------------------
// Executor
// ---------------------------------------------------------------------------

export async function executeToolCall(
  toolName: string,
  args: Record<string, unknown>,
  user: AuthenticatedUser
): Promise<ToolExecutionResult> {
  const startMs = Date.now();

  try {
    const result = await dispatch(toolName, args, user);
    const durationMs = Date.now() - startMs;
    logger.info('Agent tool executed', { toolName, durationMs, success: result.success, userId: user.id });
    return result;
  } catch (err) {
    const durationMs = Date.now() - startMs;
    const message = err instanceof Error ? err.message : String(err);
    logger.error('Agent tool execution failed', { toolName, durationMs, error: message, userId: user.id });
    return {
      success: false,
      summary: `Failed to execute ${toolName}: ${message}`,
      error: message,
    };
  }
}

async function dispatch(
  toolName: string,
  args: Record<string, unknown>,
  user: AuthenticatedUser
): Promise<ToolExecutionResult> {
  switch (toolName) {
    // -----------------------------------------------------------------------
    // Content
    // -----------------------------------------------------------------------
    case 'generate_content': {
      const svc = await getContentService();
      const draft = await svc.generateContent(
        { prompt: args['prompt'] as string, title: args['title'] as string | undefined },
        user
      ) as any;
      return {
        success: true,
        data: { id: draft.id, title: draft.title, status: draft.status },
        summary: `Created draft "${draft.title}" with content for all channels.`,
        entityType: 'Draft',
        entityId: draft.id,
        bossModePath: `/content/drafts/${draft.id}`,
      };
    }

    case 'list_drafts': {
      const svc = await getContentService();
      const result = await svc.listDrafts(
        user.orgId,
        user,
        { status: args['status'] as any },
        { page: (args['page'] as number) || 1, limit: (args['limit'] as number) || 20 }
      );
      return {
        success: true,
        data: result,
        summary: `Found ${result.meta.totalCount} draft(s). Showing page ${result.meta.page} of ${result.meta.totalPages}.`,
        bossModePath: '/content/library',
      };
    }

    case 'get_draft': {
      const svc = await getContentService();
      const draft = await svc.getDraft(args['draftId'] as string, user) as any;
      return {
        success: true,
        data: draft,
        summary: `Draft "${draft.title}" (${draft.status}). Created ${new Date(draft.createdAt).toLocaleDateString()}.`,
        entityType: 'Draft',
        entityId: draft.id,
        bossModePath: `/content/drafts/${draft.id}`,
      };
    }

    case 'update_draft': {
      const svc = await getContentService();
      const { draftId, ...updateFields } = args;
      const draft = await svc.updateDraft(draftId as string, updateFields as any, user) as any;
      return {
        success: true,
        data: { id: draft.id, title: draft.title, version: draft.version },
        summary: `Updated draft "${draft.title}" (v${draft.version}).`,
        entityType: 'Draft',
        entityId: draft.id,
        bossModePath: `/content/drafts/${draft.id}`,
      };
    }

    // -----------------------------------------------------------------------
    // Compliance Review
    // -----------------------------------------------------------------------
    case 'submit_for_review': {
      const svc = await getReviewService();
      const draft = await svc.submitForReview(args['draftId'] as string, user) as any;
      return {
        success: true,
        data: { id: draft.id, title: draft.title, status: draft.status },
        summary: `Submitted "${draft.title}" for compliance review.`,
        entityType: 'Draft',
        entityId: draft.id,
        bossModePath: `/reviews/${draft.id}`,
      };
    }

    // -----------------------------------------------------------------------
    // Publishing
    // -----------------------------------------------------------------------
    case 'schedule_publish': {
      const svc = await getPublishService();
      const job = await svc.schedulePost(
        {
          draftId: args['draftId'] as string,
          channel: args['channel'] as any,
          scheduledAt: args['scheduledAt'] as string,
        } as any,
        user
      ) as any;
      return {
        success: true,
        data: { id: job.id, status: job.status, scheduledAt: job.scheduledAt },
        summary: `Scheduled publish to ${args['channel']} for ${args['scheduledAt']}.`,
        entityType: 'PublishJob',
        entityId: job.id,
        bossModePath: `/publish/jobs/${job.id}`,
      };
    }

    case 'publish_now': {
      const svc = await getPublishService();
      const job = await svc.publishNow(
        { draftId: args['draftId'] as string, channel: args['channel'] as any } as any,
        user
      ) as any;
      return {
        success: true,
        data: { id: job.id, status: job.status },
        summary: `Publishing to ${args['channel']} now. Job ID: ${job.id}.`,
        entityType: 'PublishJob',
        entityId: job.id,
        bossModePath: `/publish/jobs/${job.id}`,
      };
    }

    // -----------------------------------------------------------------------
    // Leads
    // -----------------------------------------------------------------------
    case 'create_lead': {
      const svc = await getLeadService();
      const lead = await svc.createLead(args as any, user) as any;
      return {
        success: true,
        data: { id: lead.id, name: `${lead.firstName} ${lead.lastName}`, status: lead.status },
        summary: `Created lead "${lead.firstName} ${lead.lastName}" (${lead.email}).`,
        entityType: 'Lead',
        entityId: lead.id,
        bossModePath: `/leads/${lead.id}`,
      };
    }

    case 'list_leads': {
      const svc = await getLeadService();
      const result = await svc.listLeads(
        user.orgId,
        user,
        { status: args['status'] as any, source: args['source'] as any },
        { page: (args['page'] as number) || 1, limit: (args['limit'] as number) || 20 }
      );
      const data = result as any;
      return {
        success: true,
        data: result,
        summary: `Found ${data.pagination?.totalCount ?? data.data?.length ?? 0} lead(s).`,
        bossModePath: '/leads',
      };
    }

    case 'update_lead_status': {
      const svc = await getLeadService();
      const lead = await svc.updateStatus(
        args['leadId'] as string,
        args['status'] as any,
        user
      ) as any;
      return {
        success: true,
        data: { id: lead.id, status: lead.status },
        summary: `Updated lead "${lead.firstName} ${lead.lastName}" to ${lead.status}.`,
        entityType: 'Lead',
        entityId: lead.id,
        bossModePath: `/leads/${lead.id}`,
      };
    }

    // -----------------------------------------------------------------------
    // Prospect Finder
    // -----------------------------------------------------------------------
    case 'create_prospect_request': {
      const svc = await getProspectService();
      const req = await svc.createRequest(
        {
          criteria: args['criteria'] as any,
          requestedCount: args['requestedCount'] as number | undefined,
        } as any,
        user
      ) as any;
      return {
        success: true,
        data: { id: req.id, status: req.status, requestedCount: req.requestedCount },
        summary: `Created prospect request for ${req.requestedCount} prospects. Status: ${req.status}.`,
        entityType: 'ProspectListRequest',
        entityId: req.id,
        bossModePath: `/prospects/requests/${req.id}`,
      };
    }

    case 'list_prospect_requests': {
      const svc = await getProspectService();
      const result = await svc.listRequests(
        user.orgId,
        user,
        { page: (args['page'] as number) || 1, limit: (args['limit'] as number) || 20 }
      );
      return {
        success: true,
        data: result,
        summary: `Found ${result.meta.totalCount} prospect request(s).`,
        bossModePath: '/prospects',
      };
    }

    // -----------------------------------------------------------------------
    // LinkedIn Campaigns
    // -----------------------------------------------------------------------
    case 'create_linkedin_campaign': {
      const svc = await getLinkedInCampaignService();
      const campaign = await svc.createCampaign(
        {
          name: args['name'] as string,
          description: args['description'] as string | undefined,
          steps: args['steps'] as any,
          dailyLimit: args['dailyLimit'] as number | undefined,
        } as any,
        user
      ) as any;
      return {
        success: true,
        data: { id: campaign.id, name: campaign.name, status: campaign.status },
        summary: `Created LinkedIn campaign "${campaign.name}" with ${(args['steps'] as any[])?.length ?? 0} step(s).`,
        entityType: 'LinkedInCampaign',
        entityId: campaign.id,
        bossModePath: `/linkedin/campaigns/${campaign.id}`,
      };
    }

    case 'list_linkedin_campaigns': {
      const svc = await getLinkedInCampaignService();
      const result = await svc.listCampaigns(
        user.orgId,
        user,
        { status: args['status'] as any, page: (args['page'] as number) || 1, limit: (args['limit'] as number) || 20 } as any
      );
      const data = result as any;
      return {
        success: true,
        data: result,
        summary: `Found ${data.meta?.totalCount ?? data.items?.length ?? 0} LinkedIn campaign(s).`,
        bossModePath: '/linkedin/campaigns',
      };
    }

    case 'activate_linkedin_campaign': {
      const svc = await getLinkedInCampaignService();
      const campaign = await svc.activateCampaign(args['campaignId'] as string, user) as any;
      return {
        success: true,
        data: { id: campaign.id, name: campaign.name, status: campaign.status },
        summary: `Activated LinkedIn campaign "${campaign.name}".`,
        entityType: 'LinkedInCampaign',
        entityId: campaign.id,
        bossModePath: `/linkedin/campaigns/${campaign.id}`,
      };
    }

    // -----------------------------------------------------------------------
    // Facebook Ads
    // -----------------------------------------------------------------------
    case 'create_facebook_ad': {
      const svc = await getFacebookAdService();
      const campaign = await svc.createAdCampaign(
        {
          name: args['name'] as string,
          objective: args['objective'] as string,
          budget: args['budget'] as number | undefined,
          startDate: args['startDate'] as string | undefined,
          endDate: args['endDate'] as string | undefined,
          targeting: args['targeting'] as any,
        } as any,
        user
      ) as any;
      return {
        success: true,
        data: { id: campaign.id, name: campaign.name, status: campaign.status },
        summary: `Created Facebook ad campaign "${campaign.name}".`,
        entityType: 'FacebookAdCampaign',
        entityId: campaign.id,
        bossModePath: `/facebook/ads/${campaign.id}`,
      };
    }

    case 'list_facebook_ads': {
      const svc = await getFacebookAdService();
      const result = await svc.listAdCampaigns(
        user.orgId,
        user,
        { status: args['status'] as any },
        { page: (args['page'] as number) || 1, limit: (args['limit'] as number) || 20 }
      );
      const data = result as any;
      return {
        success: true,
        data: result,
        summary: `Found ${data.meta?.totalCount ?? data.items?.length ?? 0} Facebook ad campaign(s).`,
        bossModePath: '/facebook/ads',
      };
    }

    case 'launch_facebook_ad': {
      const svc = await getFacebookAdService();
      const campaign = await svc.launchCampaign(args['campaignId'] as string, user) as any;
      return {
        success: true,
        data: { id: campaign.id, name: campaign.name, status: campaign.status },
        summary: `Launched Facebook ad campaign "${campaign.name}".`,
        entityType: 'FacebookAdCampaign',
        entityId: campaign.id,
        bossModePath: `/facebook/ads/${campaign.id}`,
      };
    }

    // -----------------------------------------------------------------------
    // Email Sequences
    // -----------------------------------------------------------------------
    case 'create_email_sequence': {
      const svc = await getEmailSequenceService();
      const seq = await svc.createSequence(
        {
          name: args['name'] as string,
          description: args['description'] as string | undefined,
          triggerType: args['triggerType'] as string,
        } as any,
        user
      ) as any;
      return {
        success: true,
        data: { id: seq.id, name: seq.name, status: seq.status },
        summary: `Created email sequence "${seq.name}".`,
        entityType: 'EmailSequence',
        entityId: seq.id,
        bossModePath: `/email/sequences/${seq.id}`,
      };
    }

    case 'enroll_lead_in_sequence': {
      const svc = await getEmailSequenceService();
      const enrollment = await svc.enrollLead(
        args['sequenceId'] as string,
        args['leadId'] as string,
        user
      ) as any;
      return {
        success: true,
        data: { id: enrollment.id, status: enrollment.status },
        summary: `Enrolled lead in email sequence. Enrollment ID: ${enrollment.id}.`,
        entityType: 'EmailEnrollment',
        entityId: enrollment.id,
        bossModePath: `/email/sequences/${args['sequenceId']}`,
      };
    }

    // -----------------------------------------------------------------------
    // Analytics
    // -----------------------------------------------------------------------
    case 'get_analytics_overview': {
      const svc = await getAnalyticsService();
      const range = resolveDateRange(args['period'] as string | undefined);
      const overview = await svc.getOverview(user.orgId, range, user);
      return {
        success: true,
        data: overview,
        summary: 'Retrieved analytics overview with content, lead, and campaign metrics.',
        bossModePath: '/analytics',
      };
    }

    // -----------------------------------------------------------------------
    // Billing
    // -----------------------------------------------------------------------
    case 'get_credit_balance': {
      const svc = await getBillingService();
      const balance = await svc.getCreditBalance(user.orgId, user);
      return {
        success: true,
        data: balance,
        summary: `Current credit balance: ${balance.balance} credits.`,
        bossModePath: '/billing',
      };
    }

    default:
      return {
        success: false,
        summary: `Unknown tool: ${toolName}`,
        error: `Tool "${toolName}" is not registered.`,
      };
  }
}
