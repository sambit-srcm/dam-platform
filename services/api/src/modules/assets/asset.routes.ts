import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import {
  getAssetController,
  listAssetsController,
} from './asset.controller.ts';

export function assetRoutes(ctx: Context) {
  const router = Router();

  router.get('/:assetId', getAssetController(ctx));
  router.get('/', listAssetsController(ctx));

  return router;
}
