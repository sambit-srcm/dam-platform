import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import {
  downloadController,
  getAssetController,
  listAssetsController,
  listTagsController,
  viewController,
} from './asset.controller.ts';
import {
  createShareController,
  grantTeamController,
  listSharingController,
  revokeShareController,
  revokeTeamController,
} from '../shares/share.controller.ts';

export function assetRoutes(ctx: Context) {
  const router = Router();

  // Before /:assetId, which would otherwise take "tags" for an id
  router.get('/tags', listTagsController(ctx));
  router.get('/:assetId/sharing', listSharingController(ctx));
  router.put('/:assetId/teams/:teamId', grantTeamController(ctx));
  router.delete('/:assetId/teams/:teamId', revokeTeamController(ctx));
  router.post('/:assetId/shares', createShareController(ctx));
  router.delete('/:assetId/shares/:shareId', revokeShareController(ctx));
  router.get('/:assetId', getAssetController(ctx));
  router.get('/', listAssetsController(ctx));
  router.get('/:assetId/view', viewController(ctx));
  router.post('/:assetId/download', downloadController(ctx));

  return router;
}
