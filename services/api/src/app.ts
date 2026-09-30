import cors from 'cors';
import express from 'express';
import { config } from './config.ts';
import type { Context } from './shared/lib/context.ts';
import { errorHandler } from './shared/middlewares/errorHandler.ts';
import { notFoundHandler } from './shared/middlewares/notFound.ts';
import { healthRoutes } from './health.ts';
import { docsRoutes } from './docs.ts';
import { requestLogger } from './shared/middlewares/requestLogger.ts';
import { assetRoutes } from './modules/assets/asset.routes.ts';
import { authRoutes } from './modules/auth/auth.routes.ts';
import { requireAuth } from './shared/middlewares/requireAuth.ts';
import { uploadRoutes } from './modules/uploads/upload.routes.ts';
import { adminRoutes } from './modules/admin/admin.routes.ts';

export function createApp(ctx: Context) {
  const app = express();

  // Nginx sits in front, so trust its forwarded headers
  app.set('trust proxy', 1);

  app.use(requestLogger);

  // Before auth, so browser preflight requests (which carry no token) get answered
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );
  app.use(express.json({ limit: '1mb' }));

  // Public: probes and nginx need health without a login, people need /auth to get one, and the docs are open to read
  app.use('/health', healthRoutes(ctx));
  app.use('/auth', authRoutes(ctx));
  app.use('/docs', docsRoutes());

  // Everything mounted below this line needs a valid token
  app.use(requireAuth);

  app.use('/assets/uploads', uploadRoutes(ctx));
  app.use('/assets', assetRoutes(ctx));
  app.use('/admin', adminRoutes(ctx));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
