import {
  LinkedInCampaign,
  LinkedInCampaignEnrollment,
  EmailEnrollmentStatus,
  AuditAction,
  NotificationType,
  SocialPlatform,
} from '@prisma/client';
import { Job } from 'bullmq';
import { prisma } from '../db/client';
import { linkedinCampaignQueue } from '../queues';
import { writeAudit } from '../utils/audit';
import { decrypt } from '../utils/crypto';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { AuthenticatedUser, UserRole, LinkedInCampaignJobData } from '../types';
import {
  buildOffsetPaginationResult,
  calcSkip,
  OffsetPaginationResult,
} from '../utils/pagination';
import type {
  CreateCampaignDto,
  UpdateCampaignDto,
  ListCampaignsQuery,
} from '../validators/linkedin-campaign.validators';

// ---------------------------------------------------------------------------
// LinkedIn Messaging API endpoint
// ---------------------------------------------------------------------------

const LINKEDIN_MESSAGES_API = 'https://api.linkedin.com/v2/messages';

// ---------------------------------------------------------------------------
// Step shape stored in campaign.steps JSON
// ---------------------------------------------------------------------------

interface CampaignStep {
  stepNumber: number;
  messageTemplate: string;
  delayDays: number;
}

// ---------------------------------------------------------------------------
// Extended job data with enrollmentId
// ---------------------------------------------------------------------------

interface LinkedInCampaignJobDataExtended extends LinkedInCampaignJobData {
  enrollmentId: string;
}

// ---------------------------------------------------------------------------
// Enroll result type
// ---------------------------------------------------------------------------

export interface EnrollResult {
  enrolled: number;
  skipped: number;
  errors: string[];
}

// ---------------------------------------------------------------------------
// LinkedIn Campaign Service
// ---------------------------------------------------------------------------

class LinkedInCampaignService {
  // --------------------------------------------------------------------------
  // createCampaign
  // --------------------------------------------------------------------------

  async createCampaign(
    dto: CreateCampaignDto,
    user: AuthenticatedUser
  ): Promise<LinkedInCampaign> {
    // Only ADVISOR and ORG_ADMIN (and SUPER_ADMIN) can create campaigns
    if (
      user.role !== UserRole.ADVISOR &&
      user.role !== UserRole.ORG_ADMIN &&
      user.role !== UserRole.SUPER_ADMIN
    ) {
      throw Errors.forbidden('Only advisors and admins can create LinkedIn campaigns');
    }

    // User must have an active LinkedIn social connection
    await this.assertActiveLinkedInConnection(user.id);

    // Normalise steps — ensure stepNumber is set
    const steps: CampaignStep[] = dto.steps.map((s, idx) => ({
      stepNumber: idx + 1,
      messageTemplate: s.messageTemplate,
      delayDays: s.delayDays,
    }));

    const campaign = await prisma.linkedInCampaign.create({
      data: {
        organizationId: user.orgId,
        advisorId: user.id,
        name: dto.name,
        description: dto.description ?? null,
        status: 'DRAFT',
        steps: steps as unknown as Parameters<typeof prisma.linkedInCampaign.create>[0]['data']['steps'],
        targetCriteria: (dto.targetCriteria ?? {}) as unknown as Parameters<typeof prisma.linkedInCampaign.create>[0]['data']['targetCriteria'],
        dailyLimit: dto.dailyLimit,
        pauseOnReply: dto.pauseOnReply,
        businessHoursOnly: dto.businessHoursOnly,
        totalEnrolled: 0,
        totalCompleted: 0,
        totalReplied: 0,
      },
    });

    void writeAudit({
      organizationId: user.orgId,
      actorId: user.id,
      entityType: 'LinkedInCampaign',
      entityId: campaign.id,
      action: AuditAction.CREATED,
      newState: { status: 'DRAFT', name: campaign.name },
    });

    logger.info('LinkedIn campaign created', {
      campaignId: campaign.id,
      orgId: user.orgId,
      userId: user.id,
      name: dto.name,
    });

    return campaign;
  }

  // --------------------------------------------------------------------------
  // getCampaign
  // --------------------------------------------------------------------------

