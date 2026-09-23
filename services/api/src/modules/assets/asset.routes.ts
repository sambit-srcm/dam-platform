import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { upload } from '../../shared/middlewares/upload.ts';
import {
  uploadAssetController,
  getAssetController,
} from './asset.controller.ts';

export function assetRoutes(ctx: Context) {
  const router = Router();

  router.post('/', upload.single('file'), uploadAssetController(ctx));
  router.get('/:assetId', getAssetController(ctx));
  return router;
}
