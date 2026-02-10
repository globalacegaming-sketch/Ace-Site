// ──────────────────────────────────────────────────────────────────────────────
// /api/admin/labels  –  Label CRUD & user-label assignment
// ──────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import Label from '../models/Label';
import User from '../models/User';
import { requireAnyAdminAuth, requireAdminRole } from '../middleware/anyAdminAuth';
import logger from '../utils/logger';

const router = Router();

// All routes require admin/agent auth
router.use(requireAnyAdminAuth);

// ──────────────────────────────────────────────────────────────────────────────
// GET /  –  List all labels (sorted by sortOrder)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/', async (_req: Request, res: Response) => {
  try {
    const labels = await Label.find({}).sort({ sortOrder: 1, name: 1 }).lean();
    return res.json({ success: true, data: labels });
  } catch (error) {
    logger.error('List labels error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list labels' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /  –  Create a new label (admin/super_admin only)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/', requireAdminRole, async (req: Request, res: Response) => {
  try {
    const { name, color, sortOrder } = req.body;

    if (!name || typeof name !== 'string' || !name.trim()) {
      return res.status(400).json({ success: false, message: 'Label name is required' });
    }

    // Check for duplicate name (case-insensitive)
    const existing = await Label.findOne({ name: { $regex: new RegExp(`^${name.trim()}$`, 'i') } });
    if (existing) {
      return res.status(409).json({ success: false, message: 'A label with this name already exists' });
    }

    const label = await Label.create({
      name: name.trim(),
      color: color || '#3B82F6',
      sortOrder: typeof sortOrder === 'number' ? sortOrder : 0,
      createdBy: req.callerIdentity?.id ? new mongoose.Types.ObjectId(req.callerIdentity.id) : undefined,
    });

    logger.info('Label created:', { id: label._id, name: label.name, by: req.callerIdentity?.name });
    return res.status(201).json({ success: true, data: label });
  } catch (error: any) {
    logger.error('Create label error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A label with this name already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create label' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /:id  –  Update label (admin/super_admin only)
// ──────────────────────────────────────────────────────────────────────────────
router.put('/:id', requireAdminRole, async (req: Request, res: Response) => {
  try {
    const { name, color, sortOrder } = req.body;
    const labelId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(labelId)) {
      return res.status(400).json({ success: false, message: 'Invalid label ID' });
    }

    const update: Record<string, any> = {};
    if (name && typeof name === 'string') update.name = name.trim();
    if (color && typeof color === 'string') update.color = color;
    if (typeof sortOrder === 'number') update.sortOrder = sortOrder;

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    // Check uniqueness if name is being changed
    if (update.name) {
      const existing = await Label.findOne({
        _id: { $ne: labelId },
        name: { $regex: new RegExp(`^${update.name}$`, 'i') },
      });
      if (existing) {
        return res.status(409).json({ success: false, message: 'A label with this name already exists' });
      }
    }

    const label = await Label.findByIdAndUpdate(labelId, update, { new: true, runValidators: true }).lean();
    if (!label) {
      return res.status(404).json({ success: false, message: 'Label not found' });
    }

    logger.info('Label updated:', { id: labelId, update, by: req.callerIdentity?.name });
    return res.json({ success: true, data: label });
  } catch (error: any) {
    logger.error('Update label error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'A label with this name already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to update label' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /:id  –  Delete label & remove from all users (admin/super_admin only)
// ──────────────────────────────────────────────────────────────────────────────
router.delete('/:id', requireAdminRole, async (req: Request, res: Response) => {
  try {
    const labelId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(labelId)) {
      return res.status(400).json({ success: false, message: 'Invalid label ID' });
    }

    const label = await Label.findByIdAndDelete(labelId);
    if (!label) {
      return res.status(404).json({ success: false, message: 'Label not found' });
    }

    // Remove this label from all users that have it
    const result = await User.updateMany(
      { labels: labelId },
      { $pull: { labels: labelId } }
    );

    logger.info('Label deleted:', {
      id: labelId,
      name: label.name,
      usersAffected: result.modifiedCount,
      by: req.callerIdentity?.name,
    });

    return res.json({
      success: true,
      message: `Label "${label.name}" deleted and removed from ${result.modifiedCount} users`,
    });
  } catch (error) {
    logger.error('Delete label error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete label' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /assign  –  Assign labels to a user (admin & agent)
// Body: { userId: string, labelIds: string[] }
// ──────────────────────────────────────────────────────────────────────────────
router.post('/assign', async (req: Request, res: Response) => {
  try {
    const { userId, labelIds } = req.body;

    if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Valid userId is required' });
    }

    if (!Array.isArray(labelIds)) {
      return res.status(400).json({ success: false, message: 'labelIds must be an array' });
    }

    // Validate all label IDs exist
    const validIds = labelIds.filter(id => mongoose.Types.ObjectId.isValid(id));
    if (validIds.length > 0) {
      const existingCount = await Label.countDocuments({ _id: { $in: validIds } });
      if (existingCount !== validIds.length) {
        return res.status(400).json({ success: false, message: 'One or more label IDs are invalid' });
      }
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { labels: validIds },
      { new: true }
    ).populate('labels').lean();

    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    logger.info('Labels assigned:', { userId, labels: validIds, by: req.callerIdentity?.name });
    return res.json({ success: true, data: { userId: user._id, labels: user.labels } });
  } catch (error) {
    logger.error('Assign labels error:', error);
    return res.status(500).json({ success: false, message: 'Failed to assign labels' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /users  –  Filter users by label(s)
// Query: ?labels=id1,id2&match=all|any&sort=lastActive|unread|created
// ──────────────────────────────────────────────────────────────────────────────
router.get('/users', async (req: Request, res: Response) => {
  try {
    const { labels, match, sort } = req.query;

    if (!labels || typeof labels !== 'string') {
      return res.status(400).json({ success: false, message: 'labels query parameter is required' });
    }

    const labelIds = labels.split(',').filter(id => mongoose.Types.ObjectId.isValid(id));
    if (labelIds.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid label IDs provided' });
    }

    const labelObjectIds = labelIds.map(id => new mongoose.Types.ObjectId(id));

    // Build filter: $all = user has ALL labels, $in = user has ANY label
    const labelFilter = match === 'all'
      ? { labels: { $all: labelObjectIds } }
      : { labels: { $in: labelObjectIds } };

    // Build sort
    let sortOption: Record<string, 1 | -1> = { createdAt: -1 };
    if (sort === 'lastActive') sortOption = { lastLogin: -1 };
    else if (sort === 'created') sortOption = { createdAt: -1 };

    // For "unread" sort we need aggregation with chat messages
    if (sort === 'unread') {
      const pipeline = [
        { $match: labelFilter },
        {
          $lookup: {
            from: 'chatmessages',
            let: { uid: '$_id' },
            pipeline: [
              { $match: { $expr: { $and: [{ $eq: ['$userId', '$$uid'] }, { $eq: ['$senderType', 'user'] }, { $eq: ['$status', 'unread'] }] } } },
              { $count: 'count' },
            ],
            as: 'unreadMessages',
          },
        },
        {
          $addFields: {
            unreadCount: { $ifNull: [{ $arrayElemAt: ['$unreadMessages.count', 0] }, 0] },
          },
        },
        { $sort: { unreadCount: -1 as const, createdAt: -1 as const } },
        {
          $project: {
            password: 0,
            fortunePandaPassword: 0,
            unreadMessages: 0,
          },
        },
      ];

      const users = await User.aggregate(pipeline);

      // Populate labels on aggregation results
      const populatedUsers = await User.populate(users, { path: 'labels', model: 'Label' });

      return res.json({ success: true, data: populatedUsers, count: populatedUsers.length });
    }

    const users = await User.find(labelFilter)
      .select('-password -fortunePandaPassword')
      .populate('labels')
      .sort(sortOption)
      .lean();

    return res.json({ success: true, data: users, count: users.length });
  } catch (error) {
    logger.error('Filter users by label error:', error);
    return res.status(500).json({ success: false, message: 'Failed to filter users' });
  }
});

export default router;
