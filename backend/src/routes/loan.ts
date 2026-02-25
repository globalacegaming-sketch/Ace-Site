import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import { loanRequestLimiter } from '../middleware/rateLimiter';
import loanService from '../services/loanService';

const router = Router();

router.get('/account', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const summary = await loanService.getUserLoanSummary(userId);
    res.json({ success: true, data: summary });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch loan account.' });
  }
});

router.post('/request', authenticate, loanRequestLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const { amount } = req.body;

    if (!amount || typeof amount !== 'number') {
      res.status(400).json({ success: false, message: 'Valid amount is required.' });
      return;
    }

    const request = await loanService.submitLoanRequest(userId, amount);
    res.status(201).json({ success: true, data: request, message: 'Loan request submitted successfully.' });
  } catch (error: any) {
    res.status(400).json({ success: false, message: error.message || 'Failed to submit loan request.' });
  }
});

router.get('/history', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const summary = await loanService.getUserLoanSummary(userId);
    res.json({
      success: true,
      data: {
        loanHistory: summary.loanHistory,
        repaymentHistory: summary.repaymentHistory,
        requestHistory: summary.requestHistory,
      },
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch loan history.' });
  }
});

router.get('/history/:type', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.user!._id.toString();
    const type = req.params.type as 'requests' | 'loans' | 'payments';
    if (!['requests', 'loans', 'payments'].includes(type)) {
      res.status(400).json({ success: false, message: 'Invalid history type.' });
      return;
    }
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await loanService.getUserLoanHistory(userId, type, page, limit);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message || 'Failed to fetch history.' });
  }
});

export default router;
