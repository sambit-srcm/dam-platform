import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/AppError.ts';
import type { AuthUser } from '../lib/actor.ts';
import { verifyToken } from '../lib/token.ts';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// Expects "Authorization: Bearer <token>" and fills req.user from it
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme !== 'Bearer' || !token) {
    return next(new UnauthorizedError('Missing bearer token'));
  }

  try {
    req.user = await verifyToken(token);
    next();
  } catch {
    next(new UnauthorizedError('Invalid or expired token'));
  }
}

// For handlers behind requireAuth, so they don't repeat the undefined check
export function currentUser(req: Request): AuthUser {
  if (!req.user) throw new UnauthorizedError();
  return req.user;
}
