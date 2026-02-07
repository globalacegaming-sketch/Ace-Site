import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import ChatMessage, { IChatMessage, ChatMessageStatus } from '../models/ChatMessage';
import User from '../models/User';
import { requireAdminAuth } from '../middleware/adminAuth';
import { chatAttachmentUpload, getChatAttachmentUrl } from '../config/chatUploads';
import { getSocketServerInstance } from '../utils/socketManager';
import { sanitizeText } from '../utils/sanitize';
import cloudinary, { isCloudinaryEnabled } from '../config/cloudinary';
import fs from 'fs';
import { sendChatMessagePush } from '../services/oneSignalService';

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

// New endpoint to get conversation summaries (list of all users with their last message)
router.get('/conversations', async (req: Request, res: Response) => {
  try {
    const {
      status,
      search
    } = req.query;

    const filter: Record<string, unknown> = {};

    if (status && typeof status === 'string') {
      filter.status = status;
    }

    const searchFilter = buildSearchFilter(typeof search === 'string' ? search : undefined);
    const finalFilter = searchFilter ? { $and: [filter, searchFilter] } : filter;

    // Use aggregation to get unique conversations with last message and unread count
    const pipeline: any[] = [
      { $match: finalFilter },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$userId',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                { $and: [{ $eq: ['$senderType', 'user'] }, { $eq: ['$status', 'unread'] }] },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'user'
        }
      },
      {
        $unwind: {
          path: '$user',
          preserveNullAndEmptyArrays: true
        }
      },
      {
        $project: {
          userId: { $toString: '$_id' },
          lastMessage: {
            id: { $toString: '$lastMessage._id' },
            userId: { $toString: '$lastMessage.userId' },
            senderType: '$lastMessage.senderType',
            message: '$lastMessage.message',
            attachmentUrl: '$lastMessage.attachmentUrl',
            attachmentName: '$lastMessage.attachmentName',
            attachmentType: '$lastMessage.attachmentType',
            attachmentSize: '$lastMessage.attachmentSize',
            status: '$lastMessage.status',
            name: '$lastMessage.name',
            email: '$lastMessage.email',
            createdAt: '$lastMessage.createdAt',
            updatedAt: '$lastMessage.updatedAt',
            metadata: '$lastMessage.metadata'
          },
          unreadCount: 1,
          // Get user info for name/email
          userInfo: {
            firstName: '$user.firstName',
            lastName: '$user.lastName',
            username: '$user.username',
            email: '$user.email'
          }
        }
      },
      {
        $addFields: {
          // Build display name from user info or message name
          name: {
            $cond: {
              if: {
                $and: [
                  { $ne: ['$userInfo.firstName', null] },
                  { $ne: ['$userInfo.firstName', ''] }
                ]
              },
              then: {
                $trim: {
                  input: {
                    $concat: [
                      { $ifNull: ['$userInfo.firstName', ''] },
                      ' ',
                      { $ifNull: ['$userInfo.lastName', ''] }
                    ]
                  }
                }
              },
              else: {
                $cond: {
                  if: {
                    $and: [
                      { $ne: ['$userInfo.username', null] },
                      { $ne: ['$userInfo.username', ''] }
                    ]
                  },
                  then: '$userInfo.username',
                  else: {
                    $cond: {
                      if: {
                        $and: [
                          { $ne: ['$userInfo.email', null] },
                          { $ne: ['$userInfo.email', ''] }
                        ]
                      },
                      then: { $arrayElemAt: [{ $split: ['$userInfo.email', '@'] }, 0] },
                      else: {
                        $cond: {
                          if: {
                            $and: [
                              { $ne: ['$lastMessage.name', null] },
                              { $ne: ['$lastMessage.name', ''] },
                              { $ne: ['$lastMessage.name', 'GAGame'] }
                            ]
                          },
                          then: '$lastMessage.name',
                          else: 'User'
                        }
                      }
                    }
                  }
                }
              }
            }
          },
          email: {
            $ifNull: ['$userInfo.email', '$lastMessage.email']
          }
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ];

    const conversations = await ChatMessage.aggregate(pipeline);

    // Fix names for messages that might have "GAGame" or empty names
    for (const conv of conversations) {
      if (conv.lastMessage) {
        await fixUserMessageName(conv.lastMessage);
        // Update the name in the conversation if the message name was fixed
        if (conv.lastMessage.name && conv.name === 'User' && conv.lastMessage.name !== 'GAGame') {
          conv.name = conv.lastMessage.name;
        }
      }
    }

    res.json({
      success: true,
      data: conversations.map(conv => ({
        userId: conv.userId,
        name: (typeof conv.name === 'string' ? conv.name.trim() : String(conv.name || '').trim()) || 'User',
        email: conv.email || '',
        lastMessage: conv.lastMessage,
        unreadCount: conv.unreadCount
      }))
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations',
      error: error.message
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 50,
      status,
      userId,
      search,
      before // ISO date string - load messages before this date (for pagination)
    } = req.query;

    const pageNumber = Number(page) || 1;
    // When fetching conversations (no userId), allow much higher limit to show all conversations
    // When fetching messages for a specific conversation (with userId), use normal pagination
    const isFetchingConversations = !userId;
    const maxLimit = isFetchingConversations ? 10000 : 200; // Allow up to 10k messages when fetching all conversations
    const limitNumber = Math.min(Number(limit) || 50, maxLimit);

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

    // Handle 'before' parameter for cursor-based pagination (loading older messages)
    if (before && typeof before === 'string') {
      try {
        const beforeDate = new Date(before);
        if (!isNaN(beforeDate.getTime())) {
          filter.createdAt = { $lt: beforeDate };
        }
      } catch (e) {
        // Invalid date, ignore
      }
    }

    const searchFilter = buildSearchFilter(typeof search === 'string' ? search : undefined);
    const finalFilter = searchFilter ? { $and: [filter, searchFilter] } : filter;

    // When using 'before' parameter (cursor-based pagination), skip the skip/page logic
    // because we're using the cursor (before date) instead
    const useCursorPagination = before && typeof before === 'string';
    
    // Sort order depends on pagination type:
    // - Cursor pagination (before): ascending to get oldest messages first (for prepending)
    // - Offset pagination: descending to get newest messages first (standard list view)
    const sortOrder: { [key: string]: 1 | -1 } = useCursorPagination 
      ? { createdAt: 1 }  // Ascending for cursor pagination
      : { createdAt: -1 }; // Descending for offset pagination
    
    const query = ChatMessage.find(finalFilter).sort(sortOrder);
    
    if (useCursorPagination) {
      // Cursor-based: just limit, no skip
      query.limit(limitNumber);
    } else {
      // Offset-based: use skip and limit
      query.skip((pageNumber - 1) * limitNumber).limit(limitNumber);
    }
    
    const [messages, total] = await Promise.all([
      query.populate('userId', 'firstName lastName username email').lean(),
      ChatMessage.countDocuments(finalFilter)
    ]);

    // Fix names for user messages that might have incorrect names (e.g., "GAGame")
    // This ensures existing messages with wrong names are corrected when fetched
    // Also serialize messages to ensure they have 'id' field instead of just '_id'
    const fixedMessages = await Promise.all(
      messages.map(async (msg: any) => {
        await fixUserMessageName(msg);
        // Ensure message has 'id' field for frontend compatibility
        if (!msg.id && msg._id) {
          msg.id = msg._id.toString();
        }
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
      const { userId, message, replyToMessageId } = req.body;
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

      // Build replyTo snapshot if replying to a message
      let replyTo: { messageId: string; message?: string; senderName?: string; senderType?: string } | undefined;
      if (replyToMessageId && typeof replyToMessageId === 'string' && /^[0-9a-fA-F]{24}$/.test(replyToMessageId)) {
        const originalMsg = await ChatMessage.findById(replyToMessageId).lean();
        if (originalMsg) {
          replyTo = {
            messageId: replyToMessageId,
            message: originalMsg.message ? originalMsg.message.substring(0, 500) : undefined,
            senderName: originalMsg.name || undefined,
            senderType: originalMsg.senderType
          };
        }
      }

      // Upload to Cloudinary if attachment exists and Cloudinary is configured
      // Otherwise, fall back to local storage
      let attachmentUrl: string | undefined;
      if (attachment && req.file) {
        if (isCloudinaryEnabled()) {
          try {
            const result = await cloudinary.uploader.upload(req.file.path, {
              folder: `chat/${userId}`
            });
            attachmentUrl = result.secure_url;
            
            // Delete temporary file after upload
            fs.unlinkSync(req.file.path);
          } catch (cloudinaryError: any) {
            // Clean up temp file even if Cloudinary upload fails
            if (req.file?.path && fs.existsSync(req.file.path)) {
              fs.unlinkSync(req.file.path);
            }
            throw new Error(`Failed to upload attachment: ${cloudinaryError.message}`);
          }
        } else {
          // Fall back to local storage if Cloudinary is not configured
          attachmentUrl = getChatAttachmentUrl(attachment.filename);
        }
      }
      
      const chatMessage = await ChatMessage.create({
        userId,
        senderType: 'admin',
        message: sanitizedMessage,
        attachmentUrl,
        attachmentName: attachment?.originalname,
        attachmentType: attachment?.mimetype,
        attachmentSize: attachment?.size,
        status: 'read',
        name: req.adminSession?.agentName,
        email: user.email,
        ...(replyTo ? { replyTo } : {}),
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

      // Push when user is inactive or logged out (no-op if OneSignal not configured)
      const webUrl = process.env.FRONTEND_URL || process.env.PRODUCTION_FRONTEND_URL;
      const body = sanitizedMessage || (attachment ? 'Support sent an attachment' : 'New support message');
      void sendChatMessagePush({ userId, body, webUrl });

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

// Toggle reaction on a message (admin)
router.post('/:id/reactions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string' || emoji.length > 8) {
      return res.status(400).json({ success: false, message: 'Valid emoji is required' });
    }

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const message = await ChatMessage.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    const reactorId = req.adminSession?.agentName || 'admin';
    const existingIdx = message.reactions.findIndex(
      (r: any) => r.emoji === emoji && r.reactorId === reactorId && r.reactorType === 'admin'
    );

    let action: 'added' | 'removed';
    if (existingIdx >= 0) {
      message.reactions.splice(existingIdx, 1);
      action = 'removed';
    } else {
      message.reactions.push({
        emoji,
        reactorId,
        reactorType: 'admin',
        reactorName: req.adminSession?.agentName || 'Support',
        createdAt: new Date()
      } as any);
      action = 'added';
    }

    await message.save();

    const io = getSocketServerInstance();
    const payload = {
      messageId: id,
      userId: message.userId.toString(),
      reactions: message.reactions,
      action,
      emoji,
      reactorId,
      reactorType: 'admin' as const
    };

    io.to('admins').emit('chat:reaction:update', payload);
    io.to(`user:${message.userId}`).emit('chat:reaction:update', payload);

    res.json({ success: true, data: payload });
  } catch (error: any) {
    res.status(500).json({ success: false, message: 'Failed to toggle reaction', error: error.message });
  }
});

export default router;
