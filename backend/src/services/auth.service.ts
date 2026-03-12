import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { UserStatus, UserRole as PrismaUserRole, AuditAction } from '@prisma/client';
import { prisma } from '../db/client';
import { config } from '../config';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { sha256Hex, generateSecureToken } from '../utils/crypto';
import { UserRole } from '../types';
import type { RegisterDto, LoginDto } from '../validators/auth.validators';
import { emailService } from './email.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const PASSWORD_RESET_EXPIRY_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    email: string;
    role: string;
    orgId: string;
    firstName: string;
    lastName: string;
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Maps the Prisma UserRole enum to our application-level UserRole string enum.
 */
function mapPrismaRoleToAppRole(prismaRole: PrismaUserRole): UserRole {
  switch (prismaRole) {
    case PrismaUserRole.SUPER_ADMIN:
      return UserRole.SUPER_ADMIN;
    case PrismaUserRole.ADMIN:
      return UserRole.ORG_ADMIN;
    case PrismaUserRole.ADVISOR:
      return UserRole.ADVISOR;
    case PrismaUserRole.COMPLIANCE:
      return UserRole.VIEWER;
    default:
      return UserRole.ADVISOR;
  }
}

/**
 * Issues a JWT access token (15min expiry).
 */
function signAccessToken(payload: {
  sub: string;
  orgId: string;
  role: UserRole;
  email: string;
}): string {
  return jwt.sign(
    {
      sub: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      email: payload.email,
      type: 'access',
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    }
  );
}

/**
 * Issues a JWT refresh token (7d expiry).
 */
function signRefreshToken(payload: {
  sub: string;
  orgId: string;
  role: UserRole;
  email: string;
}): string {
  return jwt.sign(
    {
      sub: payload.sub,
      orgId: payload.orgId,
      role: payload.role,
      email: payload.email,
      type: 'refresh',
    },
    config.JWT_SECRET,
    {
      expiresIn: config.JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
      algorithm: 'HS256',
    }
  );
}

/**
 * Calculates the access token TTL in seconds from the JWT_EXPIRES_IN config string.
 * Defaults to 900 (15 minutes).
 */
function getAccessTokenExpiresIn(): number {
  const val = config.JWT_EXPIRES_IN;
  const match = val.match(/^(\d+)([smhd])$/);
  if (!match) return 900;
  const num = parseInt(match[1]!, 10);
  switch (match[2]) {
    case 's': return num;
    case 'm': return num * 60;
    case 'h': return num * 3600;
    case 'd': return num * 86400;
    default: return 900;
  }
}

/**
 * Builds the AuthTokens response object for a user.
 */
