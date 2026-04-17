import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { apiRouter } from './routes/index.js';
import { errorHandler } from './middleware/errorHandler.js';

function normalizeOrigin(value: string): string {
  try {
    return new URL(value).origin;
  } catch {
    return value.replace(/\/+$/, '');
  }
}

export function createApp() {
  const app = express();
  const allowedFrontendOrigin = normalizeOrigin(env.FRONTEND_URL);
  app.use(helmet());
  app.use(
    cors({
      // Dev: Vite may use any port (5173, 5174, …). Production: single FRONTEND_URL.
      origin: (origin, cb) => {
        if (!origin) {
          cb(null, true);
          return;
        }
        const normalized = normalizeOrigin(origin);
        if (env.NODE_ENV === 'development') {
          if (/^http:\/\/localhost:\d+$/.test(normalized)) {
            cb(null, true);
            return;
          }
        }
        cb(null, normalized === allowedFrontendOrigin);
      },
      credentials: true,
    })
  );
  app.use(express.json({ limit: '2mb' }));

  app.use('/api/v1', apiRouter);

  app.use(errorHandler);
  return app;
}
