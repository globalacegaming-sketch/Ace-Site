import { Router, Request, Response } from 'express';
import User from '../models/User';

const router = Router();

// Get contacts (users) - only specific fields, no passwords
router.get('/', async (req: Request, res: Response) => {
  try {
    const users = await User.find({})
      .select('username fortunePandaUsername email phone referralCode referredBy firstName lastName createdAt')
      .sort({ createdAt: -1 })
      .lean();

    // Format the response
    const contacts = users.map(user => ({
      _id: user._id,
      username: user.username,
      fpName: user.fortunePandaUsername || 'N/A',
      email: user.email,
      phone: user.phone || 'N/A',
      referralCode: user.referralCode || 'N/A',
      referredBy: user.referredBy || null,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      createdAt: user.createdAt
    }));

    return res.json({
      success: true,
      message: 'Contacts retrieved successfully',
      data: contacts,
      count: contacts.length
    });
  } catch (error: any) {
    console.error('Get contacts error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch contacts',
      error: error.message
    });
  }
});

// Get single contact by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username fortunePandaUsername email phone referralCode referredBy firstName lastName createdAt')
      .lean();

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Contact not found'
      });
    }

    const contact = {
      _id: user._id,
      username: user.username,
      fpName: user.fortunePandaUsername || 'N/A',
      email: user.email,
      phone: user.phone || 'N/A',
      referralCode: user.referralCode || 'N/A',
      referredBy: user.referredBy || null,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      createdAt: user.createdAt
    };

    return res.json({
      success: true,
      message: 'Contact retrieved successfully',
      data: contact
    });
  } catch (error: any) {
    console.error('Get contact error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch contact',
      error: error.message
    });
  }
});

export default router;

