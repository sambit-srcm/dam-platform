/** @vitest-environment jsdom */
import axios from 'axios';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount } from '../../test/mount';
import { useAuthStore } from '../../features/auth/store';

const logout = vi.hoisted(() => vi.fn());
vi.mock('../../features/auth/api', () => ({ logout }));
vi.mock('axios', () => ({
  default: { get: vi.fn() },
}));

import { AppLayout } from '../AppLayout';

const user = {
  id: 'u1',
  email: 'a@b.co',
  role: 'user' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
};

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  useAuthStore.setState({ user, ready: true });
  logout.mockResolvedValue(undefined);
  vi.mocked(axios.get).mockResolvedValue({ data: { ok: true } });
});

afterEach(() => {
  view?.unmount();
});

function layout() {
  return (
    <MemoryRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<p>Home</p>} />
        </Route>
      </Routes>
    </MemoryRouter>
  );
}

describe('AppLayout', () => {
  it('shows a connected API and signs out', async () => {
    view = await mount(layout());
    expect(view.container.textContent).toContain('API connected');
    expect(view.container.textContent).toContain('a@b.co');
    expect(view.container.textContent).not.toContain('Teams');
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Sign out',
      )!,
    );
    expect(logout).toHaveBeenCalled();
    expect(useAuthStore.getState().user).toBeNull();
  });

  it('shows admin links and an unavailable API', async () => {
    useAuthStore.setState({
      user: { ...user, role: 'admin' },
      ready: true,
    });
    vi.mocked(axios.get).mockRejectedValueOnce(new Error('down'));
    view = await mount(layout());
    expect(view.container.textContent).toContain('Dashboard');
    expect(view.container.textContent).toContain('All assets');
    expect(view.container.textContent).toContain('Teams');
    expect(view.container.textContent).toContain('API unavailable');
  });
});
