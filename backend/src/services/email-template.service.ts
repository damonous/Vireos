import { EmailTemplate } from '@prisma/client';
import { prisma } from '../db/client';
import { Errors } from '../middleware/errorHandler';
import { logger } from '../utils/logger';
import { AuthenticatedUser, UserRole } from '../types';
import type {
  CreateTemplateDto,
  UpdateTemplateDto,
  PaginationParams,
} from '../validators/email.validators';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Extracts all {{variableName}} tokens from a template string.
 * Returns a de-duplicated, sorted array of variable names.
 */
function extractVariables(content: string): string[] {
  const matches = content.matchAll(/\{\{(\w+)\}\}/g);
  const found = new Set<string>();
  for (const match of matches) {
    if (match[1]) {
      found.add(match[1]);
    }
  }
  return Array.from(found).sort();
}

// ---------------------------------------------------------------------------
// Email Template Service
// ---------------------------------------------------------------------------

class EmailTemplateService {
  /**
   * Creates a new EmailTemplate for the requesting user's organisation.
   * Automatically extracts variable names from the HTML content.
   */
  async createTemplate(
    dto: CreateTemplateDto,
    user: AuthenticatedUser
  ): Promise<EmailTemplate> {
    // Collect variables from all content fields
    const variables = extractVariables(
      [dto.subject, dto.htmlContent, dto.textContent ?? ''].join('\n')
    );

    const template = await prisma.emailTemplate.create({
      data: {
        organizationId: user.orgId,
        createdById: user.id,
        name: dto.name,
        subject: dto.subject,
        htmlContent: dto.htmlContent,
        textContent: dto.textContent ?? null,
        variables,
        isActive: true,
      },
    });

    logger.info('Email template created', {
      templateId: template.id,
      orgId: user.orgId,
      userId: user.id,
      name: dto.name,
    });

    return template;
  }

  /**
   * Lists all templates belonging to the requesting user's organisation.
   */
  async listTemplates(
    orgId: string,
    user: AuthenticatedUser,
    pagination: PaginationParams
  ): Promise<PaginatedResult<EmailTemplate>> {
    this.assertOrgAccess(orgId, user);

    const { page, limit } = pagination;
    const skip = (page - 1) * limit;

    const [items, total] = await prisma.$transaction([
      prisma.emailTemplate.findMany({
        where: { organizationId: orgId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.emailTemplate.count({
        where: { organizationId: orgId },
      }),
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
   * Retrieves a single template by ID, enforcing org-level isolation.
   */
  async getTemplate(
    templateId: string,
    user: AuthenticatedUser
  ): Promise<EmailTemplate> {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw Errors.notFound('EmailTemplate');
    }

    this.assertOrgAccess(template.organizationId, user);

    return template;
  }

  /**
   * Updates an existing template. Only org admins, advisors, and super admins
   * may update. Variables are re-extracted on every update.
   */
  async updateTemplate(
    templateId: string,
    dto: UpdateTemplateDto,
    user: AuthenticatedUser
  ): Promise<EmailTemplate> {
    const existing = await this.getTemplate(templateId, user);

    this.assertCanWrite(user);

    // Re-extract variables if any content field changes
    const newSubject = dto.subject ?? existing.subject;
    const newHtml = dto.htmlContent ?? existing.htmlContent;
    const newText =
      dto.textContent !== undefined ? dto.textContent : existing.textContent;

    const variables = extractVariables(
      [newSubject, newHtml, newText ?? ''].join('\n')
    );

    const updated = await prisma.emailTemplate.update({
      where: { id: templateId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.subject !== undefined ? { subject: dto.subject } : {}),
        ...(dto.htmlContent !== undefined ? { htmlContent: dto.htmlContent } : {}),
        ...(dto.textContent !== undefined ? { textContent: dto.textContent } : {}),
        ...(dto.isActive !== undefined ? { isActive: dto.isActive } : {}),
        variables,
      },
    });

    logger.info('Email template updated', {
      templateId,
      orgId: user.orgId,
      userId: user.id,
    });

    return updated;
  }

  /**
   * Soft-deletes a template by marking it inactive, then hard-deletes.
   * Org admins, super admins, and advisors may delete.
   */
  async deleteTemplate(
    templateId: string,
    user: AuthenticatedUser
  ): Promise<void> {
    await this.getTemplate(templateId, user);

    this.assertCanWrite(user);

    await prisma.emailTemplate.delete({
      where: { id: templateId },
    });

    logger.info('Email template deleted', {
      templateId,
      orgId: user.orgId,
      userId: user.id,
    });
  }

  /**
   * Duplicates an existing template, creating a new copy with "Copy of " prefixed
   * to the name. The new template belongs to the same organisation and retains
   * all content (subject, htmlContent, textContent, variables).
   */
  async duplicateTemplate(
    templateId: string,
    user: AuthenticatedUser
  ): Promise<EmailTemplate> {
    const source = await this.getTemplate(templateId, user);

    this.assertCanWrite(user);

    const duplicate = await prisma.emailTemplate.create({
      data: {
        organizationId: source.organizationId,
        createdById: user.id,
        name: `Copy of ${source.name}`,
        subject: source.subject,
        htmlContent: source.htmlContent,
        textContent: source.textContent,
        variables: source.variables,
        isActive: true,
      },
    });

    logger.info('Email template duplicated', {
      sourceTemplateId: templateId,
      newTemplateId: duplicate.id,
      orgId: user.orgId,
      userId: user.id,
    });

    return duplicate;
  }

  /**
   * Renders a template by substituting {{variableName}} placeholders.
   */
  async renderTemplate(
    template: EmailTemplate,
    variables: Record<string, string>
  ): Promise<{ subject: string; html: string; text: string }> {
    const interpolate = (content: string): string =>
      content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');

    return {
      subject: interpolate(template.subject),
      html: interpolate(template.htmlContent),
      text: template.textContent ? interpolate(template.textContent) : '',
    };
  }

  // ---------------------------------------------------------------------------
  // Private guards
  // ---------------------------------------------------------------------------

  private assertOrgAccess(orgId: string, user: AuthenticatedUser): void {
    if (user.role !== UserRole.SUPER_ADMIN && user.orgId !== orgId) {
      throw Errors.forbidden('Access denied to this organization\'s resources');
    }
  }

  private assertCanWrite(user: AuthenticatedUser): void {
    const writeRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN, UserRole.ADVISOR];
    if (!writeRoles.includes(user.role)) {
      throw Errors.forbidden('Insufficient permissions to modify email templates');
    }
  }

  private assertIsAdmin(user: AuthenticatedUser): void {
    const adminRoles: UserRole[] = [UserRole.SUPER_ADMIN, UserRole.ORG_ADMIN];
    if (!adminRoles.includes(user.role)) {
      throw Errors.forbidden('Only administrators can delete email templates');
    }
  }
}

export const emailTemplateService = new EmailTemplateService();
export { EmailTemplateService };
