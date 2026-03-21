import { Job } from 'bullmq';
import {
  PublishJob,
  PublishJobStatus,
  SocialPlatform,
  ContentChannel,
  ContentStatus,
  AuditAction,
} from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { decrypt, encrypt } from '../utils/crypto';
import { publishQueue, notificationQueue } from '../queues';
import type { AuthenticatedUser, PublishJobData } from '../types';
import type { PublishDto, UpdatePublishDto } from '../validators/publish.validators';
import {
  buildOffsetPaginationResult,
  calcSkip,
  type OffsetPaginationParams,
  type OffsetPaginationResult,
} from '../utils/pagination';

// ---------------------------------------------------------------------------
// LinkedIn API
// ---------------------------------------------------------------------------

const LINKEDIN_UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';

interface LinkedInUgcPostResponse {
  id: string;
}

async function publishToLinkedIn(
  accessToken: string,
  platformUserId: string,
  content: string
): Promise<{ postId: string; postUrl: string }> {
  const body = {
    author: `urn:li:person:${platformUserId}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: {
          text: content,
        },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: {
      'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC',
    },
  };

  const response = await fetch(LINKEDIN_UGC_POSTS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-Restli-Protocol-Version': '2.0.0',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('LinkedIn publish failed', {
      status: response.status,
      body: errorText,
    });
    throw new Error(
      `LinkedIn API error ${response.status}: ${errorText}`
    );
  }

  const result = (await response.json()) as LinkedInUgcPostResponse;

  // LinkedIn post ID format: "urn:li:ugcPost:123456789"
  const postId = result.id;
  const numericId = postId.split(':').pop() ?? postId;
  const postUrl = `https://www.linkedin.com/feed/update/${encodeURIComponent(postId)}`;

  return { postId: numericId, postUrl };
}

// ---------------------------------------------------------------------------
// Facebook API
// ---------------------------------------------------------------------------

async function publishToFacebook(
  accessToken: string,
  pageId: string,
  content: string,
  link?: string
): Promise<{ postId: string; postUrl: string }> {
  const params = new URLSearchParams();
  params.set('message', content);
  params.set('access_token', accessToken);

  if (link) {
    params.set('link', link);
  }

  const response = await fetch(
    `https://graph.facebook.com/v21.0/${pageId}/feed`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Facebook publish failed', {
      status: response.status,
      body: errorText,
    });
    throw new Error(
      `Facebook API error ${response.status}: ${errorText}`
    );
  }

  const result = (await response.json()) as { id: string };
  const postId = result.id;

  // Facebook post URL format: https://www.facebook.com/{pageId}/posts/{postNumericId}
  const parts = postId.split('_');
  const numericPostId = parts[1] ?? postId;
  const postUrl = `https://www.facebook.com/${pageId}/posts/${numericPostId}`;

  return { postId, postUrl };
}

// ---------------------------------------------------------------------------
// Audit trail helper
// ---------------------------------------------------------------------------