function buildAuthTokens(user: {
  id: string;
  email: string;
  role: PrismaUserRole;
  organizationId: string;
  firstName: string;
  lastName: string;
}): AuthTokens {
  const appRole = mapPrismaRoleToAppRole(user.role);

  const accessToken = signAccessToken({
    sub: user.id,
    orgId: user.organizationId,
    role: appRole,
    email: user.email,
  });

  const refreshToken = signRefreshToken({
    sub: user.id,
    orgId: user.organizationId,
    role: appRole,
    email: user.email,
  });

  return {
    accessToken,
    refreshToken,
    expiresIn: getAccessTokenExpiresIn(),
    user: {
      id: user.id,
      email: user.email,
      role: appRole,
      orgId: user.organizationId,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  };
}

/**
 * Writes an audit trail record.
 */
async function writeAuditTrail(params: {
  organizationId: string;
  actorId?: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  ipAddress?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    await prisma.auditTrail.create({
      data: {
        organizationId: params.organizationId,
        actorId: params.actorId ?? null,
        entityType: params.entityType,
        entityId: params.entityId,
        action: params.action,
        ipAddress: params.ipAddress ?? null,
        metadata: (params.metadata ?? {}) as object,
      },
    });
  } catch (err) {
    // Audit trail failures should not break the main flow — log and continue
    logger.error('Failed to write audit trail', {
      error: err instanceof Error ? err.message : String(err),
      params,
    });
  }
}

// ---------------------------------------------------------------------------
// Auth Service
// ---------------------------------------------------------------------------

/**
 * Registers a new user in an existing organization.
 *
 * - Validates that the organization exists
 * - Validates email uniqueness
 * - Hashes password with bcrypt (12 rounds)
 * - Creates user with status INVITED
 * - Sends account welcome/verification email
 * - Writes AuditTrail CREATED action
 * - Returns JWT token pair
 */
export async function register(
  dto: RegisterDto,
  ipAddress?: string
): Promise<AuthTokens> {
  const normalizedOrgName = dto.organizationName?.trim();
  const organization = dto.organizationId
    ? await prisma.organization.findUnique({
        where: { id: dto.organizationId },
      })
    : normalizedOrgName
      ? await prisma.organization.findFirst({
          where: {
            OR: [
              { name: { equals: normalizedOrgName, mode: 'insensitive' } },
              { slug: { equals: normalizedOrgName.toLowerCase().replace(/\s+/g, '-'), mode: 'insensitive' } },
            ],
          },
        })
      : null;

  if (!organization) {
    throw Errors.notFound('Organization');
  }

  if (!organization.isActive) {
    throw Errors.forbidden('Organization is not active');
  }

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { email: dto.email.toLowerCase() },
  });

  if (existingUser) {
    throw Errors.conflict('A user with this email address already exists');
  }

  // Hash password
  const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

  // Create user
  const user = await prisma.user.create({
    data: {
      organizationId: organization.id,
      email: dto.email.toLowerCase(),
      passwordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: PrismaUserRole.ADVISOR,
      status: UserStatus.INVITED,
    },
  });

  try {
    await emailService.sendEmail(
      user.email,
      'Welcome to Vireos',
      `<p>Hi ${user.firstName},</p><p>Your Vireos account has been created. You can now sign in and complete onboarding.</p>`,
      `Hi ${user.firstName}, your Vireos account has been created. You can now sign in and complete onboarding.`
    );
  } catch (err) {
    logger.warn('Failed to send welcome email during registration', {
      userId: user.id,
      email: user.email,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  // Write audit trail
  await writeAuditTrail({
    organizationId: user.organizationId,
    actorId: user.id,
    entityType: 'User',
    entityId: user.id,
    action: AuditAction.CREATED,
    ipAddress,
    metadata: { email: user.email, role: user.role },
  });

  logger.info('User registered successfully', {
    userId: user.id,
    orgId: user.organizationId,
    email: user.email,
  });

  return buildAuthTokens(user);
}

/**
 * Authenticates a user and returns a JWT token pair.
 *
 * - Finds user by email
 * - Checks account is not locked
 * - Compares bcrypt password
 * - On failure: increments failedLoginAttempts, locks after 5 failures
 * - On success: resets failedLoginAttempts, updates lastLoginAt
 * - Writes AuditTrail LOGGED_IN action
 * - Returns JWT token pair
 */
export async function login(
  dto: LoginDto,
  ipAddress?: string
): Promise<AuthTokens> {
  // Find user by email (case-insensitive)
  const user = await prisma.user.findUnique({
    where: { email: dto.email.toLowerCase() },
  });

  if (!user) {
    // Use generic message to prevent user enumeration
    throw Errors.unauthorized('Invalid email or password');
  }

  // Check account lock status
  if (user.status === UserStatus.LOCKED) {
    // Check if lock has expired
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const unlockAt = user.lockedUntil.toISOString();
      throw Errors.tooManyRequests(
        `Account is temporarily locked due to too many failed login attempts. Try again after ${unlockAt}.`
      );
    }

    // Lock has expired — unlock the account automatically
    await prisma.user.update({
      where: { id: user.id },
      data: {
        status: UserStatus.ACTIVE,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
  }

  if (user.status === UserStatus.INACTIVE) {
    throw Errors.forbidden('Account is inactive. Contact your administrator.');
  }

  // Compare password
  const isPasswordValid = await bcrypt.compare(dto.password, user.passwordHash);

  if (!isPasswordValid) {
    const newFailedAttempts = user.failedLoginAttempts + 1;
    const shouldLock = newFailedAttempts >= MAX_FAILED_ATTEMPTS;

    await prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginAttempts: newFailedAttempts,
        ...(shouldLock
          ? {
              status: UserStatus.LOCKED,
              lockedUntil: new Date(Date.now() + LOCK_DURATION_MS),
            }
          : {}),
      },
    });

    logger.warn('Failed login attempt', {
      userId: user.id,
      email: user.email,
      failedAttempts: newFailedAttempts,
      locked: shouldLock,
      ipAddress,
    });

    if (shouldLock) {
      throw Errors.tooManyRequests(
        'Account has been locked for 15 minutes due to too many failed login attempts.'
      );
    }

    throw Errors.unauthorized('Invalid email or password');
  }

  // Successful login — reset failed attempts and update last login
  const updatedUser = await prisma.user.update({
    where: { id: user.id },
    data: {
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      // Activate INVITED users on first successful login
      status: user.status === UserStatus.INVITED ? UserStatus.ACTIVE : user.status,
    },
  });

  // Write audit trail
  await writeAuditTrail({
    organizationId: updatedUser.organizationId,
    actorId: updatedUser.id,
    entityType: 'User',
    entityId: updatedUser.id,
    action: AuditAction.LOGGED_IN,
    ipAddress,
    metadata: { email: updatedUser.email },
  });

  logger.info('User logged in successfully', {
    userId: updatedUser.id,
    orgId: updatedUser.organizationId,
    email: updatedUser.email,
  });

  return buildAuthTokens(updatedUser);
}

/**
 * Refreshes an access token using a valid refresh token.
 *
 * - Verifies refresh JWT signature and type
 * - Finds user and checks status is ACTIVE
 * - Issues new access token and rotated refresh token
 */
export async function refreshTokens(refreshToken: string): Promise<AuthTokens> {
  let payload: {
    sub: string;
    orgId: string;
    role: UserRole;
    email: string;
    type: string;
  };

  try {
    payload = jwt.verify(refreshToken, config.JWT_SECRET) as typeof payload;
  } catch (err) {
    if (err instanceof Error && err.name === 'TokenExpiredError') {
      throw Errors.unauthorized('Refresh token has expired. Please log in again.');
    }
    throw Errors.unauthorized('Invalid refresh token.');
  }

  if (payload.type !== 'refresh') {
    throw Errors.unauthorized('Invalid token type. Expected a refresh token.');
  }

  // Find user
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
  });

  if (!user) {
    throw Errors.unauthorized('User not found.');
  }

  if (user.status !== UserStatus.ACTIVE) {
    throw Errors.unauthorized('Account is not active. Please contact your administrator.');
  }

  logger.debug('Tokens refreshed', { userId: user.id, orgId: user.organizationId });

  return buildAuthTokens(user);
}

