import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import {
  downloadController,
  getAssetController,
  listAssetsController,
} from './asset.controller.ts';

export function assetRoutes(ctx: Context) {
  const router = Router();

  router.get('/:assetId', getAssetController(ctx));
  router.get('/', listAssetsController(ctx));
  router.post('/:assetId/download', downloadController(ctx));

  return router;
}
