import {
  CampaignStatus,
  CreditTransactionType,
  LeadSource,
  LeadStatus,
  PublishJobStatus,
  SocialPlatform,
  ContentChannel,
  ProspectRequestStatus,
} from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { UserRole, AuthenticatedUser } from '../types';
import type { DateRange } from '../validators/analytics.validators';

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

export interface OverviewMetrics {
  contentCreated: number;
  contentPublished: number;
  totalLeads: number;
  newLeads: number;
  totalEmailsSent: number;
  emailOpenRate: number;
  activeCampaigns: number;
  creditsUsed: number;
}

export interface LinkedInCampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  enrolled: number;
  replied: number;
}

export interface LinkedInMetrics {
  postsPublished: number;
  activeCampaigns: number;
  totalEnrolled: number;
  totalReplied: number;
  replyRate: number;
  campaignList: LinkedInCampaignSummary[];
}

export interface FacebookCampaignSummary {
  id: string;
  name: string;
  status: CampaignStatus;
  impressions: number;
  clicks: number;
  leads: number;
  spend: number;
}

export interface FacebookMetrics {
  postsPublished: number;
  activeCampaigns: number;
  totalImpressions: number;
  totalClicks: number;
  ctr: number;
  totalLeads: number;
  totalSpend: number;
  cpl: number;
  campaignList: FacebookCampaignSummary[];
}

export interface EmailMetrics {
  totalSent: number;
  totalDelivered: number;
  totalOpened: number;
  totalClicked: number;
  deliveryRate: number;
  openRate: number;
  clickRate: number;
  bounceRate: number;
  unsubscribeCount: number;
}

export interface LeadMetrics {
  total: number;
  byStatus: Record<LeadStatus, number>;
  bySource: Record<LeadSource, number>;
  conversionRate: number;
  averageTimeToClient: number | null;
}

export interface ProspectMetrics {
  requestsTotal: number;
  requestsFulfilled: number;
  totalProspectsImported: number;
  creditsConsumed: number;
  conversionToLead: number;
}

// ---------------------------------------------------------------------------
// Org filter helper
// ---------------------------------------------------------------------------

/**
 * Builds a Prisma `where` clause fragment enforcing org isolation.
 *
 * - Advisors: scoped to their own org AND their own user ID on advisor-scoped tables
 * - Admin / Compliance / Super Admin: full org scope
 *
 * The `advisorField` param is the Prisma field name that stores the advisor/creator ID
 * on the model. Pass `null` when the model doesn't have a user-level scoping field
 * (e.g. Lead, EmailSend).
 */
function buildOrgFilter(
  orgId: string,
  user: AuthenticatedUser,
  advisorField: string | null = null
): Record<string, unknown> {
  const base: Record<string, unknown> = { organizationId: orgId };

  if (
    user.role === UserRole.ADVISOR &&
    advisorField !== null
  ) {
    base[advisorField] = user.id;
  }

  return base;
}

/**
 * Asserts the requesting user has access to the given orgId.
 * SUPER_ADMIN can query any org. All others must match their own orgId.
 */
function assertOrgAccess(orgId: string, user: AuthenticatedUser): void {
  if (
    user.role !== UserRole.SUPER_ADMIN &&
    orgId !== user.orgId
  ) {
    throw Errors.forbidden(
      'Access denied. You do not have permission to access this organization.'
    );
  }
}

// ---------------------------------------------------------------------------
// Service methods
// ---------------------------------------------------------------------------

/**
 * Returns high-level aggregate metrics for the dashboard overview.
 */
