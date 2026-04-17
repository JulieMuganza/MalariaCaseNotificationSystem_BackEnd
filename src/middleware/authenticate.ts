import type { Request, Response, NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.js';
import { HttpError } from '../utils/HttpError.js';

export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) {
    return next(new HttpError(401, 'Missing or invalid Authorization header'));
  }
  const token = h.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
    return next();
  } catch {
    return next(new HttpError(401, 'Invalid or expired access token'));
  }
}

export function optionalAuthenticate(req: Request, _res: Response, next: NextFunction) {
  const h = req.headers.authorization;
  if (!h?.startsWith('Bearer ')) return next();
  const token = h.slice('Bearer '.length).trim();
  try {
    const payload = verifyAccessToken(token);
    req.user = {
      id: payload.sub,
      role: payload.role,
      email: payload.email,
    };
  } catch {
    /* ignore */
  }
  return next();
}
