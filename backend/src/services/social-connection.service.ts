import { SocialConnection, SocialPlatform, AuditAction } from '@prisma/client';
import { prisma } from '../db/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { encrypt, decrypt } from '../utils/crypto';
import type { AuthenticatedUser } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const LINKEDIN_AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const LINKEDIN_TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const LINKEDIN_PROFILE_URL = 'https://api.linkedin.com/v2/userinfo';
const LINKEDIN_SCOPES = 'w_member_social openid profile email';

const FACEBOOK_AUTH_URL = 'https://www.facebook.com/v18.0/dialog/oauth';
const FACEBOOK_TOKEN_URL = 'https://graph.facebook.com/v18.0/oauth/access_token';
const FACEBOOK_ME_URL = 'https://graph.facebook.com/me';
const FACEBOOK_SCOPES = 'pages_manage_posts,pages_read_engagement';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a state parameter encoding orgId:userId:platform to prevent CSRF.
 * Format: base64(orgId:userId:platform)
 */
function buildStateParam(
  orgId: string,
  userId: string,
  platform: 'LINKEDIN' | 'FACEBOOK'
): string {
  const raw = `${orgId}:${userId}:${platform}`;
  return Buffer.from(raw, 'utf8').toString('base64url');
}

/**
 * Parses and validates the state parameter from the OAuth callback.
 * Returns null if the state is malformed.
 */
export function parseStateParam(
  state: string
): { orgId: string; userId: string; platform: 'LINKEDIN' | 'FACEBOOK' } | null {
  try {
    const decoded = Buffer.from(state, 'base64url').toString('utf8');
    const parts = decoded.split(':');
    if (parts.length !== 3) return null;

    const [orgId, userId, platform] = parts;
    if (!orgId || !userId || !platform) return null;
    if (platform !== 'LINKEDIN' && platform !== 'FACEBOOK') return null;

    return { orgId, userId, platform };
  } catch {
    return null;
  }
}

/**
 * Writes an audit trail record. Does not throw on failure.
 */
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
    logger.error('Failed to write audit trail for social connection', {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

// ---------------------------------------------------------------------------
// LinkedIn OAuth helpers
// ---------------------------------------------------------------------------

async function exchangeLinkedInCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
}> {
  const params = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: config.LINKEDIN_REDIRECT_URI,
    client_id: config.LINKEDIN_CLIENT_ID,
    client_secret: config.LINKEDIN_CLIENT_SECRET,
  });

  const response = await fetch(LINKEDIN_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('LinkedIn token exchange failed', {
      status: response.status,
      body: errorText,
    });
    throw Errors.badRequest(
      `LinkedIn authorization failed: ${response.status} ${errorText}`
    );
  }

  return response.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    expires_in?: number;
    scope?: string;
  }>;
}

async function fetchLinkedInProfile(accessToken: string): Promise<{
  sub: string;
  name?: string;
  given_name?: string;
  family_name?: string;
  email?: string;
}> {
  const response = await fetch(LINKEDIN_PROFILE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('LinkedIn profile fetch failed', {
      status: response.status,
      body: errorText,
    });
    throw Errors.badRequest(
      `Failed to fetch LinkedIn profile: ${response.status}`
    );
  }

  return response.json() as Promise<{
    sub: string;
    name?: string;
    given_name?: string;
    family_name?: string;
    email?: string;
  }>;
}

// ---------------------------------------------------------------------------
// Facebook OAuth helpers
// ---------------------------------------------------------------------------

