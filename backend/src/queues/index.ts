import { Queue, QueueOptions } from 'bullmq';
import { logger } from '../utils/logger';
import {
  PublishJobData,
  EmailJobData,
  LinkedInCampaignJobData,
  NotificationJobData,
} from '../types';

// ---------------------------------------------------------------------------
// Shared BullMQ connection config
// ---------------------------------------------------------------------------

const redisUrl = process.env['REDIS_URL'] ?? 'redis://localhost:6379';

// Parse host/port/auth from the URL for BullMQ's connection object
function parseRedisUrl(url: string): { host: string; port: number; password?: string; db?: number } {
  try {
    const parsed = new URL(url);
    return {
      host: parsed.hostname || 'localhost',
      port: parsed.port ? parseInt(parsed.port, 10) : 6379,
      password: parsed.password || undefined,
      db: parsed.pathname && parsed.pathname !== '/'
        ? parseInt(parsed.pathname.slice(1), 10)
        : undefined,
    };
  } catch {
    logger.warn('Failed to parse REDIS_URL, using defaults', { url });
    return { host: 'localhost', port: 6379 };
  }
}

const connection = parseRedisUrl(redisUrl);

const defaultQueueOptions: QueueOptions = {
  connection,
  defaultJobOptions: {
    // Retry failed jobs up to 3 times with exponential backoff
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 5_000, // 5 seconds initial, then 10s, 20s
    },
    // Remove completed jobs after 24 hours (keep last 100)
    removeOnComplete: {
      age: 24 * 60 * 60,
      count: 100,
    },
    // Remove failed jobs after 7 days (keep last 500 for debugging)
    removeOnFail: {
      age: 7 * 24 * 60 * 60,
      count: 500,
    },
  },
};

// ---------------------------------------------------------------------------
// Queue definitions
// ---------------------------------------------------------------------------

/**
 * Social media post scheduling queue.
 * Workers pick up jobs and publish to LinkedIn, Facebook, etc.
 */
export const publishQueue = new Queue<PublishJobData>('publish', defaultQueueOptions);

/**
 * Email sequence queue.
 * Workers send individual emails in drip/nurture sequences.
 */
export const emailQueue = new Queue<EmailJobData>('email', {
  ...defaultQueueOptions,
  defaultJobOptions: {
    ...defaultQueueOptions.defaultJobOptions,
    // Email jobs are less aggressive on retries — avoid spam
    attempts: 2,
    backoff: {
      type: 'exponential',
      delay: 30_000, // 30 seconds initial
    },
  },
});

/**
 * LinkedIn message automation queue.
 * Workers send outbound LinkedIn connection requests and messages.
 */
export const linkedinCampaignQueue = new Queue<LinkedInCampaignJobData>(
  'linkedin-campaign',
  {
    ...defaultQueueOptions,
    defaultJobOptions: {
      ...defaultQueueOptions.defaultJobOptions,
      // LinkedIn is strict about rate limits — be conservative
      attempts: 2,
      backoff: {
        type: 'exponential',
        delay: 60_000, // 1 minute initial
      },
    },
  }
);

/**
 * Notification queue for in-app and email notifications.
 * Lower priority than transactional emails.
 */
export const notificationQueue = new Queue<NotificationJobData>(
  'notification',
  defaultQueueOptions
);

// ---------------------------------------------------------------------------
// Queue registry
// ---------------------------------------------------------------------------

export const queues = {
  publish: publishQueue,
  email: emailQueue,
  linkedinCampaign: linkedinCampaignQueue,
  notification: notificationQueue,
} as const;

export type QueueName = keyof typeof queues;

// ---------------------------------------------------------------------------
// Graceful shutdown
// ---------------------------------------------------------------------------

/**
 * Close all queue connections. Call during application shutdown.
 */
export async function closeQueues(): Promise<void> {
  await Promise.all(
    Object.entries(queues).map(async ([name, queue]) => {
      await queue.close();
      logger.info(`Queue closed: ${name}`);
    })
  );
}