async function writeAuditTrail(params: {
  organizationId: string;
  actorId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    logger.error('Failed to write audit trail for publish job', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// Channel → Platform mapping
// ---------------------------------------------------------------------------

function channelToPlatform(channel: ContentChannel): SocialPlatform {
  switch (channel) {
    case ContentChannel.LINKEDIN:
      return SocialPlatform.LINKEDIN;
    case ContentChannel.FACEBOOK:
      return SocialPlatform.FACEBOOK;
    default:
      throw Errors.badRequest(
        `Channel ${channel} does not map to a supported social platform.`
      );
  }
}

// ---------------------------------------------------------------------------
// PublishService
// ---------------------------------------------------------------------------

/**
 * Schedules a social media post for future publication.
 * Creates a PublishJob record and enqueues it in BullMQ with a delay.
 */
export async function schedulePost(
  dto: PublishDto,
  user: AuthenticatedUser
): Promise<PublishJob> {
  const platform = channelToPlatform(dto.channel);

  // Validate draft exists, is APPROVED, and belongs to the user's org
  const draft = await prisma.draft.findUnique({ where: { id: dto.draftId } });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  if (draft.organizationId !== user.orgId) {
    throw Errors.forbidden('Access denied.');
  }

  if (draft.status !== ContentStatus.APPROVED) {
    throw Errors.badRequest(
      `Draft must be in APPROVED status to publish. Current status: ${draft.status}`
    );
  }

  // Validate a social connection exists for the channel
  const connection = await prisma.socialConnection.findUnique({
    where: {
      userId_platform: {
        userId: user.id,
        platform,
      },
    },
  });

  if (!connection || !connection.isActive) {
    throw Errors.badRequest(
      `No active ${platform} connection found. Please connect your ${platform} account first.`
    );
  }

  const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : null;
  const delayMs = scheduledAt
    ? Math.max(0, scheduledAt.getTime() - Date.now())
    : 0;

  // Create the PublishJob record
  const publishJob = await prisma.publishJob.create({
    data: {
      organizationId: user.orgId,
      draftId: dto.draftId,
      advisorId: user.id,
      channel: dto.channel,
      platform,
      status: PublishJobStatus.QUEUED,
      scheduledAt,
    },
    include: { draft: { select: { id: true, title: true, status: true } } },
  });

  // Enqueue the BullMQ job
  const jobData: PublishJobData = {
    postId: publishJob.id,
    orgId: user.orgId,
    advisorId: user.id,
    platforms: [platform],
    scheduledAt: (scheduledAt ?? new Date()).toISOString(),
  };

  await publishQueue.add(
    `publish:${publishJob.id}`,
    jobData,
    {
      delay: delayMs,
      jobId: publishJob.id,
    }
  );

  await writeAuditTrail({
    organizationId: user.orgId,
    actorId: user.id,
    entityType: 'PublishJob',
    entityId: publishJob.id,
    action: AuditAction.CREATED,
    metadata: { draftId: dto.draftId, channel: dto.channel, scheduledAt },
  });

  logger.info('Publish job scheduled', {
    jobId: publishJob.id,
    draftId: dto.draftId,
    platform,
    scheduledAt,
    delayMs,
  });

  return publishJob;
}

/**
 * Immediately publishes a social media post (no delay).
 */
export async function publishNow(
  dto: PublishDto,
  user: AuthenticatedUser
): Promise<PublishJob> {
  // publishNow is schedulePost with no scheduledAt
  return schedulePost({ ...dto, scheduledAt: undefined }, user);
}

/**
 * Cancels a QUEUED publish job. Only the owning advisor or an admin can cancel.
 */
export async function cancelJob(
  jobId: string,
  user: AuthenticatedUser
): Promise<void> {
  const publishJob = await prisma.publishJob.findUnique({
    where: { id: jobId },
  });

  if (!publishJob) {
    throw Errors.notFound('PublishJob');
  }

  if (publishJob.organizationId !== user.orgId) {
    throw Errors.forbidden('Access denied.');
  }

  // Advisors can only cancel their own jobs
  if (user.role === 'advisor' && publishJob.advisorId !== user.id) {
    throw Errors.forbidden('You can only cancel your own publish jobs.');
  }

  if (publishJob.status !== PublishJobStatus.QUEUED) {
    throw Errors.badRequest(
      `Cannot cancel a job in ${publishJob.status} status. Only QUEUED jobs can be cancelled.`
    );
  }

  // Remove from BullMQ queue
  try {
    const bullJob = await publishQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }
  } catch (err) {
    logger.warn('Failed to remove job from BullMQ queue', {
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Update DB status
  await prisma.publishJob.update({
    where: { id: jobId },
    data: { status: PublishJobStatus.CANCELLED },
  });

  await writeAuditTrail({
    organizationId: publishJob.organizationId,
    actorId: user.id,
    entityType: 'PublishJob',
    entityId: jobId,
    action: AuditAction.STATUS_CHANGED,
    metadata: {
      previousStatus: PublishJobStatus.QUEUED,
      newStatus: PublishJobStatus.CANCELLED,
    },
  });

  logger.info('Publish job cancelled', { jobId, cancelledBy: user.id });
}

export async function updateJob(
  jobId: string,
  dto: UpdatePublishDto,
  user: AuthenticatedUser
): Promise<PublishJob> {
  const publishJob = await prisma.publishJob.findUnique({
    where: { id: jobId },
  });

  if (!publishJob) {
    throw Errors.notFound('PublishJob');
  }

  if (publishJob.organizationId !== user.orgId) {
    throw Errors.forbidden('Access denied.');
  }

  if (user.role === 'advisor' && publishJob.advisorId !== user.id) {
    throw Errors.forbidden('You can only edit your own publish jobs.');
  }

  if (publishJob.status !== PublishJobStatus.QUEUED) {
    throw Errors.badRequest(
      `Cannot edit a job in ${publishJob.status} status. Only QUEUED jobs can be edited.`
    );
  }

  let platform = publishJob.platform;
  if (dto.channel && dto.channel !== publishJob.channel) {
    platform = channelToPlatform(dto.channel);
    const connection = await prisma.socialConnection.findUnique({
      where: {
        userId_platform: {
          userId: publishJob.advisorId,
          platform,
        },
      },
    });

    if (!connection || !connection.isActive) {
      throw Errors.badRequest(
        `No active ${platform} connection found. Please connect your ${platform} account first.`
      );
    }
  }

  const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : publishJob.scheduledAt;
  const updated = await prisma.publishJob.update({
    where: { id: jobId },
    data: {
      channel: dto.channel ?? publishJob.channel,
      platform,
      scheduledAt,
    },
    include: { draft: { select: { id: true, title: true, status: true } } },
  });

  // Reschedule the BullMQ job using remove + re-add for reliability.
  // changeDelay() can silently fail depending on job state; removing the old
  // job and re-enqueueing guarantees the new delay is applied correctly.
  const delayMs = scheduledAt
    ? Math.max(0, scheduledAt.getTime() - Date.now())
    : 0;

  try {
    const bullJob = await publishQueue.getJob(jobId);
    if (bullJob) {
      await bullJob.remove();
    }
  } catch (err) {
    logger.warn('Failed to remove old BullMQ job during reschedule', {
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  try {
    const jobData: PublishJobData = {
      postId: jobId,
      orgId: publishJob.organizationId,
      advisorId: publishJob.advisorId,
      platforms: [platform],
      scheduledAt: (scheduledAt ?? new Date()).toISOString(),
    };

    await publishQueue.add(
      `publish:${jobId}`,
      jobData,
      {
        delay: delayMs,
        jobId,
      }
    );
  } catch (err) {
    logger.error('Failed to re-enqueue BullMQ job during reschedule', {
      jobId,
      error: err instanceof Error ? err.message : String(err),
    });
    throw Errors.internal(
      'The publish job was updated in the database but failed to reschedule in the queue. Please try again.'
    );
  }

  await writeAuditTrail({
    organizationId: publishJob.organizationId,
    actorId: user.id,
    entityType: 'PublishJob',
    entityId: jobId,
    action: AuditAction.UPDATED,
    metadata: {
      previousChannel: publishJob.channel,
      newChannel: updated.channel,
      previousScheduledAt: publishJob.scheduledAt,
      newScheduledAt: updated.scheduledAt,
    },
  });

  logger.info('Publish job updated', {
    jobId,
    updatedBy: user.id,
    channel: updated.channel,
    scheduledAt: updated.scheduledAt,
  });

  return updated;
}

/**
 * Returns a single publish job by ID. User must belong to the same org.
 */
export async function getJob(
  jobId: string,
  user: AuthenticatedUser
): Promise<PublishJob> {
  const publishJob = await prisma.publishJob.findUnique({
    where: { id: jobId },
  });

  if (!publishJob) {
    throw Errors.notFound('PublishJob');
  }

  if (publishJob.organizationId !== user.orgId) {
    throw Errors.forbidden('Access denied.');
  }

  return publishJob;
}

/**
 * Returns a paginated list of publish jobs for an organization.
 */
export async function listJobs(
  orgId: string,
  user: AuthenticatedUser,
  pagination: OffsetPaginationParams
): Promise<OffsetPaginationResult<PublishJob>> {
  // Org isolation
  if (user.orgId !== orgId) {
    throw Errors.forbidden('Access denied.');
  }

  const skip = calcSkip(pagination);

  const [jobs, totalCount] = await Promise.all([
    prisma.publishJob.findMany({
      where: { organizationId: orgId },
      include: { draft: { select: { id: true, title: true, status: true } } },
      orderBy: { createdAt: 'desc' },
      skip,
      take: pagination.limit,
    }),
    prisma.publishJob.count({
      where: { organizationId: orgId },
    }),
  ]);

  return buildOffsetPaginationResult(jobs, totalCount, pagination);
}

// ---------------------------------------------------------------------------
// Worker processor
// ---------------------------------------------------------------------------

/**
 * Called by the BullMQ worker to process a publish job.
 * Loads the job from DB, decrypts the token, calls the platform API,
 * and updates the job status on success or failure.
 */
export async function processPublishJob(job: Job<PublishJobData>): Promise<void> {
  const { postId } = job.data;

  logger.info('Processing publish job', {
    bullJobId: job.id,
    postId,
  });

  // Load the publish job, draft, and social connection
  const publishJob = await prisma.publishJob.findUnique({
    where: { id: postId },
    include: {
      draft: true,
    },
  });

  if (!publishJob) {
    throw new Error(`PublishJob ${postId} not found in database`);
  }

  if (publishJob.status === PublishJobStatus.CANCELLED) {
    logger.info('Skipping cancelled publish job', { postId });
    return;
  }

  // Mark as PROCESSING
  await prisma.publishJob.update({
    where: { id: postId },
    data: { status: PublishJobStatus.PROCESSING },
  });

  // Load the social connection for this advisor + platform
  const connection = await prisma.socialConnection.findUnique({
    where: {
      userId_platform: {
        userId: publishJob.advisorId,
        platform: publishJob.platform,
      },
    },
  });

  if (!connection || !connection.isActive) {
    const errorMessage = `No active ${publishJob.platform} connection found for advisor ${publishJob.advisorId}`;
    await prisma.publishJob.update({
      where: { id: postId },
      data: {
        status: PublishJobStatus.FAILED,
        errorMessage,
        retryCount: { increment: 1 },
      },
    });
    throw new Error(errorMessage);
  }

  // Decrypt the OAuth token
  let accessToken: string;
  try {
    accessToken = decrypt(connection.accessToken);
  } catch (err) {
    const errorMessage = 'Failed to decrypt OAuth access token';
    await prisma.publishJob.update({
      where: { id: postId },
      data: {
        status: PublishJobStatus.FAILED,
        errorMessage,
        retryCount: { increment: 1 },
      },
    });
    throw new Error(errorMessage);
  }

  // Determine content to publish based on channel
  const draft = publishJob.draft;
  let content: string;

  switch (publishJob.channel) {
    case ContentChannel.LINKEDIN:
      content = draft.linkedinContent ?? draft.title;
      break;
    case ContentChannel.FACEBOOK:
      content = draft.facebookContent ?? draft.title;
      break;
    default:
      content = draft.title;
  }

  // Publish to the platform
  let platformPostId: string;
  let platformUrl: string;

  try {
    if (publishJob.platform === SocialPlatform.LINKEDIN) {
      const result = await publishToLinkedIn(
        accessToken,
        connection.platformUserId,
        content
      );
      platformPostId = result.postId;
      platformUrl = result.postUrl;
    } else if (publishJob.platform === SocialPlatform.FACEBOOK) {
      // The social-connection callback already stores the Facebook Page
      // access token (not user token) and the Page ID in the connection
      // record.  We can publish directly without re-fetching page context
      // — calling /me/accounts with a page token would fail (that
      // endpoint requires a user token).
      const result = await publishToFacebook(
        accessToken,
        connection.platformUserId,
        content
      );
      platformPostId = result.postId;
      platformUrl = result.postUrl;
    } else {
      throw new Error(`Unsupported platform: ${publishJob.platform}`);
    }
  } catch (err) {
    const errorMessage =
      err instanceof Error ? err.message : `Unknown error publishing to ${publishJob.platform}`;

    logger.error('Publish job failed', {
      postId,
      platform: publishJob.platform,
      error: errorMessage,
      attempt: job.attemptsMade,
    });

    await prisma.publishJob.update({
      where: { id: postId },
      data: {
        status: PublishJobStatus.FAILED,
        errorMessage,
        retryCount: { increment: 1 },
      },
    });

    // Notify the advisor via notification queue
    try {
      await notificationQueue.add(`notify:publish-failed:${postId}`, {
        type: 'in_app',
        userId: publishJob.advisorId,
        orgId: publishJob.organizationId,
        subject: `Post failed to publish on ${publishJob.platform}`,
        templateId: 'publish_failed',
        variables: {
          platform: publishJob.platform,
          draftId: publishJob.draftId,
          errorMessage,
        },
      });
    } catch (notifyErr) {
      logger.warn('Failed to enqueue failure notification', {
        postId,
        error:
          notifyErr instanceof Error ? notifyErr.message : String(notifyErr),
      });
    }

    throw err;
  }

  // Success — update job record
  await prisma.publishJob.update({
    where: { id: postId },
    data: {
      status: PublishJobStatus.PUBLISHED,
      platformPostId,
      platformUrl,
      publishedAt: new Date(),
    },
  });

  // Mark draft as published if all channels done
  // (simplified: mark PUBLISHED after any successful publish)
  await prisma.draft.update({
    where: { id: publishJob.draftId },
    data: {
      status: ContentStatus.PUBLISHED,
      publishedChannels: {
        push: publishJob.channel,
      },
    },
  });

  // Write audit trail
  await writeAuditTrail({
    organizationId: publishJob.organizationId,
    actorId: publishJob.advisorId,
    entityType: 'PublishJob',
    entityId: postId,
    action: AuditAction.PUBLISHED,
    metadata: {
      platform: publishJob.platform,
      platformPostId,
      platformUrl,
      draftId: publishJob.draftId,
    },
  });

  logger.info('Publish job completed successfully', {
    postId,
    platform: publishJob.platform,
    platformPostId,
    platformUrl,
  });
}
