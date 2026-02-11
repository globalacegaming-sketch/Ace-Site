import type { SupportTicketCategory } from '../../models/SupportTicket';

const CATEGORY_LABELS: Record<SupportTicketCategory, string> = {
  payment_related_queries: 'Payment Related Queries',
  game_issue: 'Game Issue',
  complaint: 'Complaint',
  feedback: 'Feedback',
  business_queries: 'Business Queries'
};

export function getTicketCreatedHtml(params: {
  ticketNumber: string;
  category: SupportTicketCategory;
  recipientName: string;
  supportUrl: string;
}): string {
  const { ticketNumber, category, recipientName, supportUrl } = params;
  const categoryLabel = CATEGORY_LABELS[category] || category;

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Support Ticket Created</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1a1a1a; margin: 0; padding: 0; background: #f5f5f5; }
    .container { max-width: 520px; margin: 0 auto; padding: 32px 24px; }
    .card { background: #fff; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.06); padding: 32px; }
    .badge { display: inline-block; padding: 4px 10px; border-radius: 6px; font-size: 12px; font-weight: 600; background: #fef3c7; color: #92400e; }
    .meta { font-size: 14px; color: #6b7280; margin-bottom: 16px; }
    .cta { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #3b82f6; color: #fff !important; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 14px; }
    .footer { margin-top: 24px; font-size: 12px; color: #9ca3af; }
  </style>
</head>
<body>
  <div class="container">
    <div class="card">
      <h1 style="margin:0 0 8px; font-size: 18px;">Support Ticket Received</h1>
      <p>Hi ${recipientName},</p>
      <p>We've received your support request and will get back to you soon.</p>
      <p class="meta">Ticket <strong>${ticketNumber}</strong> · ${categoryLabel} · <span class="badge">PENDING</span></p>
      <p style="font-size: 14px; color: #6b7280;">You can check the status of your ticket anytime using the link below.</p>
      <a href="${supportUrl}" class="cta">View Support</a>
      <p class="footer">Global Ace Gaming · Support</p>
    </div>
  </div>
</body>
</html>
`.trim();
}
