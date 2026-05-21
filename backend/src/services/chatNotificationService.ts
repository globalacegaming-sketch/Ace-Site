import mongoose from 'mongoose';
import Notification from '../models/Notification';
import { getSocketServerInstance } from '../utils/socketManager';
import { sendChatMessagePush } from './oneSignalService';
import logger from '../utils/logger';

function normalizeUserId(userId: string): string {
  return String(userId).trim();
}

function isUserSocketOnline(userId: string): boolean {
  try {
    const io = getSocketServerInstance();
    const room = io.sockets.adapter.rooms.get(`user:${userId}`);
    return !!room && room.size > 0;
  } catch {
    return false;
  }
}

/**
 * In-app notification + push when support sends a chat message.
 * Push is sent when the user is offline, or always if ONESIGNAL_ALWAYS_PUSH=true.
 */
export async function notifyUserSupportMessage(options: {
  userId: string;
  body: string;
}): Promise<void> {
  const userId = normalizeUserId(options.userId);
  if (!mongoose.Types.ObjectId.isValid(userId)) {
    logger.warn('[chat-notify] invalid userId', userId);
    return;
  }

  const preview = (options.body || 'Support sent an attachment').slice(0, 200);
  const online = isUserSocketOnline(userId);

  try {
    const notification = await Notification.create({
      userId: new mongoose.Types.ObjectId(userId),
      title: 'New message from Support',
      message: preview,
      type: 'info',
      link: '/chat',
    });

    try {
      const io = getSocketServerInstance();
      io.to(`user:${userId}`).emit('notification:new', {
        _id: notification._id.toString(),
        title: notification.title,
        message: notification.message,
        type: notification.type,
        link: notification.link,
        isRead: false,
        createdAt: notification.createdAt,
      });
    } catch (socketErr) {
      logger.warn('[chat-notify] socket emit failed:', socketErr);
    }
  } catch (dbErr) {
    logger.error('[chat-notify] failed to create in-app notification:', dbErr);
  }

  const alwaysPush = process.env.ONESIGNAL_ALWAYS_PUSH === 'true';
  if (online && !alwaysPush) {
    return;
  }

  const webUrl = process.env.FRONTEND_URL || process.env.PRODUCTION_FRONTEND_URL;
  await sendChatMessagePush({ userId, body: options.body, webUrl });
}
