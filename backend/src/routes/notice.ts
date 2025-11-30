import { Router, Request, Response } from 'express';
import Notice, { INotice } from '../models/Notice';
import Notification from '../models/Notification';
import User from '../models/User';
import { getSocketServerInstance } from '../utils/socketManager';

const router = Router();

// Get active notices for users (max 3, by priority)
router.get('/active', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const notices = await Notice.find({
      isActive: true,
      $or: [
        { expiresAt: { $exists: false } },
        { expiresAt: { $gte: now } }
      ]
    })
      .sort({ priority: 1, createdAt: -1 })
      .limit(3)
      .select('-__v');

    return res.json({
      success: true,
      message: 'Active notices retrieved successfully',
      data: notices
    });
  } catch (error: any) {
    console.error('Error fetching active notices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notices',
      error: error.message
    });
  }
});

// Get all notices (admin/agent only)
router.get('/all', async (req: Request, res: Response) => {
  try {
    const notices = await Notice.find()
      .sort({ priority: 1, createdAt: -1 })
      .select('-__v');

    return res.json({
      success: true,
      message: 'All notices retrieved successfully',
      data: notices
    });
  } catch (error: any) {
    console.error('Error fetching all notices:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notices',
      error: error.message
    });
  }
});

// Get single notice by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const notice = await Notice.findById(req.params.id).select('-__v');

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    return res.json({
      success: true,
      message: 'Notice retrieved successfully',
      data: notice
    });
  } catch (error: any) {
    console.error('Error fetching notice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notice',
      error: error.message
    });
  }
});

// Create new notice (admin/agent only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { title, message, type, isActive, priority, expiresAt } = req.body;

    if (!title || !message) {
      return res.status(400).json({
        success: false,
        message: 'Title and message are required'
      });
    }

    // Validate priority (1-3)
    const noticePriority = priority ? Math.max(1, Math.min(3, parseInt(priority))) : 1;

    const notice = new Notice({
      title,
      message,
      type: type || 'info',
      isActive: isActive !== undefined ? isActive : true,
      priority: noticePriority,
      expiresAt: expiresAt ? new Date(expiresAt) : undefined
    });

    await notice.save();

    // Create notifications for all active users when a notice is created
    if (isActive !== false) {
      try {
        const users = await User.find({ isActive: true }).select('_id');
        const notifications = users.map(user => ({
          userId: user._id,
          title: title,
          message: message,
          type: type || 'info',
          noticeId: notice._id,
          isRead: false
        }));

        if (notifications.length > 0) {
          await Notification.insertMany(notifications);
          
          // Emit notification event to all connected users via Socket.IO
          const io = getSocketServerInstance();
          const notificationPayload = {
            title: title,
            message: message,
            type: type || 'info',
            noticeId: notice._id.toString(),
            createdAt: new Date().toISOString()
          };
          
          // Emit to all users (they can filter on client side)
          io.emit('notification:new', notificationPayload);
          
          console.log(`✅ Created ${notifications.length} notifications for notice: ${title}`);
        }
      } catch (notifError: any) {
        // Don't fail notice creation if notification creation fails
        console.error('⚠️ Failed to create notifications:', notifError.message);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Notice created successfully',
      data: notice
    });
  } catch (error: any) {
    console.error('Error creating notice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create notice',
      error: error.message
    });
  }
});

// Update notice (admin/agent only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { title, message, type, isActive, priority, expiresAt } = req.body;

    const notice = await Notice.findById(req.params.id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    if (title) notice.title = title;
    if (message) notice.message = message;
    if (type) notice.type = type;
    if (isActive !== undefined) notice.isActive = isActive;
    if (priority !== undefined) notice.priority = Math.max(1, Math.min(3, parseInt(priority)));
    if (expiresAt !== undefined) notice.expiresAt = expiresAt ? new Date(expiresAt) : undefined;

    await notice.save();

    return res.json({
      success: true,
      message: 'Notice updated successfully',
      data: notice
    });
  } catch (error: any) {
    console.error('Error updating notice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update notice',
      error: error.message
    });
  }
});

// Delete notice (admin/agent only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const notice = await Notice.findByIdAndDelete(req.params.id);

    if (!notice) {
      return res.status(404).json({
        success: false,
        message: 'Notice not found'
      });
    }

    return res.json({
      success: true,
      message: 'Notice deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting notice:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notice',
      error: error.message
    });
  }
});

export default router;

