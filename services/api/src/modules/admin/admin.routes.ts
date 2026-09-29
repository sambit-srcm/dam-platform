import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { requireRole } from '../../shared/middlewares/requireRole.ts';
import { listAdminAssetsController } from './admin.controller.ts';

export function adminRoutes(ctx: Context) {
  const router = Router();

  // First line on purpose: every admin route added below is covered by it
  router.use(requireRole('admin'));

  router.get('/assets', listAdminAssetsController(ctx));

  return router;
}
