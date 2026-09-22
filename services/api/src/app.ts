import express from 'express';
import type { Context } from './shared/lib/context.ts';
import { errorHandler } from './shared/middlewares/errorHandler.ts';
import { notFoundHandler } from './shared/middlewares/notFound.ts';
import { healthRoutes } from './health.ts';
import { requestLogger } from './shared/middlewares/requestLogger.ts';
import { assetRoutes } from './modules/assets/asset.routes.ts';

export function createApp(ctx: Context) {
  const app = express();

  // Nginx sits in front, so trust its forwarded headers
  app.set('trust proxy', 1);

  app.use(requestLogger);
  app.use(express.json({ limit: '1mb' }));

  app.use('/health', healthRoutes(ctx));
  app.use('/assets', assetRoutes(ctx));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