export async function getOverview(
  orgId: string,
  range: DateRange,
  user: AuthenticatedUser
): Promise<OverviewMetrics> {
  assertOrgAccess(orgId, user);

  const dateFilter = { gte: range.from, lte: range.to };
  const advisorFilter =
    user.role === UserRole.ADVISOR ? { creatorId: user.id } : {};
  const advisorPublishFilter =
    user.role === UserRole.ADVISOR ? { advisorId: user.id } : {};

  const [
    contentCreated,
    contentPublished,
    totalLeads,
    newLeads,
    emailSendsData,
    linkedInActive,
    facebookActive,
    creditsData,
  ] = await Promise.all([
    // Drafts created in range
    prisma.draft.count({
      where: {
        organizationId: orgId,
        ...advisorFilter,
        createdAt: dateFilter,
      },
    }),

    // Publish jobs completed (PUBLISHED status) in range
    prisma.publishJob.count({
      where: {
        organizationId: orgId,
        ...advisorPublishFilter,
        status: PublishJobStatus.PUBLISHED,
        publishedAt: dateFilter,
      },
    }),

    // Total leads created in range
    prisma.lead.count({
      where: {
        organizationId: orgId,
        createdAt: dateFilter,
      },
    }),

    // Leads with status NEW created in range
    prisma.lead.count({
      where: {
        organizationId: orgId,
        status: LeadStatus.NEW,
        createdAt: dateFilter,
      },
    }),

    // Email sends in range (for open rate calculation)
    prisma.emailSend.findMany({
      where: {
        organizationId: orgId,
        sentAt: dateFilter,
      },
      select: {
        openedAt: true,
      },
    }),

    // Active LinkedIn campaigns
    prisma.linkedInCampaign.count({
      where: {
        organizationId: orgId,
        ...(user.role === UserRole.ADVISOR ? { advisorId: user.id } : {}),
        status: CampaignStatus.ACTIVE,
      },
    }),

    // Active Facebook ad campaigns
    prisma.facebookAdCampaign.count({
      where: {
        organizationId: orgId,
        ...(user.role === UserRole.ADVISOR ? { advisorId: user.id } : {}),
        status: CampaignStatus.ACTIVE,
      },
    }),

    // Sum of DEBIT credit transactions in range
    prisma.creditTransaction.aggregate({
      where: {
        organizationId: orgId,
        type: CreditTransactionType.DEBIT,
        createdAt: dateFilter,
      },
      _sum: { amount: true },
    }),
  ]);

  const totalEmailsSent = emailSendsData.length;
  const totalOpened = emailSendsData.filter((e) => e.openedAt !== null).length;
  const emailOpenRate =
    totalEmailsSent > 0
      ? Math.round((totalOpened / totalEmailsSent) * 10000) / 100
      : 0;

  logger.debug('Overview metrics computed', { orgId, range, userId: user.id });

  return {
    contentCreated,
    contentPublished,
    totalLeads,
    newLeads,
    totalEmailsSent,
    emailOpenRate,
    activeCampaigns: linkedInActive + facebookActive,
    creditsUsed: creditsData._sum.amount ?? 0,
  };
}

/**
 * Returns LinkedIn-specific campaign and publishing analytics.
 */
export async function getLinkedInAnalytics(
  orgId: string,
  range: DateRange,
  user: AuthenticatedUser
): Promise<LinkedInMetrics> {
  assertOrgAccess(orgId, user);

  const dateFilter = { gte: range.from, lte: range.to };
  const advisorFilter =
    user.role === UserRole.ADVISOR ? { advisorId: user.id } : {};

  const [postsPublished, campaigns] = await Promise.all([
    // LinkedIn posts published in range
    prisma.publishJob.count({
      where: {
        organizationId: orgId,
        ...(user.role === UserRole.ADVISOR ? { advisorId: user.id } : {}),
        platform: SocialPlatform.LINKEDIN,
        channel: ContentChannel.LINKEDIN,
        status: PublishJobStatus.PUBLISHED,
        publishedAt: dateFilter,
      },
    }),

    // All LinkedIn campaigns in the org (for advisor: their own)
    prisma.linkedInCampaign.findMany({
      where: {
        organizationId: orgId,
        ...advisorFilter,
      },
      select: {
        id: true,
        name: true,
        status: true,
        totalEnrolled: true,
        totalReplied: true,
      },
    }),
  ]);

  const activeCampaigns = campaigns.filter(
    (c) => c.status === CampaignStatus.ACTIVE
  ).length;

  const totalEnrolled = campaigns.reduce((sum, c) => sum + c.totalEnrolled, 0);
  const totalReplied = campaigns.reduce((sum, c) => sum + c.totalReplied, 0);
  const replyRate =
    totalEnrolled > 0
      ? Math.round((totalReplied / totalEnrolled) * 10000) / 100
      : 0;

  const campaignList: LinkedInCampaignSummary[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    enrolled: c.totalEnrolled,
    replied: c.totalReplied,
  }));

  return {
    postsPublished,
    activeCampaigns,
    totalEnrolled,
    totalReplied,
    replyRate,
    campaignList,
  };
}

/**
 * Returns Facebook Ads campaign and publishing analytics.
 */
