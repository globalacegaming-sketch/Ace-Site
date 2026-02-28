import { Router, Request, Response } from 'express';
import fs from 'fs';
import Bonus, { IBonus } from '../models/Bonus';
import User from '../models/User';
import ChatMessage from '../models/ChatMessage';
import { getSocketServerInstance } from '../utils/socketManager';
import cloudinary, { isCloudinaryEnabled } from '../config/cloudinary';
import { bonusImageUpload } from '../config/bonusUploads';

const router = Router();

// Get all active bonuses (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const now = new Date();
    const bonuses = await Bonus.find({
      isActive: true,
      $and: [
        {
          $or: [
            { validFrom: { $exists: false } },
            { validFrom: { $lte: now } }
          ]
        },
        {
          $or: [
            { validUntil: { $exists: false } },
            { validUntil: { $gte: now } }
          ]
        }
      ]
    })
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');

    return res.json({
      success: true,
      message: 'Bonuses retrieved successfully',
      data: bonuses
    });
  } catch (error: any) {
    console.error('Error fetching bonuses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bonuses',
      error: error.message
    });
  }
});

// Get all bonuses (admin/agent only)
router.get('/all', async (req: Request, res: Response) => {
  try {
    const bonuses = await Bonus.find()
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');

    return res.json({
      success: true,
      message: 'All bonuses retrieved successfully',
      data: bonuses
    });
  } catch (error: any) {
    console.error('Error fetching all bonuses:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bonuses',
      error: error.message
    });
  }
});

// Get single bonus by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const bonus = await Bonus.findById(req.params.id).select('-__v');

    if (!bonus) {
      return res.status(404).json({
        success: false,
        message: 'Bonus not found'
      });
    }

    return res.json({
      success: true,
      message: 'Bonus retrieved successfully',
      data: bonus
    });
  } catch (error: any) {
    console.error('Error fetching bonus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch bonus',
      error: error.message
    });
  }
});

// Upload bonus image to Cloudinary (admin/agent only)
router.post('/upload-image', bonusImageUpload.single('image'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No image file provided' });
    }

    const filePath = req.file.path;
    let imageUrl: string;

    if (isCloudinaryEnabled()) {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'bonuses',
        resource_type: 'image',
        transformation: [{ quality: 'auto', fetch_format: 'auto' }]
      });
      imageUrl = result.secure_url;
      fs.unlink(filePath, () => {});
    } else {
      imageUrl = `/uploads/bonus/${req.file.filename}`;
    }

    return res.json({ success: true, message: 'Image uploaded', data: { url: imageUrl } });
  } catch (error: any) {
    if (req.file) fs.unlink(req.file.path, () => {});
    console.error('Error uploading bonus image:', error);
    return res.status(500).json({ success: false, message: 'Failed to upload image', error: error.message });
  }
});

// Create new bonus (admin/agent only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      image,
      bonusType,
      bonusValue,
      termsAndConditions,
      order,
      isActive,
      validFrom,
      validUntil,
      maxClaims,
      cooldownHours
    } = req.body;

    if (!title || !description || !image) {
      return res.status(400).json({
        success: false,
        message: 'Title, description, and image are required'
      });
    }

    const bonus = new Bonus({
      title,
      description,
      image,
      bonusType: bonusType || 'other',
      bonusValue,
      termsAndConditions,
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true,
      validFrom: validFrom ? new Date(validFrom) : undefined,
      validUntil: validUntil ? new Date(validUntil) : undefined,
      maxClaims: maxClaims !== undefined ? Number(maxClaims) : 1,
      cooldownHours: cooldownHours !== undefined ? Number(cooldownHours) : 0
    });

    await bonus.save();

    return res.status(201).json({
      success: true,
      message: 'Bonus created successfully',
      data: bonus
    });
  } catch (error: any) {
    console.error('Error creating bonus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create bonus',
      error: error.message
    });
  }
});

// Update bonus (admin/agent only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const {
      title,
      description,
      image,
      bonusType,
      bonusValue,
      termsAndConditions,
      order,
      isActive,
      validFrom,
      validUntil,
      maxClaims,
      cooldownHours
    } = req.body;

    const bonus = await Bonus.findById(req.params.id);

    if (!bonus) {
      return res.status(404).json({
        success: false,
        message: 'Bonus not found'
      });
    }

    if (title) bonus.title = title;
    if (description) bonus.description = description;
    if (image) bonus.image = image;
    if (bonusType) bonus.bonusType = bonusType;
    if (bonusValue !== undefined) bonus.bonusValue = bonusValue;
    if (termsAndConditions !== undefined) bonus.termsAndConditions = termsAndConditions;
    if (order !== undefined) bonus.order = order;
    if (isActive !== undefined) bonus.isActive = isActive;
    if (validFrom !== undefined) bonus.validFrom = validFrom ? new Date(validFrom) : undefined;
    if (validUntil !== undefined) bonus.validUntil = validUntil ? new Date(validUntil) : undefined;
    if (maxClaims !== undefined) bonus.maxClaims = Number(maxClaims);
    if (cooldownHours !== undefined) bonus.cooldownHours = Number(cooldownHours);

    await bonus.save();

    return res.json({
      success: true,
      message: 'Bonus updated successfully',
      data: bonus
    });
  } catch (error: any) {
    console.error('Error updating bonus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update bonus',
      error: error.message
    });
  }
});

