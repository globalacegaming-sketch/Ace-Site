import { Router, Request, Response } from 'express';
import Platform, { IPlatform } from '../models/Platform';

const router = Router();

// Get all active platforms (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const platforms = await Platform.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');

    return res.json({
      success: true,
      message: 'Platforms retrieved successfully',
      data: platforms
    });
  } catch (error: any) {
    console.error('Error fetching platforms:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platforms',
      error: error.message
    });
  }
});

// Get all platforms (admin/agent only)
router.get('/all', async (req: Request, res: Response) => {
  try {
    const platforms = await Platform.find()
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');

    return res.json({
      success: true,
      message: 'All platforms retrieved successfully',
      data: platforms
    });
  } catch (error: any) {
    console.error('Error fetching all platforms:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platforms',
      error: error.message
    });
  }
});

// Get single platform by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const platform = await Platform.findById(req.params.id).select('-__v');

    if (!platform) {
      return res.status(404).json({
        success: false,
        message: 'Platform not found'
      });
    }

    return res.json({
      success: true,
      message: 'Platform retrieved successfully',
      data: platform
    });
  } catch (error: any) {
    console.error('Error fetching platform:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch platform',
      error: error.message
    });
  }
});

// Create new platform (admin/agent only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, description, image, gameLink, order, isActive } = req.body;

    if (!name || !description || !image || !gameLink) {
      return res.status(400).json({
        success: false,
        message: 'Name, description, image, and gameLink are required'
      });
    }

    const platform = new Platform({
      name,
      description,
      image,
      gameLink,
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    await platform.save();

    return res.status(201).json({
      success: true,
      message: 'Platform created successfully',
      data: platform
    });
  } catch (error: any) {
    console.error('Error creating platform:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create platform',
      error: error.message
    });
  }
});

// Update platform (admin/agent only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { name, description, image, gameLink, order, isActive } = req.body;

    const platform = await Platform.findById(req.params.id);

    if (!platform) {
      return res.status(404).json({
        success: false,
        message: 'Platform not found'
      });
    }

    if (name) platform.name = name;
    if (description) platform.description = description;
    if (image) platform.image = image;
    if (gameLink) platform.gameLink = gameLink;
    if (order !== undefined) platform.order = order;
    if (isActive !== undefined) platform.isActive = isActive;

    await platform.save();

    return res.json({
      success: true,
      message: 'Platform updated successfully',
      data: platform
    });
  } catch (error: any) {
    console.error('Error updating platform:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update platform',
      error: error.message
    });
  }
});

// Delete platform (admin/agent only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const platform = await Platform.findByIdAndDelete(req.params.id);

    if (!platform) {
      return res.status(404).json({
        success: false,
        message: 'Platform not found'
      });
    }

    return res.json({
      success: true,
      message: 'Platform deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting platform:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete platform',
      error: error.message
    });
  }
});

export default router;

