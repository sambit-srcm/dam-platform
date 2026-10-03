import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alice, makeCtx } from '../../../test/helpers.ts';
import { fakeReq, fakeRes } from '../../../test/support.ts';

vi.mock('../auth.service.ts', () => ({
  register: vi.fn(),
  login: vi.fn(),
  getMe: vi.fn(),
}));

import {
  loginController,
  logoutController,
  meController,
  registerController,
} from '../auth.controller.ts';
import { getMe, login, register } from '../auth.service.ts';

const session = { token: 'jwt', user: { id: 'u1', email: 'a@b.com' } };
let ctx: ReturnType<typeof makeCtx>['ctx'];

beforeEach(() => {
  vi.resetAllMocks();
  ctx = makeCtx().ctx;
});

describe('sign up endpoint', () => {
  it('creates the account and answers "201 created" with the session', async () => {
    vi.mocked(register).mockResolvedValue(session as never);
    const { req, log } = fakeReq({
      body: { email: 'a@b.com', password: 'longenough' },
    });
    const { res, mocks } = fakeRes();

    await registerController(ctx)(req, res);

    expect(mocks.status).toHaveBeenCalledWith(201);
    expect(mocks.json).toHaveBeenCalledWith({ user: session.user });
    expect(mocks.cookie).toHaveBeenCalledWith(
      'dam_token',
      'jwt',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(log.info).toHaveBeenCalledOnce();
  });

  it('tidies the email (spaces and capitals) before handing it on', async () => {
    vi.mocked(register).mockResolvedValue(session as never);
    const { req } = fakeReq({
      body: { email: '  A@B.com ', password: 'longenough' },
    });

    await registerController(ctx)(req, fakeRes().res);

    expect(register).toHaveBeenCalledWith(ctx, {
      email: 'a@b.com',
      password: 'longenough',
    });
  });

  it.each([
    [
      'a password shorter than 8 characters',
      { email: 'a@b.com', password: 'short' },
    ],
    [
      'an email that is not an email',
      { email: 'nope', password: 'longenough' },
    ],
    ['nothing at all', {}],
  ])('refuses %s without creating anyone', async (_name, body) => {
    const { req } = fakeReq({ body });

    await expect(registerController(ctx)(req, fakeRes().res)).rejects.toThrow();
    expect(register).not.toHaveBeenCalled();
  });
});

describe('sign in endpoint', () => {
  it('answers with the session and the normal "200 ok"', async () => {
    vi.mocked(login).mockResolvedValue(session as never);
    const { req, log } = fakeReq({
      body: { email: 'a@b.com', password: 'x' },
    });
    const { res, mocks } = fakeRes();

    await loginController(ctx)(req, res);

    expect(mocks.status).not.toHaveBeenCalled();
    expect(mocks.json).toHaveBeenCalledWith({ user: session.user });
    expect(mocks.cookie).toHaveBeenCalledWith(
      'dam_token',
      'jwt',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(log.info).toHaveBeenCalledOnce();
  });

  it('refuses a request with no password', async () => {
    const { req } = fakeReq({ body: { email: 'a@b.com' } });

    await expect(loginController(ctx)(req, fakeRes().res)).rejects.toThrow();
    expect(login).not.toHaveBeenCalled();
  });
});

describe('sign out endpoint', () => {
  it('clears the cookie and answers 204', () => {
    const { res, mocks } = fakeRes();

    logoutController()({} as never, res);

    expect(mocks.clearCookie).toHaveBeenCalledWith(
      'dam_token',
      expect.objectContaining({ httpOnly: true }),
    );
    expect(mocks.status).toHaveBeenCalledWith(204);
    expect(mocks.end).toHaveBeenCalledOnce();
  });
});

describe('"who am I" endpoint', () => {
  it('looks up the signed-in user and returns them', async () => {
    vi.mocked(getMe).mockResolvedValue({ id: alice.id } as never);
    const { req } = fakeReq({ user: alice });
    const { res, mocks } = fakeRes();

    await meController(ctx)(req, res);

    expect(getMe).toHaveBeenCalledWith(ctx, alice.id);
    expect(mocks.json).toHaveBeenCalledWith({ id: alice.id });
  });

  it('refuses when nobody is signed in', async () => {
    const { req } = fakeReq();

    await expect(meController(ctx)(req, fakeRes().res)).rejects.toMatchObject({
      status: 401,
    });
    expect(getMe).not.toHaveBeenCalled();
  });
});
