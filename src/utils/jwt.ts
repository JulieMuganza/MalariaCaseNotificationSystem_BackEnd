import jwt, { type SignOptions } from 'jsonwebtoken';
import type { UserRole } from '@prisma/client';
import { env } from '../config/env.js';

export type AccessPayload = {
  sub: string;
  role: UserRole;
  email: string;
};

const ISSUER = 'malaria-notification-api';

export function signAccessToken(payload: AccessPayload): string {
  const options: SignOptions = {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN as SignOptions['expiresIn'],
    issuer: ISSUER,
  };
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, options);
}

export function verifyAccessToken(token: string): AccessPayload {
  const decoded = jwt.verify(token, env.JWT_ACCESS_SECRET, {
    issuer: ISSUER,
  });
  if (typeof decoded === 'string' || !decoded || typeof decoded.sub !== 'string') {
    throw new Error('Invalid token payload');
  }
  return decoded as AccessPayload;
}
