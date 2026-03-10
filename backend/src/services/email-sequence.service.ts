import {
  EmailSequence,
  EmailSequenceStep,
  EmailEnrollment,
  EmailEnrollmentStatus,
} from '@prisma/client';
import { Job } from 'bullmq';
import { prisma } from '../db/client';
import { emailQueue } from '../queues';
import { emailService } from './email.service';
import { emailTemplateService } from './email-template.service';
import { Errors } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AuthenticatedUser, UserRole, EmailJobData } from '../types';
import type {
  CreateSequenceDto,
  UpdateSequenceDto,
  AddStepDto,
  PaginationParams,
} from '../validators/email.validators';
import type { PaginatedResult } from './email-template.service';

// ---------------------------------------------------------------------------
// Extended job data type — superset of EmailJobData with sequence-specific fields
// ---------------------------------------------------------------------------

interface EmailSequenceJobData extends EmailJobData {
  /** The EmailEnrollment ID being processed */
  enrollmentId: string;
  /** The EmailSequenceStep ID for this job */
  stepId: string;
  /** The Lead ID receiving the email */
  leadId: string;
}

// ---------------------------------------------------------------------------
// Email Sequence Service
// ---------------------------------------------------------------------------

class EmailSequenceService {
  // --------------------------------------------------------------------------
  // Sequence CRUD
  // --------------------------------------------------------------------------

  /**
   * Creates a new email drip sequence for the given organisation.
   */
  async createSequence(
    dto: CreateSequenceDto,
    user: AuthenticatedUser
  ): Promise<EmailSequence> {
    const sequence = await prisma.emailSequence.create({
      data: {
        organizationId: user.orgId,
        createdById: user.id,
        name: dto.name,
        description: dto.description ?? null,
        triggerType: dto.triggerType,
        status: 'DRAFT',
        totalSteps: 0,
        totalEnrolled: 0,
      },
    });

    logger.info('Email sequence created', {
      sequenceId: sequence.id,
      orgId: user.orgId,
      userId: user.id,
      name: dto.name,
    });

    return sequence;
  }

