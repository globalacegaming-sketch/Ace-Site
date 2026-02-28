import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import ChatMessage, { IChatMessage } from '../models/ChatMessage';
import { getSocketServerInstance } from '../utils/socketManager';
import { chatAttachmentUpload, getChatAttachmentUrl } from '../config/chatUploads';
import { sanitizeText } from '../utils/sanitize';
import cloudinary, { isCloudinaryEnabled } from '../config/cloudinary';
import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';

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

router.use(authenticate);

router.get('/messages', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 25 } = req.query;

    const pageNumber = Number(page) || 1;
    const limitNumber = Math.min(Number(limit) || 25, 1000); // Allow up to 1000 messages

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const [messages, total] = await Promise.all([
      ChatMessage.find({ userId: req.user._id })
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      ChatMessage.countDocuments({ userId: req.user._id })
    ]);

    // Fix names for user messages that might have incorrect names (e.g., "GAGame")
    // This ensures existing messages with wrong names are corrected when fetched
    const fixedMessages = messages.map((msg: any) => {
      // If it's a user message and the name is "GAGame" or empty, fix it
      if (msg.senderType === 'user' && (!msg.name || msg.name.trim() === '' || msg.name === 'GAGame')) {
        // Fetch user data to get correct name
        // Since we already have req.user, use it for the current user's messages
        if (msg.userId.toString() === req.user._id.toString()) {
          let correctedName: string;
          if (req.user.firstName || req.user.lastName) {
            correctedName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
          } else if (req.user.username) {
            correctedName = req.user.username;
          } else if (req.user.email) {
            correctedName = req.user.email.split('@')[0];
          } else {
            correctedName = 'User';
          }
          msg.name = correctedName;
        }
      }
      return msg;
    });

    // .lean() returns raw MongoDB objects with _id but no id virtual — normalize
    const normalized = fixedMessages.map((msg: any) => ({
      ...msg,
      id: msg._id.toString(),
    }));

    res.json({
      success: true,
      data: normalized,
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
  '/messages',
  chatAttachmentUpload.single('attachment'),
  async (req: Request, res: Response) => {
    try {
      // Authentication check must be first before any use of req.user
      if (!req.user) {
        return res.status(401).json({
          success: false,
          message: 'User not authenticated'
        });
      }

      const { message, replyToMessageId } = req.body;
      const attachment = req.file;

      if (!message && !attachment) {
        return res.status(400).json({
          success: false,
          message: 'Message text or attachment is required'
        });
      }

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

      // Security: Users can only send 'user' type messages, never 'system' or 'admin'
      // This prevents users from spoofing system messages like bonus claims
      // Sanitize message input to prevent XSS attacks
      const sanitizedMessage = message ? sanitizeText(message) : undefined;
      
      // Construct name with proper fallbacks to ensure we always have a valid name
      let name: string;
      if (req.user.firstName || req.user.lastName) {
        // Use first and last name if available
        name = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
      } else if (req.user.username) {
        // Fallback to username
        name = req.user.username;
      } else if (req.user.email) {
        // Fallback to email (extract part before @)
        name = req.user.email.split('@')[0];
      } else {
        // Last resort: use "User" as fallback
        name = 'User';
      }
      
      // Ensure name is not empty and doesn't contain "GAGame" (which is reserved for admin)
      if (!name || name.trim() === '' || name === 'GAGame') {
        name = req.user.email ? req.user.email.split('@')[0] : 'User';
      }
      
      // Upload to Cloudinary if attachment exists and Cloudinary is configured
      // Otherwise, fall back to local storage
      let attachmentUrl: string | undefined;
      if (attachment && req.file) {
        if (isCloudinaryEnabled()) {
          try {
            const userId = req.user._id.toString();
            const filePath = req.file.path;

            // Verify temp file exists before uploading
            if (!filePath || !fs.existsSync(filePath)) {
              logger.warn('Temp file not found, falling back to local storage');
              attachmentUrl = getChatAttachmentUrl(attachment.filename);
            } else {
              logger.debug('Uploading to Cloudinary:', { filePath, mimetype: req.file.mimetype, size: req.file.size });

              const result = await cloudinary.uploader.upload(filePath, {
                folder: `chat/${userId}`,
                resource_type: 'auto',
              });
              attachmentUrl = result.secure_url;

              // Delete temporary file after upload
              if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
            }
          } catch (cloudinaryError: any) {
            // Cloudinary failed -- fall back to local storage instead of crashing
            const errMsg =
              cloudinaryError?.message ||
              cloudinaryError?.error?.message ||
              (cloudinaryError?.http_code ? `HTTP ${cloudinaryError.http_code}` : null) ||
              'Unknown Cloudinary error';
            logger.warn('Cloudinary upload failed, falling back to local storage:', errMsg);

            // The file is already saved to disk by multer, so just use it
            attachmentUrl = getChatAttachmentUrl(attachment.filename);
          }
        } else {
          // Fall back to local storage if Cloudinary is not configured
          attachmentUrl = getChatAttachmentUrl(attachment.filename);
        }
      }
      
      const chatMessage = await ChatMessage.create({
        userId: req.user._id,
        senderType: 'user', // Always 'user' for user-sent messages
        message: sanitizedMessage,
        attachmentUrl,
        attachmentName: attachment?.originalname,
        attachmentType: attachment?.mimetype,
        attachmentSize: attachment?.size,
        status: 'unread',
        name,
        email: req.user.email,
        ...(replyTo ? { replyTo } : {})
      });

      const io = getSocketServerInstance();
      const payload = serializeMessage(chatMessage);

      io.in('admins').fetchSockets().then(sockets => {
        logger.info(`📨 Emitting chat:message:new to admins room (${sockets.length} admin socket(s): ${sockets.map(s => s.data.adminSession?.agentName || s.id).join(', ')})`);
      }).catch(() => {});

      io.to('admins').emit('chat:message:new', payload);
      if (req.user) {
        io.to(`user:${req.user._id}`).emit('chat:message:new', payload);
      }

      res.status(201).json({
        success: true,
        message: 'Message sent successfully',
        data: payload
      });
    } catch (error: any) {
      logger.error('Failed to send chat message:', {
        error: error.message,
        stack: error.stack,
        userId: req.user?._id,
        hasAttachment: !!req.file
      });
      if (!res.headersSent) {
        res.status(500).json({
          success: false,
          message: 'Failed to send message',
          error: error.message
        });
      }
    }
  }
);

// Toggle reaction on a message (add or remove)
router.post('/messages/:id/reactions', async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User not authenticated' });
    }

    const { id } = req.params;
    const { emoji } = req.body;

    if (!emoji || typeof emoji !== 'string' || emoji.length > 8) {
      return res.status(400).json({ success: false, message: 'Valid emoji is required' });
    }

    if (!/^[0-9a-fA-F]{24}$/.test(id)) {
      return res.status(400).json({ success: false, message: 'Invalid message ID' });
    }

    const message = await ChatMessage.findById(id);
    if (!message) {
      return res.status(404).json({ success: false, message: 'Message not found' });
    }

    // Ensure user can only react to messages in their conversation
    if (message.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: 'Access denied' });
    }

    const reactorId = req.user._id.toString();
    // Find if user already reacted with this exact emoji (toggle off) or any other emoji (replace)
    const sameEmojiIdx = message.reactions.findIndex(
      (r: any) => r.emoji === emoji && r.reactorId === reactorId && r.reactorType === 'user'
    );

    let action: 'added' | 'removed';
    if (sameEmojiIdx >= 0) {
      // Clicking same emoji again = remove it
      message.reactions.splice(sameEmojiIdx, 1);
      action = 'removed';
    } else {
      // Remove any previous reaction by this user (one reaction per user)
      const prevIdx = message.reactions.findIndex(
        (r: any) => r.reactorId === reactorId && r.reactorType === 'user'
      );
      if (prevIdx >= 0) message.reactions.splice(prevIdx, 1);

      let reactorName: string;
      if (req.user.firstName || req.user.lastName) {
        reactorName = `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim();
      } else {
        reactorName = req.user.username || req.user.email?.split('@')[0] || 'User';
      }
      message.reactions.push({ emoji, reactorId, reactorType: 'user', reactorName, createdAt: new Date() } as any);
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
      reactorType: 'user' as const
    };

    io.to('admins').emit('chat:reaction:update', payload);
    io.to(`user:${message.userId}`).emit('chat:reaction:update', payload);

    res.json({ success: true, data: payload });
  } catch (error: any) {
    logger.error('Failed to toggle reaction:', error);
    res.status(500).json({ success: false, message: 'Failed to toggle reaction', error: error.message });
  }
});

export default router;