export async function getFacebookAnalytics(
  orgId: string,
  range: DateRange,
  user: AuthenticatedUser
): Promise<FacebookMetrics> {
  assertOrgAccess(orgId, user);

  const dateFilter = { gte: range.from, lte: range.to };
  const advisorFilter =
    user.role === UserRole.ADVISOR ? { advisorId: user.id } : {};

  const [postsPublished, campaigns, facebookLeads] = await Promise.all([
    // Facebook posts published in range
    prisma.publishJob.count({
      where: {
        organizationId: orgId,
        ...(user.role === UserRole.ADVISOR ? { advisorId: user.id } : {}),
        platform: SocialPlatform.FACEBOOK,
        status: PublishJobStatus.PUBLISHED,
        publishedAt: dateFilter,
      },
    }),

    // All Facebook campaigns
    prisma.facebookAdCampaign.findMany({
      where: {
        organizationId: orgId,
        ...advisorFilter,
      },
      select: {
        id: true,
        name: true,
        status: true,
        impressions: true,
        clicks: true,
        leads: true,
        spend: true,
      },
    }),

    // Leads sourced from Facebook Ads in range
    prisma.lead.count({
      where: {
        organizationId: orgId,
        source: LeadSource.FACEBOOK_ADS,
        createdAt: dateFilter,
      },
    }),
  ]);

  const activeCampaigns = campaigns.filter(
    (c) => c.status === CampaignStatus.ACTIVE
  ).length;

  const totalImpressions = campaigns.reduce((sum, c) => sum + c.impressions, 0);
  const totalClicks = campaigns.reduce((sum, c) => sum + c.clicks, 0);
  const totalSpend = campaigns.reduce(
    (sum, c) => sum + Number(c.spend),
    0
  );

  const ctr =
    totalImpressions > 0
      ? Math.round((totalClicks / totalImpressions) * 10000) / 100
      : 0;

  const cpl =
    facebookLeads > 0
      ? Math.round((totalSpend / facebookLeads) * 100) / 100
      : 0;

  const campaignList: FacebookCampaignSummary[] = campaigns.map((c) => ({
    id: c.id,
    name: c.name,
    status: c.status,
    impressions: c.impressions,
    clicks: c.clicks,
    leads: c.leads,
    spend: Number(c.spend),
  }));

  return {
    postsPublished,
    activeCampaigns,
    totalImpressions,
    totalClicks,
    ctr,
    totalLeads: facebookLeads,
    totalSpend,
    cpl,
    campaignList,
  };
}

/**
 * Returns email delivery and engagement metrics.
 */
export async function getEmailAnalytics(
  orgId: string,
  range: DateRange,
  user: AuthenticatedUser
): Promise<EmailMetrics> {
  assertOrgAccess(orgId, user);

  const dateFilter = { gte: range.from, lte: range.to };

  // Load all email sends in range using aggregate-friendly queries
  const [emailSends, unsubscribeCount] = await Promise.all([
    prisma.emailSend.findMany({
      where: {
        organizationId: orgId,
        sentAt: dateFilter,
      },
      select: {
        status: true,
        openedAt: true,
        clickedAt: true,
        bouncedAt: true,
      },
    }),

    // Count unsubscribed enrollments updated in range
    prisma.emailEnrollment.count({
      where: {
        organizationId: orgId,
        status: 'UNSUBSCRIBED',
        unsubscribedAt: dateFilter,
      },
    }),
  ]);

  const totalSent = emailSends.length;
  const totalDelivered = emailSends.filter(
    (e) => e.bouncedAt === null && e.status !== 'bounced'
  ).length;
  const totalOpened = emailSends.filter((e) => e.openedAt !== null).length;
  const totalClicked = emailSends.filter((e) => e.clickedAt !== null).length;
  const totalBounced = emailSends.filter((e) => e.bouncedAt !== null).length;

  const deliveryRate =
    totalSent > 0 ? Math.round((totalDelivered / totalSent) * 10000) / 100 : 0;
  const openRate =
    totalSent > 0 ? Math.round((totalOpened / totalSent) * 10000) / 100 : 0;
  const clickRate =
    totalSent > 0 ? Math.round((totalClicked / totalSent) * 10000) / 100 : 0;
  const bounceRate =
    totalSent > 0 ? Math.round((totalBounced / totalSent) * 10000) / 100 : 0;

  return {
    totalSent,
    totalDelivered,
    totalOpened,
    totalClicked,
    deliveryRate,
    openRate,
    clickRate,
    bounceRate,
    unsubscribeCount,
  };
}

/**
 * Returns lead funnel metrics including status/source breakdown and conversion.
 */
