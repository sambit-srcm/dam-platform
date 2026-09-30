import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import {
  downloadController,
  getAssetController,
  listAssetsController,
  listTagsController,
  viewController,
} from './asset.controller.ts';

export function assetRoutes(ctx: Context) {
  const router = Router();

  // Before /:assetId, which would otherwise take "tags" for an id
  router.get('/tags', listTagsController(ctx));
  router.get('/:assetId', getAssetController(ctx));
  router.get('/', listAssetsController(ctx));
  router.get('/:assetId/view', viewController(ctx));
  router.post('/:assetId/download', downloadController(ctx));

  return router;
}
