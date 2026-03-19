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
 * Processes a user/system notification.
 * Routes to email (Mailgun) or in-app notification storage.
 */
async function processNotificationJob(
  job: Job<NotificationJobData>
): Promise<void> {
  const { type, userId, orgId, subject } = job.data;

  logger.info('Processing notification job', {
    jobId: job.id,
    type,
    userId,
    orgId,
    subject,
  });

  // NOTE: Full implementation wired up when NotificationService is built.
  // When NotificationService is available, import and call it here:
  //   const service = new NotificationService();
  //   await service.send(job.data);

  logger.info('Notification job completed', { jobId: job.id, userId });
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
