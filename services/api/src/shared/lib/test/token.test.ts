import { SignJWT } from 'jose';
import { describe, expect, it } from 'vitest';
import { config } from '../../../config.ts';
import { signToken, verifyToken } from '../token.ts';

const user = {
  id: '11111111-1111-4111-8111-111111111111',
  role: 'user',
} as const;
const secret = new TextEncoder().encode(config.JWT_SECRET);

describe('login tokens', () => {
  it('give back the same person that was signed in', async () => {
    const token = await signToken(user);
    expect(await verifyToken(token)).toEqual(user);
  });

  it('remember that someone is an admin', async () => {
    const token = await signToken({ ...user, role: 'admin' });
    expect((await verifyToken(token)).role).toBe('admin');
  });

  it('are refused when someone changes a single character', async () => {
    const token = await signToken(user);
    const tampered = token.slice(0, -2) + (token.endsWith('a') ? 'bb' : 'aa');
    await expect(verifyToken(tampered)).rejects.toThrow();
  });

  it('are refused when signed with a different secret', async () => {
    const forged = await new SignJWT({ role: 'admin' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setExpirationTime('1h')
      .sign(
        new TextEncoder().encode('another-secret-that-is-also-long-enough'),
      );
    await expect(verifyToken(forged)).rejects.toThrow();
  });

  it('are refused once they have expired', async () => {
    const expired = await new SignJWT({ role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
      .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
      .sign(secret);
    await expect(verifyToken(expired)).rejects.toThrow();
  });

  it('are refused when they claim a role we do not have', async () => {
    const odd = await new SignJWT({ role: 'superuser' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setExpirationTime('1h')
      .sign(secret);
    await expect(verifyToken(odd)).rejects.toThrow(/missing its claims/);
  });

  it('are refused when they do not say who the person is', async () => {
    const anonymous = await new SignJWT({ role: 'user' })
      .setProtectedHeader({ alg: 'HS256' })
      .setExpirationTime('1h')
      .sign(secret);
    await expect(verifyToken(anonymous)).rejects.toThrow(/missing its claims/);
  });

  it('are refused when it is just some random text', async () => {
    await expect(verifyToken('not-a-token')).rejects.toThrow();
  });
});
