import type { Request, Response } from 'express';
import { clearAuthCookie, setAuthCookie } from '../../shared/lib/authCookie.ts';
import type { Context } from '../../shared/lib/context.ts';
import { currentUser } from '../../shared/middlewares/requireAuth.ts';
import { loginBody, registerBody } from './auth.schema.ts';
import { getMe, login, register } from './auth.service.ts';

export function registerController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const result = await register(ctx, registerBody.parse(req.body));

    setAuthCookie(res, result.token);
    req.log.info({ userId: result.user.id }, 'user registered');
    res.status(201).json({ user: result.user });
  };
}

export function loginController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const result = await login(ctx, loginBody.parse(req.body));

    setAuthCookie(res, result.token);
    req.log.info({ userId: result.user.id }, 'user logged in');
    res.json({ user: result.user });
  };
}

export function logoutController() {
  return (_req: Request, res: Response) => {
    clearAuthCookie(res);
    res.status(204).end();
  };
}

export function meController(ctx: Context) {
  return async (req: Request, res: Response) => {
    res.json(await getMe(ctx, currentUser(req).id));
  };
}
