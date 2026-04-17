import type { Request, Response, NextFunction } from 'express';
import type { UserRole } from '@prisma/client';
import { HttpError } from '../utils/HttpError.js';

export function requireRole(...allowed: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) return next(new HttpError(401, 'Unauthorized'));
    if (!allowed.includes(req.user.role)) {
      return next(new HttpError(403, 'Insufficient permissions'));
    }
    return next();
  };
}
