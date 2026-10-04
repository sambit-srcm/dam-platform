import type { CookieOptions, Request, Response } from 'express';
import { config } from '../../config.ts';

export const AUTH_COOKIE = 'dam_token';

export function readAuthCookie(req: Request) {
  const header = req.headers.cookie;
  if (!header) return undefined;

  for (const part of header.split(';')) {
    const splitAt = part.indexOf('=');
    if (splitAt === -1) continue;
    const name = part.slice(0, splitAt).trim();
    if (name !== AUTH_COOKIE) continue;
    return decodeURIComponent(part.slice(splitAt + 1).trim());
  }

  return undefined;
}

// HttpOnly keeps the token away from page scripts. Strict means other sites cannot make
// the browser attach it, which is what stops cross-site request forgery.
const options: CookieOptions = {
  httpOnly: true,
  secure: config.COOKIE_SECURE,
  sameSite: 'strict',
  path: '/',
};

export function setAuthCookie(res: Response, token: string) {
  res.cookie(AUTH_COOKIE, token, {
    ...options,
    maxAge: config.JWT_EXPIRES_IN_SECONDS * 1000,
  });
}

export function clearAuthCookie(res: Response) {
  res.clearCookie(AUTH_COOKIE, options);
}
