import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import Agent, { AgentRole } from '../models/Agent';
import { AGENT_JWT_SECRET } from '../config/secrets';

const AGENT_ROLES: readonly AgentRole[] = ['super_admin', 'admin', 'agent'];
export const ADMIN_ROLES: readonly AgentRole[] = ['super_admin', 'admin'];

export interface AgentTokenPayload {
  agentId: string;
  username: string;
  displayName?: string;
  role: AgentRole;
  type: 'agent';
  exp?: number;
}

export interface AgentStatus {
  isActive: boolean;
  role: AgentRole;
  permissions: string[];
}

export interface AuthenticatedAgent extends AgentTokenPayload {
  permissions: string[];
}

/** Signature, `type: 'agent'` and role check only — does not hit the database. */
export const verifyAgentToken = (token: string): AgentTokenPayload | null => {
  try {
    const decoded = jwt.verify(token, AGENT_JWT_SECRET) as Partial<AgentTokenPayload> & { userId?: string };
    if (decoded.type !== 'agent' || !decoded.role || !AGENT_ROLES.includes(decoded.role)) {
      return null;
    }
    const agentId = decoded.agentId || decoded.userId;
    if (!agentId || !decoded.username) {
      return null;
    }
    return { ...decoded, agentId } as AgentTokenPayload;
  } catch {
    return null;
  }
};

// Deactivation and role/permission changes take effect within this window.
const STATUS_CACHE_TTL_MS = 30_000;
const statusCache = new Map<string, { status: AgentStatus | null; expiresAt: number }>();

export const getAgentStatus = async (agentId: string): Promise<AgentStatus | null> => {
  const cached = statusCache.get(agentId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.status;
  }

  let status: AgentStatus | null = null;
  if (mongoose.Types.ObjectId.isValid(agentId)) {
    const agent = await Agent.findById(agentId).select('isActive role permissions').lean();
    if (agent) {
      status = { isActive: agent.isActive, role: agent.role, permissions: agent.permissions || [] };
    }
  }

  statusCache.set(agentId, { status, expiresAt: Date.now() + STATUS_CACHE_TTL_MS });
  return status;
};

export const invalidateAgentStatus = (agentId: string): void => {
  statusCache.delete(agentId);
};

/** Verifies the token and confirms the agent still exists and is active. Role and permissions come from the database. */
export const authenticateAgentToken = async (token: string): Promise<AuthenticatedAgent | null> => {
  const payload = verifyAgentToken(token);
  if (!payload) {
    return null;
  }

  const status = await getAgentStatus(payload.agentId);
  if (!status || !status.isActive) {
    return null;
  }

  return { ...payload, role: status.role, permissions: status.permissions };
};
