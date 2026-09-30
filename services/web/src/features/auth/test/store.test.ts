import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store';
import type { AuthResponse } from '../types';

const session: AuthResponse = {
  token: 'abc.def.ghi',
  user: {
    id: 'u1',
    email: 'alice@example.com',
    role: 'user',
    createdAt: '2026-01-01T00:00:00.000Z',
  },
};

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ token: null, user: null });
});

describe('sign-in store', () => {
  it('starts with nobody signed in', () => {
    const { token, user } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  it('remembers the token and the user after signing in', () => {
    useAuthStore.getState().setSession(session);

    const { token, user } = useAuthStore.getState();
    expect(token).toBe('abc.def.ghi');
    expect(user?.email).toBe('alice@example.com');
  });

  it('forgets everything on logout', () => {
    useAuthStore.getState().setSession(session);
    useAuthStore.getState().logout();

    const { token, user } = useAuthStore.getState();
    expect(token).toBeNull();
    expect(user).toBeNull();
  });

  it('replaces the old user when someone else signs in', () => {
    useAuthStore.getState().setSession(session);
    useAuthStore.getState().setSession({
      token: 'second-token',
      user: {
        ...session.user,
        id: 'u2',
        email: 'bob@example.com',
        role: 'admin',
      },
    });

    expect(useAuthStore.getState().user?.email).toBe('bob@example.com');
    expect(useAuthStore.getState().token).toBe('second-token');
  });

  it('saves the session in the browser so a refresh keeps the user signed in', () => {
    useAuthStore.getState().setSession(session);

    const saved = JSON.parse(localStorage.getItem('dam-auth')!);
    expect(saved.state.token).toBe('abc.def.ghi');
    expect(saved.state.user.email).toBe('alice@example.com');
  });

  it('clears the saved session on logout', () => {
    useAuthStore.getState().setSession(session);
    useAuthStore.getState().logout();

    const saved = JSON.parse(localStorage.getItem('dam-auth')!);
    expect(saved.state.token).toBeNull();
  });

  it('does not save the action functions, only the data', () => {
    useAuthStore.getState().setSession(session);

    const saved = JSON.parse(localStorage.getItem('dam-auth')!);
    expect(saved.state.setSession).toBeUndefined();
    expect(saved.state.logout).toBeUndefined();
  });
});
