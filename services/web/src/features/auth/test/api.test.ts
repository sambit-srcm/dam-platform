import { beforeEach, describe, expect, it } from 'vitest';
import { http } from '../../../lib/http';
import { login, register } from '../api';

let sent: { method: string; url: string; data: unknown }[] = [];

beforeEach(() => {
  sent = [];
  http.defaults.adapter = async (config) => {
    sent.push({
      method: (config.method ?? '').toUpperCase(),
      url: config.url ?? '',
      data: JSON.parse(config.data),
    });
    return {
      data: { token: 't', user: { id: 'u1' } },
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
    expect(result.token).toBe('t');
  });

  it('posts the email and password to /auth/register', async () => {
    const result = await register(credentials);
    expect(sent[0]).toMatchObject({ method: 'POST', url: '/auth/register' });
    expect(result.user.id).toBe('u1');
  });
});
