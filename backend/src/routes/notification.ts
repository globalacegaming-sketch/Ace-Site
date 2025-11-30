import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth';
import Notification from '../models/Notification';
import User from '../models/User';
import { getSocketServerInstance } from '../utils/socketManager';

const router = Router();

// All notification routes require authentication
router.use(authenticate);

// Get user's notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, unreadOnly = false } = req.query;
    
    const pageNumber = Number(page) || 1;
    const limitNumber = Math.min(Number(limit) || 50, 100);
    
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    // Get user's creation date to ensure new users don't see old notifications
    const user = await User.findById(req.user!._id).select('createdAt');
    const userCreatedAt = user?.createdAt || new Date();
    
    // Notifications must be:
    // 1. Created in the last 24 hours
    // 2. Created after the user registered (so new users don't see old notifications)
    const minDate = new Date(Math.max(twentyFourHoursAgo.getTime(), userCreatedAt.getTime()));
    
    const query: any = { 
      userId: req.user!._id,
      createdAt: { $gte: minDate }
    };
    if (unreadOnly === 'true') {
      query.isRead = false;
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(query)
        .sort({ createdAt: -1 })
        .skip((pageNumber - 1) * limitNumber)
        .limit(limitNumber)
        .lean(),
      Notification.countDocuments({ userId: req.user!._id, createdAt: { $gte: minDate } }),
      Notification.countDocuments({ userId: req.user!._id, isRead: false, createdAt: { $gte: minDate } })
    ]);

    return res.json({
      success: true,
      data: notifications,
      pagination: {
        total,
        unreadCount,
        page: pageNumber,
        limit: limitNumber,
        totalPages: Math.ceil(total / limitNumber)
      }
    });
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch notifications',
      error: error.message
    });
  }
});

// Get unread notification count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    // Get user's creation date to ensure new users don't see old notifications
    const user = await User.findById(req.user!._id).select('createdAt');
    const userCreatedAt = user?.createdAt || new Date();
    
    // Notifications must be:
    // 1. Created in the last 24 hours
    // 2. Created after the user registered (so new users don't see old notifications)
    const minDate = new Date(Math.max(twentyFourHoursAgo.getTime(), userCreatedAt.getTime()));
    
    const count = await Notification.countDocuments({
      userId: req.user!._id,
      isRead: false,
      createdAt: { $gte: minDate }
    });

    return res.json({
      success: true,
      count
    });
  } catch (error: any) {
    console.error('Error fetching unread count:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
});

// Mark notification as read
router.put('/:id/read', async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findOne({
      _id: req.params.id,
      userId: req.user!._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    notification.isRead = true;
    notification.readAt = new Date();
    await notification.save();

    return res.json({
      success: true,
      message: 'Notification marked as read',
      data: notification
    });
  } catch (error: any) {
    console.error('Error marking notification as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

// Mark all notifications as read
router.put('/read-all', async (req: Request, res: Response) => {
  try {
    // Calculate 24 hours ago
    const twentyFourHoursAgo = new Date();
    twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
    
    // Get user's creation date to ensure new users don't see old notifications
    const user = await User.findById(req.user!._id).select('createdAt');
    const userCreatedAt = user?.createdAt || new Date();
    
    // Notifications must be:
    // 1. Created in the last 24 hours
    // 2. Created after the user registered (so new users don't see old notifications)
    const minDate = new Date(Math.max(twentyFourHoursAgo.getTime(), userCreatedAt.getTime()));
    
    const result = await Notification.updateMany(
      { 
        userId: req.user!._id, 
        isRead: false,
        createdAt: { $gte: minDate }
      },
      { 
        isRead: true,
        readAt: new Date()
      }
    );

    return res.json({
      success: true,
      message: 'All notifications marked as read',
      data: {
        modifiedCount: result.modifiedCount
      }
    });
  } catch (error: any) {
    console.error('Error marking all notifications as read:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

// Delete notification
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const notification = await Notification.findOneAndDelete({
      _id: req.params.id,
      userId: req.user!._id
    });

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    return res.json({
      success: true,
      message: 'Notification deleted'
    });
  } catch (error: any) {
    console.error('Error deleting notification:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

export default router;

