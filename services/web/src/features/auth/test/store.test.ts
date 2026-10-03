import { beforeEach, describe, expect, it } from 'vitest';
import { useAuthStore } from '../store';
import type { AuthUser } from '../types';

const alice: AuthUser = {
  id: 'u1',
  email: 'alice@example.com',
  role: 'user',
  createdAt: '2026-01-01T00:00:00.000Z',
};

beforeEach(() => {
  localStorage.clear();
  useAuthStore.setState({ user: null, ready: false });
});

describe('sign-in store', () => {
  it('starts with nobody signed in', () => {
    const { user, ready } = useAuthStore.getState();
    expect(user).toBeNull();
    expect(ready).toBe(false);
  });

  it('remembers the user after signing in', () => {
    useAuthStore.getState().setUser(alice);

    const { user, ready } = useAuthStore.getState();
    expect(user?.email).toBe('alice@example.com');
    expect(ready).toBe(true);
  });

  it('forgets the user on logout', () => {
    useAuthStore.getState().setUser(alice);
    useAuthStore.getState().clearUser();

    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().ready).toBe(true);
  });

  it('replaces the old user when someone else signs in', () => {
    useAuthStore.getState().setUser(alice);
    useAuthStore.getState().setUser({
      ...alice,
      id: 'u2',
      email: 'bob@example.com',
      role: 'admin',
    });

    expect(useAuthStore.getState().user?.email).toBe('bob@example.com');
  });

  it('does not put the session in localStorage', () => {
    useAuthStore.getState().setUser(alice);

    expect(localStorage.getItem('dam-auth')).toBeNull();
  });
});
