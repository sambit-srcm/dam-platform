import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { upload } from '../../shared/middlewares/upload.ts';
import { uploadAssetController } from './asset.controller.ts';

export function assetRoutes(ctx: Context) {
  const router = Router();

  router.post('/', upload.single('file'), uploadAssetController(ctx));

  return router;
}