  async getCampaign(
    campaignId: string,
    user: AuthenticatedUser
  ): Promise<LinkedInCampaign & { _count: { enrollments: number } }> {
    const campaign = await prisma.linkedInCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId:
          user.role === UserRole.SUPER_ADMIN ? undefined : user.orgId,
      },
      include: { _count: { select: { enrollments: true } } },
    });

    if (!campaign) {
      throw Errors.notFound('LinkedInCampaign');
    }

    // ADVISOR can only see their own campaigns
    if (
      user.role === UserRole.ADVISOR &&
      campaign.advisorId !== user.id
    ) {
      throw Errors.forbidden('You do not have access to this campaign');
    }

    return campaign;
  }

  // --------------------------------------------------------------------------
  // listCampaigns
  // --------------------------------------------------------------------------

  async listCampaigns(
    orgId: string,
    user: AuthenticatedUser,
    query: ListCampaignsQuery
  ): Promise<OffsetPaginationResult<LinkedInCampaign>> {
    // Enforce org isolation
    const effectiveOrgId =
      user.role === UserRole.SUPER_ADMIN ? orgId : user.orgId;

    const where: Record<string, unknown> = {
      organizationId: effectiveOrgId,
    };

    // ADVISOR can only see their own campaigns
    if (user.role === UserRole.ADVISOR) {
      where['advisorId'] = user.id;
    }

    if (query.status) {
      where['status'] = query.status;
    }

    const pagination = { page: query.page, limit: query.limit };
    const skip = calcSkip(pagination);

    const [campaigns, totalCount] = await Promise.all([
      prisma.linkedInCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: query.limit,
      }),
      prisma.linkedInCampaign.count({ where }),
    ]);

    return buildOffsetPaginationResult(campaigns, totalCount, pagination);
  }

  // --------------------------------------------------------------------------
  // updateCampaign
  // --------------------------------------------------------------------------

  async updateCampaign(
    campaignId: string,
    dto: UpdateCampaignDto,
    user: AuthenticatedUser
  ): Promise<LinkedInCampaign> {
    const campaign = await this.getCampaignForWrite(campaignId, user);

    if (campaign.status !== 'DRAFT') {
      throw Errors.conflict('Only DRAFT campaigns can be updated');
    }

    const steps =
      dto.steps !== undefined
        ? dto.steps.map((s, idx) => ({
            stepNumber: idx + 1,
            messageTemplate: s.messageTemplate,
            delayDays: s.delayDays,
          }))
        : undefined;

    const updated = await prisma.linkedInCampaign.update({
      where: { id: campaignId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(steps !== undefined ? { steps: steps as unknown as Parameters<typeof prisma.linkedInCampaign.update>[0]['data']['steps'] } : {}),
        ...(dto.targetCriteria !== undefined
          ? { targetCriteria: dto.targetCriteria as unknown as Parameters<typeof prisma.linkedInCampaign.update>[0]['data']['targetCriteria'] }
          : {}),
        ...(dto.dailyLimit !== undefined ? { dailyLimit: dto.dailyLimit } : {}),
        ...(dto.pauseOnReply !== undefined ? { pauseOnReply: dto.pauseOnReply } : {}),
        ...(dto.businessHoursOnly !== undefined
          ? { businessHoursOnly: dto.businessHoursOnly }
          : {}),
      },
    });

    void writeAudit({
      organizationId: user.orgId,
      actorId: user.id,
      entityType: 'LinkedInCampaign',
      entityId: campaignId,
      action: AuditAction.UPDATED,
      newState: dto as Record<string, unknown>,
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // deleteCampaign
  // --------------------------------------------------------------------------

  async deleteCampaign(campaignId: string, user: AuthenticatedUser): Promise<void> {
    const campaign = await this.getCampaignForWrite(campaignId, user);

    if (campaign.status !== 'DRAFT') {
      throw Errors.conflict('Only DRAFT campaigns can be deleted');
    }

    await prisma.linkedInCampaign.delete({ where: { id: campaignId } });

    void writeAudit({
      organizationId: user.orgId,
      actorId: user.id,
      entityType: 'LinkedInCampaign',
      entityId: campaignId,
      action: AuditAction.DELETED,
      previousState: { name: campaign.name, status: campaign.status },
    });

    logger.info('LinkedIn campaign deleted', {
      campaignId,
      orgId: user.orgId,
      userId: user.id,
    });
  }

  // --------------------------------------------------------------------------
  // activateCampaign
  // --------------------------------------------------------------------------

  async activateCampaign(
    campaignId: string,
    user: AuthenticatedUser
  ): Promise<LinkedInCampaign> {
    const campaign = await this.getCampaignForWrite(campaignId, user);

    if (campaign.status !== 'DRAFT') {
      throw Errors.conflict('Only DRAFT campaigns can be activated');
    }

    // Must have at least one step
    const steps = campaign.steps as unknown as CampaignStep[];
    if (!steps || steps.length === 0) {
      throw Errors.badRequest('Campaign must have at least one step before activation');
    }

    // Validate advisor has active LinkedIn connection
    await this.assertActiveLinkedInConnection(campaign.advisorId);

    const updated = await prisma.linkedInCampaign.update({
      where: { id: campaignId },
      data: { status: 'ACTIVE' },
    });

    void writeAudit({
      organizationId: campaign.organizationId,
      actorId: user.id,
      entityType: 'LinkedInCampaign',
      entityId: campaignId,
      action: AuditAction.STATUS_CHANGED,
      previousState: { status: 'DRAFT' },
      newState: { status: 'ACTIVE' },
    });

    logger.info('LinkedIn campaign activated', {
      campaignId,
      orgId: campaign.organizationId,
      userId: user.id,
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // pauseCampaign
  // --------------------------------------------------------------------------

  async pauseCampaign(
    campaignId: string,
    user: AuthenticatedUser
  ): Promise<LinkedInCampaign> {
    const campaign = await this.getCampaignForWrite(campaignId, user);

    if (campaign.status !== 'ACTIVE') {
      throw Errors.conflict('Only ACTIVE campaigns can be paused');
    }

    const updated = await prisma.linkedInCampaign.update({
      where: { id: campaignId },
      data: { status: 'PAUSED' },
    });

    void writeAudit({
      organizationId: campaign.organizationId,
      actorId: user.id,
      entityType: 'LinkedInCampaign',
      entityId: campaignId,
      action: AuditAction.STATUS_CHANGED,
      previousState: { status: 'ACTIVE' },
      newState: { status: 'PAUSED' },
    });

    logger.info('LinkedIn campaign paused', {
      campaignId,
      orgId: campaign.organizationId,
      userId: user.id,
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // enrollLeads
  // --------------------------------------------------------------------------

  async enrollLeads(
    campaignId: string,
    leadIds: string[],
    user: AuthenticatedUser
  ): Promise<EnrollResult> {
    const campaign = await this.getCampaignForWrite(campaignId, user);

    if (campaign.status !== 'ACTIVE') {
      throw Errors.conflict('Campaign must be ACTIVE to enroll leads');
    }

    const steps = campaign.steps as unknown as CampaignStep[];
    const firstStep = steps[0];

    let enrolled = 0;
    let skipped = 0;
    const errors: string[] = [];

    for (const leadId of leadIds) {
      try {
        // Validate lead exists in org
        const lead = await prisma.lead.findFirst({
          where: { id: leadId, organizationId: campaign.organizationId },
        });

        if (!lead) {
          errors.push(`Lead ${leadId} not found in organization`);
          skipped++;
          continue;
        }

        // Lead must have a LinkedIn URL (used as the person ID)
        if (!lead.linkedinUrl) {
          errors.push(`Lead ${leadId} does not have a LinkedIn profile URL — skipped`);
          skipped++;
          continue;
        }

        // Check for existing active enrollment
        const existing = await prisma.linkedInCampaignEnrollment.findUnique({
          where: { campaignId_leadId: { campaignId, leadId } },
        });

        if (existing && existing.status === EmailEnrollmentStatus.ACTIVE) {
          errors.push(`Lead ${leadId} is already actively enrolled — skipped`);
          skipped++;
          continue;
        }

        // Calculate nextSendAt
        const nextSendAt = this.calcNextSendAt(
          campaign.businessHoursOnly,
          firstStep ? firstStep.delayDays : 0
        );

        // Create or update enrollment
        let enrollment: LinkedInCampaignEnrollment;

        if (existing) {
          enrollment = await prisma.linkedInCampaignEnrollment.update({
            where: { id: existing.id },
            data: {
              status: EmailEnrollmentStatus.ACTIVE,
              currentStep: 1,
              nextSendAt,
              repliedAt: null,
            },
          });
        } else {
          enrollment = await prisma.linkedInCampaignEnrollment.create({
            data: {
              campaignId,
              leadId,
              organizationId: campaign.organizationId,
              currentStep: 1,
              status: EmailEnrollmentStatus.ACTIVE,
              nextSendAt,
            },
          });
        }

        // Enqueue the first job with delay
        const delayMs = firstStep
          ? firstStep.delayDays * 24 * 60 * 60 * 1000
          : 0;

        const jobData: LinkedInCampaignJobDataExtended = {
          campaignId,
          orgId: campaign.organizationId,
          advisorId: campaign.advisorId,
          recipientLinkedInId: lead.linkedinUrl,
          messageTemplateId: firstStep ? firstStep.messageTemplate : '',
          enrollmentId: enrollment.id,
        };

        await (linkedinCampaignQueue as unknown as import('bullmq').Queue<LinkedInCampaignJobDataExtended>).add(
          `linkedin-campaign-${campaignId}-lead-${leadId}-step-1`,
          jobData,
          {
            delay: delayMs > 0 ? delayMs : undefined,
            attempts: 2,
            backoff: { type: 'exponential', delay: 60_000 },
          }
        );

        enrolled++;
      } catch (err) {
        // Propagate unexpected errors, swallow enrollment-level errors
        if (
          err instanceof Error &&
          'statusCode' in err &&
          ((err as { statusCode: number }).statusCode === 409 ||
            (err as { statusCode: number }).statusCode === 404)
        ) {
          skipped++;
          errors.push(`Lead ${leadId}: ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    // Increment campaign.totalEnrolled
    if (enrolled > 0) {
      await prisma.linkedInCampaign.update({
        where: { id: campaignId },
        data: { totalEnrolled: { increment: enrolled } },
      });
    }

    logger.info('LinkedIn campaign enrollment completed', {
      campaignId,
      enrolled,
      skipped,
      errorCount: errors.length,
      orgId: campaign.organizationId,
      userId: user.id,
    });

    return { enrolled, skipped, errors };
  }

  // --------------------------------------------------------------------------
  // processLinkedInCampaignJob (BullMQ worker processor)
  // --------------------------------------------------------------------------

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async processLinkedInCampaignJob(job: Job<any>): Promise<void> {
    const {
      campaignId,
      orgId,
      advisorId,
      enrollmentId,
    } = job.data as LinkedInCampaignJobDataExtended;

    logger.info('Processing LinkedIn campaign job', {
      jobId: job.id,
      campaignId,
      orgId,
      advisorId,
      enrollmentId,
    });

    // Load enrollment
    const enrollment = await prisma.linkedInCampaignEnrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      logger.warn('LinkedIn enrollment not found, skipping job', { enrollmentId });
      return;
    }

    // Skip if enrollment is not ACTIVE
    if (enrollment.status !== EmailEnrollmentStatus.ACTIVE) {
      logger.info('LinkedIn enrollment is no longer ACTIVE, skipping job', {
        enrollmentId,
        status: enrollment.status,
      });
      return;
    }

    // Load campaign
    const campaign = await prisma.linkedInCampaign.findUnique({
      where: { id: campaignId },
    });

    if (!campaign || campaign.status !== 'ACTIVE') {
      logger.warn('LinkedIn campaign not found or not active, skipping job', {
        campaignId,
        status: campaign?.status,
      });
      return;
    }

    // Check daily limit — count enrollments updated today for this campaign
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sentToday = await prisma.linkedInCampaignEnrollment.count({
      where: {
        campaignId,
        updatedAt: { gte: todayStart },
        status: { not: EmailEnrollmentStatus.ACTIVE },
      },
    });

    if (sentToday >= campaign.dailyLimit) {
      logger.warn('LinkedIn campaign daily limit reached, skipping job', {
        campaignId,
        dailyLimit: campaign.dailyLimit,
        sentToday,
      });
      return;
    }

    // Load lead
    const lead = await prisma.lead.findUnique({
      where: { id: enrollment.leadId },
    });

    if (!lead || !lead.linkedinUrl) {
      logger.warn('Lead not found or missing LinkedIn URL for campaign job', {
        leadId: enrollment.leadId,
        enrollmentId,
      });
      return;
    }

    // Load advisor's LinkedIn SocialConnection
    const socialConnection = await prisma.socialConnection.findFirst({
      where: {
        userId: advisorId,
        platform: SocialPlatform.LINKEDIN,
        isActive: true,
      },
    });

    if (!socialConnection) {
      logger.error('Advisor has no active LinkedIn connection for campaign job', {
        advisorId,
        campaignId,
        enrollmentId,
      });
      throw new Error(`Advisor ${advisorId} has no active LinkedIn connection`);
    }

    // Get current step (enrollment.currentStep is 1-based)
    const steps = campaign.steps as unknown as CampaignStep[];
    const stepIndex = enrollment.currentStep - 1;
    const currentStep = steps[stepIndex];

    if (!currentStep) {
      logger.warn('No step found at index for LinkedIn campaign', {
        enrollmentId,
        stepIndex,
        totalSteps: steps.length,
      });
      // Mark as completed if no more steps
      await prisma.linkedInCampaignEnrollment.update({
        where: { id: enrollmentId },
        data: { status: EmailEnrollmentStatus.COMPLETED, nextSendAt: null },
      });
      return;
    }

    // Decrypt the LinkedIn access token
    let accessToken: string;
    try {
      accessToken = decrypt(socialConnection.accessToken);
    } catch (err) {
      logger.error('Failed to decrypt LinkedIn access token', {
        advisorId,
        socialConnectionId: socialConnection.id,
        error: err instanceof Error ? err.message : String(err),
      });
      throw new Error('Failed to decrypt LinkedIn access token');
    }

    // Send message via LinkedIn Messaging API
    const messagePayload = {
      recipients: [
        {
          personUrn: `urn:li:person:${lead.linkedinUrl}`,
        },
      ],
      subject: '',
      body: currentStep.messageTemplate,
    };

    let linkedinResponse: Response;
    try {
      linkedinResponse = await fetch(LINKEDIN_MESSAGES_API, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
          'X-Restli-Protocol-Version': '2.0.0',
        },
        body: JSON.stringify(messagePayload),
      });
    } catch (err) {
      logger.error('LinkedIn API request failed', {
        campaignId,
        enrollmentId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Re-throw for BullMQ retry
      throw err;
    }

    if (!linkedinResponse.ok) {
      const errorBody = await linkedinResponse.text().catch(() => '');
      logger.error('LinkedIn API returned error', {
        campaignId,
        enrollmentId,
        status: linkedinResponse.status,
        body: errorBody,
      });
      throw new Error(
        `LinkedIn API error ${linkedinResponse.status}: ${errorBody}`
      );
    }

    logger.info('LinkedIn message sent successfully', {
      campaignId,
      enrollmentId,
      leadId: lead.id,
      stepNumber: enrollment.currentStep,
    });

    // Determine next step
    const nextStepIndex = stepIndex + 1;
    const nextStep = steps[nextStepIndex];

    if (nextStep) {
      // Advance to next step
      const nextSendAt = this.calcNextSendAt(
        campaign.businessHoursOnly,
        nextStep.delayDays
      );

      await prisma.linkedInCampaignEnrollment.update({
        where: { id: enrollmentId },
        data: {
          currentStep: enrollment.currentStep + 1,
          nextSendAt,
        },
      });

      // Enqueue next job
      const delayMs = nextStep.delayDays * 24 * 60 * 60 * 1000;

      const nextJobData: LinkedInCampaignJobDataExtended = {
        campaignId,
        orgId,
        advisorId,
        recipientLinkedInId: lead.linkedinUrl,
        messageTemplateId: nextStep.messageTemplate,
        enrollmentId,
      };

      await (linkedinCampaignQueue as unknown as import('bullmq').Queue<LinkedInCampaignJobDataExtended>).add(
        `linkedin-campaign-${campaignId}-enrollment-${enrollmentId}-step-${enrollment.currentStep + 1}`,
        nextJobData,
        {
          delay: delayMs > 0 ? delayMs : undefined,
          attempts: 2,
          backoff: { type: 'exponential', delay: 60_000 },
        }
      );

      logger.info('Enqueued next LinkedIn campaign step', {
        campaignId,
        enrollmentId,
        nextStep: enrollment.currentStep + 1,
        nextSendAt: nextSendAt.toISOString(),
      });
    } else {
      // No more steps — mark enrollment COMPLETED
      await prisma.linkedInCampaignEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status: EmailEnrollmentStatus.COMPLETED,
          nextSendAt: null,
        },
      });

      await prisma.linkedInCampaign.update({
        where: { id: campaignId },
        data: { totalCompleted: { increment: 1 } },
      });

      logger.info('LinkedIn campaign enrollment completed', {
        campaignId,
        enrollmentId,
        leadId: lead.id,
      });
    }

    // Write audit trail
    void writeAudit({
      organizationId: orgId,
      actorId: advisorId,
      entityType: 'LinkedInCampaignEnrollment',
      entityId: enrollmentId,
      action: AuditAction.UPDATED,
      metadata: {
        step: enrollment.currentStep,
        leadId: lead.id,
        campaignId,
      },
    });
  }

  // --------------------------------------------------------------------------
  // detectReply
  // --------------------------------------------------------------------------

  async detectReply(
    enrollmentId: string,
    repliedAt: string,
    user: AuthenticatedUser
  ): Promise<LinkedInCampaignEnrollment> {
    const enrollment = await prisma.linkedInCampaignEnrollment.findUnique({
      where: { id: enrollmentId },
    });

    if (!enrollment) {
      throw Errors.notFound('LinkedInCampaignEnrollment');
    }

    // Org isolation check for non-super-admins
    if (
      user.role !== UserRole.SUPER_ADMIN &&
      enrollment.organizationId !== user.orgId
    ) {
      throw Errors.forbidden('Access denied to this enrollment');
    }

    const updated = await prisma.linkedInCampaignEnrollment.update({
      where: { id: enrollmentId },
      data: {
        status: EmailEnrollmentStatus.PAUSED,
        repliedAt: new Date(repliedAt),
      },
    });

    // Increment campaign.totalReplied
    await prisma.linkedInCampaign.update({
      where: { id: enrollment.campaignId },
      data: { totalReplied: { increment: 1 } },
    });

    // Load campaign to get advisorId for notification
    const campaign = await prisma.linkedInCampaign.findUnique({
      where: { id: enrollment.campaignId },
    });

    if (campaign) {
      // Create notification for advisor
      await prisma.notification.create({
        data: {
          userId: campaign.advisorId,
          organizationId: enrollment.organizationId,
          type: NotificationType.CAMPAIGN_PAUSED,
          title: 'LinkedIn Campaign Reply Detected',
          body: 'Contact replied to your LinkedIn campaign',
          metadata: {
            campaignId: enrollment.campaignId,
            enrollmentId,
            leadId: enrollment.leadId,
          } as unknown as Parameters<typeof prisma.notification.create>[0]['data']['metadata'],
        },
      });
    }

    void writeAudit({
      organizationId: enrollment.organizationId,
      actorId: user.id,
      entityType: 'LinkedInCampaignEnrollment',
      entityId: enrollmentId,
      action: AuditAction.STATUS_CHANGED,
      previousState: { status: enrollment.status },
      newState: { status: EmailEnrollmentStatus.PAUSED, repliedAt },
    });

    logger.info('LinkedIn campaign reply detected', {
      enrollmentId,
      campaignId: enrollment.campaignId,
      leadId: enrollment.leadId,
      repliedAt,
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Calculates the next send time.
   * If businessHoursOnly: next business day at 9 AM.
   * Otherwise: now + delayDays * 24 hours.
   */
  private calcNextSendAt(businessHoursOnly: boolean, delayDays: number): Date {
    if (businessHoursOnly) {
      const next = new Date();
      // Add delayDays
      next.setDate(next.getDate() + delayDays);
      // Advance to next business day if it's a weekend
      while (next.getDay() === 0 || next.getDay() === 6) {
        next.setDate(next.getDate() + 1);
      }
      // Set to 9 AM
      next.setHours(9, 0, 0, 0);
      return next;
    }
    return new Date(Date.now() + delayDays * 24 * 60 * 60 * 1000);
  }

  /**
   * Asserts user has an active LinkedIn social connection.
   * Throws 400 if not found.
   */
  private async assertActiveLinkedInConnection(userId: string): Promise<void> {
    const conn = await prisma.socialConnection.findFirst({
      where: {
        userId,
        platform: SocialPlatform.LINKEDIN,
        isActive: true,
      },
    });

    if (!conn) {
      throw Errors.badRequest(
        'You must connect your LinkedIn account before managing LinkedIn campaigns'
      );
    }
  }

  /**
   * Fetches campaign for write operations with ownership enforcement.
   * - ADVISOR: can only write to their own campaigns
   * - ORG_ADMIN / SUPER_ADMIN: can write to any campaign in org
   */
  private async getCampaignForWrite(
    campaignId: string,
    user: AuthenticatedUser
  ): Promise<LinkedInCampaign> {
    const campaign = await prisma.linkedInCampaign.findFirst({
      where: {
        id: campaignId,
        organizationId:
          user.role === UserRole.SUPER_ADMIN ? undefined : user.orgId,
      },
    });

    if (!campaign) {
      throw Errors.notFound('LinkedInCampaign');
    }

    if (
      user.role === UserRole.ADVISOR &&
      campaign.advisorId !== user.id
    ) {
      throw Errors.forbidden('You do not have permission to modify this campaign');
    }

    return campaign;
  }
}

// ---------------------------------------------------------------------------
// Singleton export
// ---------------------------------------------------------------------------

export const linkedinCampaignService = new LinkedInCampaignService();
export { LinkedInCampaignService };
