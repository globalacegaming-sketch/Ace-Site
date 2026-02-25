import mongoose from 'mongoose';
import LoanAccount, { ILoanAccount } from '../models/LoanAccount';
import LoanRequest, { ILoanRequest } from '../models/LoanRequest';
import Loan, { ILoan } from '../models/Loan';
import LoanLedger, { ILoanLedger, LedgerType, PaymentMethod } from '../models/LoanLedger';
import LoanLimitHistory from '../models/LoanLimitHistory';
import LoanAgentLog, { LoanAgentAction } from '../models/LoanAgentLog';
import ChatMessage from '../models/ChatMessage';
import Notification from '../models/Notification';
import User from '../models/User';
import emailService from './emailService';
import { getSocketServerInstance } from '../utils/socketManager';

const PAYMENT_METHOD_TO_LEDGER_TYPE: Record<PaymentMethod, LedgerType> = {
  CASH: 'REPAY_CASH',
  WINNING_DEDUCTION: 'REPAY_WINNING',
  REFERRAL_CREDIT: 'REPAY_REFERRAL',
  TASK_CREDIT: 'REPAY_TASK',
  MANUAL_ADJUSTMENT: 'ADJUSTMENT',
};

class LoanService {
  async logAgentAction(
    agentId: string,
    action: LoanAgentAction,
    targetUserId: string | mongoose.Types.ObjectId,
    details: Record<string, any>,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      await LoanAgentLog.create({ agentId, action, targetUserId, details, ipAddress, userAgent });
    } catch { /* non-critical */ }
  }

  private async notifyUser(userId: string, title: string, message: string, type: 'info' | 'success' | 'warning' | 'error' = 'info', link = '/loans') {
    try {
      await Notification.create({ userId, title, message, type, link });
      const io = getSocketServerInstance();
      io.to(`user:${userId}`).emit('notification:new', { title, message, type });
    } catch { /* non-critical */ }
  }

  private async sendLoanChatMessage(
    userId: string,
    chatMsg: string,
    metadata: Record<string, any>
  ) {
    try {
      const user = await User.findById(userId).select('username email firstName lastName').lean();
      if (!user) return;

      const name = (user as any).firstName && (user as any).lastName
        ? `${(user as any).firstName} ${(user as any).lastName}`.trim()
        : (user as any).username;

      const systemMessage = await ChatMessage.create({
        userId: user._id,
        senderType: 'system',
        message: chatMsg,
        status: 'unread',
        name,
        email: (user as any).email,
        metadata: {
          ...metadata,
          isSystemMessage: true,
          timestamp: new Date().toISOString(),
        },
      });

      const io = getSocketServerInstance();
      const payload = {
        id: systemMessage._id.toString(),
        userId: systemMessage.userId.toString(),
        senderType: 'system',
        message: systemMessage.message,
        status: systemMessage.status,
        name: systemMessage.name,
        email: systemMessage.email,
        metadata: systemMessage.metadata,
        createdAt: systemMessage.createdAt,
        updatedAt: systemMessage.updatedAt,
      };
      io.to('admins').emit('chat:message:new', payload);
      io.to(`user:${userId}`).emit('chat:message:new', payload);
    } catch { /* non-critical */ }
  }

  async getOrCreateAccount(userId: string): Promise<ILoanAccount> {
    let account = await LoanAccount.findOne({ userId });
    if (!account) {
      account = await LoanAccount.create({ userId, loanLimit: 20, activeBalance: 0 });
    }
    return account;
  }

  async getAccountByUserId(userId: string): Promise<ILoanAccount | null> {
    return LoanAccount.findOne({ userId });
  }

  async getUserLoanSummary(userId: string) {
    const account = await this.getOrCreateAccount(userId);

    await this.markOverdueLoans(userId);

    const activeLoan = await Loan.findOne({
      userId,
      status: { $in: ['ACTIVE', 'OVERDUE'] },
    }).sort({ createdAt: -1 });

    const pendingRequest = await LoanRequest.findOne({
      userId,
      status: 'PENDING',
    });

    const loanHistory = await Loan.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const repaymentHistory = await LoanLedger.find({
      userId,
      type: { $ne: 'ISSUE' },
    })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const requestHistory = await LoanRequest.find({ userId })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    return {
      loanLimit: account.loanLimit,
      activeBalance: account.activeBalance,
      availableToBorrow: Math.max(0, account.loanLimit - account.activeBalance),
      activeLoan: activeLoan
        ? {
            id: activeLoan._id,
            principalAmount: activeLoan.principalAmount,
            issuedAt: activeLoan.issuedAt,
            dueAt: activeLoan.dueAt,
            status: activeLoan.status,
          }
        : null,
      pendingRequest: pendingRequest
        ? {
            id: pendingRequest._id,
            requestedAmount: pendingRequest.requestedAmount,
            createdAt: pendingRequest.createdAt,
          }
        : null,
      loanHistory,
      repaymentHistory,
      requestHistory,
    };
  }

  async submitLoanRequest(userId: string, amount: number) {
    const account = await this.getOrCreateAccount(userId);

    if (amount < 10 || amount > 100) {
      throw new Error('Loan amount must be between $10 and $100.');
    }

    const available = account.loanLimit - account.activeBalance;
    if (amount > available) {
      throw new Error(`Requested amount exceeds available limit. Available: $${available.toFixed(2)}`);
    }

    const overdueLoan = await Loan.findOne({ userId, status: 'OVERDUE' });
    if (overdueLoan) {
      throw new Error('Cannot request a loan while you have an overdue loan.');
    }

    const existingPending = await LoanRequest.findOne({ userId, status: 'PENDING' });
    if (existingPending) {
      throw new Error('You already have a pending loan request.');
    }

    const activeLoan = await Loan.findOne({ userId, status: 'ACTIVE' });
    if (activeLoan) {
      throw new Error('Cannot request a new loan while you have an active loan.');
    }

    const request = await LoanRequest.create({
      userId,
      requestedAmount: amount,
      status: 'PENDING',
    });

    return request;
  }

  async approveLoanRequest(
    requestId: string,
    agentId: string,
    agentRemarks: string,
    ipAddress?: string,
    userAgentStr?: string
  ) {
    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const request = await LoanRequest.findById(requestId).session(session);
      if (!request) throw new Error('Loan request not found.');
      if (request.status !== 'PENDING') throw new Error('This request has already been processed.');

      const account = await LoanAccount.findOne({ userId: request.userId }).session(session);
      if (!account) throw new Error('Loan account not found.');

      const available = account.loanLimit - account.activeBalance;
      if (request.requestedAmount > available) {
        throw new Error('Requested amount exceeds available limit.');
      }

      request.status = 'APPROVED';
      request.reviewedByAgentId = agentId;
      request.agentRemarks = agentRemarks;
      request.reviewedAt = new Date();
      await request.save({ session });

      const issuedAt = new Date();
      const dueAt = new Date(issuedAt);
      dueAt.setDate(dueAt.getDate() + 7);

      const loan = await Loan.create(
        [
          {
            userId: request.userId,
            principalAmount: request.requestedAmount,
            remainingBalance: request.requestedAmount,
            issuedAt,
            dueAt,
            status: 'ACTIVE',
            approvedRequestId: request._id,
          },
        ],
        { session }
      );

      account.activeBalance += request.requestedAmount;
      await account.save({ session });

      await LoanLedger.create(
        [
          {
            loanId: loan[0]._id,
            userId: request.userId,
            type: 'ISSUE',
            amount: request.requestedAmount,
            note: agentRemarks,
            createdByAgentId: agentId,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      this.sendApprovalEmail(request.userId.toString(), request.requestedAmount, dueAt, account.activeBalance);
      this.notifyUser(request.userId.toString(), 'Loan Approved', `Your loan request of $${request.requestedAmount.toFixed(2)} has been approved!`, 'success');
      this.logAgentAction(agentId, 'APPROVE', request.userId, { requestId, amount: request.requestedAmount, remarks: agentRemarks }, ipAddress, userAgentStr);
      this.sendLoanChatMessage(
        request.userId.toString(),
        `💰 LOAN APPROVED: Your loan request of $${request.requestedAmount.toFixed(2)} has been approved! Due date: ${dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Total owed: $${account.activeBalance.toFixed(2)}.`,
        { type: 'loan_approved', amount: request.requestedAmount, dueDate: dueAt.toISOString(), totalOwed: account.activeBalance, requestId, source: 'Loan System' }
      );

      return { loan: loan[0], request };
    } catch (error: any) {
      await session.abortTransaction();
      if (error.name === 'VersionError') throw new Error('This request was already processed by another agent.');
      throw error;
    } finally {
      session.endSession();
    }
  }

  async manualIssueLoan(
    userId: string,
    amount: number,
    agentId: string,
    remarks: string,
    ipAddress?: string,
    userAgentStr?: string
  ) {
    if (amount < 1 || amount > 500) {
      throw new Error('Loan amount must be between $1 and $500.');
    }

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      let account = await LoanAccount.findOne({ userId }).session(session);
      if (!account) {
        [account] = await LoanAccount.create([{ userId, loanLimit: 20, activeBalance: 0 }], { session });
      }

      const existingActive = await Loan.findOne({ userId, status: { $in: ['ACTIVE', 'OVERDUE'] } }).session(session);
      if (existingActive) {
        throw new Error('User already has an active or overdue loan. Repay the existing loan first.');
      }

      const available = account.loanLimit - account.activeBalance;
      if (amount > available) {
        throw new Error(`Amount exceeds available limit. Available: $${available.toFixed(2)}`);
      }

      const request = (await LoanRequest.create(
        [
          {
            userId,
            requestedAmount: amount,
            status: 'APPROVED',
            agentRemarks: remarks || 'Manually issued by agent',
            reviewedByAgentId: agentId,
            reviewedAt: new Date(),
          },
        ],
        { session }
      ))[0];

      const issuedAt = new Date();
      const dueAt = new Date(issuedAt);
      dueAt.setDate(dueAt.getDate() + 7);

      const loan = (await Loan.create(
        [
          {
            userId,
            principalAmount: amount,
            remainingBalance: amount,
            issuedAt,
            dueAt,
            status: 'ACTIVE',
            approvedRequestId: request._id,
          },
        ],
        { session }
      ))[0];

      account.activeBalance += amount;
      await account.save({ session });

      await LoanLedger.create(
        [
          {
            loanId: loan._id,
            userId,
            type: 'ISSUE',
            amount,
            note: remarks || 'Manually issued by agent',
            createdByAgentId: agentId,
          },
        ],
        { session }
      );

      await session.commitTransaction();

      this.sendApprovalEmail(userId, amount, dueAt, account.activeBalance);
      this.notifyUser(userId, 'Loan Issued', `A loan of $${amount.toFixed(2)} has been issued to your account.`, 'success');
      this.logAgentAction(agentId, 'MANUAL_ISSUE', userId, { amount, remarks }, ipAddress, userAgentStr);
      this.sendLoanChatMessage(
        userId,
        `💰 LOAN ISSUED: A loan of $${amount.toFixed(2)} has been issued to your account. Due date: ${dueAt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}. Total owed: $${account.activeBalance.toFixed(2)}.`,
        { type: 'loan_issued', amount, dueDate: dueAt.toISOString(), totalOwed: account.activeBalance, source: 'Loan System' }
      );

      return { loan, request, account };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async rejectLoanRequest(
    requestId: string,
    agentId: string,
    agentRemarks: string,
    ipAddress?: string,
    userAgentStr?: string
  ) {
    if (!agentRemarks || agentRemarks.trim().length === 0) {
      throw new Error('Remarks are required when rejecting a loan request.');
    }

    const request = await LoanRequest.findById(requestId);
    if (!request) throw new Error('Loan request not found.');
    if (request.status !== 'PENDING') throw new Error('This request has already been processed.');

    request.status = 'REJECTED';
    request.reviewedByAgentId = agentId;
    request.agentRemarks = agentRemarks;
    request.reviewedAt = new Date();

    try {
      await request.save();
    } catch (error: any) {
      if (error.name === 'VersionError') throw new Error('This request was already processed by another agent.');
      throw error;
    }

    this.sendRejectionEmail(request.userId.toString(), request.requestedAmount, agentRemarks);
    this.notifyUser(request.userId.toString(), 'Loan Request Declined', `Your loan request of $${request.requestedAmount.toFixed(2)} was not approved.`, 'error');
    this.logAgentAction(agentId, 'REJECT', request.userId, { requestId, amount: request.requestedAmount, remarks: agentRemarks }, ipAddress, userAgentStr);

    return request;
  }

  async processRepayment(
    loanId: string,
    amount: number,
    paymentMethod: PaymentMethod,
    agentId: string,
    remarks?: string,
    ipAddress?: string,
    userAgentStr?: string
  ) {
    if (amount <= 0) throw new Error('Payment amount must be greater than 0.');

    const session = await mongoose.startSession();
    session.startTransaction();

    try {
      const loan = await Loan.findById(loanId).session(session);
      if (!loan) throw new Error('Loan not found.');
      if (loan.status === 'PAID') throw new Error('This loan is already fully paid.');
      if (loan.status !== 'ACTIVE' && loan.status !== 'OVERDUE') {
        throw new Error('Loan must be ACTIVE or OVERDUE to accept repayment.');
      }

      const account = await LoanAccount.findOne({ userId: loan.userId }).session(session);
      if (!account) throw new Error('Loan account not found.');

      if (amount > account.activeBalance) {
        throw new Error(`Payment amount ($${amount.toFixed(2)}) exceeds active balance ($${account.activeBalance.toFixed(2)}).`);
      }

      const cappedLoanAmount = Math.min(amount, loan.remainingBalance ?? loan.principalAmount);

      const ledgerType = PAYMENT_METHOD_TO_LEDGER_TYPE[paymentMethod];

      await LoanLedger.create(
        [
          {
            loanId: loan._id,
            userId: loan.userId,
            type: ledgerType,
            amount,
            paymentMethod,
            note: remarks,
            createdByAgentId: agentId,
          },
        ],
        { session }
      );

      account.activeBalance -= amount;
      await account.save({ session });

      loan.remainingBalance = Math.max(0, (loan.remainingBalance ?? loan.principalAmount) - cappedLoanAmount);
      if (loan.remainingBalance === 0) {
        loan.status = 'PAID';
      }
      await loan.save({ session });

      await session.commitTransaction();

      this.sendRepaymentEmail(
        loan.userId.toString(),
        amount,
        paymentMethod,
        account.activeBalance
      );
      this.notifyUser(
        loan.userId.toString(),
        'Payment Received',
        `A payment of $${amount.toFixed(2)} has been applied to your loan. Remaining: $${account.activeBalance.toFixed(2)}.`,
        account.activeBalance === 0 ? 'success' : 'info'
      );
      this.logAgentAction(agentId, 'REPAYMENT', loan.userId, { loanId, amount, paymentMethod, remarks, loanRemaining: loan.remainingBalance, accountRemaining: account.activeBalance }, ipAddress, userAgentStr);
      const paidOff = account.activeBalance === 0;
      this.sendLoanChatMessage(
        loan.userId.toString(),
        paidOff
          ? `✅ LOAN FULLY PAID: A payment of $${amount.toFixed(2)} has been applied. Your loan is now fully repaid!`
          : `💵 LOAN PAYMENT RECEIVED: A payment of $${amount.toFixed(2)} has been applied to your loan. Remaining balance: $${account.activeBalance.toFixed(2)}.`,
        { type: 'loan_repayment', amount, paymentMethod, remaining: account.activeBalance, loanId, paidOff, source: 'Loan System' }
      );

      return { loan, remainingBalance: account.activeBalance };
    } catch (error) {
      await session.abortTransaction();
      throw error;
    } finally {
      session.endSession();
    }
  }

  async adjustLimit(
    userId: string,
    newLimit: number,
    agentId: string,
    ipAddress?: string,
    userAgentStr?: string
  ) {
    if (newLimit < 20 || newLimit > 500) {
      throw new Error('Loan limit must be between $20 and $500.');
    }

    const account = await this.getOrCreateAccount(userId);

    if (newLimit < account.activeBalance) {
      throw new Error(
        `New limit ($${newLimit}) cannot be less than active balance ($${account.activeBalance.toFixed(2)}).`
      );
    }

    const oldLimit = account.loanLimit;
    account.loanLimit = newLimit;
    await account.save();

    await LoanLimitHistory.create({
      userId,
      oldLimit,
      newLimit,
      changedByAgentId: agentId,
    });

    this.notifyUser(userId, 'Loan Limit Updated', `Your loan limit has been updated from $${oldLimit.toFixed(2)} to $${newLimit.toFixed(2)}.`, 'info');
    this.logAgentAction(agentId, 'LIMIT_CHANGE', userId, { oldLimit, newLimit }, ipAddress, userAgentStr);

    return { oldLimit, newLimit, activeBalance: account.activeBalance };
  }

  async markOverdueLoans(userId?: string) {
    const filter: any = {
      status: 'ACTIVE',
      dueAt: { $lt: new Date() },
    };
    if (userId) filter.userId = userId;

    await Loan.updateMany(filter, { $set: { status: 'OVERDUE' } });
  }

  async getPendingRequests(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      LoanRequest.find({ status: 'PENDING' })
        .populate('userId', 'username email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanRequest.countDocuments({ status: 'PENDING' }),
    ]);

    return { requests, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAllRequests(page = 1, limit = 20, status?: string) {
    const filter: any = {};
    if (status) filter.status = status;

    const skip = (page - 1) * limit;
    const [requests, total] = await Promise.all([
      LoanRequest.find(filter)
        .populate('userId', 'username email firstName lastName')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanRequest.countDocuments(filter),
    ]);

    return { requests, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getActiveLoans(page = 1, limit = 20) {
    await this.markOverdueLoans();

    const skip = (page - 1) * limit;
    const [loans, total] = await Promise.all([
      Loan.find({ status: { $in: ['ACTIVE', 'OVERDUE'] } })
        .populate('userId', 'username email firstName lastName')
        .sort({ dueAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Loan.countDocuments({ status: { $in: ['ACTIVE', 'OVERDUE'] } }),
    ]);

    return { loans, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getLedger(userId?: string, page = 1, limit = 50) {
    const filter: any = {};
    if (userId) filter.userId = userId;

    const skip = (page - 1) * limit;
    const [entries, total] = await Promise.all([
      LoanLedger.find(filter)
        .populate('userId', 'username email')
        .populate('loanId', 'principalAmount status')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanLedger.countDocuments(filter),
    ]);

    return { entries, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getUserLoanAccount(userId: string) {
    const account = await LoanAccount.findOne({ userId })
      .populate('userId', 'username email firstName lastName')
      .lean();

    if (!account) return null;

    const activeLoans = await Loan.find({
      userId,
      status: { $in: ['ACTIVE', 'OVERDUE'] },
    }).lean();

    return { ...account, activeLoans };
  }

  async getAdminStats() {
    const [
      totalIssued,
      totalOutstanding,
      totalOverdue,
      totalPaid,
      totalRepaid,
      activeAccounts,
    ] = await Promise.all([
      Loan.countDocuments(),
      LoanAccount.aggregate([
        { $match: { activeBalance: { $gt: 0 } } },
        { $group: { _id: null, total: { $sum: '$activeBalance' } } },
      ]),
      Loan.countDocuments({ status: 'OVERDUE' }),
      Loan.countDocuments({ status: 'PAID' }),
      LoanLedger.aggregate([
        { $match: { type: { $ne: 'ISSUE' } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      LoanAccount.countDocuments({ activeBalance: { $gt: 0 } }),
    ]);

    const outstanding = totalOutstanding[0]?.total || 0;
    const repaid = totalRepaid[0]?.total || 0;

    return {
      totalLoansIssued: totalIssued,
      totalOutstandingBalance: outstanding,
      totalOverdueLoans: totalOverdue,
      totalPaidLoans: totalPaid,
      totalRepaid: repaid,
      activeAccounts,
      repaymentRate: totalIssued > 0 ? ((totalPaid / totalIssued) * 100).toFixed(1) : '0',
    };
  }

  async searchUserAccounts(query: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    if (!query.trim()) {
      const [accounts, total] = await Promise.all([
        LoanAccount.find()
          .populate('userId', 'username email firstName lastName')
          .sort({ updatedAt: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),
        LoanAccount.countDocuments(),
      ]);
      return { accounts, total, page, totalPages: Math.ceil(total / limit) };
    }

    const users = await User.find({
      $or: [
        { username: { $regex: query, $options: 'i' } },
        { email: { $regex: query, $options: 'i' } },
      ],
    })
      .select('_id')
      .limit(100)
      .lean();

    const userIds = users.map((u) => u._id);

    const [accounts, total] = await Promise.all([
      LoanAccount.find({ userId: { $in: userIds } })
        .populate('userId', 'username email firstName lastName')
        .sort({ updatedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanAccount.countDocuments({ userId: { $in: userIds } }),
    ]);

    return { accounts, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getAgentLogs(page = 1, limit = 50, agentId?: string) {
    const filter: any = {};
    if (agentId) filter.agentId = agentId;

    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      LoanAgentLog.find(filter)
        .populate('targetUserId', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      LoanAgentLog.countDocuments(filter),
    ]);

    return { logs, total, page, totalPages: Math.ceil(total / limit) };
  }

  async getUserLoanHistory(userId: string, type: 'requests' | 'loans' | 'payments', page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    if (type === 'requests') {
      const [items, total] = await Promise.all([
        LoanRequest.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        LoanRequest.countDocuments({ userId }),
      ]);
      return { items, total, page, totalPages: Math.ceil(total / limit) };
    }

    if (type === 'loans') {
      const [items, total] = await Promise.all([
        Loan.find({ userId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
        Loan.countDocuments({ userId }),
      ]);
      return { items, total, page, totalPages: Math.ceil(total / limit) };
    }

    const [items, total] = await Promise.all([
      LoanLedger.find({ userId, type: { $ne: 'ISSUE' } }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
      LoanLedger.countDocuments({ userId, type: { $ne: 'ISSUE' } }),
    ]);
    return { items, total, page, totalPages: Math.ceil(total / limit) };
  }

  private async sendApprovalEmail(
    userId: string,
    amount: number,
    dueDate: Date,
    remainingBalance: number
  ) {
    try {
      const user = await User.findById(userId).select('email firstName').lean();
      if (!user?.email) return;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #22c55e;">Loan Request Approved</h2>
              <p>Hello ${(user as any).firstName || 'there'},</p>
              <p>Your loan request has been approved. Here are the details:</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #22c55e;">
                <p style="margin: 5px 0;"><strong>Amount:</strong> $${amount.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Due Date:</strong> ${dueDate.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
                <p style="margin: 5px 0;"><strong>Total Balance Owed:</strong> $${remainingBalance.toFixed(2)}</p>
              </div>
              <p style="color: #666; font-size: 13px;">Please ensure repayment before the due date to maintain your borrowing privileges.</p>
            </div>
          </body>
        </html>
      `;

      await emailService.sendEmail({
        to: user.email,
        subject: 'Loan Request Approved - Global Ace Gaming',
        html,
      });
    } catch (err) {
      console.error('Failed to send loan approval email:', err);
    }
  }

  private async sendRejectionEmail(userId: string, amount: number, remarks: string) {
    try {
      const user = await User.findById(userId).select('email firstName').lean();
      if (!user?.email) return;

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #ef4444;">Loan Request Not Approved</h2>
              <p>Hello ${(user as any).firstName || 'there'},</p>
              <p>We regret to inform you that your loan request could not be approved at this time.</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #ef4444;">
                <p style="margin: 5px 0;"><strong>Requested Amount:</strong> $${amount.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Reason:</strong> ${remarks}</p>
              </div>
              <p style="color: #666; font-size: 13px;">Feel free to submit a new request in the future.</p>
            </div>
          </body>
        </html>
      `;

      await emailService.sendEmail({
        to: user.email,
        subject: 'Loan Request Not Approved - Global Ace Gaming',
        html,
      });
    } catch (err) {
      console.error('Failed to send loan rejection email:', err);
    }
  }

  private async sendRepaymentEmail(
    userId: string,
    amount: number,
    paymentMethod: string,
    remainingBalance: number
  ) {
    try {
      const user = await User.findById(userId).select('email firstName').lean();
      if (!user?.email) return;

      const methodDisplay = paymentMethod.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, c => c.toUpperCase());

      const html = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
          </head>
          <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0;">Global Ace Gaming</h1>
            </div>
            <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
              <h2 style="color: #3b82f6;">Loan Payment Received</h2>
              <p>Hello ${(user as any).firstName || 'there'},</p>
              <p>A payment has been applied to your loan account.</p>
              <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #3b82f6;">
                <p style="margin: 5px 0;"><strong>Amount Paid:</strong> $${amount.toFixed(2)}</p>
                <p style="margin: 5px 0;"><strong>Payment Method:</strong> ${methodDisplay}</p>
                <p style="margin: 5px 0;"><strong>Remaining Balance:</strong> $${remainingBalance.toFixed(2)}</p>
              </div>
              ${remainingBalance === 0 ? '<p style="color: #22c55e; font-weight: bold;">Your loan has been fully repaid. Thank you!</p>' : ''}
            </div>
          </body>
        </html>
      `;

      await emailService.sendEmail({
        to: user.email,
        subject: 'Loan Payment Received - Global Ace Gaming',
        html,
      });
    } catch (err) {
      console.error('Failed to send repayment email:', err);
    }
  }
}

export default new LoanService();