export async function getLeadAnalytics(
  orgId: string,
  range: DateRange,
  user: AuthenticatedUser
): Promise<LeadMetrics> {
  assertOrgAccess(orgId, user);

  const dateFilter = { gte: range.from, lte: range.to };

  // Aggregate by status and source in parallel
  const [byStatusGroups, bySourceGroups, clientLeads] = await Promise.all([
    prisma.lead.groupBy({
      by: ['status'],
      where: {
        organizationId: orgId,
        createdAt: dateFilter,
      },
      _count: { _all: true },
    }),

    prisma.lead.groupBy({
      by: ['source'],
      where: {
        organizationId: orgId,
        createdAt: dateFilter,
      },
      _count: { _all: true },
    }),

    // Leads that progressed to CLIENT status (to compute averageTimeToClient)
    prisma.lead.findMany({
      where: {
        organizationId: orgId,
        status: LeadStatus.CLIENT,
        createdAt: dateFilter,
      },
      select: {
        createdAt: true,
        updatedAt: true,
      },
    }),
  ]);

  // Build full status map with zeroes for missing statuses
  const byStatus = {} as Record<LeadStatus, number>;
  for (const statusKey of Object.values(LeadStatus)) {
    byStatus[statusKey] = 0;
  }
  for (const row of byStatusGroups) {
    byStatus[row.status] = row._count._all;
  }

  // Build full source map with zeroes for missing sources
  const bySource = {} as Record<LeadSource, number>;
  for (const sourceKey of Object.values(LeadSource)) {
    bySource[sourceKey] = 0;
  }
  for (const row of bySourceGroups) {
    bySource[row.source] = row._count._all;
  }

  const total = Object.values(byStatus).reduce((sum, n) => sum + n, 0);
  const clientCount = byStatus[LeadStatus.CLIENT] ?? 0;
  const conversionRate =
    total > 0 ? Math.round((clientCount / total) * 10000) / 100 : 0;

  // Average days from creation to last update for CLIENT leads (proxy for time-to-client)
  let averageTimeToClient: number | null = null;
  if (clientLeads.length > 0) {
    const totalDays = clientLeads.reduce((sum, lead) => {
      const diffMs = lead.updatedAt.getTime() - lead.createdAt.getTime();
      return sum + diffMs / (1000 * 60 * 60 * 24);
    }, 0);
    averageTimeToClient = Math.round((totalDays / clientLeads.length) * 100) / 100;
  }

  return {
    total,
    byStatus,
    bySource,
    conversionRate,
    averageTimeToClient,
  };
}

/**
 * Returns prospect list request metrics and conversion rates.
 */
export async function getProspectAnalytics(
  orgId: string,
  range: DateRange,
  user: AuthenticatedUser
): Promise<ProspectMetrics> {
  assertOrgAccess(orgId, user);

  const dateFilter = { gte: range.from, lte: range.to };
  const advisorFilter =
    user.role === UserRole.ADVISOR ? { requestedById: user.id } : {};

  const [requests, creditsData] = await Promise.all([
    // All prospect list requests in range
    prisma.prospectListRequest.findMany({
      where: {
        organizationId: orgId,
        ...advisorFilter,
        createdAt: dateFilter,
      },
      select: {
        id: true,
        status: true,
        fulfilledCount: true,
        creditCost: true,
      },
    }),

    // Credits consumed by prospect requests in range (DEBIT transactions)
    prisma.creditTransaction.aggregate({
      where: {
        organizationId: orgId,
        type: CreditTransactionType.DEBIT,
        createdAt: dateFilter,
        metadata: {
          path: ['reason'],
          equals: 'prospect_list',
        },
      },
      _sum: { amount: true },
    }),
  ]);

  const requestsTotal = requests.length;
  const requestsFulfilled = requests.filter(
    (r) => r.status === ProspectRequestStatus.FULFILLED
  ).length;
  const totalProspectsImported = requests.reduce(
    (sum, r) => sum + r.fulfilledCount,
    0
  );

  // Sum credit cost from the request records themselves (more reliable than metadata filter)
  const creditsConsumed = requests.reduce((sum, r) => sum + r.creditCost, 0);

  // Count leads whose prospectRequestId links to a fulfilled request in this org/range
  const fulfilledRequestIds = requests
    .filter((r) => r.status === ProspectRequestStatus.FULFILLED)
    .map((r) => r.id);

  let leadsFromProspects = 0;
  if (fulfilledRequestIds.length > 0) {
    leadsFromProspects = await prisma.lead.count({
      where: {
        organizationId: orgId,
        prospectRequestId: { in: fulfilledRequestIds },
      },
    });
  }

  const conversionToLead =
    totalProspectsImported > 0
      ? Math.round((leadsFromProspects / totalProspectsImported) * 10000) / 100
      : 0;

  logger.debug('Prospect metrics computed', {
    orgId,
    requestsTotal,
    requestsFulfilled,
    totalProspectsImported,
    leadsFromProspects,
    userId: user.id,
  });

  // Suppress unused variable warning from creditsData — we use the request-level sum instead
  void creditsData;

  return {
    requestsTotal,
    requestsFulfilled,
    totalProspectsImported,
    creditsConsumed,
    conversionToLead,
  };
}
