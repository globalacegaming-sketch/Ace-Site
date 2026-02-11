import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { adminAuthLimiter } from '../middleware/rateLimiter';
import Agent, { AGENT_PERMISSIONS } from '../models/Agent';
import logger from '../utils/logger';

const router = Router();

const AGENT_JWT_SECRET = process.env.AGENT_JWT_SECRET || process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// ──────────────────────────────────────────────────────────────────────────────
// Middleware: requireSuperAdmin
// Verifies the JWT has role: 'super_admin'
// ──────────────────────────────────────────────────────────────────────────────
const requireSuperAdmin = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;

    if (decoded.role !== 'super_admin') {
      res.status(403).json({ success: false, message: 'Super admin access required' });
      return;
    }

    // Attach agent info to request for downstream use
    (req as any).agentAuth = decoded;
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

// ──────────────────────────────────────────────────────────────────────────────
// POST /agent-auth/login  -- AceAdmin login (super_admin / admin roles)
// ──────────────────────────────────────────────────────────────────────────────
router.post('/login', adminAuthLimiter, async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        success: false,
        message: 'Username and password are required',
      });
    }

    // Authenticate against the Agent collection (super_admin or admin role)
    const agent = await Agent.findOne({
      agentName: username.trim(),
      isActive: true,
      role: { $in: ['super_admin', 'admin'] },
    }).select('+passwordHash');

    if (!agent) {
      logger.warn('❌ AceAdmin login failed: agent not found or not authorized:', username);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    const passwordValid = await agent.comparePassword(password.trim());
    if (!passwordValid) {
      logger.warn('❌ AceAdmin login failed: bad password for:', username);
      return res.status(401).json({ success: false, message: 'Invalid credentials' });
    }

    // Update lastLogin
    agent.lastLogin = new Date();
    await agent.save();

    // Generate JWT token with role
    const token = jwt.sign(
      {
        agentId: agent._id.toString(),
        username: agent.agentName,
        role: agent.role,
        type: 'agent',
      },
      AGENT_JWT_SECRET,
      { expiresIn: '24h' },
    );

    logger.info('✅ AceAdmin login successful:', { username: agent.agentName, role: agent.role });

    return res.json({
      success: true,
      message: 'Agent login successful',
      data: {
        token,
        username: agent.agentName,
        role: agent.role,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      },
    });
  } catch (error: any) {
    logger.error('Agent login error:', error);
    return res.status(500).json({
      success: false,
      message: 'Login failed',
      error: error.message,
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// GET /agent-auth/verify  -- verify JWT
// ──────────────────────────────────────────────────────────────────────────────
router.get('/verify', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, message: 'No token provided' });
    }

    const token = authHeader.substring(7);

    try {
      const decoded = jwt.verify(token, AGENT_JWT_SECRET) as any;

      return res.json({
        success: true,
        message: 'Token is valid',
        data: {
          username: decoded.username,
          role: decoded.role,
        },
      });
    } catch {
      return res.status(401).json({ success: false, message: 'Invalid or expired token' });
    }
  } catch (error: any) {
    logger.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Verification failed',
      error: error.message,
    });
  }
});

// ──────────────────────────────────────────────────────────────────────────────
// Agent CRUD endpoints  (super_admin only)
// ──────────────────────────────────────────────────────────────────────────────

// GET /agent-auth/agents -- list all agents
router.get('/agents', requireSuperAdmin, async (_req: Request, res: Response) => {
  try {
    const agents = await Agent.find({})
      .select('agentName role permissions isActive lastLogin createdAt updatedAt')
      .sort({ createdAt: -1 })
      .lean();

    return res.json({
      success: true,
      data: agents,
      count: agents.length,
    });
  } catch (error: any) {
    logger.error('List agents error:', error);
    return res.status(500).json({ success: false, message: 'Failed to list agents' });
  }
});

