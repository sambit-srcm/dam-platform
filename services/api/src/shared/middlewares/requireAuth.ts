import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../errors/AppError.ts';
import type { AuthUser } from '../lib/actor.ts';
import { readAuthCookie } from '../lib/authCookie.ts';
import { verifyToken } from '../lib/token.ts';

function presentedToken(req: Request) {
  const cookie = readAuthCookie(req);
  if (cookie) return cookie;

  const [scheme, token] = req.headers.authorization?.split(' ') ?? [];
  if (scheme === 'Bearer' && token) return token;
  return undefined;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

// The browser sends the HttpOnly cookie. A non-browser client may still send a bearer token.
export async function requireAuth(
  req: Request,
  _res: Response,
  next: NextFunction,
) {
  const token = presentedToken(req);
  if (!token) {
    return next(new UnauthorizedError('Authentication required'));
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