async function exchangeFacebookCode(code: string): Promise<{
  access_token: string;
  token_type: string;
  expires_in?: number;
}> {
  const params = new URLSearchParams({
    client_id: config.FACEBOOK_APP_ID,
    client_secret: config.FACEBOOK_APP_SECRET,
    redirect_uri: config.FACEBOOK_REDIRECT_URI,
    code,
  });

  const response = await fetch(
    `${FACEBOOK_TOKEN_URL}?${params.toString()}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Facebook token exchange failed', {
      status: response.status,
      body: errorText,
    });
    throw Errors.badRequest(
      `Facebook authorization failed: ${response.status} ${errorText}`
    );
  }

  return response.json() as Promise<{
    access_token: string;
    token_type: string;
    expires_in?: number;
  }>;
}

async function fetchFacebookProfile(accessToken: string): Promise<{
  id: string;
  name?: string;
}> {
  const params = new URLSearchParams({
    fields: 'id,name',
    access_token: accessToken,
  });

  const response = await fetch(
    `${FACEBOOK_ME_URL}?${params.toString()}`
  );

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Facebook profile fetch failed', {
      status: response.status,
      body: errorText,
    });
    throw Errors.badRequest(
      `Failed to fetch Facebook profile: ${response.status}`
    );
  }

  return response.json() as Promise<{ id: string; name?: string }>;
}

// ---------------------------------------------------------------------------
// SocialConnectionService
// ---------------------------------------------------------------------------

/**
 * Builds the OAuth authorization URL for the given platform.
 * The state param encodes orgId:userId:platform to prevent CSRF attacks.
 */
export function getAuthorizationUrl(
  platform: 'LINKEDIN' | 'FACEBOOK',
  userId: string,
  orgId: string
): string {
  const state = buildStateParam(orgId, userId, platform);

  if (platform === 'LINKEDIN') {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: config.LINKEDIN_CLIENT_ID,
      redirect_uri: config.LINKEDIN_REDIRECT_URI,
      state,
      scope: LINKEDIN_SCOPES,
    });
    return `${LINKEDIN_AUTH_URL}?${params.toString()}`;
  }

  // FACEBOOK
  const params = new URLSearchParams({
    client_id: config.FACEBOOK_APP_ID,
    redirect_uri: config.FACEBOOK_REDIRECT_URI,
    state,
    scope: FACEBOOK_SCOPES,
    response_type: 'code',
  });
  return `${FACEBOOK_AUTH_URL}?${params.toString()}`;
}

/**
 * Handles the OAuth callback from LinkedIn or Facebook.
 * Exchanges the authorization code for tokens, fetches the user profile,
 * and upserts the SocialConnection record in the database.
 */
export async function handleCallback(
  platform: 'LINKEDIN' | 'FACEBOOK',
  code: string,
  state: string
): Promise<SocialConnection> {
  // Validate state param
  const stateData = parseStateParam(state);
  if (!stateData) {
    throw Errors.badRequest('Invalid OAuth state parameter. Possible CSRF attack.');
  }

  const { orgId, userId } = stateData;

  // Verify user exists and belongs to the org
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw Errors.notFound('User');
  }
  if (user.organizationId !== orgId) {
    throw Errors.forbidden('User does not belong to the specified organization.');
  }

  let encryptedAccessToken: string;
  let encryptedRefreshToken: string | null = null;
  let tokenExpiresAt: Date | null = null;
  let platformUserId: string;
  let platformUsername: string | null = null;
  let scopes: string[];

  if (platform === 'LINKEDIN') {
    const tokens = await exchangeLinkedInCode(code);
    const profile = await fetchLinkedInProfile(tokens.access_token);

    encryptedAccessToken = encrypt(tokens.access_token);
    encryptedRefreshToken = tokens.refresh_token
      ? encrypt(tokens.refresh_token)
      : null;
    tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;
    platformUserId = profile.sub;
    platformUsername = profile.name ?? profile.given_name ?? null;
    scopes = LINKEDIN_SCOPES.split(' ');
  } else {
    const tokens = await exchangeFacebookCode(code);
    const profile = await fetchFacebookProfile(tokens.access_token);

    encryptedAccessToken = encrypt(tokens.access_token);
    tokenExpiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000)
      : null;
    platformUserId = profile.id;
    platformUsername = profile.name ?? null;
    scopes = FACEBOOK_SCOPES.split(',');
  }

  // Upsert the social connection (one per user per platform)
  const connection = await prisma.socialConnection.upsert({
    where: {
      userId_platform: {
        userId,
        platform: platform as SocialPlatform,
      },
    },
    create: {
      userId,
      organizationId: orgId,
      platform: platform as SocialPlatform,
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt,
      platformUserId,
      platformUsername,
      scopes,
      isActive: true,
    },
    update: {
      accessToken: encryptedAccessToken,
      refreshToken: encryptedRefreshToken,
      tokenExpiresAt,
      platformUserId,
      platformUsername,
      scopes,
      isActive: true,
      updatedAt: new Date(),
    },
  });

  await writeAuditTrail({
    organizationId: orgId,
    actorId: userId,
    entityType: 'SocialConnection',
    entityId: connection.id,
    action: AuditAction.CREATED,
    metadata: { platform, platformUserId },
  });

  logger.info('Social connection established', {
    userId,
    orgId,
    platform,
    connectionId: connection.id,
    platformUserId,
  });

  return connection;
}

/**
 * Retrieves the active social connection for a user on a specific platform.
 * Returns null if none exists.
 */
export async function getConnection(
  userId: string,
  platform: SocialPlatform
): Promise<SocialConnection | null> {
  return prisma.socialConnection.findUnique({
    where: {
      userId_platform: { userId, platform },
    },
  });
}

/**
 * Refreshes the OAuth token for a LinkedIn connection using the stored refresh token.
 * Facebook long-lived tokens don't typically use refresh tokens.
 */
export async function refreshToken(
  connectionId: string
): Promise<SocialConnection> {
  const connection = await prisma.socialConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw Errors.notFound('SocialConnection');
  }

  if (!connection.refreshToken) {
    throw Errors.badRequest(
      'No refresh token available for this connection. Please re-authorize.'
    );
  }

  const decryptedRefreshToken = decrypt(connection.refreshToken);

  if (connection.platform === 'LINKEDIN') {
    const params = new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: decryptedRefreshToken,
      client_id: config.LINKEDIN_CLIENT_ID,
      client_secret: config.LINKEDIN_CLIENT_SECRET,
    });

    const response = await fetch(LINKEDIN_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('LinkedIn token refresh failed', {
        connectionId,
        status: response.status,
        body: errorText,
      });
      throw Errors.badRequest(
        `LinkedIn token refresh failed: ${response.status}. Please re-authorize.`
      );
    }

    const tokens = (await response.json()) as {
      access_token: string;
      refresh_token?: string;
      expires_in?: number;
    };

    const updated = await prisma.socialConnection.update({
      where: { id: connectionId },
      data: {
        accessToken: encrypt(tokens.access_token),
        refreshToken: tokens.refresh_token
          ? encrypt(tokens.refresh_token)
          : connection.refreshToken,
        tokenExpiresAt: tokens.expires_in
          ? new Date(Date.now() + tokens.expires_in * 1000)
          : null,
        updatedAt: new Date(),
      },
    });

    logger.info('LinkedIn token refreshed', { connectionId });
    return updated;
  }

  throw Errors.badRequest(
    'Token refresh is not supported for this platform. Please re-authorize.'
  );
}

/**
 * Disconnects (deactivates) a social connection.
 * Advisors can only disconnect their own connections; admins can disconnect any.
 */
export async function disconnect(
  connectionId: string,
  user: AuthenticatedUser
): Promise<void> {
  const connection = await prisma.socialConnection.findUnique({
    where: { id: connectionId },
  });

  if (!connection) {
    throw Errors.notFound('SocialConnection');
  }

  // Org isolation: connection must belong to the user's org
  if (connection.organizationId !== user.orgId) {
    throw Errors.forbidden('Access denied.');
  }

  // Role check: advisors can only disconnect their own connections
  if (
    user.role === 'advisor' &&
    connection.userId !== user.id
  ) {
    throw Errors.forbidden('You can only disconnect your own social connections.');
  }

  await prisma.socialConnection.delete({ where: { id: connectionId } });

  await writeAuditTrail({
    organizationId: connection.organizationId,
    actorId: user.id,
    entityType: 'SocialConnection',
    entityId: connectionId,
    action: AuditAction.DELETED,
    metadata: { platform: connection.platform },
  });

  logger.info('Social connection disconnected', {
    connectionId,
    userId: user.id,
    platform: connection.platform,
  });
}

/**
 * Lists all active social connections for a user within their organization.
 */
export async function listConnections(
  userId: string,
  orgId: string
): Promise<SocialConnection[]> {
  return prisma.socialConnection.findMany({
    where: {
      userId,
      organizationId: orgId,
      isActive: true,
    },
    orderBy: { createdAt: 'desc' },
  });
}
