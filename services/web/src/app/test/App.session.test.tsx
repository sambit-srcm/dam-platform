/** @vitest-environment jsdom */
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { mount } from '../../test/mount';
import { useAuthStore } from '../../features/auth/store';

const getMe = vi.hoisted(() => vi.fn());
vi.mock('../../features/auth/api', () => ({ getMe }));

const search = vi.hoisted(() => ({
  result: { page: { items: [], total: 0 }, error: null },
}));
vi.mock('../../features/assets/useAssetSearch', () => ({
  useAssetSearch: () => search.result,
}));
vi.mock('../../features/teams/api', () => ({
  listTeams: vi.fn().mockResolvedValue([]),
}));
vi.mock('../../features/assets/api', () => ({
  getTags: vi.fn().mockResolvedValue([]),
  getAssets: vi.fn(),
  getAssetView: vi.fn(),
  getDownloadUrl: vi.fn(),
}));
vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      get: vi.fn().mockResolvedValue({ data: { ok: true } }),
    },
  };
});

import { App } from '../App';

const user = {
  id: 'u1',
  email: 'a@b.co',
  role: 'user' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
};

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  useAuthStore.setState({ user: null, ready: false });
  getMe.mockResolvedValue(user);
});

afterEach(() => {
  view?.unmount();
});

describe('session restore', () => {
  it('restores the signed-in user', async () => {
    view = await mount(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(useAuthStore.getState().user?.email).toBe('a@b.co');
    expect(view.container.textContent).toContain('My gallery');
  });

  it('clears the session when /auth/me fails', async () => {
    getMe.mockRejectedValueOnce(new Error('expired'));
    view = await mount(
      <MemoryRouter>
        <App />
      </MemoryRouter>,
    );
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().ready).toBe(true);
  });
});
