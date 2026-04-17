import type { Request, Response, NextFunction } from 'express';
import type { ZodSchema } from 'zod';
import { HttpError } from '../utils/HttpError.js';

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return next(
        new HttpError(400, 'Validation failed', parsed.error.flatten())
      );
    }
    req.body = parsed.data as Request['body'];
    return next();
  };
}
