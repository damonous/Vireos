/**
 * Worker entry point.
 *
 * This module starts all BullMQ workers. It is run as a separate process
 * (via `npm run start:worker` or `node dist/queues/workers/index.js`) to
 * allow independent scaling of the API server and job processing layers.
 *
 * Each worker processes jobs from its corresponding queue. Workers are
 * designed to be stateless and horizontally scalable — multiple instances
 * can run concurrently against the same Redis queue.
 */

import { Worker, Job } from 'bullmq';
import { NotificationType } from '@prisma/client';
import { logger } from '../../utils/logger';
import {
  PublishJobData,
  EmailJobData,
  LinkedInCampaignJobData,
  NotificationJobData,
} from '../../types';
import { processPublishJob as handlePublishJob } from '../../services/publish.service';
import { emailSequenceService } from '../../services/email-sequence.service';
import { linkedinCampaignService } from '../../services/linkedin-campaign.service';
import { emailService } from '../../services/email.service';
import { prisma } from '../../db/client';

// ---------------------------------------------------------------------------
// Redis connection (same config as queues/index.ts)
// ---------------------------------------------------------------------------

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      db:
        parsed.pathname && parsed.pathname !== '/'
          ? parseInt(parsed.pathname.slice(1), 10)
          : undefined,
    };
  } catch {
    return { host: 'localhost', port: 6379 };
  }
}

const connection = parseRedisUrl(redisUrl);

// ---------------------------------------------------------------------------
// Job processors
// ---------------------------------------------------------------------------

/**
 * Processes a scheduled social media post.
 * Delegates to PublishService.processPublishJob which handles:
 * - Loading draft content and social connection tokens from DB
 * - Decrypting OAuth tokens
 * - Calling LinkedIn UGC Posts API or Facebook Graph API
 * - Updating PublishJob status on success/failure
 * - Writing AuditTrail and failure notifications
 */
async function processPublishJob(job: Job<PublishJobData>): Promise<void> {
  const { postId, orgId, advisorId, platforms } = job.data;

  logger.info('Processing publish job', {
    jobId: job.id,
    postId,
    orgId,
    advisorId,
    platforms,
  });

  await handlePublishJob(job);

  logger.info('Publish job completed', { jobId: job.id, postId });
}

/**
 * Processes an email sequence send.
 * Delegates to EmailSequenceService.processEmailJob which handles:
 * - Loading enrollment, step, lead, and template from DB
 * - Checking lead is not unsubscribed
 * - Rendering template with lead variables
 * - Sending via Mailgun
 * - Creating EmailSend record
 * - Enqueueing next step or marking enrollment COMPLETED
 */
async function processEmailJob(job: Job<EmailJobData>): Promise<void> {
  const { sequenceId, recipientId, orgId } = job.data;

  logger.info('Processing email job', {
    jobId: job.id,
    sequenceId,
    recipientId,
    orgId,
  });

  await emailSequenceService.processEmailJob(job);

  logger.info('Email job completed', { jobId: job.id, sequenceId, recipientId });
}

/**
 * Processes a LinkedIn outbound campaign message.
 * Delegates to LinkedInCampaignService which handles:
 * - Loading enrollment, campaign, lead, and SocialConnection from DB
 * - Checking daily send limits
 * - Decrypting OAuth token and calling LinkedIn Messaging API
 * - Advancing enrollment to next step or marking COMPLETED
 * - Writing AuditTrail
 */
async function processLinkedInCampaignJob(
  job: Job<LinkedInCampaignJobData>
): Promise<void> {
  const { campaignId, orgId, advisorId, recipientLinkedInId } = job.data;

  logger.info('Processing LinkedIn campaign job', {
    jobId: job.id,
    campaignId,
    orgId,
    advisorId,
    recipientLinkedInId,
  });

  await linkedinCampaignService.processLinkedInCampaignJob(job);

  logger.info('LinkedIn campaign job completed', { jobId: job.id, campaignId });
}

/**
 * Maps a NotificationType to a human-readable email subject line.
 */
function getEmailSubjectForNotificationType(type: NotificationType): string {
  switch (type) {
    case NotificationType.CONTENT_SUBMITTED:
      return 'Content Submitted for Review';
    case NotificationType.CONTENT_APPROVED:
      return 'Your Content Has Been Approved';
    case NotificationType.CONTENT_REJECTED:
      return 'Your Content Has Been Rejected';
    case NotificationType.CONTENT_NEEDS_CHANGES:
      return 'Changes Requested on Your Content';
    default:
      return 'Notification from Vireos';
  }
}

/**
 * Builds an HTML email body from a notification record.
 */
function buildNotificationEmailHtml(title: string, body: string): string {
  return `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <h2 style="color: #333;">${title}</h2>
      <p style="color: #555; font-size: 16px; line-height: 1.5;">${body}</p>
      <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
      <p style="color: #999; font-size: 12px;">This is an automated notification from Vireos. Please do not reply to this email.</p>
    </div>
  `.trim();
}

/**
 * Processes a user/system notification.
 *
 * When `notificationId` is present (compliance email flow):
 *   1. Reads the Notification record from the database
 *   2. Looks up the recipient user's email address
 *   3. Sends an email via Mailgun using the existing email service
 *
 * When `notificationId` is absent (template-based flow):
 *   Falls back to sending via the email template service.
 */
