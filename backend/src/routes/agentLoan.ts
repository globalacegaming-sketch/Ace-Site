import { Router, Request, Response, NextFunction } from 'express';
import { validateAdminSession } from '../services/adminSessionService';
import loanService from '../services/loanService';
import type { PaymentMethod } from '../models/LoanLedger';
import jwt from 'jsonwebtoken';

const router = Router();

const requireAdminOrAgentAuth = (req: Request, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, message: 'Access denied. No token provided.' });
    return;
  }

  const token = authHeader.substring(7);

  const adminSession = validateAdminSession(token);
  if (adminSession) {
    (req as any).adminSession = adminSession;
    return next();
  }

  try {
    const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;
    const validRoles = ['super_admin', 'admin', 'agent'];
    if (decoded.type === 'agent' && validRoles.includes(decoded.role)) {
      (req as any).agentSession = {
        username: decoded.username,
        role: decoded.role,
        userId: decoded.userId || decoded.agentId,
      };
      return next();
    }
  } catch { /* agent auth failed */ }

  res.status(401).json({ success: false, message: 'Invalid or expired session. Please login again.' });
};

const getAgentId = (req: Request): string => {
  const admin = (req as any).adminSession;
  if (admin) return admin.agentName || admin.adminId;
  const agent = (req as any).agentSession;
  if (agent) return agent.username || agent.userId;
  return 'unknown';
};

router.use(requireAdminOrAgentAuth);

router.post('/manual-issue', async (req: Request, res: Response) => {
  try {
    const { userId, amount, remarks } = req.body;
    const agentId = getAgentId(req);

    if (!userId) {
      res.status(400).json({ success: false, message: 'User ID is required.' });
      return;
    }
    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'Valid amount is required.' });
      return;
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    const ua = req.headers['user-agent'] || '';
    const result = await loanService.manualIssueLoan(userId, amount, agentId, remarks || '', ip, ua);
    res.json({ success: true, data: result, message: 'Loan issued successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/pending', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await loanService.getPendingRequests(page, limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/requests', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string | undefined;
    const result = await loanService.getAllRequests(page, limit, status);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/approve/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { remarks } = req.body;
    const agentId = getAgentId(req);
    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    const ua = req.headers['user-agent'] || '';

    const result = await loanService.approveLoanRequest(requestId, agentId, remarks || '', ip, ua);
    res.json({ success: true, data: result, message: 'Loan request approved.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/reject/:requestId', async (req: Request, res: Response) => {
  try {
    const { requestId } = req.params;
    const { remarks } = req.body;
    const agentId = getAgentId(req);

    if (!remarks || remarks.trim().length === 0) {
      res.status(400).json({ success: false, message: 'Remarks are required for rejection.' });
      return;
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    const ua = req.headers['user-agent'] || '';
    const result = await loanService.rejectLoanRequest(requestId, agentId, remarks, ip, ua);
    res.json({ success: true, data: result, message: 'Loan request rejected.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.post('/repay/:loanId', async (req: Request, res: Response) => {
  try {
    const { loanId } = req.params;
    const { amount, paymentMethod, remarks } = req.body;
    const agentId = getAgentId(req);

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      res.status(400).json({ success: false, message: 'Valid payment amount is required.' });
      return;
    }

    const validMethods: PaymentMethod[] = [
      'CASH',
      'WINNING_DEDUCTION',
      'REFERRAL_CREDIT',
      'TASK_CREDIT',
      'MANUAL_ADJUSTMENT',
    ];
    if (!paymentMethod || !validMethods.includes(paymentMethod)) {
      res.status(400).json({ success: false, message: 'Valid payment method is required.' });
      return;
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    const ua = req.headers['user-agent'] || '';
    const result = await loanService.processRepayment(loanId, amount, paymentMethod, agentId, remarks, ip, ua);
    res.json({ success: true, data: result, message: 'Repayment processed successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/active-loans', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await loanService.getActiveLoans(page, limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/adjust-limit', async (req: Request, res: Response) => {
  try {
    const { userId, newLimit } = req.body;
    const agentId = getAgentId(req);

    if (!userId) {
      res.status(400).json({ success: false, message: 'User ID is required.' });
      return;
    }
    if (!newLimit || typeof newLimit !== 'number') {
      res.status(400).json({ success: false, message: 'Valid new limit is required.' });
      return;
    }

    const ip = req.ip || req.headers['x-forwarded-for'] as string || '';
    const ua = req.headers['user-agent'] || '';
    const result = await loanService.adjustLimit(userId, newLimit, agentId, ip, ua);
    res.json({ success: true, data: result, message: 'Loan limit adjusted successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message });
  }
});

router.get('/ledger', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const userId = req.query.userId as string | undefined;
    const result = await loanService.getLedger(userId, page, limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/user-account/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const account = await loanService.getUserLoanAccount(userId);
    if (!account) {
      const newAccount = await loanService.getOrCreateAccount(userId);
      res.json({ success: true, data: newAccount });
      return;
    }
    res.json({ success: true, data: account });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/stats', async (req: Request, res: Response) => {
  try {
    const stats = await loanService.getAdminStats();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/search', async (req: Request, res: Response) => {
  try {
    const query = (req.query.q as string) || '';
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await loanService.searchUserAccounts(query, page, limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/agent-logs', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const agentId = req.query.agentId as string | undefined;
    const result = await loanService.getAgentLogs(page, limit, agentId);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/ledger/export-csv', async (req: Request, res: Response) => {
  try {
    const userId = req.query.userId as string | undefined;
    const result = await loanService.getLedger(userId, 1, 10000);

    const header = 'Date,User,Type,Amount,Payment Method,Note,Agent\n';
    const rows = result.entries.map((e: any) => {
      const date = new Date(e.createdAt).toISOString();
      const user = (e.userId as any)?.username || e.userId || '';
      const type = e.type || '';
      const amount = e.type === 'ISSUE' ? `+${e.amount.toFixed(2)}` : `-${e.amount.toFixed(2)}`;
      const method = e.paymentMethod || '';
      const note = (e.note || '').replace(/"/g, '""');
      const agent = e.createdByAgentId || '';
      return `${date},"${user}",${type},${amount},${method},"${note}","${agent}"`;
    });

    const csv = header + rows.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=loan_ledger_${new Date().toISOString().slice(0, 10)}.csv`);
    res.send(csv);
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