// Delete bonus (admin/agent only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const bonus = await Bonus.findByIdAndDelete(req.params.id);

    if (!bonus) {
      return res.status(404).json({
        success: false,
        message: 'Bonus not found'
      });
    }

    return res.json({
      success: true,
      message: 'Bonus deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting bonus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete bonus',
      error: error.message
    });
  }
});

// Claim bonus (user endpoint)
router.post('/:id/claim', async (req: Request, res: Response) => {
  try {
    const { userId } = req.body;
    const bonusId = req.params.id;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required'
      });
    }

    const bonus = await Bonus.findById(bonusId);

    if (!bonus) {
      return res.status(404).json({
        success: false,
        message: 'Bonus not found'
      });
    }

    // Check if bonus is active and valid
    if (!bonus.isActive) {
      return res.status(400).json({
        success: false,
        message: 'This bonus is not available'
      });
    }

    const now = new Date();
    if (bonus.validFrom && new Date(bonus.validFrom) > now) {
      return res.status(400).json({
        success: false,
        message: 'This bonus is not yet available'
      });
    }

    if (bonus.validUntil && new Date(bonus.validUntil) < now) {
      return res.status(400).json({
        success: false,
        message: 'This bonus has expired'
      });
    }

    // Gather this user's claim history for this bonus
    const userClaims = (bonus.claims || []).filter(c => c.userId === userId);
    const claimCount = userClaims.length;
    const maxClaims = bonus.maxClaims ?? 1;   // default 1 for legacy docs
    const cooldownHrs = bonus.cooldownHours ?? 0;

    if (cooldownHrs > 0) {
      // Repeatable bonus — check cooldown
      if (maxClaims > 0 && claimCount >= maxClaims) {
        return res.status(400).json({
          success: false,
          message: `You have reached the maximum of ${maxClaims} claim(s) for this bonus`,
          alreadyClaimed: true
        });
      }
      if (claimCount > 0) {
        const lastClaim = userClaims.reduce((a, b) =>
          new Date(a.claimedAt) > new Date(b.claimedAt) ? a : b
        );
        const msSinceLast = Date.now() - new Date(lastClaim.claimedAt).getTime();
        const cooldownMs = cooldownHrs * 60 * 60 * 1000;
        if (msSinceLast < cooldownMs) {
          const availableAt = new Date(new Date(lastClaim.claimedAt).getTime() + cooldownMs);
          return res.status(400).json({
            success: false,
            message: 'Bonus is on cooldown',
            cooldown: true,
            availableAt: availableAt.toISOString()
          });
        }
      }
    } else {
      // One-time bonus (cooldown=0) — legacy behaviour
      if (bonus.claimedBy.includes(userId)) {
        return res.status(400).json({
          success: false,
          message: 'You have already claimed this bonus',
          alreadyClaimed: true
        });
      }
    }

    // Record the claim
    if (!bonus.claims) bonus.claims = [];
    bonus.claims.push({ userId, claimedAt: new Date() });
    if (!bonus.claimedBy.includes(userId)) bonus.claimedBy.push(userId);
    await bonus.save();

    // Send special system message to admin chat about bonus claim
    try {
      const user = await User.findById(userId).select('username email firstName lastName');
      
      if (user) {
        const name = user.firstName && user.lastName
          ? `${user.firstName} ${user.lastName}`.trim()
          : user.username;

        // Create a special system message that users cannot replicate
        // This message is marked as 'system' type which users cannot send
        // But we use the user's actual name so admins know who is claiming
        const systemMessage = await ChatMessage.create({
          userId: user._id,
          senderType: 'system',
          message: `🎁 BONUS CLAIM REQUEST: User wants to claim "${bonus.title}" (${bonus.bonusType})${bonus.bonusValue ? ` - Value: ${bonus.bonusValue}` : ''}`,
          status: 'unread',
          name: name, // Use user's actual name instead of 'System'
          email: user.email,
          metadata: {
            type: 'bonus_claim',
            bonusId: bonus._id.toString(),
            bonusTitle: bonus.title,
            bonusType: bonus.bonusType,
            bonusValue: bonus.bonusValue,
            isSystemMessage: true,
            timestamp: new Date().toISOString()
          }
        });

        // Emit to admin chat
        const io = getSocketServerInstance();
        const payload = {
          id: systemMessage._id.toString(),
          userId: systemMessage.userId.toString(),
          senderType: 'system',
          message: systemMessage.message,
          status: systemMessage.status,
          name: systemMessage.name,
          email: systemMessage.email,
          metadata: systemMessage.metadata,
          createdAt: systemMessage.createdAt,
          updatedAt: systemMessage.updatedAt
        };

        io.to('admins').emit('chat:message:new', payload);
        io.to(`user:${userId}`).emit('chat:message:new', payload);

        console.log('✅ Bonus claim system message sent to admin chat:', {
          userId: userId,
          bonusId: bonus._id.toString(),
          bonusTitle: bonus.title
        });
      }
    } catch (chatError: any) {
      // Don't fail the bonus claim if chat message fails
      console.error('⚠️ Failed to send bonus claim chat message:', chatError.message);
    }

    return res.json({
      success: true,
      message: 'Bonus claimed successfully',
      data: {
        bonusId: bonus._id,
        claimed: true
      }
    });
  } catch (error: any) {
    console.error('Error claiming bonus:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to claim bonus',
      error: error.message
    });
  }
});

export default router;