/**
 * Logs out a user by writing an audit trail entry.
 */
export async function logout(
  userId: string,
  orgId: string,
  ipAddress?: string
): Promise<void> {
  await writeAuditTrail({
    organizationId: orgId,
    actorId: userId,
    entityType: 'User',
    entityId: userId,
    action: AuditAction.LOGGED_OUT,
    ipAddress,
  });

  logger.info('User logged out', { userId, orgId });
}

/**
 * Initiates a password reset flow.
 *
 * - Finds user by email
 * - Generates a secure 32-byte token
 * - Stores hashed token + 1hr expiry on user
 * - Sends password reset email
 */
export async function forgotPassword(email: string): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase() },
  });

  // Always return success to prevent user enumeration
  if (!user) {
    logger.info('Password reset requested for unknown email', {
      email: email.toLowerCase(),
    });
    return;
  }

  // Generate secure token
  const rawToken = generateSecureToken(32);
  const hashedToken = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_EXPIRY_MS);

  // Store hashed token
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: expiresAt,
    },
  });

  const resetUrl = `${config.API_BASE_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;

  try {
    await emailService.sendEmail(
      user.email,
      'Reset your Vireos password',
      `<p>Hi ${user.firstName},</p><p>Use the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">${resetUrl}</a></p>`,
      `Reset your Vireos password using this link (expires in 1 hour): ${resetUrl}`
    );
  } catch (err) {
    logger.warn('Failed to send password reset email', {
      userId: user.id,
      email: user.email,
      expiresAt: expiresAt.toISOString(),
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Resets a user's password using a valid reset token.
 *
 * - Finds user by hashed token
 * - Validates token has not expired
 * - Hashes new password
 * - Clears token fields
 * - Writes AuditTrail PASSWORD_RESET action
 */
export async function resetPassword(
  token: string,
  newPassword: string
): Promise<void> {
  const hashedToken = sha256Hex(token);

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: {
        gt: new Date(),
      },
    },
  });

  if (!user) {
    throw Errors.badRequest(
      'Password reset token is invalid or has expired. Please request a new one.'
    );
  }

  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
      // Ensure account is active after password reset
      status: user.status === UserStatus.LOCKED ? UserStatus.ACTIVE : user.status,
      failedLoginAttempts: 0,
      lockedUntil: null,
    },
  });

  await writeAuditTrail({
    organizationId: user.organizationId,
    actorId: user.id,
    entityType: 'User',
    entityId: user.id,
    action: AuditAction.PASSWORD_RESET,
    metadata: { method: 'reset_token' },
  });

  logger.info('Password reset successfully', {
    userId: user.id,
    orgId: user.organizationId,
  });
}