  /**
   * Lists sequences for an organisation with pagination.
   */
  async listSequences(
    orgId: string,
    user: AuthenticatedUser,
    pagination: PaginationParams
  ): Promise<PaginatedResult<EmailSequence>> {
    this.assertOrgAccess(orgId, user);

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.emailSequence.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailSequence.count({ where: { organizationId: orgId } }),
    ]);

    const totalPages = Math.ceil(total / limit);

    return {
      items,
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1,
    };
  }

  /**
   * Retrieves a single sequence with all its steps.
   */
  async getSequence(
    sequenceId: string,
    user: AuthenticatedUser
  ): Promise<EmailSequence & { steps: EmailSequenceStep[] }> {
    const sequence = await prisma.emailSequence.findUnique({
      where: { id: sequenceId },
      include: { steps: { orderBy: { stepNumber: 'asc' } } },
    });

    if (!sequence) {
      throw Errors.notFound('EmailSequence');
    }

    this.assertOrgAccess(sequence.organizationId, user);

    return sequence;
  }

  /**
   * Updates sequence metadata. Trigger type and status can be changed here.
   */
  async updateSequence(
    sequenceId: string,
    dto: UpdateSequenceDto,
    user: AuthenticatedUser
  ): Promise<EmailSequence> {
    const existing = await this.getSequence(sequenceId, user);

    this.assertCanWrite(user);

    const updated = await prisma.emailSequence.update({
      where: { id: existing.id },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.status !== undefined ? { status: dto.status } : {}),
        ...(dto.triggerType !== undefined ? { triggerType: dto.triggerType } : {}),
      },
    });

    logger.info('Email sequence updated', {
      sequenceId,
      orgId: user.orgId,
      userId: user.id,
    });

    return updated;
  }

  // --------------------------------------------------------------------------
  // Steps
  // --------------------------------------------------------------------------

  /**
   * Adds a step to a sequence. The step number is auto-incremented
   * and totalSteps on the sequence is updated atomically.
   */
  async addStep(
    sequenceId: string,
    dto: AddStepDto,
    user: AuthenticatedUser
  ): Promise<EmailSequenceStep> {
    const sequence = await this.getSequence(sequenceId, user);

    this.assertCanWrite(user);

    // Verify the template belongs to the same org
    const template = await prisma.emailTemplate.findUnique({
      where: { id: dto.templateId },
    });

    if (!template) {
      throw Errors.notFound('EmailTemplate');
    }

    if (template.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
      throw Errors.forbidden('Template does not belong to this organization');
    }

    const nextStepNumber = sequence.totalSteps + 1;

    const [step] = await prisma.$transaction([
      prisma.emailSequenceStep.create({
        data: {
          sequenceId,
          organizationId: user.orgId,
          stepNumber: nextStepNumber,
          templateId: dto.templateId,
          delayDays: dto.delayDays,
          delayHours: dto.delayHours,
          subject: dto.subject ?? null,
        },
      }),
      prisma.emailSequence.update({
        where: { id: sequenceId },
        data: { totalSteps: nextStepNumber },
      }),
    ]);

    logger.info('Email sequence step added', {
      sequenceId,
      stepId: step.id,
      stepNumber: nextStepNumber,
      orgId: user.orgId,
      userId: user.id,
    });

    return step;
  }

  // --------------------------------------------------------------------------
  // Enrollment
  // --------------------------------------------------------------------------

  /**
   * Enrolls a single lead in a sequence.
   * - Skips if already enrolled and active
   * - Enqueues the first step job immediately (or with delay if step 1 has delay)
   */
  async enrollLead(
    sequenceId: string,
    leadId: string,
    user: AuthenticatedUser
  ): Promise<EmailEnrollment> {
    const sequence = await this.getSequence(sequenceId, user);

    if (sequence.totalSteps === 0) {
      throw Errors.badRequest('Cannot enroll into a sequence with no steps');
    }

    // Verify lead belongs to same org
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });
    if (!lead) {
      throw Errors.notFound('Lead');
    }
    if (lead.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
      throw Errors.forbidden('Lead does not belong to this organization');
    }

    // Check for existing active enrollment
    const existing = await prisma.emailEnrollment.findUnique({
      where: { sequenceId_leadId: { sequenceId, leadId } },
    });

    if (existing && existing.status === EmailEnrollmentStatus.ACTIVE) {
      throw Errors.conflict('Lead is already actively enrolled in this sequence');
    }

    // Fetch step 1
    const firstStep = await prisma.emailSequenceStep.findFirst({
      where: { sequenceId, stepNumber: 1 },
    });

    if (!firstStep) {
      throw Errors.badRequest('Sequence has no step 1');
    }

    // Calculate nextSendAt based on step 1 delay
    const delayMs = this.stepDelayMs(firstStep);
    const nextSendAt = new Date(Date.now() + delayMs);

    // Upsert enrollment
    const enrollment = existing
      ? await prisma.emailEnrollment.update({
          where: { id: existing.id },
          data: {
            status: EmailEnrollmentStatus.ACTIVE,
            currentStep: 1,
            nextSendAt,
            completedAt: null,
            unsubscribedAt: null,
          },
        })
      : await prisma.emailEnrollment.create({
          data: {
            sequenceId,
            leadId,
            organizationId: user.orgId,
            enrolledById: user.id,
            currentStep: 1,
            status: EmailEnrollmentStatus.ACTIVE,
            nextSendAt,
          },
        });

    // Update sequence totalEnrolled counter
    await prisma.emailSequence.update({
      where: { id: sequenceId },
      data: { totalEnrolled: { increment: 1 } },
    });

    // Enqueue the first email job
    await this.enqueueEmailJob({
      enrollmentId: enrollment.id,
      sequenceId,
      stepId: firstStep.id,
      stepNumber: 1,
      orgId: user.orgId,
      leadId,
      delayMs,
    });

    logger.info('Lead enrolled in email sequence', {
      enrollmentId: enrollment.id,
      sequenceId,
      leadId,
      orgId: user.orgId,
      nextSendAt: nextSendAt.toISOString(),
    });

    return enrollment;
  }

  /**
   * Enrolls multiple leads in a sequence.
   * Returns counts of enrolled vs skipped (already active enrollments).
   */
  async enrollMultipleLeads(
    sequenceId: string,
    leadIds: string[],
    user: AuthenticatedUser
  ): Promise<{ enrolled: number; skipped: number }> {
    let enrolled = 0;
    let skipped = 0;

    for (const leadId of leadIds) {
      try {
        await this.enrollLead(sequenceId, leadId, user);
        enrolled++;
      } catch (err) {
        // Skip duplicates (409 Conflict) and missing leads (404)
        if (
          err instanceof Error &&
          ('statusCode' in err) &&
          ((err as { statusCode: number }).statusCode === 409 ||
            (err as { statusCode: number }).statusCode === 404)
        ) {
          skipped++;
        } else {
          throw err;
        }
      }
    }

    return { enrolled, skipped };
  }

  // --------------------------------------------------------------------------
  // BullMQ worker processor
  // --------------------------------------------------------------------------

  /**
   * Called by the BullMQ email worker for each scheduled email job.
   *
   * Workflow:
   * 1. Load enrollment + current step + lead + template
   * 2. Check lead is not unsubscribed; if so, mark enrollment UNSUBSCRIBED and stop
   * 3. Render template with lead variables
   * 4. Send via EmailService
   * 5. Create EmailSend record
   * 6. Calculate next step; enqueue next job with delay or mark enrollment COMPLETED
   * 7. Update enrollment currentStep and nextSendAt
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async processEmailJob(job: Job<any>): Promise<void> {
    const { enrollmentId, stepId, orgId, leadId } = job.data as EmailSequenceJobData;

    logger.info('Processing email sequence job', {
      jobId: job.id,
      enrollmentId,
      stepId,
      orgId,
      leadId,
    });

    // Load enrollment
    const enrollment = await prisma.emailEnrollment.findUnique({
      where: { id: enrollmentId },
      include: { sequence: { include: { steps: { orderBy: { stepNumber: 'asc' } } } } },
    });

    if (!enrollment) {
      logger.warn('Enrollment not found, skipping job', { enrollmentId });
      return;
    }

    // Check enrollment is still active
    if (enrollment.status !== EmailEnrollmentStatus.ACTIVE) {
      logger.info('Enrollment is no longer active, skipping job', {
        enrollmentId,
        status: enrollment.status,
      });
      return;
    }

    // Load lead
    const lead = await prisma.lead.findUnique({ where: { id: leadId } });

    if (!lead) {
      logger.warn('Lead not found for email job', { leadId, enrollmentId });
      return;
    }

    // Check lead is not unsubscribed
    if (lead.isUnsubscribed) {
      await prisma.emailEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status: EmailEnrollmentStatus.UNSUBSCRIBED,
          unsubscribedAt: new Date(),
        },
      });
      logger.info('Lead is unsubscribed, enrollment marked UNSUBSCRIBED', {
        enrollmentId,
        leadId,
      });
      return;
    }

    // Load the current step
    const currentStep = enrollment.sequence.steps.find((s) => s.id === stepId);

    if (!currentStep) {
      logger.warn('Step not found for email job', { stepId, enrollmentId });
      return;
    }

    // Load the template
    const template = await prisma.emailTemplate.findUnique({
      where: { id: currentStep.templateId },
    });

    if (!template) {
      logger.warn('Template not found for step', {
        templateId: currentStep.templateId,
        stepId,
      });
      return;
    }

    // Build lead variables for template interpolation
    const leadVariables: Record<string, string> = {
      firstName: lead.firstName,
      lastName: lead.lastName,
      email: lead.email,
      phone: lead.phone ?? '',
      company: lead.company ?? '',
      title: lead.title ?? '',
      fullName: `${lead.firstName} ${lead.lastName}`.trim(),
    };

    // Render the template
    const rendered = await emailTemplateService.renderTemplate(template, leadVariables);

    // Use step-level subject override if present
    const subject = currentStep.subject ?? rendered.subject;

    // Send the email
    let sgMessageId = '';
    try {
      sgMessageId = await emailService.sendEmail(
        lead.email,
        subject,
        rendered.html,
        rendered.text || undefined
      );
    } catch (err) {
      logger.error('Failed to send email for sequence step', {
        enrollmentId,
        stepId,
        leadId,
        error: err instanceof Error ? err.message : String(err),
      });
      // Re-throw so BullMQ can retry
      throw err;
    }

    // Record the send
    await prisma.emailSend.create({
      data: {
        enrollmentId,
        organizationId: orgId,
        leadId,
        stepId,
        sgMessageId: sgMessageId || null,
        status: 'sent',
      },
    });

    // Determine the next step
    const allSteps = enrollment.sequence.steps;
    const nextStep = allSteps.find((s) => s.stepNumber === currentStep.stepNumber + 1);

    if (nextStep) {
      // Enqueue next step with delay
      const delayMs = this.stepDelayMs(nextStep);
      const nextSendAt = new Date(Date.now() + delayMs);

      await this.enqueueEmailJob({
        enrollmentId,
        sequenceId: enrollment.sequenceId,
        stepId: nextStep.id,
        stepNumber: nextStep.stepNumber,
        orgId,
        leadId,
        delayMs,
      });

      await prisma.emailEnrollment.update({
        where: { id: enrollmentId },
        data: {
          currentStep: nextStep.stepNumber,
          nextSendAt,
        },
      });

      logger.info('Enqueued next sequence step', {
        enrollmentId,
        nextStepId: nextStep.id,
        nextStepNumber: nextStep.stepNumber,
        nextSendAt: nextSendAt.toISOString(),
      });
    } else {
      // No more steps — mark enrollment as completed
      await prisma.emailEnrollment.update({
        where: { id: enrollmentId },
        data: {
          status: EmailEnrollmentStatus.COMPLETED,
          completedAt: new Date(),
          nextSendAt: null,
        },
      });

      logger.info('Email sequence completed for enrollment', {
        enrollmentId,
        leadId,
        sequenceId: enrollment.sequenceId,
      });
    }
  }

  // --------------------------------------------------------------------------
  // Unsubscribe
  // --------------------------------------------------------------------------

  /**
   * Marks a lead as unsubscribed and stops all active enrollments for that
   * email + organization combination.
   */
  async handleUnsubscribe(email: string, orgId: string): Promise<void> {
    // Find the lead by email and org
    const lead = await prisma.lead.findUnique({
      where: { organizationId_email: { organizationId: orgId, email } },
    });

    if (!lead) {
      // No matching lead — nothing to do
      logger.info('Unsubscribe request for unknown email/org', { email, orgId });
      return;
    }

    if (lead.isUnsubscribed) {
      logger.info('Lead already unsubscribed', { leadId: lead.id, email });
      return;
    }

    // Mark lead as unsubscribed
    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        isUnsubscribed: true,
        unsubscribedAt: new Date(),
      },
    });

    // Find all active enrollments for this lead
    const activeEnrollments = await prisma.emailEnrollment.findMany({
      where: {
        leadId: lead.id,
        organizationId: orgId,
        status: EmailEnrollmentStatus.ACTIVE,
      },
    });

    if (activeEnrollments.length > 0) {
      await prisma.emailEnrollment.updateMany({
        where: {
          leadId: lead.id,
          organizationId: orgId,
          status: EmailEnrollmentStatus.ACTIVE,
        },
        data: {
          status: EmailEnrollmentStatus.UNSUBSCRIBED,
          unsubscribedAt: new Date(),
        },
      });

      logger.info('Active enrollments marked UNSUBSCRIBED', {
        leadId: lead.id,
        email,
        orgId,
        count: activeEnrollments.length,
      });
    }

    logger.info('Lead unsubscribed successfully', {
      leadId: lead.id,
      email,
      orgId,
      enrollmentsStopped: activeEnrollments.length,
    });
  }

  // --------------------------------------------------------------------------
  // Private helpers
  // --------------------------------------------------------------------------

  /**
   * Returns the delay in milliseconds for a sequence step based on delayDays + delayHours.
   */
  private stepDelayMs(step: { delayDays: number; delayHours: number }): number {
    return (step.delayDays * 24 * 60 * 60 + step.delayHours * 60 * 60) * 1000;
  }

  /**
   * Enqueues an EmailJobData onto the emailQueue with an optional delay.
   */
  private async enqueueEmailJob(params: {
    enrollmentId: string;
    sequenceId: string;
    stepId: string;
    stepNumber: number;
    orgId: string;
    leadId: string;
    delayMs: number;
  }): Promise<void> {
    const jobData: EmailSequenceJobData = {
      // Base EmailJobData fields
      sequenceId: params.sequenceId,
      recipientId: params.leadId,
      orgId: params.orgId,
      templateId: params.stepId,
      variables: {},
      scheduledAt: new Date(Date.now() + params.delayMs).toISOString(),
      // Extended EmailSequenceJobData fields
      enrollmentId: params.enrollmentId,
      stepId: params.stepId,
      leadId: params.leadId,
    };

    await (emailQueue as unknown as import('bullmq').Queue<EmailSequenceJobData>).add(
      `email-seq-${params.sequenceId}-step-${params.stepNumber}-enrollment-${params.enrollmentId}`,
      jobData,
      {
        delay: params.delayMs > 0 ? params.delayMs : undefined,
        attempts: 2,
        backoff: { type: 'exponential', delay: 30_000 },
      }
    );
  }

  private assertOrgAccess(orgId: string, user: AuthenticatedUser): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.orgId !== orgId) {
      throw Errors.forbidden('Access denied to this organization\'s resources');
    }
  }

  private assertCanWrite(user: AuthenticatedUser): void {
    const writeRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.ADVISOR];
    if (!writeRoles.includes(user.role)) {
      throw Errors.forbidden('Insufficient permissions');
    }
  }
}

export const emailSequenceService = new EmailSequenceService();
export { EmailSequenceService };
