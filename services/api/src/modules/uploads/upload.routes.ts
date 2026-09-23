import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import {
  abortUploadController,
  completeUploadController,
  recordPartController,
  signPartsController,
  startUploadController,
  uploadStatusController,
} from './upload.controller.ts';

export function uploadRoutes(ctx: Context) {
  const router = Router();

  router.post('/', startUploadController(ctx));
  router.get('/:assetId', uploadStatusController(ctx));
  router.post('/:assetId/parts', signPartsController(ctx));
  router.post('/:assetId/parts/recorded', recordPartController(ctx));
  router.post('/:assetId/complete', completeUploadController(ctx));
  router.delete('/:assetId', abortUploadController(ctx));

  return router;
}
