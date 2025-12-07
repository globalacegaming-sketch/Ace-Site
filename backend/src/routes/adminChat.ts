import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import ChatMessage, { IChatMessage, ChatMessageStatus } from '../models/ChatMessage';
import User from '../models/User';
import { requireAdminAuth } from '../middleware/adminAuth';
import { chatAttachmentUpload, getChatAttachmentUrl } from '../config/chatUploads';
import { getSocketServerInstance } from '../utils/socketManager';
import { sanitizeText } from '../utils/sanitize';

const router = Router();

const serializeMessage = (message: IChatMessage) => {
  const json = message.toObject();
  return {
    ...json,
    id: message._id.toString(),
    userId: message.userId.toString(),
    adminId: message.adminId ? message.adminId.toString() : undefined,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
};

const serializePlainMessage = (message: Record<string, unknown>) => {
  const _id = message._id as mongoose.Types.ObjectId | string | undefined;
  const userId = message.userId as mongoose.Types.ObjectId | string | undefined;
  const adminId = message.adminId as mongoose.Types.ObjectId | string | undefined;
  
  return {
    ...message,
    id: _id ? (typeof _id === 'string' ? _id : _id.toString()) : (message.id as string | undefined),
    userId: userId ? (typeof userId === 'string' ? userId : userId.toString()) : (message.userId as string | undefined),
    adminId: adminId ? (typeof adminId === 'string' ? adminId : adminId.toString()) : (message.adminId as string | undefined),
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
  };
};

const buildSearchFilter = (search?: string) => {
  if (!search) return undefined;

  const regex = new RegExp(search, 'i');
  return {
    $or: [
      { name: regex },
      { email: regex },
      { message: regex }
    ]
  };
};

// Helper function to fix user message names (corrects "GAGame" or empty names)
const fixUserMessageName = async (msg: any): Promise<void> => {
  if (msg.senderType === 'user' && (!msg.name || msg.name.trim() === '' || msg.name === 'GAGame')) {
    let user: any = null;
    
    // Check if userId is populated (object) or needs to be fetched
    if (msg.userId && typeof msg.userId === 'object' && msg.userId._id) {
      // User data is already populated
      user = msg.userId;
      // Convert userId to string for consistency
      msg.userId = msg.userId._id.toString();
    } else if (msg.userId) {
      // userId is a string, need to fetch user data
      const userIdStr = typeof msg.userId === 'string' ? msg.userId : msg.userId.toString();
      user = await User.findById(userIdStr).select('firstName lastName username email').lean();
    }
    
    // Fix the name if we have user data
    if (user) {
      let correctedName: string;
      if (user.firstName || user.lastName) {
        correctedName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      } else if (user.username) {
        correctedName = user.username;
      } else if (user.email) {
        correctedName = user.email.split('@')[0];
      } else {
        correctedName = 'User';
      }
      msg.name = correctedName;
    }
  } else if (msg.userId && typeof msg.userId === 'object' && msg.userId._id) {
    // Convert userId to string for consistency even if name doesn't need fixing
    msg.userId = msg.userId._id.toString();
  }
};

router.use(requireAdminAuth);

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      userId,
      startDate,
      endDate,
      search
    } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Math.min(Number(limit) || 50, 200);

    const filter: Record<string, unknown> = {};

    if (status && typeof status === 'string') {
      filter.status = status;
    }

    if (userId && typeof userId === 'string') {
      if (mongoose.Types.ObjectId.isValid(userId)) {
        filter.userId = userId;
      } else {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId parameter'
        });
      }
    }

    if ((startDate && typeof startDate === 'string') || (endDate && typeof endDate === 'string')) {
      filter.createdAt = {};
      if (startDate && typeof startDate === 'string') {
        filter.createdAt = {
          ...(filter.createdAt as Record<string, Date>),
          $gte: new Date(startDate)
        };
      }
      if (endDate && typeof endDate === 'string') {
        filter.createdAt = {
          ...(filter.createdAt as Record<string, Date>),
          $lte: new Date(endDate)
        };
      }
    }

    const searchFilter = buildSearchFilter(typeof search === 'string' ? search : undefined);
    const finalFilter = searchFilter ? { $and: [filter, searchFilter] } : filter;

    const [messages, total] = await Promise.all([
      ChatMessage.find(finalFilter)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .populate('userId', 'firstName lastName username email')
        .lean(),
      ChatMessage.countDocuments(finalFilter)
    ]);

    // Fix names for user messages that might have incorrect names (e.g., "GAGame")
    // This ensures existing messages with wrong names are corrected when fetched
    const fixedMessages = await Promise.all(
      messages.map(async (msg: any) => {
        await fixUserMessageName(msg);
        return msg;
      })
    );

    // If filtering by userId, also include user information for the header
    let userInfo = null;
    if (userId && typeof userId === 'string' && mongoose.Types.ObjectId.isValid(userId)) {
      const user = await User.findById(userId)
        .select('firstName lastName username email')
        .lean();
      
      if (user) {
        // Construct the user's display name using the same logic as messages
        let displayName: string;
        if (user.firstName || user.lastName) {
          displayName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        } else if (user.username) {
          displayName = user.username;
        } else if (user.email) {
          displayName = user.email.split('@')[0];
        } else {
          displayName = 'User';
        }
        
        userInfo = {
          id: user._id.toString(),
          name: displayName,
          firstName: user.firstName || '',
          lastName: user.lastName || '',
          username: user.username || '',
          email: user.email || ''
        };
      }
    }

    res.json({
      success: true,
      data: fixedMessages,
      user: userInfo, // Include user info when filtering by userId
      pagination: {
        total,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch messages',
      error: error.message
    });
  }
});

