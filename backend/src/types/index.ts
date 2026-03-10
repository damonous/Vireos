import { Request } from 'express';

// ---------------------------------------------------------------------------
// User roles
// ---------------------------------------------------------------------------

export enum UserRole {
  SUPER_ADMIN = 'super_admin',
  ORG_ADMIN = 'org_admin',
  ADVISOR = 'advisor',
  VIEWER = 'viewer',
}

// ---------------------------------------------------------------------------
// JWT payload / authenticated user shape
// ---------------------------------------------------------------------------

export interface JwtPayload {
  /** User's UUID primary key */
  sub: string;
  /** Organization UUID the user belongs to */
  orgId: string;
  /** User's role within their organization */
  role: UserRole;
  /** User's email address */
  email: string;
  /** Token type: 'access' or 'refresh' */
  type: 'access' | 'refresh';
  /** Issued-at timestamp (seconds since epoch) */
  iat?: number;
  /** Expiry timestamp (seconds since epoch) */
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  orgId: string;
  role: UserRole;
  email: string;
}

// ---------------------------------------------------------------------------
// Express request extensions
// ---------------------------------------------------------------------------

/**
 * Express Request augmented with the authenticated user.
 * Set by the `authenticate` middleware after JWT verification.
 */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  /** Trace/correlation ID attached by requestLogger middleware */
  traceId?: string;
}

// ---------------------------------------------------------------------------
// Standard API response shapes
// ---------------------------------------------------------------------------

export interface ApiSuccessResponse<T = unknown> {
  success: true;
  data: T;
  meta?: Record<string, unknown>;
}

export interface ApiErrorResponse {
  success: false;
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T = unknown> =
  | ApiSuccessResponse<T>
  | ApiErrorResponse;

// ---------------------------------------------------------------------------
// Pagination response meta
// ---------------------------------------------------------------------------

export interface CursorPageMeta {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextCursor: string | null;
  previousCursor: string | null;
  totalCount?: number;
}

export interface OffsetPageMeta {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ---------------------------------------------------------------------------
// BullMQ job data types
// ---------------------------------------------------------------------------

export interface PublishJobData {
  postId: string;
  orgId: string;
  advisorId: string;
  platforms: string[];
  scheduledAt: string; // ISO-8601
}

export interface EmailJobData {
  sequenceId: string;
  recipientId: string;
  orgId: string;
  templateId: string;
  variables: Record<string, string>;
  scheduledAt: string; // ISO-8601
}

export interface LinkedInCampaignJobData {
  campaignId: string;
  orgId: string;
  advisorId: string;
  recipientLinkedInId: string;
  messageTemplateId: string;
}

export interface NotificationJobData {
  type: 'email' | 'in_app';
  userId: string;
  orgId: string;
  subject: string;
  templateId: string;
  variables: Record<string, string>;
}

// ---------------------------------------------------------------------------
// Social platform types
// ---------------------------------------------------------------------------

export type SocialPlatform = 'linkedin' | 'facebook' | 'twitter' | 'instagram';

export interface OAuthTokens {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: Date;
  scope?: string;
}

// ---------------------------------------------------------------------------
// Subscription / plan types
// ---------------------------------------------------------------------------

export type SubscriptionStatus =
  | 'active'
  | 'trialing'
  | 'past_due'
  | 'canceled'
  | 'unpaid'
  | 'incomplete';

export type PlanTier = 'starter' | 'professional' | 'enterprise';
