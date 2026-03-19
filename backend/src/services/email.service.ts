import crypto from 'node:crypto';
import formData from 'form-data';
import Mailgun from 'mailgun.js';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface MailgunWebhookSignature {
  timestamp: string;
  token: string;
  signature: string;
}

export interface MailgunWebhookEventData {
  event: string;
  timestamp: number;
  recipient?: string;
  message?: {
    headers?: {
      'message-id'?: string;
    };
  };
  url?: string;
  reason?: string;
}

export interface MailgunWebhookPayload {
  signature?: MailgunWebhookSignature;
  'event-data'?: MailgunWebhookEventData;
}

// ---------------------------------------------------------------------------
// Email Service
// ---------------------------------------------------------------------------

class EmailService {
  private readonly client: ReturnType<Mailgun['client']>;

  constructor() {
    const mailgun = new Mailgun(formData);
    this.client = mailgun.client({
      username: 'api',
      key: config.MAILGUN_API_KEY,
    });
  }

  /**
   * Sends a plain HTML/text email via Mailgun.
   * Returns the Mailgun message ID for tracking.
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<string> {
    const msg = {
      to,
      from: `${config.MAILGUN_FROM_NAME} <${config.MAILGUN_FROM_EMAIL}>`,
      subject,
      html,
      ...(text ? { text } : {}),
    };

    logger.info('Sending email via Mailgun', {
      to,
      subject,
      fromEmail: config.MAILGUN_FROM_EMAIL,
      domain: config.MAILGUN_DOMAIN,
    });

    const response = await this.client.messages.create(config.MAILGUN_DOMAIN, msg);
    const messageId = response.id ?? '';

    logger.info('Email sent successfully', {
      to,
      subject,
      messageId,
      statusCode: response.status,
    });

    return messageId;
  }

  /**
   * Sends an email using a stored EmailTemplate, interpolating variables.
   * Returns the Mailgun message ID.
   */
  async sendFromTemplate(
    templateId: string,
    to: string,
    variables: Record<string, string>
  ): Promise<string> {
    const template = await prisma.emailTemplate.findUnique({
      where: { id: templateId },
    });

    if (!template) {
      throw new Error(`EmailTemplate not found: ${templateId}`);
    }

    const rendered = await this.renderTemplate(
      template.subject,
      template.htmlContent,
      template.textContent ?? undefined,
      variables
    );

    return this.sendEmail(to, rendered.subject, rendered.html, rendered.text);
  }

  /**
   * Renders subject, html, and text by replacing {{variableName}} tokens.
   */
  renderTemplate(
    subject: string,
    html: string,
    text: string | undefined,
    variables: Record<string, string>
  ): { subject: string; html: string; text: string } {
    const interpolate = (content: string): string =>
      content.replace(/\{\{(\w+)\}\}/g, (_, key: string) => variables[key] ?? '');

    return {
      subject: interpolate(subject),
      html: interpolate(html),
      text: text ? interpolate(text) : '',
    };
  }

  /**
   * Validates a Mailgun webhook signature when a signing key is configured.
   */
  verifyWebhookSignature(signature?: MailgunWebhookSignature): boolean {
    if (!config.MAILGUN_WEBHOOK_SIGNING_KEY) {
      return true;
    }

    if (!signature) {
      return false;
    }

    const digest = crypto
      .createHmac('sha256', config.MAILGUN_WEBHOOK_SIGNING_KEY)
      .update(signature.timestamp.concat(signature.token))
      .digest('hex');

    return digest === signature.signature;
  }

  /**
   * Processes an array of Mailgun webhook events.
   * Updates EmailSend records with delivery status, open/click/bounce timestamps.
   */
  async handleWebhook(events: MailgunWebhookEventData[]): Promise<void> {
    for (const event of events) {
      const mailgunMessageId = event.message?.headers?.['message-id'];

      if (!mailgunMessageId) {
        logger.warn('Mailgun webhook event missing message ID', { event: event.event });
        continue;
      }

      const normalised = mailgunMessageId.replace(/^<|>$/g, '');

      try {
        const emailSend = await prisma.emailSend.findFirst({
          where: {
            OR: [
              { sgMessageId: mailgunMessageId },
              { sgMessageId: normalised },
            ],
          },
        });

        if (!emailSend) {
          logger.debug('No EmailSend record found for Mailgun message ID', {
            mailgunMessageId,
            event: event.event,
          });
          continue;
        }

        const now = new Date(event.timestamp * 1000);

        switch (event.event) {
          case 'delivered':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: { status: 'delivered' },
            });
            break;

          case 'opened':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: {
                status: 'opened',
                openedAt: emailSend.openedAt ?? now,
              },
            });
            break;

          case 'clicked':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: {
                status: 'clicked',
                clickedAt: emailSend.clickedAt ?? now,
              },
            });
            break;

          case 'failed':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: {
                status: 'bounced',
                bouncedAt: emailSend.bouncedAt ?? now,
              },
            });
            break;

          case 'complained':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: { status: 'spam' },
            });
            break;

          case 'unsubscribe':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: { status: 'unsubscribed' },
            });
            break;

          default:
            logger.debug('Unhandled Mailgun event type', { event: event.event });
        }

        logger.info('Mailgun webhook event processed', {
          event: event.event,
          mailgunMessageId,
          emailSendId: emailSend.id,
        });
      } catch (err) {
        logger.error('Failed to process Mailgun webhook event', {
          event: event.event,
          mailgunMessageId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

export const emailService = new EmailService();
export { EmailService };
