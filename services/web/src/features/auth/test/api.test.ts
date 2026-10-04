import { beforeEach, describe, expect, it } from 'vitest';
import { http } from '../../../lib/http';
import { getMe, login, logout, register } from '../api';

let sent: { method: string; url: string; data: unknown }[] = [];

beforeEach(() => {
  sent = [];
  http.defaults.adapter = async (config) => {
    sent.push({
      method: (config.method ?? '').toUpperCase(),
      url: config.url ?? '',
      data: config.data === undefined ? undefined : JSON.parse(config.data),
    });
    return {
      data: { user: { id: 'u1' } },
      status: 200,
      statusText: 'OK',
      headers: {},
      config,
    };
  };
});

const credentials = { email: 'a@b.co', password: 'correct-horse' };

describe('sign-in API calls', () => {
  it('posts the email and password to /auth/login', async () => {
    const result = await login(credentials);
    expect(sent[0]).toEqual({
      method: 'POST',
      url: '/auth/login',
      data: credentials,
    });
    expect(result.user.id).toBe('u1');
  });

  it('posts the email and password to /auth/register', async () => {
    const result = await register(credentials);
    expect(sent[0]).toMatchObject({ method: 'POST', url: '/auth/register' });
    expect(result.user.id).toBe('u1');
  });

  it('loads the current user and signs out', async () => {
    await expect(getMe()).resolves.toMatchObject({ user: { id: 'u1' } });
    expect(sent[0]).toMatchObject({ method: 'GET', url: '/auth/me' });
    await logout();
    expect(sent[1]).toMatchObject({ method: 'POST', url: '/auth/logout' });
  });
});
