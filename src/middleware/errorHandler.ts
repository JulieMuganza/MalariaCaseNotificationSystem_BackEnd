import type { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { HttpError } from '../utils/HttpError.js';
import { env } from '../config/env.js';

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction
) {
  if (err instanceof HttpError) {
    return res.status(err.status).json({
      error: {
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
  }
  if (err instanceof ZodError) {
    return res.status(400).json({
      error: {
        message: 'Validation failed',
        details: err.flatten(),
      },
    });
  }
  console.error(err);
  return res.status(500).json({
    error: {
      message:
        env.NODE_ENV === 'production' ? 'Internal server error' : String(err),
    },
  });
}
