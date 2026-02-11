import { Router, Request, Response, NextFunction } from 'express';
import { authenticate } from '../middleware/auth';
import { requireAgentAuth } from '../middleware/agentAuth';
import SupportTicket, { SupportTicketCategory, SupportTicketStatus } from '../models/SupportTicket';
import User from '../models/User';
import { supportAttachmentUpload, getSupportAttachmentUrl } from '../config/supportUploads';
import { verifyToken } from '../utils/jwt';
import * as supportEmailService from '../services/supportEmailService';

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

      // Log received data for debugging (hide sensitive info)
      console.log('Support ticket request received:', {
        category,
        descriptionLength: description?.length,
        name,
        email,
        phone,
        hasAttachment: !!attachment,
        isAuthenticated: !!req.user,
        bodyKeys: Object.keys(req.body)
      });

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
        if (req.user.firstName || req.user.lastName) {
          ticketName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
        } else if (req.user.username) {
          ticketName = req.user.username;
        } else if (req.user.email) {
          ticketName = req.user.email.split('@')[0];
        } else {
          ticketName = 'User';
        }
        
        // Ensure name is not empty
        if (!ticketName || ticketName.trim().length === 0) {
          ticketName = 'User';
        }
        
        // Validate user email exists
        if (!req.user.email) {
          return res.status(400).json({
            success: false,
            message: 'User account missing email address'
          });
        }
        
        ticketEmail = req.user.email.trim().toLowerCase();
        ticketPhone = req.user.phone?.trim();
        
        // Validate phone length if provided
        if (ticketPhone && ticketPhone.length > 20) {
          return res.status(400).json({
            success: false,
            message: 'Phone number cannot exceed 20 characters'
          });
        }
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
        // Ensure name is not empty after trimming
        ticketName = name.trim();
        if (ticketName.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Name cannot be empty'
          });
        }
        
        // Validate and clean email
        ticketEmail = email.trim().toLowerCase();
        if (!ticketEmail) {
          return res.status(400).json({
            success: false,
            message: 'Email cannot be empty'
          });
        }
        
        // Validate email format before saving
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(ticketEmail)) {
          return res.status(400).json({
            success: false,
            message: 'Please provide a valid email address'
          });
        }
        
        ticketPhone = phone?.trim();
        
        // Validate phone length if provided
        if (ticketPhone && ticketPhone.length > 20) {
          return res.status(400).json({
            success: false,
            message: 'Phone number cannot exceed 20 characters'
          });
        }
      }
      
      // Validate name length (model has maxlength: 120)
      if (ticketName.length > 120) {
        return res.status(400).json({
          success: false,
          message: 'Name cannot exceed 120 characters'
        });
      }

      // Create ticket (ticketNumber will be generated by the pre-save hook)
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
        status: 'pending',
        statusHistory: [{ status: 'pending', changedAt: new Date(), notifyUser: true }]
      });

      // Send transactional email (fire-and-forget, don't block response)
      void supportEmailService.sendTicketCreatedEmail(ticket).then((r) => {
        if (r.success) {
          SupportTicket.findByIdAndUpdate(ticket._id, { lastEmailSentAt: new Date(), lastEmailStatus: 'sent' }).catch(() => {});
        } else {
          SupportTicket.findByIdAndUpdate(ticket._id, { lastEmailStatus: 'failed' }).catch(() => {});
        }
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
      
      // Handle validation errors
      if (error.name === 'ValidationError') {
        const validationErrors: Record<string, string> = {};
        const errors = Object.values((error as any).errors) as any[];
        
        errors.forEach((err: any) => {
          validationErrors[err.path] = err.message;
        });
        
        const errorMessages = errors.map((err: any) => err.message);
        const firstError = errorMessages[0] || 'Validation failed';
        
        console.error('Support ticket validation error:', {
          errors: validationErrors,
          errorDetails: errors.map((e: any) => ({
            field: e.path,
            message: e.message,
            value: e.value
          }))
        });
        
        return res.status(400).json({
          success: false,
          message: firstError,
          errors: validationErrors,
          errorDetails: errorMessages
        });
      }
      
      // Handle duplicate key error (race condition - pre-save hook will generate a new unique number on retry)
      if (error.code === 11000 && error.keyPattern?.ticketNumber) {
        // Retry once - pre-save hook will generate a new unique ticket number
        try {
          const { category, description, name, email, phone } = req.body;
          const attachment = req.file;
          
          // Reconstruct ticket data for retry
          let retryUserId: string | undefined;
          let retryTicketName: string;
          let retryTicketEmail: string;
          let retryTicketPhone: string | undefined;

          if (req.user) {
            retryUserId = req.user._id.toString();
            if (req.user.firstName || req.user.lastName) {
              retryTicketName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
            } else if (req.user.username) {
              retryTicketName = req.user.username;
            } else if (req.user.email) {
              retryTicketName = req.user.email.split('@')[0];
            } else {
              retryTicketName = 'User';
            }
            retryTicketEmail = req.user.email;
            retryTicketPhone = req.user.phone;
          } else {
            retryTicketName = name.trim();
            retryTicketEmail = email.trim().toLowerCase();
            retryTicketPhone = phone?.trim();
          }
          
          const ticket = await SupportTicket.create({
            userId: retryUserId,
            category: category as SupportTicketCategory,
            description: description.trim(),
            attachmentUrl: attachment ? getSupportAttachmentUrl(attachment.filename) : undefined,
            attachmentName: attachment?.originalname,
            attachmentType: attachment?.mimetype,
            attachmentSize: attachment?.size,
            name: retryTicketName,
            email: retryTicketEmail,
            phone: retryTicketPhone,
            status: 'pending',
            statusHistory: [{ status: 'pending', changedAt: new Date(), notifyUser: true }]
          });

          void supportEmailService.sendTicketCreatedEmail(ticket).then((r) => {
            if (r.success) SupportTicket.findByIdAndUpdate(ticket._id, { lastEmailSentAt: new Date(), lastEmailStatus: 'sent' }).catch(() => {});
            else SupportTicket.findByIdAndUpdate(ticket._id, { lastEmailStatus: 'failed' }).catch(() => {});
          });
          
          return res.status(201).json({
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
        } catch (retryError: any) {
          console.error('Error retrying ticket creation:', retryError);
          return res.status(500).json({
            success: false,
            message: 'Failed to create support ticket. Please try again.',
            error: retryError.message
          });
        }
      }
      
      return res.status(500).json({
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

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    const query: any = { userId: req.user._id };
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
    const { page = 1, limit = 50, status, statusIn, category, search, excludeClosed } = req.query;
    const pageNumber = Number(page) || 1;
    const limitNumber = Math.min(Number(limit) || 50, 100);

    const query: any = {};
    
    if (statusIn && typeof statusIn === 'string') {
      const statuses = statusIn.split(',').map((s: string) => s.trim()).filter((s: string) =>
        ['pending', 'in_progress', 'resolved', 'closed'].includes(s)
      );
      if (statuses.length > 0) query.status = { $in: statuses };
    } else if (status && ['pending', 'in_progress', 'resolved', 'closed'].includes(status as string)) {
      query.status = status;
    } else if (excludeClosed === 'true') {
      query.status = { $nin: ['closed'] };
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
    const { status, notes, notifyUser = true } = req.body;

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

    const previousStatus = ticket.status;
    if (previousStatus === status) {
      return res.json({ success: true, message: 'No change', data: ticket });
    }

    const agentName = (req as any).agentSession?.username || 'Support';
    const statusHistoryEntry = {
      status: status as SupportTicketStatus,
      changedAt: new Date(),
      changedByName: agentName,
      note: notes || undefined,
      notifyUser: notifyUser !== false
    };

    const updateData: any = {
      status,
      $push: { statusHistory: statusHistoryEntry }
    };

    if (notes) updateData.notes = notes;
    if (status === 'resolved' || status === 'closed') {
      updateData.resolvedAt = new Date();
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

    // Send transactional email when status changed (if notifyUser is true)
    if (notifyUser !== false) {
      void supportEmailService.sendTicketStatusChangedEmail({
        ticket: updatedTicket as any,
        previousStatus,
        note: notes
      }).then((r) => {
        SupportTicket.findByIdAndUpdate(id, {
          lastEmailSentAt: r.success ? new Date() : undefined,
          lastEmailStatus: r.success ? 'sent' : 'failed'
        }).catch(() => {});
      });
    }

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

