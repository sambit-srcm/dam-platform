import { USER_ROLES, type UserRole } from '@dam/db';
import { SignJWT, jwtVerify } from 'jose';
import { config } from '../../config.ts';
import type { AuthUser } from './actor.ts';

const secret = new TextEncoder().encode(config.JWT_SECRET);

export async function signToken(user: AuthUser) {
  return new SignJWT({ role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(user.id)
    .setIssuedAt()
    .setExpirationTime(`${config.JWT_EXPIRES_IN_SECONDS}s`)
    .sign(secret);
}

// Throws if the token is forged, expired or missing the claims we rely on
export async function verifyToken(token: string): Promise<AuthUser> {
  const { payload } = await jwtVerify(token, secret, {
    algorithms: ['HS256'],
  });

  const role = payload.role as UserRole;
  if (!payload.sub || !USER_ROLES.includes(role)) {
    throw new Error('token is missing its claims');
  }
  return { id: payload.sub, role };
}
