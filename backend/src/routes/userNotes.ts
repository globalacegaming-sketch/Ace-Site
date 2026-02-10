// ──────────────────────────────────────────────────────────────────────────────
// /api/admin/notes  –  User Notes CRUD
// ──────────────────────────────────────────────────────────────────────────────

import { Router, Request, Response } from 'express';
import mongoose from 'mongoose';
import UserNote from '../models/UserNote';
import User from '../models/User';
import { requireAnyAdminAuth } from '../middleware/anyAdminAuth';
import logger from '../utils/logger';

const router = Router();

// All routes require admin/agent auth
router.use(requireAnyAdminAuth);

// ──────────────────────────────────────────────────────────────────────────────
// GET /:userId  –  List all notes for a user (newest first)
// ──────────────────────────────────────────────────────────────────────────────
router.get('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    // Verify user exists
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const notes = await UserNote.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    return res.json({ success: true, data: notes });
  } catch (error) {
    logger.error('List user notes error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list notes' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// POST /:userId  –  Add a note for a user
// ──────────────────────────────────────────────────────────────────────────────
router.post('/:userId', async (req: Request, res: Response) => {
  try {
    const { userId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ success: false, message: 'Invalid user ID' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Note content is required' });
    }

    // Verify user exists
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    const caller = req.callerIdentity;
    const note = await UserNote.create({
      userId: new mongoose.Types.ObjectId(userId),
      authorId: caller?.id || 'unknown',
      authorName: caller?.name || 'Unknown',
      content: content.trim(),
    });

    logger.info('Note created:', { noteId: note._id, userId, by: caller?.name });
    return res.status(201).json({ success: true, data: note });
  } catch (error) {
    logger.error('Create user note error:', error);
    return res.status(500).json({ success: false, message: 'Failed to create note' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// PUT /:noteId  –  Edit a note (only the original author)
// ──────────────────────────────────────────────────────────────────────────────
router.put('/:noteId', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;
    const { content } = req.body;

    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ success: false, message: 'Invalid note ID' });
    }

    if (!content || typeof content !== 'string' || !content.trim()) {
      return res.status(400).json({ success: false, message: 'Note content is required' });
    }

    const note = await UserNote.findById(noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    // Only the original author can edit
    const caller = req.callerIdentity;
    if (note.authorId !== caller?.id) {
      return res.status(403).json({ success: false, message: 'You can only edit your own notes' });
    }

    note.content = content.trim();
    await note.save();

    logger.info('Note updated:', { noteId, by: caller?.name });
    return res.json({ success: true, data: note });
  } catch (error) {
    logger.error('Update user note error:', error);
    return res.status(500).json({ success: false, message: 'Failed to update note' });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// DELETE /:noteId  –  Delete a note (original author or super_admin)
// ──────────────────────────────────────────────────────────────────────────────
router.delete('/:noteId', async (req: Request, res: Response) => {
  try {
    const { noteId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(noteId)) {
      return res.status(400).json({ success: false, message: 'Invalid note ID' });
    }

    const note = await UserNote.findById(noteId);
    if (!note) {
      return res.status(404).json({ success: false, message: 'Note not found' });
    }

    // Only author or super_admin can delete
    const caller = req.callerIdentity;
    if (note.authorId !== caller?.id && caller?.role !== 'super_admin') {
      return res.status(403).json({ success: false, message: 'You can only delete your own notes' });
    }

    await UserNote.findByIdAndDelete(noteId);

    logger.info('Note deleted:', { noteId, by: caller?.name });
    return res.json({ success: true, message: 'Note deleted' });
  } catch (error) {
    logger.error('Delete user note error:', error);
    return res.status(500).json({ success: false, message: 'Failed to delete note' });
  }
});

export default router;
