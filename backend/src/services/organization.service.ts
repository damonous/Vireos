import { randomBytes } from 'crypto';
import bcrypt from 'bcryptjs';
import { UserStatus, UserRole as PrismaUserRole } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import { UserRole } from '../types';
import type { AuthenticatedUser } from '../types';
import { config } from '../config';
import { emailService } from './email.service';
import { generateSecureToken, sha256Hex } from '../utils/crypto';
import type {
  CreateOrgDto,
  UpdateOrgDto,
  InviteMemberDto,
  PaginationQuery,
} from '../validators/auth.validators';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const BCRYPT_ROUNDS = 12;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  pagination: {
    total: number;
    page: number;
    limit: number;
    hasNext: boolean;
  };
}

// Organization shape returned by service
export interface OrgResult {
  id: string;
  name: string;
  slug: string;
  icpType: string;
  complianceRules: unknown;
  prohibitedTerms: string[];
  requiredDisclosures: unknown;
  logoUrl: string | null;
  website: string | null;
  subscriptionStatus: string;
  creditBalance: number;
  isActive: boolean;
  settings: unknown;
  userCount?: number;
  createdAt: Date;
  updatedAt: Date;
}

// User/member shape returned by service
export interface MemberResult {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  status: string;
  avatarUrl: string | null;
  phone: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Checks that a requesting user has access to the given organization.
 * Super admins bypass this check.
 */
function assertOrgAccess(requestingUser: AuthenticatedUser, orgId: string): void {
  if (requestingUser.role === UserRole.SUPER_ADMIN) return;

  if (requestingUser.orgId !== orgId) {
    throw Errors.forbidden(
      'You do not have permission to access this organization.'
    );
  }
}

/**
 * Checks that a requesting user has admin rights (org_admin or super_admin).
 */
function assertAdminAccess(requestingUser: AuthenticatedUser, orgId: string): void {
  if (requestingUser.role === UserRole.SUPER_ADMIN) return;

  if (requestingUser.orgId !== orgId) {
    throw Errors.forbidden('You do not have permission to access this organization.');
  }

  if (requestingUser.role !== UserRole.ORG_ADMIN) {
    throw Errors.forbidden('Administrator access is required for this action.');
  }
}

/**
 * Maps a Prisma User record to our MemberResult shape (omits passwordHash).
 */
function mapUserToMember(user: {
  id: string;
  organizationId: string;
  email: string;
  firstName: string;
  lastName: string;
  role: PrismaUserRole;
  status: UserStatus;
  avatarUrl: string | null;
  phone: string | null;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): MemberResult {
  return {
    id: user.id,
    organizationId: user.organizationId,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    role: user.role,
    status: user.status,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    lastLoginAt: user.lastLoginAt,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

// ---------------------------------------------------------------------------
// Organization Service
// ---------------------------------------------------------------------------

/**
 * Creates a new organization. Only super_admin users can create organizations.
 */
export async function create(
  dto: CreateOrgDto,
  createdByUserId: string
): Promise<OrgResult> {
  // Check slug uniqueness
  const existingOrg = await prisma.organization.findUnique({
    where: { slug: dto.slug },
  });

  if (existingOrg) {
    throw Errors.conflict(`An organization with slug "${dto.slug}" already exists.`);
  }

  const org = await prisma.organization.create({
    data: {
      name: dto.name,
      slug: dto.slug,
      icpType: dto.icpType ?? 'financial_advisor',
      website: dto.website ?? null,
    },
  });

  logger.info('Organization created', {
    orgId: org.id,
    name: org.name,
    slug: org.slug,
    createdByUserId,
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    icpType: org.icpType,
    complianceRules: org.complianceRules,
    prohibitedTerms: org.prohibitedTerms,
    requiredDisclosures: org.requiredDisclosures,
    logoUrl: org.logoUrl,
    website: org.website,
    subscriptionStatus: org.subscriptionStatus,
    creditBalance: org.creditBalance,
    isActive: org.isActive,
    settings: org.settings,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Retrieves an organization by ID.
 * Enforces org access control.
 */
export async function findById(
  id: string,
  requestingUser: AuthenticatedUser
): Promise<OrgResult> {
  assertOrgAccess(requestingUser, id);

  const org = await prisma.organization.findUnique({
    where: { id },
  });

  if (!org) {
    throw Errors.notFound('Organization');
  }

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    icpType: org.icpType,
    complianceRules: org.complianceRules,
    prohibitedTerms: org.prohibitedTerms,
    requiredDisclosures: org.requiredDisclosures,
    logoUrl: org.logoUrl,
    website: org.website,
    subscriptionStatus: org.subscriptionStatus,
    creditBalance: org.creditBalance,
    isActive: org.isActive,
    settings: org.settings,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Updates organization details.
 * Requires admin or super_admin role.
 */
export async function update(
  id: string,
  dto: UpdateOrgDto,
  requestingUser: AuthenticatedUser
): Promise<OrgResult> {
  assertAdminAccess(requestingUser, id);

  // Verify org exists
  const existing = await prisma.organization.findUnique({ where: { id } });
  if (!existing) {
    throw Errors.notFound('Organization');
  }

  const org = await prisma.organization.update({
    where: { id },
    data: {
      ...(dto.name !== undefined ? { name: dto.name } : {}),
      ...(dto.icpType !== undefined ? { icpType: dto.icpType } : {}),
      ...(dto.website !== undefined ? { website: dto.website } : {}),
      ...(dto.logoUrl !== undefined ? { logoUrl: dto.logoUrl } : {}),
      ...(dto.prohibitedTerms !== undefined ? { prohibitedTerms: dto.prohibitedTerms } : {}),
      ...(dto.requiredDisclosures !== undefined ? { requiredDisclosures: dto.requiredDisclosures as object } : {}),
      ...(dto.complianceRules !== undefined ? { complianceRules: dto.complianceRules as object } : {}),
      ...(dto.settings !== undefined ? { settings: dto.settings as object } : {}),
    },
  });

  logger.info('Organization updated', {
    orgId: org.id,
    updatedBy: requestingUser.id,
    changes: dto,
  });

  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    icpType: org.icpType,
    complianceRules: org.complianceRules,
    prohibitedTerms: org.prohibitedTerms,
    requiredDisclosures: org.requiredDisclosures,
    logoUrl: org.logoUrl,
    website: org.website,
    subscriptionStatus: org.subscriptionStatus,
    creditBalance: org.creditBalance,
    isActive: org.isActive,
    settings: org.settings,
    createdAt: org.createdAt,
    updatedAt: org.updatedAt,
  };
}

/**
 * Returns paginated list of organization members.
 */
export async function getMembers(
  orgId: string,
  requestingUser: AuthenticatedUser,
  pagination: PaginationQuery
): Promise<PaginatedResult<MemberResult>> {
  assertOrgAccess(requestingUser, orgId);

  const { page, limit } = pagination;
  const skip = (page - 1) * limit;

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where: { organizationId: orgId },
      orderBy: { createdAt: 'asc' },
      skip,
      take: limit,
      select: {
        id: true,
        organizationId: true,
        email: true,
        firstName: true,
        lastName: true,
        role: true,
        status: true,
        avatarUrl: true,
        phone: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.user.count({ where: { organizationId: orgId } }),
  ]);

  return {
    items: users.map(mapUserToMember),
    pagination: {
      total,
      page,
      limit,
      hasNext: skip + limit < total,
    },
  };
}

/**
 * Invites a new member to an organization.
 * Requires admin or super_admin role.
 * Creates user with INVITED status — they receive an email to set their password.
 */
export async function inviteMember(
  orgId: string,
  dto: InviteMemberDto,
  requestingUser: AuthenticatedUser
): Promise<MemberResult> {
  assertAdminAccess(requestingUser, orgId);

  // Verify org exists
  const org = await prisma.organization.findUnique({ where: { id: orgId } });
  if (!org) {
    throw Errors.notFound('Organization');
  }

  // Check email uniqueness
  const existingUser = await prisma.user.findUnique({
    where: { email: dto.email.toLowerCase() },
  });

  if (existingUser) {
    throw Errors.conflict('A user with this email address already exists.');
  }

  // Map role string to Prisma enum
  const prismaRole = dto.role as PrismaUserRole;

  // Create user with INVITED status and a cryptographically random placeholder password hash.
  // The invited user will set their real password via the invitation email link.
  const placeholderPasswordHash = await bcrypt.hash(
    randomBytes(32).toString('hex'),
    BCRYPT_ROUNDS
  );

  const user = await prisma.user.create({
    data: {
      organizationId: orgId,
      email: dto.email.toLowerCase(),
      passwordHash: placeholderPasswordHash,
      firstName: dto.firstName,
      lastName: dto.lastName,
      role: prismaRole,
      status: UserStatus.INVITED,
    },
  });

  const rawToken = generateSecureToken(32);
  const hashedToken = sha256Hex(rawToken);
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordResetToken: hashedToken,
      passwordResetExpiresAt: expiresAt,
    },
  });

  const inviteUrl = `${config.API_BASE_URL.replace(/\/$/, '')}/reset-password?token=${encodeURIComponent(rawToken)}`;

  try {
    await emailService.sendEmail(
      user.email,
      `You're invited to join ${org.name} on Vireos`,
      `<p>Hi ${user.firstName},</p><p>${requestingUser.email} invited you to join ${org.name} on Vireos.</p><p>Set your password using this link (expires in 1 hour): <a href="${inviteUrl}">${inviteUrl}</a></p>`,
      `You've been invited to ${org.name} on Vireos. Set your password using this link (expires in 1 hour): ${inviteUrl}`
    );
  } catch (err) {
    logger.warn('Failed to send organization invitation email', {
      userId: user.id,
      orgId,
      invitedBy: requestingUser.id,
      error: err instanceof Error ? err.message : String(err),
    });
  }

  logger.info('Member invited', {
    userId: user.id,
    orgId,
    email: user.email,
    role: user.role,
    invitedBy: requestingUser.id,
  });

  return mapUserToMember(user);
}

/**
 * Updates a member's role within an organization.
 * Requires admin or super_admin role.
 */
export async function updateMemberRole(
  orgId: string,
  userId: string,
  role: PrismaUserRole,
  requestingUser: AuthenticatedUser
): Promise<MemberResult> {
  assertAdminAccess(requestingUser, orgId);

  // Verify user exists and belongs to this org
  const existingUser = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId },
  });