router.post(
  '/',
  chatAttachmentUpload.single('attachment'),
  async (req: Request, res: Response) => {
    try {
      const { userId, message } = req.body;
      const attachment = req.file;

      if (!userId || typeof userId !== 'string') {
        return res.status(400).json({
          success: false,
          message: 'userId is required'
        });
      }

      if (!message && !attachment) {
        return res.status(400).json({
          success: false,
          message: 'Message text or attachment is required'
        });
      }

      if (!mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid userId format'
        });
      }

      const user = await User.findById(userId).lean();

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      // Sanitize message input to prevent XSS attacks
      const sanitizedMessage = message ? sanitizeText(message) : undefined;
      
      const chatMessage = await ChatMessage.create({
        userId,
        senderType: 'admin',
        message: sanitizedMessage,
        attachmentUrl: attachment ? getChatAttachmentUrl(attachment.filename) : undefined,
        attachmentName: attachment?.originalname,
        attachmentType: attachment?.mimetype,
        attachmentSize: attachment?.size,
        status: 'read',
        name: req.adminSession?.agentName,
        email: user.email,
        metadata: {
          ...(attachment
            ? {
                attachmentUploadedBy: req.adminSession?.agentName
              }
            : {}),
          adminAgentName: req.adminSession?.agentName
        }
      });

      const io = getSocketServerInstance();
      const payload = serializeMessage(chatMessage);
      const room = `user:${userId}`;

      io.to('admins').emit('chat:message:new', payload);
      io.to(room).emit('chat:message:new', payload);

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: payload
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Failed to send message',
        error: error.message
      });
    }
  }
);

// Batch update message status
router.put('/batch-status', async (req: Request, res: Response) => {
  try {
    const { messageIds, status, userId } = req.body as { 
      messageIds?: string[]; 
      status?: ChatMessageStatus;
      userId?: string;
    };

    if (!status || !['unread', 'read', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: unread, read, resolved'
      });
    }

    const filter: Record<string, unknown> = {};
    
    if (messageIds && Array.isArray(messageIds) && messageIds.length > 0) {
      const validIds = messageIds.filter(id => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length === 0) {
        return res.status(400).json({
          success: false,
          message: 'No valid message IDs provided'
        });
      }
      filter._id = { $in: validIds };
    } else if (userId && mongoose.Types.ObjectId.isValid(userId)) {
      filter.userId = userId;
      filter.senderType = 'user';
      filter.status = 'unread';
    } else {
      return res.status(400).json({
        success: false,
        message: 'Either messageIds or userId must be provided'
      });
    }

    const updateData: Record<string, unknown> = { status };
    
    if (status === 'read') {
      updateData.readAt = new Date();
    }

    if (status === 'resolved') {
      updateData.resolvedAt = new Date();
      updateData.metadata = {
        resolvedByAgent: req.adminSession?.agentName,
        resolvedAt: new Date()
      };
    }

    const result = await ChatMessage.updateMany(filter, updateData);
    const updatedMessages = await ChatMessage.find(filter).lean();

    const io = getSocketServerInstance();
    const userIds = new Set<string>();
    
    updatedMessages.forEach((msg: Record<string, unknown>) => {
      const payload = serializePlainMessage(msg);
      const userIdRaw = msg.userId as mongoose.Types.ObjectId | string | undefined;
      let userId: string | undefined;
      if (userIdRaw) {
        userId = typeof userIdRaw === 'string' ? userIdRaw : userIdRaw.toString();
      }
      if (userId) {
        const userRoom = `user:${userId}`;
        userIds.add(userId);
        io.to('admins').emit('chat:message:status', payload);
        io.to(userRoom).emit('chat:message:status', payload);
      }
    });

    res.json({
      success: true,
      message: `Updated ${result.modifiedCount} message(s)`,
      data: {
        modifiedCount: result.modifiedCount,
        affectedUsers: Array.from(userIds)
      }
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update message status',
      error: error.message
    });
  }
});

router.put('/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status } = req.body as { status?: ChatMessageStatus };

    if (!status || !['unread', 'read', 'resolved'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid status. Allowed values: unread, read, resolved'
      });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message id'
      });
    }

    const message = await ChatMessage.findById(id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    message.status = status;

    if (status === 'read') {
      message.readAt = new Date();
    }

    if (status === 'resolved') {
      message.resolvedAt = new Date();
      message.metadata = {
        ...(message.metadata as Record<string, unknown> | undefined),
        resolvedByAgent: req.adminSession?.agentName,
        resolvedAt: message.resolvedAt
      };
    }

    await message.save();

    const io = getSocketServerInstance();
    const payload = serializeMessage(message);
    const room = `user:${message.userId.toString()}`;

    io.to('admins').emit('chat:message:status', payload);
    io.to(room).emit('chat:message:status', payload);

    res.json({
      success: true,
      message: 'Message status updated',
      data: payload
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to update message status',
      error: error.message
    });
  }
});

export default router;

