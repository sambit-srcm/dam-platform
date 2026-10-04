import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { config } from './config.ts';
import type { Context } from './shared/lib/context.ts';
import { errorHandler } from './shared/middlewares/errorHandler.ts';
import { notFoundHandler } from './shared/middlewares/notFound.ts';
import { healthRoutes } from './health.ts';
import { docsRoutes } from './docs.ts';
import { createRateLimiters } from './shared/middlewares/rateLimit.ts';
import { requestLogger } from './shared/middlewares/requestLogger.ts';
import { assetRoutes } from './modules/assets/asset.routes.ts';
import { authRoutes } from './modules/auth/auth.routes.ts';
import { requireAuth } from './shared/middlewares/requireAuth.ts';
import { uploadRoutes } from './modules/uploads/upload.routes.ts';
import { adminRoutes } from './modules/admin/admin.routes.ts';
import { publicShareRoutes } from './modules/shares/share.routes.ts';
import { teamRoutes } from './modules/teams/team.routes.ts';

export function createApp(ctx: Context) {
  const app = express();

  // Nginx sits in front, so trust its forwarded headers
  app.set('trust proxy', 1);

  const limiters = createRateLimiters(ctx);

  app.use(requestLogger);

  // Security headers on every response.
  app.use(helmet());

  // Before auth, so browser preflight requests (which carry no token) get answered
  app.use(
    cors({
      origin: config.CORS_ORIGIN.split(',').map((origin) => origin.trim()),
      methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
      credentials: true,
      allowedHeaders: ['Authorization', 'Content-Type'],
      maxAge: 600,
    }),
  );

  // After cors, so a 429 still reaches the browser readable. Before the body is parsed.
  app.use(limiters.global);
  app.use(express.json({ limit: '1mb' }));

  // Probes and the spec stay unversioned. Everything else is under /v1.
  app.use('/health', healthRoutes(ctx));
  app.use('/docs', docsRoutes());

  const v1 = express.Router();
  v1.post('/auth/login', limiters.loginByAddress, limiters.loginByAccount);
  v1.post('/auth/register', limiters.register);
  v1.use('/auth', authRoutes(ctx));
  v1.use('/shares', publicShareRoutes(ctx));

  v1.use(requireAuth);
  v1.use(limiters.perUser);
  v1.use('/teams', teamRoutes(ctx));

  v1.post('/assets/uploads', limiters.uploadStart);
  v1.use('/assets/uploads', uploadRoutes(ctx));
  v1.use('/assets', assetRoutes(ctx));
  v1.use('/admin', adminRoutes(ctx));
  app.use('/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
