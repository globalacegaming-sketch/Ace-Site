import type { SupportTicketCategory, SupportTicketStatus } from '../../models/SupportTicket';

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  payment_related_queries: 'Payment Related Queries',
  game_issue: 'Game Issue',
  complaint: 'Complaint',
  feedback: 'Feedback',
  business_queries: 'Business Queries'
};

const STATUS_STYLES: Record<SupportTicketStatus, string> = {
  pending: 'background: #fef3c7; color: #92400e;',
  in_progress: 'background: #dbeafe; color: #1e40af;',
  resolved: 'background: #d1fae5; color: #065f46;',
  closed: 'background: #f3f4f6; color: #374151;'
};

function formatStatus(s: SupportTicketStatus): string {
  return s === 'in_progress' ? 'In Progress' : s.charAt(0).toUpperCase() + s.slice(1);
}

export function getTicketStatusChangedHtml(params: {
  ticketNumber: string;
  category: SupportTicketCategory;
  status: SupportTicketStatus;
  previousStatus: SupportTicketStatus;
  recipientName: string;
  supportUrl: string;
  note?: string | null;
}): string {
  const { ticketNumber, category, status, previousStatus, recipientName, supportUrl, note } = params;
  const categoryLabel = CATEGORY_LABELS[category] || category;
  const statusStyle = STATUS_STYLES[status] || STATUS_STYLES.closed;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Ticket Update</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 520px; margin: 0 auto; padding: 32px 24px; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 32px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; }
    .meta { font-size: 14px; color: #6b7280; margin-bottom: 16px; }
    .note { background: #f9fafb; border-left: 4px solid #3b82f6; padding: 12px 16px; margin: 16px 0; border-radius: 4px; }
    .cta { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .footer { margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1 style="margin:0 0 8px; font-size: 18px;">Support Ticket Update</h1>
      <p>Hi ${recipientName},</p>
      <p>Your ticket status has been updated from <strong>${formatStatus(previousStatus)}</strong> to <strong>${formatStatus(status)}</strong>.</p>
      <p class="meta">Ticket <strong>${ticketNumber}</strong> · ${categoryLabel} · <span class="badge" style="${statusStyle}">${formatStatus(status).toUpperCase()}</span></p>
      ${note && note.trim() ? `
      <div class="note">
        <strong>Note from support:</strong><br>${note.trim().replace(/\n/g, '<br>')}
      </div>
      ` : ''}
      <a href="${supportUrl}" class="cta">View Ticket</a>
      <p class="footer">Global Ace Gaming · Support</p>
    </div>
  </div>
</body>
</html>
`.trim();
}
