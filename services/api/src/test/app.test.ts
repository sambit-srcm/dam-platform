import type { AddressInfo } from 'node:net';
import type { Server } from 'node:http';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

// Stands in for the admin handlers, so reaching one needs no database
vi.mock('../modules/admin/admin.controller.ts', () => {
  const reached =
    () => (_req: unknown, res: { json: (body: unknown) => void }) =>
      res.json({ reached: true });
  return {
    dashboardController: reached,
    getAdminAssetController: reached,
    listAdminAssetsController: reached,
    listAllTagsController: reached,
  };
});

import { createApp } from '../app.ts';
import type { Context } from '../shared/lib/context.ts';
import { signToken } from '../shared/lib/token.ts';

let server: Server;
let base: string;

beforeAll(async () => {
  // Requests stopped by auth never touch the context
  server = createApp({} as Context).listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const call = (path: string, token?: string) =>
  fetch(`${base}${path}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

const userToken = () => signToken({ id: 'u1', role: 'user' });
const adminToken = () => signToken({ id: 'u2', role: 'admin' });

describe('routes that need a login', () => {
  it.each([
    ['GET', '/assets'],
    ['GET', '/assets/tags'],
    ['POST', '/assets/uploads'],
    ['GET', '/admin/dashboard'],
    ['GET', '/admin/assets'],
  ])('%s %s answers 401 without a token', async (method, path) => {
    const res = await fetch(`${base}${path}`, { method });

    expect(res.status).toBe(401);
    expect((await res.json()).error.code).toBe('unauthorized');
  });

  it('answers 401 to a forged token', async () => {
    const res = await call('/assets', 'not.a.real-token');

    expect(res.status).toBe(401);
  });
});

describe('admin routes', () => {
  it('turn away a signed-in normal user with 403', async () => {
    const res = await call('/admin/dashboard', await userToken());

    expect(res.status).toBe(403);
    expect((await res.json()).error.code).toBe('forbidden');
  });

  it('let an admin through', async () => {
    const res = await call('/admin/dashboard', await adminToken());

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ reached: true });
  });
});

describe('public routes', () => {
  it('serve health without a token', async () => {
    const res = await call('/health/live');

    expect(res.status).toBe(200);
  });
});
