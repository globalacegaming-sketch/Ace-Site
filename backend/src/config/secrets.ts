import 'dotenv/config';
import logger from '../utils/logger';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

const readEnv = (name: string): string | undefined => {
  const value = process.env[name];
  return value && value.trim() ? value.trim() : undefined;
};

const jwtSecret = readEnv('JWT_SECRET');
if (!jwtSecret && IS_PRODUCTION) {
  throw new Error('JWT_SECRET must be set in production.');
}

export const JWT_SECRET = jwtSecret || 'dev-only-jwt-secret-do-not-use-in-production';

const agentJwtSecret = readEnv('AGENT_JWT_SECRET');
if (!agentJwtSecret && IS_PRODUCTION) {
  logger.warn('⚠️  AGENT_JWT_SECRET is not set; agent tokens are signed with JWT_SECRET. Set a separate value.');
}

export const AGENT_JWT_SECRET = agentJwtSecret || JWT_SECRET;

const sessionSecret = readEnv('SESSION_SECRET');
if (!sessionSecret && IS_PRODUCTION) {
  logger.warn('⚠️  SESSION_SECRET is not set; session cookies are signed with JWT_SECRET. Set a separate value.');
}

export const SESSION_SECRET = sessionSecret || JWT_SECRET;
