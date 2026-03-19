import { z } from 'zod';

// ---------------------------------------------------------------------------
// Auth validators
// ---------------------------------------------------------------------------

export const registerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(1, 'First name is required').max(50, 'First name cannot exceed 50 characters'),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name cannot exceed 50 characters'),
  organizationId: z.string().uuid('Organization ID must be a valid UUID').optional(),
  organizationName: z.string().min(1, 'Organization name is required').max(200).optional(),
  inviteToken: z.string().optional(),
}).refine((value) => Boolean(value.organizationId || value.organizationName), {
  message: 'Organization ID or organization name is required',
  path: ['organizationName'],
});

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Reset token is required'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'New password must be at least 8 characters')
    .regex(/[A-Z]/, 'New password must contain at least one uppercase letter')
    .regex(/[0-9]/, 'New password must contain at least one number'),
});

export const verifyEmailSchema = z.object({
  token: z.string().min(1, 'Verification token is required'),
});

export const updateProfileSchema = z.object({
  firstName: z.string().min(1, 'First name is required').max(50, 'First name cannot exceed 50 characters').optional(),
  lastName: z.string().min(1, 'Last name is required').max(50, 'Last name cannot exceed 50 characters').optional(),
  phone: z.string().max(30, 'Phone number cannot exceed 30 characters').optional().nullable(),
  settings: z.record(z.unknown()).optional(),
});

// ---------------------------------------------------------------------------
// Org validators
// ---------------------------------------------------------------------------

export const createOrgSchema = z.object({
  name: z.string().min(1, 'Organization name is required').max(200),
  slug: z
    .string()
    .min(1, 'Slug is required')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens'),
  icpType: z.string().default('financial_advisor'),
  website: z.string().url('Website must be a valid URL').optional(),
});

export const updateOrgSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  icpType: z.string().min(1).max(100).optional(),
  website: z.string().url().optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  prohibitedTerms: z.array(z.string().min(1).max(200)).optional(),
  requiredDisclosures: z.union([z.array(z.string().min(1).max(1000)), z.record(z.unknown())]).optional(),
  complianceRules: z.record(z.unknown()).optional(),
  settings: z.record(z.unknown()).optional(),
});

export const inviteMemberSchema = z.object({
  email: z.string().email('Invalid email address'),
  firstName: z.string().min(1).max(50),
  lastName: z.string().min(1).max(50),
  role: z.enum(['ADMIN', 'ADVISOR', 'COMPLIANCE']).default('ADVISOR'),
});

export const updateMemberRoleSchema = z.object({
  role: z.enum(['ADMIN', 'ADVISOR', 'COMPLIANCE']),
});

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ---------------------------------------------------------------------------
// Types inferred from schemas
// ---------------------------------------------------------------------------

export type RegisterDto = z.infer<typeof registerSchema>;
export type LoginDto = z.infer<typeof loginSchema>;
export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordDto = z.infer<typeof resetPasswordSchema>;
export type RefreshTokenDto = z.infer<typeof refreshTokenSchema>;
export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;
export type CreateOrgDto = z.infer<typeof createOrgSchema>;
export type UpdateOrgDto = z.infer<typeof updateOrgSchema>;
export type InviteMemberDto = z.infer<typeof inviteMemberSchema>;
export type UpdateMemberRoleDto = z.infer<typeof updateMemberRoleSchema>;
export type PaginationQuery = z.infer<typeof paginationQuerySchema>;
