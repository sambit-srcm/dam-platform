import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { requireRole } from '../../shared/middlewares/requireRole.ts';
import { adminTeamRoutes } from '../teams/team.routes.ts';
import {
  dashboardController,
  getAdminAssetController,
  listAdminAssetsController,
  listAllTagsController,
} from './admin.controller.ts';

export function adminRoutes(ctx: Context) {
  const router = Router();

  // First line on purpose: every admin route added below is covered by it
  router.use(requireRole('admin'));

  router.use('/teams', adminTeamRoutes(ctx));
  router.get('/dashboard', dashboardController(ctx));
  router.get('/assets', listAdminAssetsController(ctx));
  router.get('/tags', listAllTagsController(ctx));
  router.get('/assets/:assetId', getAdminAssetController(ctx));

  return router;
}
