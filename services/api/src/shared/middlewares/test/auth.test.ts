import type { NextFunction, Request, Response } from 'express';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../lib/token.ts', () => ({ verifyToken: vi.fn() }));

import { ForbiddenError, UnauthorizedError } from '../../errors/AppError.ts';
import { verifyToken } from '../../lib/token.ts';
import { requireAuth } from '../requireAuth.ts';
import { requireRole } from '../requireRole.ts';

const alice = { id: 'u1', role: 'user' as const };
const admin = { id: 'u2', role: 'admin' as const };

const reqWith = (authorization?: string, user?: typeof alice | typeof admin) =>
  ({ headers: { authorization }, user }) as unknown as Request;
const res = {} as Response;

let next: ReturnType<typeof vi.fn> & NextFunction;

beforeEach(() => {
  vi.resetAllMocks();
  next = vi.fn() as typeof next;
});

describe('requireAuth', () => {
  it('rejects a request with no Authorization header', async () => {
    await requireAuth(reqWith(), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(UnauthorizedError));
    expect(verifyToken).not.toHaveBeenCalled();
  });

  it('puts the verified user on the request and moves on', async () => {
    vi.mocked(verifyToken).mockResolvedValue(alice);
    const req = reqWith('Bearer good');

    await requireAuth(req, res, next);

    expect(verifyToken).toHaveBeenCalledWith('good');
    expect(req.user).toEqual(alice);
    expect(next).toHaveBeenCalledWith();
  });

  it('turns a bad or expired token into a 401', async () => {
    vi.mocked(verifyToken).mockRejectedValue(new Error('jwt expired'));
    const req = reqWith('Bearer stale');

    await requireAuth(req, res, next);

    expect(req.user).toBeUndefined();
    expect(next.mock.calls[0]![0]).toMatchObject({
      status: 401,
      message: 'Invalid or expired token',
    });
  });
});

describe('requireRole', () => {
  it('lets a user with the role through', () => {
    requireRole('admin')(reqWith('Bearer x', admin), res, next);

    expect(next).toHaveBeenCalledWith();
  });

  it('sends a 403 to a user without the role', () => {
    requireRole('admin')(reqWith('Bearer x', alice), res, next);

    expect(next).toHaveBeenCalledWith(expect.any(ForbiddenError));
  });
});