/**
 * Changes a user's password after verifying their current password.
 */
export async function changePassword(
  userId: string,
  currentPassword: string,
  newPassword: string
): Promise<void> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
  });

  if (!user) {
    throw Errors.notFound('User');
  }

  // Verify current password
  const isCurrentPasswordValid = await bcrypt.compare(
    currentPassword,
    user.passwordHash
  );

  if (!isCurrentPasswordValid) {
    throw Errors.unauthorized('Current password is incorrect.');
  }

  // Ensure new password is different
  const isSamePassword = await bcrypt.compare(newPassword, user.passwordHash);
  if (isSamePassword) {
    throw Errors.badRequest('New password must be different from your current password.');
  }

  const newPasswordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash: newPasswordHash },
  });

  await writeAuditTrail({
    organizationId: user.organizationId,
    actorId: userId,
    entityType: 'User',
    entityId: userId,
    action: AuditAction.PASSWORD_RESET,
    metadata: { method: 'change_password' },
  });

  logger.info('Password changed successfully', {
    userId: user.id,
    orgId: user.organizationId,
  });
}

/**
 * Verifies a user's email address using a verification token.
 */
export async function verifyEmail(token: string): Promise<void> {
  // For now this is a simplified implementation — in production you'd store
  // an email verification token similarly to the password reset token
  const hashedToken = sha256Hex(token);

  const user = await prisma.user.findFirst({
    where: {
      passwordResetToken: hashedToken,
    },
  });

  if (!user) {
    throw Errors.badRequest('Email verification token is invalid or has expired.');
  }

  await prisma.user.update({
    where: { id: user.id },
    data: {
      emailVerifiedAt: new Date(),
      status: UserStatus.ACTIVE,
      passwordResetToken: null,
      passwordResetExpiresAt: null,
    },
  });

  logger.info('Email verified successfully', {
    userId: user.id,
    orgId: user.organizationId,
  });
}
