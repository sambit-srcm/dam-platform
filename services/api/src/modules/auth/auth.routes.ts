import { Router } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { requireAuth } from '../../shared/middlewares/requireAuth.ts';
import {
  loginController,
  meController,
  registerController,
} from './auth.controller.ts';

export function authRoutes(ctx: Context) {
  const router = Router();

  router.post('/register', registerController(ctx));
  router.post('/login', loginController(ctx));
  router.get('/me', requireAuth, meController(ctx));

  return router;
}
