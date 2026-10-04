import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import {
  downloadShareController,
  previewShareController,
} from './share.controller.ts';

// Public. The token is the credential, and it is not a user session.
export function publicShareRoutes(ctx: Context) {
  const router = Router();
  router.get('/:token', previewShareController(ctx));
  router.post('/:token/download', downloadShareController(ctx));
  return router;
}