// POST /agent-auth/agents -- create a new agent
router.post('/agents', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { agentName, password, role, permissions } = req.body;

    if (!agentName || !password) {
      return res.status(400).json({ success: false, message: 'agentName and password are required' });
    }

    if (password.length < 4) {
      return res.status(400).json({ success: false, message: 'Password must be at least 4 characters' });
    }

    const validRoles = ['super_admin', 'admin', 'agent'];
    const agentRole = validRoles.includes(role) ? role : 'agent';

    // Validate permissions
    let agentPermissions = [...AGENT_PERMISSIONS]; // default: all
    if (Array.isArray(permissions)) {
      agentPermissions = permissions.filter((p: string) => (AGENT_PERMISSIONS as readonly string[]).includes(p));
    }

    // Check for duplicate name
    const existing = await Agent.findOne({ agentName });
    if (existing) {
      return res.status(409).json({ success: false, message: 'Agent name already exists' });
    }

    const agent = await Agent.create({
      agentName,
      passwordHash: password, // pre-save hook will bcrypt this
      role: agentRole,
      permissions: agentPermissions,
      isActive: true,
    });

    logger.info('✅ Agent created:', { agentName: agent.agentName, role: agent.role });

    return res.status(201).json({
      success: true,
      message: 'Agent created successfully',
      data: {
        _id: agent._id,
        agentName: agent.agentName,
        role: agent.role,
        permissions: agent.permissions,
        isActive: agent.isActive,
        createdAt: agent.createdAt,
      },
    });
  } catch (error: any) {
    logger.error('Create agent error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Agent name already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to create agent' });
  }
});

// PUT /agent-auth/agents/:id -- update agent
router.put('/agents/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { agentName, role, permissions, isActive, password } = req.body;

    const agent = await Agent.findById(id).select('+passwordHash');
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    // Prevent deactivating the last super_admin
    if (isActive === false && agent.role === 'super_admin') {
      const superAdminCount = await Agent.countDocuments({ role: 'super_admin', isActive: true });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last super admin',
        });
      }
    }

    // Prevent changing role away from super_admin if it's the last one
    if (role && role !== 'super_admin' && agent.role === 'super_admin') {
      const superAdminCount = await Agent.countDocuments({ role: 'super_admin', isActive: true });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot change role of the last super admin',
        });
      }
    }

    if (agentName !== undefined) agent.agentName = agentName;
    if (role !== undefined) {
      const validRoles = ['super_admin', 'admin', 'agent'];
      if (validRoles.includes(role)) agent.role = role;
    }
    if (Array.isArray(permissions)) {
      agent.permissions = permissions.filter((p: string) =>
        (AGENT_PERMISSIONS as readonly string[]).includes(p),
      );
    }
    if (isActive !== undefined) agent.isActive = isActive;
    if (password) {
      agent.passwordHash = password; // pre-save hook will bcrypt this
    }

    await agent.save();

    logger.info('✅ Agent updated:', { agentName: agent.agentName, role: agent.role });

    return res.json({
      success: true,
      message: 'Agent updated successfully',
      data: {
        _id: agent._id,
        agentName: agent.agentName,
        role: agent.role,
        permissions: agent.permissions,
        isActive: agent.isActive,
        lastLogin: agent.lastLogin,
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
      },
    });
  } catch (error: any) {
    logger.error('Update agent error:', error);
    if (error.code === 11000) {
      return res.status(409).json({ success: false, message: 'Agent name already exists' });
    }
    return res.status(500).json({ success: false, message: 'Failed to update agent' });
  }
});

// DELETE /agent-auth/agents/:id -- soft-delete (set isActive: false)
router.delete('/agents/:id', requireSuperAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;

    const agent = await Agent.findById(id);
    if (!agent) {
      return res.status(404).json({ success: false, message: 'Agent not found' });
    }

    // Prevent deactivating the last super_admin
    if (agent.role === 'super_admin') {
      const superAdminCount = await Agent.countDocuments({ role: 'super_admin', isActive: true });
      if (superAdminCount <= 1) {
        return res.status(400).json({
          success: false,
          message: 'Cannot deactivate the last super admin',
        });
      }
    }

    agent.isActive = false;
    await agent.save();

    logger.info('✅ Agent deactivated:', { agentName: agent.agentName });

    return res.json({
      success: true,
      message: 'Agent deactivated successfully',
      data: { _id: agent._id, agentName: agent.agentName, isActive: agent.isActive },
    });
  } catch (error: any) {
    logger.error('Delete agent error:', error);
    return res.status(500).json({ success: false, message: 'Failed to deactivate agent' });
  }
});

export default router;