async function processNotificationJob(
  job: Job<NotificationJobData>
): Promise<void> {
  const { type, userId, orgId, subject, notificationId } = job.data;

  logger.info('Processing notification job', {
    jobId: job.id,
    type,
    userId,
    orgId,
    subject,
    notificationId,
  });

  // -----------------------------------------------------------------------
  // Compliance email flow: send email based on an existing Notification record
  // -----------------------------------------------------------------------
  if (notificationId) {
    const notification = await prisma.notification.findUnique({
      where: { id: notificationId },
    });

    if (!notification) {
      logger.warn('Notification record not found, skipping email', {
        jobId: job.id,
        notificationId,
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: notification.userId },
      select: { id: true, email: true, firstName: true, lastName: true },
    });

    if (!user) {
      logger.warn('User not found for notification, skipping email', {
        jobId: job.id,
        notificationId,
        userId: notification.userId,
      });
      return;
    }

    if (!user.email) {
      logger.warn('User has no email address, skipping email', {
        jobId: job.id,
        notificationId,
        userId: user.id,
      });
      return;
    }

    const emailSubject = getEmailSubjectForNotificationType(notification.type);
    const emailHtml = buildNotificationEmailHtml(notification.title, notification.body);
    const emailText = `${notification.title}\n\n${notification.body}`;

    try {
      const messageId = await emailService.sendEmail(
        user.email,
        emailSubject,
        emailHtml,
        emailText
      );

      logger.info('Compliance notification email sent', {
        jobId: job.id,
        notificationId,
        userId: user.id,
        email: user.email,
        notificationType: notification.type,
        messageId,
      });
    } catch (err) {
      logger.error('Failed to send compliance notification email', {
        jobId: job.id,
        notificationId,
        userId: user.id,
        email: user.email,
        notificationType: notification.type,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err; // Re-throw so BullMQ can retry the job
    }

    return;
  }

  // -----------------------------------------------------------------------
  // Template-based email flow (existing publish failure notifications, etc.)
  // -----------------------------------------------------------------------
  if (type === 'email' && job.data.templateId) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true },
    });

    if (!user?.email) {
      logger.warn('User not found or has no email, skipping template email', {
        jobId: job.id,
        userId,
      });
      return;
    }

    try {
      const messageId = await emailService.sendFromTemplate(
        job.data.templateId,
        user.email,
        job.data.variables
      );

      logger.info('Template notification email sent', {
        jobId: job.id,
        userId,
        templateId: job.data.templateId,
        messageId,
      });
    } catch (err) {
      logger.error('Failed to send template notification email', {
        jobId: job.id,
        userId,
        templateId: job.data.templateId,
        error: err instanceof Error ? err.message : String(err),
        stack: err instanceof Error ? err.stack : undefined,
      });
      throw err;
    }

    return;
  }

  // In-app only notifications don't need email processing
  logger.info('Notification job completed (in-app only)', { jobId: job.id, userId });
}

// ---------------------------------------------------------------------------
// Worker instances
// ---------------------------------------------------------------------------

const workers: Worker[] = [];

function startWorkers(): void {
  logger.info('Starting BullMQ workers...');

  const publishWorker = new Worker<PublishJobData>(
    'publish',
    processPublishJob,
    {
      connection,
      concurrency: 5,
      // Drain delay for graceful shutdown
      drainDelay: 5,
    }
  );

  const emailWorker = new Worker<EmailJobData>(
    'email',
    processEmailJob,
    {
      connection,
      // Sequential processing to respect Mailgun provider rate limits
      concurrency: 2,
      drainDelay: 5,
    }
  );

  const linkedinCampaignWorker = new Worker<LinkedInCampaignJobData>(
    'linkedin-campaign',
    processLinkedInCampaignJob,
    {
      connection,
      // LinkedIn rate limits require serialised processing per org
      concurrency: 1,
      drainDelay: 5,
    }
  );

  const notificationWorker = new Worker<NotificationJobData>(
    'notification',
    processNotificationJob,
    {
      connection,
      concurrency: 10,
      drainDelay: 5,
    }
  );

  // Attach shared event handlers
  [publishWorker, emailWorker, linkedinCampaignWorker, notificationWorker].forEach(
    (worker) => {
      worker.on('completed', (job) => {
        logger.info('Job completed', { queue: worker.name, jobId: job.id });
      });

      worker.on('failed', (job, err) => {
        logger.error('Job failed', {
          queue: worker.name,
          jobId: job?.id,
          error: err.message,
          stack: err.stack,
          attempts: job?.attemptsMade,
        });
      });

      worker.on('error', (err) => {
        logger.error('Worker error', { queue: worker.name, error: err.message });
      });

      workers.push(worker);
    }
  );

  logger.info('All workers started', {
    workers: ['publish', 'email', 'linkedin-campaign', 'notification'],
  });
}

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

async function shutdown(): Promise<void> {
  logger.info('Worker shutdown initiated...');

  await Promise.all(workers.map((w) => w.close()));

  logger.info('All workers shut down gracefully');
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown());
process.on('SIGINT', () => void shutdown());

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

// Only start workers when this file is the entry point (not when imported in tests)
if (require.main === module) {
  // Load env vars before starting
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  require('dotenv').config();

  startWorkers();
}

export { startWorkers };
