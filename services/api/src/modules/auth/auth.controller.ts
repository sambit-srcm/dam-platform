import type { Request, Response } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { currentUser } from '../../shared/middlewares/requireAuth.ts';
import { loginBody, registerBody } from './auth.schema.ts';
import { getMe, login, register } from './auth.service.ts';

export function registerController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const result = await register(ctx, registerBody.parse(req.body));

    req.log.info({ userId: result.user.id }, 'user registered');
    res.status(201).json(result);
  };
}

export function loginController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const result = await login(ctx, loginBody.parse(req.body));

    req.log.info({ userId: result.user.id }, 'user logged in');
    res.json(result);
  };
}

export function meController(ctx: Context) {
  return async (req: Request, res: Response) => {
    res.json(await getMe(ctx, currentUser(req).id));
  };
}
