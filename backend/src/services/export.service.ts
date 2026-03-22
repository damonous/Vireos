import PDFDocument from 'pdfkit';
import { AuditAction } from '@prisma/client';
import { prisma } from '../db/client';
import { logger } from '../utils/logger';
import { Errors } from '../middleware/errorHandler';
import type { AuthenticatedUser } from '../types';
import { UserRole } from '../types';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AuditEntry {
  id: string;
  action: AuditAction;
  actorId: string | null;
  metadata: unknown;
  createdAt: Date;
  actor: { firstName: string; lastName: string; email: string } | null;
}

interface DraftWithRelations {
  id: string;
  organizationId: string;
  creatorId: string;
  reviewerId: string | null;
  title: string;
  originalPrompt: string;
  linkedinContent: string | null;
  facebookContent: string | null;
  emailContent: string | null;
  adCopyContent: string | null;
  flagsJson: unknown;
  status: string;
  reviewNotes: string | null;
  complianceScore: number | null;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  creator: { firstName: string; lastName: string; email: string };
  reviewer: { firstName: string; lastName: string; email: string } | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetches a draft with org isolation and includes creator/reviewer relations.
 */
async function fetchDraftForExport(
  draftId: string,
  user: AuthenticatedUser
): Promise<DraftWithRelations> {
  const draft = await prisma.draft.findUnique({
    where: { id: draftId },
    include: {
      creator: {
        select: { firstName: true, lastName: true, email: true },
      },
      reviewer: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
  });

  if (!draft) {
    throw Errors.notFound('Draft');
  }

  // Enforce org isolation
  if (draft.organizationId !== user.orgId && user.role !== UserRole.SUPER_ADMIN) {
    throw Errors.notFound('Draft');
  }

  return draft as unknown as DraftWithRelations;
}

/**
 * Fetches audit trail entries for a given draft, ordered chronologically.
 */
async function fetchAuditTrail(
  organizationId: string,
  draftId: string
): Promise<AuditEntry[]> {
  const entries = await prisma.auditTrail.findMany({
    where: {
      organizationId,
      entityType: 'Draft',
      entityId: draftId,
    },
    include: {
      actor: {
        select: { firstName: true, lastName: true, email: true },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return entries as unknown as AuditEntry[];
}

/**
 * Formats a date for display in exports.
 */
function formatDate(date: Date): string {
  return date.toISOString().replace('T', ' ').replace(/\.\d{3}Z$/, ' UTC');
}

/**
 * Returns a human-readable label for an audit action.
 */
function auditActionLabel(action: AuditAction): string {
  const labels: Record<string, string> = {
    CREATED: 'Created',
    UPDATED: 'Updated',
    DELETED: 'Deleted',
    STATUS_CHANGED: 'Status Changed',
    SUBMITTED: 'Submitted for Review',
    APPROVED: 'Approved',
    REJECTED: 'Rejected',
    PUBLISHED: 'Published',
    LOGGED_IN: 'Logged In',
    LOGGED_OUT: 'Logged Out',
    PASSWORD_RESET: 'Password Reset',
    VIEWED: 'Viewed',
    EXPORTED: 'Exported',
  };
  return labels[action] ?? action;
}

/**
 * Strips HTML tags from a string for plain-text rendering in PDF.
 */
function stripHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .trim();
}

// ---------------------------------------------------------------------------
// PDF Export
// ---------------------------------------------------------------------------

/**
 * Generates a compliance export PDF for a given draft.
 *
 * The PDF includes:
 * - Header with draft title
 * - Status and compliance score
 * - Content sections for each non-null channel
 * - Compliance disclosures/flags
 * - Review information
 * - Chronological audit trail
 * - Footer with generation metadata
 */
export async function exportDraftToPdf(
  draftId: string,
  user: AuthenticatedUser
): Promise<Buffer> {
  const draft = await fetchDraftForExport(draftId, user);
  const auditEntries = await fetchAuditTrail(draft.organizationId, draftId);

  logger.info('Generating PDF export for draft', {
    draftId,
    userId: user.id,
    orgId: user.orgId,
  });

  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Compliance Export - ${draft.title}`,
          Author: user.email,
          Subject: 'Compliance Export Report',
          Creator: 'Vireos Platform',
        },
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err: Error) => reject(err));

      const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ---- Header ----
      doc
        .fontSize(20)
        .font('Helvetica-Bold')
        .text(`Compliance Export — ${draft.title}`, { align: 'center' });

      doc.moveDown(0.5);

      // ---- Status Badge ----
      doc
        .fontSize(12)
        .font('Helvetica-Bold')
        .text('Status: ', { continued: true })
        .font('Helvetica')
        .text(draft.status.replace(/_/g, ' '));

      // ---- Compliance Score ----
      if (draft.complianceScore !== null && draft.complianceScore !== undefined) {
        const scorePercent = Math.round(draft.complianceScore * 100);
        doc
          .font('Helvetica-Bold')
          .text('Compliance Score: ', { continued: true })
          .font('Helvetica')
          .text(`${scorePercent}%`);
      }

      doc
        .font('Helvetica')
        .fontSize(10)
        .text(`Draft Version: ${draft.version}`)
        .text(`Created: ${formatDate(draft.createdAt)}`)
        .text(`Last Updated: ${formatDate(draft.updatedAt)}`)
        .text(`Created By: ${draft.creator.firstName} ${draft.creator.lastName} (${draft.creator.email})`);

      doc.moveDown(1);

      // ---- Separator ----
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageWidth, doc.y)
        .stroke();

      doc.moveDown(0.5);

      // ---- Content Sections ----
      const channels: { label: string; content: string | null }[] = [
        { label: 'LinkedIn', content: draft.linkedinContent },
        { label: 'Facebook', content: draft.facebookContent },
        { label: 'Email', content: draft.emailContent },
        { label: 'Ad Copy', content: draft.adCopyContent },
      ];

      for (const channel of channels) {
        if (channel.content) {
          doc
            .fontSize(14)
            .font('Helvetica-Bold')
            .text(`${channel.label} Content`);

          doc.moveDown(0.3);

          doc
            .fontSize(10)
            .font('Helvetica')
            .text(stripHtml(channel.content), {
              width: pageWidth,
              lineGap: 2,
            });

          doc.moveDown(1);
        }
      }

      // ---- Disclosures / Compliance Flags ----
      const flagsJson = draft.flagsJson as Record<string, unknown> | null;
      if (flagsJson && Object.keys(flagsJson).length > 0) {
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.margins.left + pageWidth, doc.y)
          .stroke();

        doc.moveDown(0.5);

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Compliance Flags & Disclosures');

        doc.moveDown(0.3);

        const postGenFlags = flagsJson['post_generation_flags'] as string[] | undefined;
        if (postGenFlags && postGenFlags.length > 0) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text('Post-Generation Flagged Terms:');

          doc
            .font('Helvetica')
            .text(postGenFlags.join(', '));

          doc.moveDown(0.3);
        }

        const lowScore = flagsJson['low_compliance_score'] as number | undefined;
        if (lowScore !== undefined) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text('Low Compliance Score Flag: ', { continued: true })
            .font('Helvetica')
            .text(`${Math.round(lowScore * 100)}%`);

          doc.moveDown(0.3);
        }

        // Render any other flags in the flagsJson
        for (const [key, value] of Object.entries(flagsJson)) {
          if (key === 'post_generation_flags' || key === 'low_compliance_score') {
            continue;
          }
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text(`${key}: `, { continued: true })
            .font('Helvetica')
            .text(typeof value === 'string' ? value : JSON.stringify(value));
        }

        doc.moveDown(1);
      }

      // ---- Review Section ----
      if (draft.reviewer || draft.reviewNotes) {
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.margins.left + pageWidth, doc.y)
          .stroke();

        doc.moveDown(0.5);

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Review Information');

        doc.moveDown(0.3);

        if (draft.reviewer) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text('Reviewer: ', { continued: true })
            .font('Helvetica')
            .text(
              `${draft.reviewer.firstName} ${draft.reviewer.lastName} (${draft.reviewer.email})`
            );
        }

        if (draft.reviewNotes) {
          doc
            .fontSize(10)
            .font('Helvetica-Bold')
            .text('Review Notes:');

          doc
            .font('Helvetica')
            .text(draft.reviewNotes, { width: pageWidth, lineGap: 2 });
        }

        // Find the approval/rejection audit entry for the date
        const reviewAction = auditEntries.find(
          (e) => e.action === AuditAction.APPROVED || e.action === AuditAction.REJECTED
        );
        if (reviewAction) {
          doc
            .font('Helvetica-Bold')
            .text(`${auditActionLabel(reviewAction.action)} Date: `, { continued: true })
            .font('Helvetica')
            .text(formatDate(reviewAction.createdAt));
        }

        doc.moveDown(1);
      }

      // ---- Audit Trail Section ----
      if (auditEntries.length > 0) {
        doc
          .moveTo(doc.page.margins.left, doc.y)
          .lineTo(doc.page.margins.left + pageWidth, doc.y)
          .stroke();

        doc.moveDown(0.5);

        doc
          .fontSize(14)
          .font('Helvetica-Bold')
          .text('Audit Trail');

        doc.moveDown(0.3);

        for (const entry of auditEntries) {
          const actorName = entry.actor
            ? `${entry.actor.firstName} ${entry.actor.lastName}`
            : 'System';

          const metadata = entry.metadata as Record<string, unknown> | null;
          const reason =
            metadata && typeof metadata['reason'] === 'string'
              ? ` — ${metadata['reason']}`
              : '';

          doc
            .fontSize(9)
            .font('Helvetica')
            .text(
              `${formatDate(entry.createdAt)} | ${actorName} | ${auditActionLabel(entry.action)}${reason}`,
              { width: pageWidth }
            );

          doc.moveDown(0.2);
        }

        doc.moveDown(1);
      }

      // ---- Footer ----
      doc
        .moveTo(doc.page.margins.left, doc.y)
        .lineTo(doc.page.margins.left + pageWidth, doc.y)
        .stroke();

      doc.moveDown(0.5);

      doc
        .fontSize(8)
        .font('Helvetica-Oblique')
        .fillColor('#666666')
        .text(
          `Generated on ${formatDate(new Date())} by ${user.email}`,
          { align: 'center' }
        );

      doc
        .text('Vireos Compliance Export — Confidential', { align: 'center' });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ---------------------------------------------------------------------------
// DOCX (HTML-based MVP) Export
// ---------------------------------------------------------------------------

/**
 * Generates a compliance export in a simple HTML-based format served as .docx.
 *
 * For MVP, this produces an HTML document with proper Word-compatible structure.
 * Microsoft Word and Google Docs both open HTML files saved as .docx correctly.
 * Full OOXML generation can replace this in a future iteration.
 */
export async function exportDraftToDocx(
  draftId: string,
  user: AuthenticatedUser
): Promise<Buffer> {
  const draft = await fetchDraftForExport(draftId, user);
  const auditEntries = await fetchAuditTrail(draft.organizationId, draftId);

  logger.info('Generating DOCX export for draft', {
    draftId,
    userId: user.id,
    orgId: user.orgId,
  });

  // Build content sections
  const channels: { label: string; content: string | null }[] = [
    { label: 'LinkedIn', content: draft.linkedinContent },
    { label: 'Facebook', content: draft.facebookContent },
    { label: 'Email', content: draft.emailContent },
    { label: 'Ad Copy', content: draft.adCopyContent },
  ];

  const channelSections = channels
    .filter((c) => c.content)
    .map(
      (c) =>
        `<h2>${c.label} Content</h2>
         <div style="border:1px solid #ddd; padding:12px; margin-bottom:16px; white-space:pre-wrap;">${c.content}</div>`
    )
    .join('\n');

  // Build compliance flags section
  let flagsSection = '';
  const flagsJson = draft.flagsJson as Record<string, unknown> | null;
  if (flagsJson && Object.keys(flagsJson).length > 0) {
    flagsSection = '<h2>Compliance Flags &amp; Disclosures</h2>';

    const postGenFlags = flagsJson['post_generation_flags'] as string[] | undefined;
    if (postGenFlags && postGenFlags.length > 0) {
      flagsSection += `<p><strong>Post-Generation Flagged Terms:</strong> ${postGenFlags.join(', ')}</p>`;
    }

    const lowScore = flagsJson['low_compliance_score'] as number | undefined;
    if (lowScore !== undefined) {
      flagsSection += `<p><strong>Low Compliance Score Flag:</strong> ${Math.round(lowScore * 100)}%</p>`;
    }

    for (const [key, value] of Object.entries(flagsJson)) {
      if (key === 'post_generation_flags' || key === 'low_compliance_score') continue;
      const displayValue = typeof value === 'string' ? value : JSON.stringify(value);
      flagsSection += `<p><strong>${key}:</strong> ${displayValue}</p>`;
    }
  }

  // Build review section
  let reviewSection = '';
  if (draft.reviewer || draft.reviewNotes) {
    reviewSection = '<h2>Review Information</h2>';

    if (draft.reviewer) {
      reviewSection += `<p><strong>Reviewer:</strong> ${draft.reviewer.firstName} ${draft.reviewer.lastName} (${draft.reviewer.email})</p>`;
    }

    if (draft.reviewNotes) {
      reviewSection += `<p><strong>Review Notes:</strong></p><p>${draft.reviewNotes}</p>`;
    }

    const reviewAction = auditEntries.find(
      (e) => e.action === AuditAction.APPROVED || e.action === AuditAction.REJECTED
    );
    if (reviewAction) {
      reviewSection += `<p><strong>${auditActionLabel(reviewAction.action)} Date:</strong> ${formatDate(reviewAction.createdAt)}</p>`;
    }
  }

  // Build audit trail section
  let auditSection = '';
  if (auditEntries.length > 0) {
    auditSection = `
      <h2>Audit Trail</h2>
      <table border="1" cellpadding="6" cellspacing="0" style="border-collapse:collapse; width:100%; font-size:11px;">
        <thead>
          <tr style="background:#f0f0f0;">
            <th>Timestamp</th>
            <th>Actor</th>
            <th>Action</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          ${auditEntries
            .map((entry) => {
              const actorName = entry.actor
                ? `${entry.actor.firstName} ${entry.actor.lastName}`
                : 'System';
              const metadata = entry.metadata as Record<string, unknown> | null;
              const reason =
                metadata && typeof metadata['reason'] === 'string'
                  ? metadata['reason']
                  : '';
              return `<tr>
                <td>${formatDate(entry.createdAt)}</td>
                <td>${actorName}</td>
                <td>${auditActionLabel(entry.action)}</td>
                <td>${reason}</td>
              </tr>`;
            })
            .join('\n')}
        </tbody>
      </table>`;
  }

  // Compliance score display
  const scoreDisplay =
    draft.complianceScore !== null && draft.complianceScore !== undefined
      ? `<p><strong>Compliance Score:</strong> ${Math.round(draft.complianceScore * 100)}%</p>`
      : '';

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8">
  <title>Compliance Export - ${draft.title}</title>
  <style>
    body { font-family: Calibri, Arial, sans-serif; margin: 40px; color: #333; line-height: 1.5; }
    h1 { color: #1a1a2e; border-bottom: 2px solid #1a1a2e; padding-bottom: 8px; }
    h2 { color: #16213e; margin-top: 24px; border-bottom: 1px solid #ddd; padding-bottom: 4px; }
    .meta { background: #f8f9fa; padding: 12px; border-radius: 4px; margin-bottom: 20px; }
    .footer { margin-top: 40px; padding-top: 12px; border-top: 1px solid #ccc; font-size: 11px; color: #888; text-align: center; }
    table { margin-top: 8px; }
    th { text-align: left; }
  </style>
</head>
<body>
  <h1>Compliance Export &mdash; ${draft.title}</h1>

  <div class="meta">
    <p><strong>Status:</strong> ${draft.status.replace(/_/g, ' ')}</p>
    ${scoreDisplay}
    <p><strong>Draft Version:</strong> ${draft.version}</p>
    <p><strong>Created:</strong> ${formatDate(draft.createdAt)}</p>
    <p><strong>Last Updated:</strong> ${formatDate(draft.updatedAt)}</p>
    <p><strong>Created By:</strong> ${draft.creator.firstName} ${draft.creator.lastName} (${draft.creator.email})</p>
  </div>

  ${channelSections}
  ${flagsSection}
  ${reviewSection}
  ${auditSection}

  <div class="footer">
    <p>Generated on ${formatDate(new Date())} by ${user.email}</p>
    <p>Vireos Compliance Export &mdash; Confidential</p>
  </div>
</body>
</html>`;

  return Buffer.from(html, 'utf-8');
}
