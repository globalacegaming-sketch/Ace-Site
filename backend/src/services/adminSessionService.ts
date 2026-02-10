interface AdminSession {
  adminId: string;
  agentName: string;
  token: string;
  expiresAt: number;
  role: string;
  permissions: string[];
}

const sessions = new Map<string, AdminSession>();

export const createAdminSession = (session: AdminSession): void => {
  sessions.set(session.token, session);
};

export const validateAdminSession = (token: string): AdminSession | null => {
  const session = sessions.get(token);

  if (!session) {
    return null;
  }

  if (session.expiresAt <= Date.now()) {
    sessions.delete(token);
    return null;
  }

  return session;
};

export const revokeAdminSession = (token: string): void => {
  sessions.delete(token);
};

export const listActiveAdminSessions = (): AdminSession[] => {
  const now = Date.now();
  return Array.from(sessions.values()).filter((session) => session.expiresAt > now);
};

