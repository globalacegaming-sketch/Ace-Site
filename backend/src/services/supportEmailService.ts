import emailService from './emailService';
import logger from '../utils/logger';
import { getTicketCreatedHtml } from '../templates/support/ticketCreated';
import { getTicketStatusChangedHtml } from '../templates/support/ticketStatusChanged';
import type { ISupportTicket } from '../models/SupportTicket';

const SUPPORT_URL = process.env.FRONTEND_URL || process.env.PRODUCTION_FRONTEND_URL || 'https://www.globalacegaming.com';
const SUPPORT_PAGE = `${SUPPORT_URL.replace(/\/$/, '')}/support`;

export interface SendTicketCreatedResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

export interface SendStatusChangedResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

/**
 * Send transactional email when a ticket is created.
 * Separate from promotional emails - clean, minimal, trust-focused.
 */
export async function sendTicketCreatedEmail(ticket: ISupportTicket): Promise<SendTicketCreatedResult> {
  const recipientName = ticket.name?.trim() || ticket.email?.split('@')[0] || 'there';
  const html = getTicketCreatedHtml({
    ticketNumber: ticket.ticketNumber,
    category: ticket.category as any,
    recipientName,
    supportUrl: SUPPORT_PAGE
  });

  const subject = `Support Ticket ${ticket.ticketNumber} – Received`;
  const success = await emailService.sendEmail({
    to: ticket.email,
    subject,
    html
  });

  if (success) {
    logger.info('Support ticket created email sent', { ticketNumber: ticket.ticketNumber, to: ticket.email });
    return { success: true };
  }
  logger.warn('Failed to send support ticket created email', { ticketNumber: ticket.ticketNumber, to: ticket.email });
  return { success: false, error: 'Email send failed' };
}

/**
 * Send transactional email when ticket status changes.
 * Skips if notifyUser was false (handled by caller).
 */
export async function sendTicketStatusChangedEmail(params: {
  ticket: ISupportTicket;
  previousStatus: string;
  note?: string | null;
}): Promise<SendStatusChangedResult> {
  const { ticket, previousStatus, note } = params;
  const recipientName = ticket.name?.trim() || ticket.email?.split('@')[0] || 'there';

  const html = getTicketStatusChangedHtml({
    ticketNumber: ticket.ticketNumber,
    category: ticket.category as any,
    status: ticket.status as any,
    previousStatus: previousStatus as any,
    recipientName,
    supportUrl: SUPPORT_PAGE,
    note
  });

  const subject = `Support Ticket ${ticket.ticketNumber} – Status Updated`;
  const success = await emailService.sendEmail({
    to: ticket.email,
    subject,
    html
  });

  if (success) {
    logger.info('Support ticket status changed email sent', {
      ticketNumber: ticket.ticketNumber,
      status: ticket.status,
      to: ticket.email
    });
    return { success: true };
  }
  logger.warn('Failed to send support ticket status changed email', {
    ticketNumber: ticket.ticketNumber,
    to: ticket.email
  });
  return { success: false, error: 'Email send failed' };
}
