import { Router, Request, Response } from 'express';
import FAQ, { IFAQ } from '../models/FAQ';
import { sanitizeString, sanitizeText } from '../utils/sanitize';

const router = Router();

// Get all active FAQs (public)
router.get('/', async (req: Request, res: Response) => {
  try {
    const faqs = await FAQ.find({ isActive: true })
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');

    return res.json({
      success: true,
      message: 'FAQs retrieved successfully',
      data: faqs
    });
  } catch (error: any) {
    console.error('Error fetching FAQs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs',
      error: error.message
    });
  }
});

// Get all FAQs (admin/agent only)
router.get('/all', async (req: Request, res: Response) => {
  try {
    const faqs = await FAQ.find()
      .sort({ order: 1, createdAt: -1 })
      .select('-__v');

    return res.json({
      success: true,
      message: 'All FAQs retrieved successfully',
      data: faqs
    });
  } catch (error: any) {
    console.error('Error fetching all FAQs:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQs',
      error: error.message
    });
  }
});

// Get single FAQ by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const faq = await FAQ.findById(req.params.id).select('-__v');

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    return res.json({
      success: true,
      message: 'FAQ retrieved successfully',
      data: faq
    });
  } catch (error: any) {
    console.error('Error fetching FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch FAQ',
      error: error.message
    });
  }
});

// Create new FAQ (admin/agent only)
router.post('/', async (req: Request, res: Response) => {
  try {
    const { question, answer, category, order, isActive } = req.body;

    if (!question || !answer) {
      return res.status(400).json({
        success: false,
        message: 'Question and answer are required'
      });
    }

    // Sanitize user inputs to prevent XSS attacks
    const sanitizedQuestion = sanitizeString(question);
    const sanitizedAnswer = sanitizeText(answer);
    const sanitizedCategory = sanitizeString(category || 'general');
    
    const faq = new FAQ({
      question: sanitizedQuestion,
      answer: sanitizedAnswer,
      category: sanitizedCategory,
      order: order || 0,
      isActive: isActive !== undefined ? isActive : true
    });

    await faq.save();

    return res.status(201).json({
      success: true,
      message: 'FAQ created successfully',
      data: faq
    });
  } catch (error: any) {
    console.error('Error creating FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to create FAQ',
      error: error.message
    });
  }
});

// Update FAQ (admin/agent only)
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { question, answer, category, order, isActive } = req.body;

    const faq = await FAQ.findById(req.params.id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    if (question) faq.question = sanitizeString(question);
    if (answer) faq.answer = sanitizeText(answer);
    if (category) faq.category = sanitizeString(category);
    if (order !== undefined) faq.order = order;
    if (isActive !== undefined) faq.isActive = isActive;

    await faq.save();

    return res.json({
      success: true,
      message: 'FAQ updated successfully',
      data: faq
    });
  } catch (error: any) {
    console.error('Error updating FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to update FAQ',
      error: error.message
    });
  }
});

// Delete FAQ (admin/agent only)
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const faq = await FAQ.findByIdAndDelete(req.params.id);

    if (!faq) {
      return res.status(404).json({
        success: false,
        message: 'FAQ not found'
      });
    }

    return res.json({
      success: true,
      message: 'FAQ deleted successfully'
    });
  } catch (error: any) {
    console.error('Error deleting FAQ:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to delete FAQ',
      error: error.message
    });
  }
});

export default router;