  if (!existingUser) {
    throw Errors.notFound('User');
  }

  // Prevent admins from modifying super_admin users
  if (
    existingUser.role === PrismaUserRole.SUPER_ADMIN &&
    requestingUser.role !== UserRole.SUPER_ADMIN
  ) {
    throw Errors.forbidden('You cannot modify a super admin user.');
  }

  // Prevent self-demotion for the last admin
  if (
    userId === requestingUser.id &&
    role !== PrismaUserRole.ADMIN &&
    existingUser.role === PrismaUserRole.ADMIN
  ) {
    const adminCount = await prisma.user.count({
      where: {
        organizationId: orgId,
        role: PrismaUserRole.ADMIN,
        status: { not: UserStatus.INACTIVE },
      },
    });

    if (adminCount <= 1) {
      throw Errors.badRequest(
        'Cannot demote the last administrator in the organization.'
      );
    }
  }

  const user = await prisma.user.update({
    where: { id: userId },
    data: { role },
    select: {
      id: true,
      organizationId: true,
      email: true,
      firstName: true,
      lastName: true,
      role: true,
      status: true,
      avatarUrl: true,
      phone: true,
      lastLoginAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  logger.info('Member role updated', {
    userId,
    orgId,
    newRole: role,
    updatedBy: requestingUser.id,
  });

  return mapUserToMember(user);
}

/**
 * Removes a member from an organization (sets status to INACTIVE).
 * Requires admin or super_admin role.
 */
export async function removeMember(
  orgId: string,
  userId: string,
  requestingUser: AuthenticatedUser
): Promise<void> {
  assertAdminAccess(requestingUser, orgId);

  // Prevent self-removal
  if (userId === requestingUser.id) {
    throw Errors.badRequest('You cannot remove yourself from the organization.');
  }

  // Verify user exists and belongs to this org
  const existingUser = await prisma.user.findFirst({
    where: { id: userId, organizationId: orgId },
  });

  if (!existingUser) {
    throw Errors.notFound('User');
  }

  // Prevent removing super admins
  if (
    existingUser.role === PrismaUserRole.SUPER_ADMIN &&
    requestingUser.role !== UserRole.SUPER_ADMIN
  ) {
    throw Errors.forbidden('You cannot remove a super admin user.');
  }

  await prisma.user.update({
    where: { id: userId },
    data: { status: UserStatus.INACTIVE },
  });

  logger.info('Member removed from organization', {
    userId,
    orgId,
    removedBy: requestingUser.id,
  });
}
