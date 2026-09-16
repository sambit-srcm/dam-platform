import express from 'express';
import type { Context } from './context.ts';
import { errorHandler, notFoundHandler } from './errors.ts';
import { requestLogger } from './logger.ts';
import { assetRoutes } from './routes/assets.ts';

export function createApp(ctx: Context) {
  const app = express();

  // Nginx sits in front, so trust its forwarded headers
  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.use('/assets', assetRoutes(ctx));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
