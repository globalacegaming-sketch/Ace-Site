import Loan from '../models/Loan';
import Notification from '../models/Notification';
import emailService from './emailService';
import { getSocketServerInstance } from '../utils/socketManager';

class LoanCronService {
  private overdueInterval: ReturnType<typeof setInterval> | null = null;
  private reminderInterval: ReturnType<typeof setInterval> | null = null;
  private overdueReminderInterval: ReturnType<typeof setInterval> | null = null;

  private readonly OVERDUE_CHECK_MS = 60 * 60 * 1000; // 1 hour
  private readonly DUE_SOON_CHECK_MS = 12 * 60 * 60 * 1000; // 12 hours
  private readonly OVERDUE_REMINDER_MS = 12 * 60 * 60 * 1000; // 12 hours

  initialize() {
    this.overdueInterval = setInterval(() => this.markOverdueLoans(), this.OVERDUE_CHECK_MS);
    this.reminderInterval = setInterval(() => this.sendDueSoonReminders(), this.DUE_SOON_CHECK_MS);
    this.overdueReminderInterval = setInterval(() => this.sendOverdueReminders(), this.OVERDUE_REMINDER_MS);

    setTimeout(() => this.markOverdueLoans(), 5000);
    setTimeout(() => this.sendDueSoonReminders(), 10000);
    setTimeout(() => this.sendOverdueReminders(), 15000);

    console.log('[LoanCron] Initialized — overdue check every 1h, due-soon reminders every 12h, overdue reminders every 12h');
  }

  cleanup() {
    if (this.overdueInterval) clearInterval(this.overdueInterval);
    if (this.reminderInterval) clearInterval(this.reminderInterval);
    if (this.overdueReminderInterval) clearInterval(this.overdueReminderInterval);
    this.overdueInterval = null;
    this.reminderInterval = null;
    this.overdueReminderInterval = null;
  }

  async markOverdueLoans() {
    try {
      const result = await Loan.updateMany(
        { status: 'ACTIVE', dueAt: { $lt: new Date() } },
        { $set: { status: 'OVERDUE' } }
      );

      if (result.modifiedCount > 0) {
        console.log(`[LoanCron] Marked ${result.modifiedCount} loan(s) as OVERDUE`);

        const newlyOverdue = await Loan.find({
          status: 'OVERDUE',
          dueAt: { $gte: new Date(Date.now() - this.OVERDUE_CHECK_MS) },
        })
          .populate('userId', 'email firstName')
          .lean();

        for (const loan of newlyOverdue) {
          const user = loan.userId as any;
          if (!user?.email) continue;
          const uid = (user._id || loan.userId).toString();

          try {
            await Notification.create({
              userId: uid,
              title: 'Loan Overdue',
              message: `Your loan of $${loan.principalAmount.toFixed(2)} is now overdue. Please contact support to arrange repayment immediately.`,
              type: 'warning',
              link: '/loans',
            });

            const io = getSocketServerInstance();
            io.to(`user:${uid}`).emit('notification:new', {
              title: 'Loan Overdue',
              message: `Your loan of $${loan.principalAmount.toFixed(2)} is now overdue.`,
              type: 'warning',
            });

            await this.sendOverdueEmail(user.email, user.firstName, loan.principalAmount, loan.dueAt);
          } catch { /* continue */ }
        }
      }
    } catch (err) {
      console.error('[LoanCron] Failed to mark overdue loans:', err);
    }
  }

  /**
   * Sends a reminder 1 day before the loan is due.
   * Checks every 12 hours; deduplicates by looking for an existing
   * "Loan Due Tomorrow" notification within the last 12 hours.
   */
  async sendDueSoonReminders() {
    try {
      const now = new Date();
      const oneDayFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      const loansDueSoon = await Loan.find({
        status: 'ACTIVE',
        dueAt: { $gt: now, $lte: oneDayFromNow },
      })
        .populate('userId', 'email firstName')
        .lean();

      if (loansDueSoon.length === 0) return;

      const dedupeWindow = new Date(now.getTime() - this.DUE_SOON_CHECK_MS);
      let sent = 0;

      for (const loan of loansDueSoon) {
        const user = loan.userId as any;
        if (!user?.email) continue;
        const uid = (user._id || loan.userId).toString();

        const alreadySent = await Notification.findOne({
          userId: uid,
          title: 'Loan Due Tomorrow',
          createdAt: { $gte: dedupeWindow },
        });
        if (alreadySent) continue;

        const hoursLeft = Math.round((new Date(loan.dueAt).getTime() - now.getTime()) / (60 * 60 * 1000));
        const timeLabel = hoursLeft <= 1 ? 'in less than an hour' : `in ~${hoursLeft} hours`;

        try {
          await Notification.create({
            userId: uid,
            title: 'Loan Due Tomorrow',
            message: `Your loan of $${loan.principalAmount.toFixed(2)} is due ${timeLabel}. Please arrange repayment to avoid overdue status.`,
            type: 'warning',
            link: '/loans',
          });

          const io = getSocketServerInstance();
          io.to(`user:${uid}`).emit('notification:new', {
            title: 'Loan Due Tomorrow',
            message: `Your loan of $${loan.principalAmount.toFixed(2)} is due ${timeLabel}.`,
            type: 'warning',
          });

          await this.sendDueSoonEmail(user.email, user.firstName, loan.principalAmount, loan.dueAt, timeLabel);
          sent++;
        } catch { /* continue */ }
      }

      if (sent > 0) console.log(`[LoanCron] Sent ${sent} due-soon reminder(s)`);
    } catch (err) {
      console.error('[LoanCron] Failed to send due-soon reminders:', err);
    }
  }

