import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import ChatMessage, { IChatMessage } from '../models/ChatMessage';
import { getSocketServerInstance } from '../utils/socketManager';
import { chatAttachmentUpload, getChatAttachmentUrl } from '../config/chatUploads';

const router = Router();

const serializeMessage = (message: IChatMessage) => {
  const json = message.toObject();
  return {
    ...json,
    id: message._id.toString(),
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

    const [messages, total] = await Promise.all([
      ChatMessage.find({ userId: req.user!._id })
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      ChatMessage.countDocuments({ userId: req.user!._id })
    ]);

    res.json({
      success: true,
      data: messages,
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
      const { message } = req.body;
      const attachment = req.file;

      if (!message && !attachment) {
        return res.status(400).json({
          success: false,
          message: 'Message text or attachment is required'
        });
      }

      const name =
        req.user?.firstName || req.user?.lastName
          ? `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim()
          : req.user?.username;

      // Security: Users can only send 'user' type messages, never 'system' or 'admin'
      // This prevents users from spoofing system messages like bonus claims
      const chatMessage = await ChatMessage.create({
        userId: req.user!._id,
        senderType: 'user', // Always 'user' for user-sent messages
        message,
        attachmentUrl: attachment ? getChatAttachmentUrl(attachment.filename) : undefined,
        attachmentName: attachment?.originalname,
        attachmentType: attachment?.mimetype,
        attachmentSize: attachment?.size,
        status: 'unread',
        name,
        email: req.user?.email
      });

      const io = getSocketServerInstance();
      const payload = serializeMessage(chatMessage);

      io.to('admins').emit('chat:message:new', payload);
      io.to(`user:${req.user!._id}`).emit('chat:message:new', payload);

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

export default router;

