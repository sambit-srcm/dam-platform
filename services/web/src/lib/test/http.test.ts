import type { InternalAxiosRequestConfig } from 'axios';
import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../../features/auth/store';
import type { AuthUser } from '../../features/auth/types';
import { getErrorMessage, http } from '../http';

const user: AuthUser = {
  id: 'u1',
  email: 'alice@example.com',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

// Pretends to be the server: answers every call with the status we choose,
// and remembers what the browser sent so we can look at it afterwards
function fakeServer(status: number, body: unknown = {}) {
  const sent: InternalAxiosRequestConfig[] = [];
  http.defaults.adapter = async (config) => {
    sent.push(config);
    const response = {
      data: body,
      status,
      statusText: '',
      headers: {},
      config,
    };
    if (status >= 400) {
      throw new AxiosError(
        `Request failed with status code ${status}`,
        'ERR_BAD_REQUEST',
        config,
        null,
        response,
      );
    }
    return response;
  };
  return sent;
}

beforeEach(() => {
  useAuthStore.setState({ user: null, ready: true });
});

describe('sending requests', () => {
  it('talks to the versioned /api address', async () => {
    const sent = fakeServer(200);
    await http.get('/assets');
    expect(http.defaults.baseURL).toBe('/api/v1');
    expect(sent[0]!.url).toBe('/assets');
  });

  it('sends the session cookie instead of a bearer token', async () => {
    useAuthStore.setState({ user, ready: true });
    const sent = fakeServer(200);
    await http.get('/assets');
    expect(sent[0]!.withCredentials).toBe(true);
    expect(sent[0]!.headers.Authorization).toBeUndefined();
  });

  it('sends no bearer token when nobody is signed in', async () => {
    const sent = fakeServer(200);
    await http.get('/assets');
    expect(sent[0]!.headers.Authorization).toBeUndefined();
  });
});

describe('when the server says the token is no good (401)', () => {
  it('signs the user out', async () => {
    useAuthStore.setState({ user, ready: true });
    fakeServer(401);

    await expect(http.get('/assets')).rejects.toThrow();

    expect(useAuthStore.getState().user).toBeNull();
  });

  it('still lets the caller see the error', async () => {
    useAuthStore.setState({ user, ready: true });
    fakeServer(401, { error: { message: 'Token expired' } });

    const error = await http.get('/assets').catch((e: unknown) => e);

    expect(getErrorMessage(error)).toBe('Token expired');
  });

  it('does nothing extra on the login page, where nobody is signed in yet', async () => {
    fakeServer(401, { error: { message: 'Wrong email or password' } });

    await expect(http.post('/auth/login')).rejects.toThrow();

    expect(useAuthStore.getState().user).toBeNull();
  });
});

describe('other failures', () => {
  it('keeps the user signed in after a 403', async () => {
    useAuthStore.setState({ user, ready: true });
    fakeServer(403);

    await expect(http.get('/admin/assets')).rejects.toThrow();

    expect(useAuthStore.getState().user).toEqual(user);
  });

  it('keeps the user signed in after a server error', async () => {
    useAuthStore.setState({ user, ready: true });
    fakeServer(500);

    await expect(http.get('/assets')).rejects.toThrow();

    expect(useAuthStore.getState().user).toEqual(user);
  });
});

describe('getErrorMessage', () => {
  it('shows the message the API sent', () => {
    const error = new AxiosError(
      'Request failed',
      'ERR_BAD_REQUEST',
      undefined,
      null,
      {
        data: { error: { code: 'not_found', message: 'Asset not found' } },
        status: 404,
        statusText: '',
        headers: {},
        config: {} as InternalAxiosRequestConfig,
      },
    );
    expect(getErrorMessage(error)).toBe('Asset not found');
  });

  it('falls back to the network message when the API said nothing useful', () => {
    const error = new AxiosError('Network Error');
    expect(getErrorMessage(error)).toBe('Network Error');
  });

  it('uses the message of an ordinary error', () => {
    expect(getErrorMessage(new Error('Boom'))).toBe('Boom');
  });

  it('gives a friendly default for anything else', () => {
    expect(getErrorMessage('weird')).toBe('Something went wrong');
    expect(getErrorMessage(undefined)).toBe('Something went wrong');
  });
});