  /**
   * Sends a reminder every 12 hours to users with overdue loans.
   * Deduplicates by checking for an existing "Overdue Reminder" notification
   * within the last 12 hours.
   */
  async sendOverdueReminders() {
    try {
      const now = new Date();

      const overdueLoans = await Loan.find({ status: 'OVERDUE' })
        .populate('userId', 'email firstName')
        .lean();

      if (overdueLoans.length === 0) return;

      const dedupeWindow = new Date(now.getTime() - this.OVERDUE_REMINDER_MS);
      let sent = 0;

      for (const loan of overdueLoans) {
        const user = loan.userId as any;
        if (!user?.email) continue;
        const uid = (user._id || loan.userId).toString();

        const alreadySent = await Notification.findOne({
          userId: uid,
          title: 'Overdue Loan Reminder',
          createdAt: { $gte: dedupeWindow },
        });
        if (alreadySent) continue;

        const daysOverdue = Math.floor((now.getTime() - new Date(loan.dueAt).getTime()) / (24 * 60 * 60 * 1000));
        const overdueLabel = daysOverdue <= 0 ? 'today' : `${daysOverdue} day${daysOverdue > 1 ? 's' : ''} ago`;

        try {
          await Notification.create({
            userId: uid,
            title: 'Overdue Loan Reminder',
            message: `Your loan of $${loan.principalAmount.toFixed(2)} was due ${overdueLabel} and remains unpaid. Please arrange repayment immediately to restore your borrowing privileges.`,
            type: 'error',
            link: '/loans',
          });

          const io = getSocketServerInstance();
          io.to(`user:${uid}`).emit('notification:new', {
            title: 'Overdue Loan Reminder',
            message: `Your loan of $${loan.principalAmount.toFixed(2)} is overdue. Please repay immediately.`,
            type: 'error',
          });

          await this.sendOverdueReminderEmail(user.email, user.firstName, loan.principalAmount, loan.dueAt, overdueLabel);
          sent++;
        } catch { /* continue */ }
      }

      if (sent > 0) console.log(`[LoanCron] Sent ${sent} overdue reminder(s)`);
    } catch (err) {
      console.error('[LoanCron] Failed to send overdue reminders:', err);
    }
  }

  private async sendDueSoonEmail(email: string, firstName: string | undefined, amount: number, dueDate: Date, timeLabel: string) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #f59e0b;">Loan Payment Due Tomorrow</h2>
            <p>Hello ${firstName || 'there'},</p>
            <p>This is a reminder that your loan payment is due <strong>${timeLabel}</strong>.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #f59e0b;">
              <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <p style="color: #666; font-size: 13px;">Please ensure repayment before the due date to maintain your borrowing privileges and avoid overdue status.</p>
          </div>
        </body>
      </html>
    `;

    await emailService.sendEmail({ to: email, subject: 'Loan Due Tomorrow - Global Ace Gaming', html });
  }

  private async sendOverdueEmail(email: string, firstName: string | undefined, amount: number, dueDate: Date) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #ef4444;">Loan Overdue</h2>
            <p>Hello ${firstName || 'there'},</p>
            <p>Your loan payment is now <strong>overdue</strong>. Please arrange repayment immediately.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <p style="color: #ef4444; font-size: 13px; font-weight: bold;">Failure to repay may affect your future loan eligibility and limit increases.</p>
          </div>
        </body>
      </html>
    `;

    await emailService.sendEmail({ to: email, subject: 'Loan Overdue - Immediate Action Required - Global Ace Gaming', html });
  }

  private async sendOverdueReminderEmail(email: string, firstName: string | undefined, amount: number, dueDate: Date, overdueLabel: string) {
    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
        <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
          </div>
          <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
            <h2 style="color: #ef4444;">Overdue Loan Reminder</h2>
            <p>Hello ${firstName || 'there'},</p>
            <p>Your loan of <strong>$${amount.toFixed(2)}</strong> was due <strong>${overdueLabel}</strong> and remains unpaid.</p>
            <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
              <p style="margin: 5px 0;"><strong>Amount Owed:</strong> $${amount.toFixed(2)}</p>
              <p style="margin: 5px 0;"><strong>Original Due Date:</strong> ${new Date(dueDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
            </div>
            <p style="color: #ef4444; font-size: 13px; font-weight: bold;">Please contact support or arrange repayment immediately to restore your borrowing privileges.</p>
          </div>
        </body>
      </html>
    `;

    await emailService.sendEmail({ to: email, subject: 'Overdue Loan Reminder - Global Ace Gaming', html });
  }
}

export default new LoanCronService();
