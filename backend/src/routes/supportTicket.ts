import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAgentAuth } from '../middleware/agentAuth';
import SupportTicket, { SupportTicketCategory, SupportTicketStatus } from '../models/SupportTicket';
import User from '../models/User';
import { supportAttachmentUpload, getSupportAttachmentUrl } from '../config/supportUploads';
import { verifyToken } from '../utils/jwt';

const router = Router();

// Optional authentication middleware - tries to authenticate but doesn't fail if no token
const optionalAuthenticate = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const decoded = verifyToken(token);
      const user = await User.findById(decoded.userId).select('-password');
      if (user && user.isActive) {
        req.user = user;
      }
    }
    next();
  } catch (error) {
    // If token is invalid, just continue without user
    next();
  }
};

// Submit a support ticket (public endpoint, but can be authenticated)
router.post(
  '/',
  optionalAuthenticate,
  supportAttachmentUpload.single('attachment'),
  async (req: Request, res: Response) => {
    try {
      const { category, description, name, email, phone } = req.body;
      const attachment = req.file;

      // Validation
      if (!category) {
        return res.status(400).json({
          success: false,
          message: 'Category is required'
        });
      }

      const validCategories: SupportTicketCategory[] = [
        'payment_related_queries',
        'game_issue',
        'complaint',
        'feedback',
        'business_queries'
      ];

      if (!validCategories.includes(category as SupportTicketCategory)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid category'
        });
      }

      if (!description || description.trim().length === 0) {
        return res.status(400).json({
          success: false,
          message: 'Description is required'
        });
      }

      if (description.trim().length > 5000) {
        return res.status(400).json({
          success: false,
          message: 'Description cannot exceed 5000 characters'
        });
      }

      // Get user info - if authenticated, use user data; otherwise use provided data
      let userId: string | undefined;
      let ticketName: string;
      let ticketEmail: string;
      let ticketPhone: string | undefined;

      if (req.user) {
        // User is logged in - use their account info
        userId = req.user._id.toString();
        ticketName = req.user.firstName && req.user.lastName
          ? `${req.user.firstName} ${req.user.lastName}`.trim()
          : req.user.username;
        ticketEmail = req.user.email;
        ticketPhone = req.user.phone;
      } else {
        // Non-logged-in user - use provided data
        if (!name || name.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Name is required'
          });
        }
        if (!email || email.trim().length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Email is required'
          });
        }
        ticketName = name.trim();
        ticketEmail = email.trim().toLowerCase();
        ticketPhone = phone?.trim();
      }

      // Create ticket
      const ticket = await SupportTicket.create({
        userId,
        category: category as SupportTicketCategory,
        description: description.trim(),
        attachmentUrl: attachment ? getSupportAttachmentUrl(attachment.filename) : undefined,
        attachmentName: attachment?.originalname,
        attachmentType: attachment?.mimetype,
        attachmentSize: attachment?.size,
        name: ticketName,
        email: ticketEmail,
        phone: ticketPhone,
        status: 'pending'
      });

      res.status(201).json({
        success: true,
        message: 'Your ticket has been created with Global Ace Management. We will try to reach you soon.',
        data: {
          ticketNumber: ticket.ticketNumber,
          _id: ticket._id,
          category: ticket.category,
          status: ticket.status,
          createdAt: ticket.createdAt
        }
      });
    } catch (error: any) {
      console.error('Error creating support ticket:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create support ticket',
        error: error.message
      });
    }
  }
);

// Get user's own tickets (authenticated)
router.get('/my-tickets', authenticate, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Math.min(Number(limit) || 20, 100);

    const query: any = { userId: req.user!._id };
    if (status && ['pending', 'in_progress', 'resolved', 'closed'].includes(status as string)) {
      query.status = status;
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      SupportTicket.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error: any) {
    console.error('Error fetching user tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
});

// Get all tickets (agent/admin only)
router.get('/', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, status, category, search } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Math.min(Number(limit) || 50, 100);

    const query: any = {};
    
    if (status && ['pending', 'in_progress', 'resolved', 'closed'].includes(status as string)) {
      query.status = status;
    }
    
    if (category && [
      'payment_related_queries',
      'game_issue',
      'complaint',
      'feedback',
      'business_queries'
    ].includes(category as string)) {
      query.category = category;
    }

    if (search) {
      query.$or = [
        { ticketNumber: { $regex: search, $options: 'i' } },
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    const [tickets, total] = await Promise.all([
      SupportTicket.find(query)
        .populate('userId', 'username email firstName lastName')
        .populate('assignedTo', 'username')
        .populate('resolvedBy', 'username')
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      SupportTicket.countDocuments(query)
    ]);

    res.json({
      success: true,
      data: tickets,
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error: any) {
    console.error('Error fetching tickets:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch tickets',
      error: error.message
    });
  }
});

// Update ticket status (agent/admin only)
router.put('/:id/status', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = req.body;

    if (!status || !['pending', 'in_progress', 'resolved', 'closed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }

    const ticket = await SupportTicket.findById(id);
    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    const updateData: any = { status };
    
    if (notes) {
      updateData.notes = notes;
    }

      if (status === 'resolved' || status === 'closed') {
        updateData.resolvedAt = new Date();
        // Note: resolvedBy will be set to the agent's user ID if they have one
        // For now, we'll leave it undefined as agents don't have user accounts
      }

      if (status === 'in_progress' && !ticket.assignedTo) {
        // Note: assignedTo will be set to the agent's user ID if they have one
        // For now, we'll leave it undefined as agents don't have user accounts
      }

    const updatedTicket = await SupportTicket.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    )
      .populate('userId', 'username email firstName lastName')
      .populate('assignedTo', 'username')
      .populate('resolvedBy', 'username')
      .lean();

    res.json({
      success: true,
      message: 'Ticket status updated',
      data: updatedTicket
    });
  } catch (error: any) {
    console.error('Error updating ticket status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ticket status',
      error: error.message
    });
  }
});

// Get single ticket (agent/admin only)
router.get('/:id', requireAgentAuth, async (req: Request, res: Response) => {
  try {
    const ticket = await SupportTicket.findById(req.params.id)
      .populate('userId', 'username email firstName lastName phone')
      .populate('assignedTo', 'username')
      .populate('resolvedBy', 'username')
      .lean();

    if (!ticket) {
      return res.status(404).json({
        success: false,
        message: 'Ticket not found'
      });
    }

    res.json({
      success: true,
      data: ticket
    });
  } catch (error: any) {
    console.error('Error fetching ticket:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ticket',
      error: error.message
    });
  }
});

export default router;

