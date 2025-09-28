import jwt from 'jsonwebtoken';
import { IUser } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';
const JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '30d';

export interface JWTPayload {
  userId: string;
  email: string;
  username: string;
  role: string;
}

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export const generateTokens = (user: IUser): TokenPair => {
  const payload: JWTPayload = {
    userId: user._id.toString(),
    email: user.email,
    username: user.username,
    role: user.role
  };

  const accessToken = jwt.sign(payload, JWT_SECRET, {
    expiresIn: JWT_EXPIRES_IN,
    issuer: 'global-ace-gaming',
    audience: 'global-ace-gaming-users'
  });

  const refreshToken = jwt.sign(
    { userId: user._id.toString() },
    JWT_SECRET,
    {
      expiresIn: JWT_REFRESH_EXPIRES_IN,
      issuer: 'global-ace-gaming',
      audience: 'global-ace-gaming-refresh'
    }
  );

  return { accessToken, refreshToken };
};

export const verifyToken = (token: string): JWTPayload => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'global-ace-gaming',
      audience: 'global-ace-gaming-users'
    }) as JWTPayload;
  } catch (error) {
    throw new Error('Invalid or expired token');
  }
};

export const verifyRefreshToken = (token: string): { userId: string } => {
  try {
    return jwt.verify(token, JWT_SECRET, {
      issuer: 'global-ace-gaming',
      audience: 'global-ace-gaming-refresh'
    }) as { userId: string };
  } catch (error) {
    throw new Error('Invalid or expired refresh token');
  }
};
