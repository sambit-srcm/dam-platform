import { beforeEach, describe, expect, it, vi } from 'vitest';
import { hashPassword } from '../../../shared/lib/password.ts';
import { verifyToken } from '../../../shared/lib/token.ts';
import { alice, makeCtx } from '../../../test/helpers.ts';

vi.mock('../auth.repository.ts', () => ({
  createUser: vi.fn(),
  findUserByEmail: vi.fn(),
  findUserById: vi.fn(),
}));

import {
  createUser,
  findUserByEmail,
  findUserById,
} from '../auth.repository.ts';
import { getMe, login, register } from '../auth.service.ts';

const { ctx } = makeCtx();

const storedUser = async (password = 'correct-horse') => ({
  id: alice.id,
  email: 'alice@example.com',
  role: 'user' as const,
  passwordHash: await hashPassword(password),
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: new Date('2026-01-01T00:00:00Z'),
});

beforeEach(() => {
  vi.resetAllMocks();
});

describe('signing up', () => {
  it('creates the account and signs the person straight in', async () => {
    vi.mocked(createUser).mockResolvedValue(await storedUser());

    const result = await register(ctx, {
      email: 'alice@example.com',
      password: 'correct-horse',
    });

    expect(result.user.email).toBe('alice@example.com');
    expect(await verifyToken(result.token)).toMatchObject({
      id: alice.id,
      role: 'user',
    });
  });

  it('never saves the password itself, only a scrambled version', async () => {
    vi.mocked(createUser).mockResolvedValue(await storedUser());
    await register(ctx, {
      email: 'alice@example.com',
      password: 'correct-horse',
    });

    const saved = vi.mocked(createUser).mock.calls[0]![1];
    expect(saved.passwordHash).not.toContain('correct-horse');
    expect(saved.passwordHash.length).toBeGreaterThan(20);
  });

  it('never sends the scrambled password back', async () => {
    vi.mocked(createUser).mockResolvedValue(await storedUser());
    const result = await register(ctx, {
      email: 'a@b.co',
      password: 'correct-horse',
    });

    expect(result.user).not.toHaveProperty('passwordHash');
  });

  it('says the email is taken when the database complains about a duplicate', async () => {
    vi.mocked(createUser).mockRejectedValue(
      Object.assign(new Error('dup'), { code: '23505' }),
    );

    await expect(
      register(ctx, { email: 'alice@example.com', password: 'correct-horse' }),
    ).rejects.toMatchObject({ status: 409 });
  });
});

describe('logging in', () => {
  it('works with the right password', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(await storedUser());

    const result = await login(ctx, {
      email: 'alice@example.com',
      password: 'correct-horse',
    });

    expect(result.user.id).toBe(alice.id);
    expect(result.token).toBeTruthy();
  });

  it('is refused with the wrong password', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(await storedUser());

    await expect(
      login(ctx, { email: 'alice@example.com', password: 'wrong-password' }),
    ).rejects.toMatchObject({ status: 401 });
  });

  it('gives the same answer for an unknown email, so nobody can find out who has an account', async () => {
    vi.mocked(findUserByEmail).mockResolvedValue(undefined as never);

    const unknown = await login(ctx, {
      email: 'ghost@example.com',
      password: 'whatever1',
    }).catch((e) => e);

    vi.mocked(findUserByEmail).mockResolvedValue(await storedUser());
    const wrong = await login(ctx, {
      email: 'alice@example.com',
      password: 'wrong-password',
    }).catch((e) => e);

    expect(unknown.status).toBe(401);
    expect(unknown.message).toBe(wrong.message);
  });
});

describe('looking up my own account', () => {
  it('returns the profile without the password', async () => {
    vi.mocked(findUserById).mockResolvedValue(await storedUser());

    const me = await getMe(ctx, alice.id);

    expect(me).toEqual({
      id: alice.id,
      email: 'alice@example.com',
      role: 'user',
      createdAt: new Date('2026-01-01T00:00:00Z'),
    });
  });

  it('says not found when the account was deleted', async () => {
    vi.mocked(findUserById).mockResolvedValue(undefined as never);
    await expect(getMe(ctx, alice.id)).rejects.toMatchObject({ status: 404 });
  });
});
