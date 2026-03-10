import sgMail from '@sendgrid/mail';
import { config } from '../config';
import { logger } from '../utils/logger';
import { prisma } from '../db/client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SendGridWebhookEvent {
  event: string;
  email: string;
  timestamp: number;
  sg_message_id?: string;
  'smtp-id'?: string;
  ip?: string;
  useragent?: string;
  sg_event_id?: string;
  reason?: string;
  url?: string;
  category?: string | string[];
}

// ---------------------------------------------------------------------------
// Email Service
// ---------------------------------------------------------------------------

class EmailService {
  constructor() {
    sgMail.setApiKey(config.SENDGRID_API_KEY);
  }

  /**
   * Sends a plain HTML/text email via SendGrid.
   * Returns the SendGrid message ID for tracking.
   */
  async sendEmail(
    to: string,
    subject: string,
    html: string,
    text?: string
  ): Promise<string> {
    const msg: sgMail.MailDataRequired = {
      to,
      from: {
        email: config.SENDGRID_FROM_EMAIL,
        name: config.SENDGRID_FROM_NAME,
      },
      subject,
      html,
      ...(text ? { text } : {}),
    };

    logger.info('Sending email via SendGrid', {
      to,
      subject,
      fromEmail: config.SENDGRID_FROM_EMAIL,
    });

    const [response] = await sgMail.send(msg);

    const messageId =
      (response.headers['x-message-id'] as string | undefined) ??
      (response.headers['X-Message-Id'] as string | undefined) ??
      '';

    logger.info('Email sent successfully', {
      to,
      subject,
      messageId,
      statusCode: response.statusCode,
    });

    return messageId;
  }

  /**
   * Sends an email using a stored EmailTemplate, interpolating variables.
   * Returns the SendGrid message ID.
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
   * Processes an array of SendGrid webhook events.
   * Updates EmailSend records with delivery status, open/click/bounce timestamps.
   */
  async handleWebhook(events: SendGridWebhookEvent[]): Promise<void> {
    for (const event of events) {
      const sgMessageId = event.sg_message_id ?? event['smtp-id'];

      if (!sgMessageId) {
        logger.warn('SendGrid webhook event missing message ID', { event: event.event });
        continue;
      }

      // Normalise the message ID — SendGrid sometimes appends a filter suffix
      // like "sg_message_id.filter0.7369.59B0839E11.0", strip after the first dot-separated
      // UUID portion. A simpler approach: find the EmailSend by sg_message_id prefix.
      const normalised = sgMessageId.split('.')[0] ?? sgMessageId;

      try {
        const emailSend = await prisma.emailSend.findFirst({
          where: {
            OR: [
              { sgMessageId: sgMessageId },
              { sgMessageId: normalised },
            ],
          },
        });

        if (!emailSend) {
          logger.debug('No EmailSend record found for SendGrid message ID', {
            sgMessageId,
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

          case 'open':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: {
                status: 'opened',
                openedAt: emailSend.openedAt ?? now,
              },
            });
            break;

          case 'click':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: {
                status: 'clicked',
                clickedAt: emailSend.clickedAt ?? now,
              },
            });
            break;

          case 'bounce':
          case 'blocked':
            await prisma.emailSend.update({
              where: { id: emailSend.id },
              data: {
                status: 'bounced',
                bouncedAt: emailSend.bouncedAt ?? now,
              },
            });
            break;

          case 'spamreport':
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
            logger.debug('Unhandled SendGrid event type', { event: event.event });
        }

        logger.info('SendGrid webhook event processed', {
          event: event.event,
          sgMessageId,
          emailSendId: emailSend.id,
        });
      } catch (err) {
        logger.error('Failed to process SendGrid webhook event', {
          event: event.event,
          sgMessageId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }
}

export const emailService = new EmailService();
export { EmailService };
