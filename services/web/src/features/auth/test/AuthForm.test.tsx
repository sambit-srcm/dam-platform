/** @vitest-environment jsdom */
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { change, mount, submit } from '../../../test/mount';
import { useAuthStore } from '../store';

const api = vi.hoisted(() => ({
  login: vi.fn(),
  register: vi.fn(),
}));

vi.mock('../api', () => api);

import { AuthForm } from '../AuthForm';
import { LoginPage } from '../../../pages/LoginPage';
import { RegisterPage } from '../../../pages/RegisterPage';

const user = {
  id: 'u1',
  email: 'a@b.co',
  role: 'user' as const,
  createdAt: '2026-01-01T00:00:00.000Z',
};

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  useAuthStore.setState({ user: null, ready: true });
  api.login.mockResolvedValue({ user });
  api.register.mockResolvedValue({ user });
});

afterEach(() => {
  view?.unmount();
});

describe('AuthForm', () => {
  it('signs in and stores the user', async () => {
    view = await mount(
      <MemoryRouter>
        <AuthForm mode="login" />
      </MemoryRouter>,
    );
    await change(view.container.querySelector('#email')!, 'a@b.co');
    await change(view.container.querySelector('#password')!, 'secret');
    await submit(view.container.querySelector('form')!);
    expect(api.login).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'secret',
    });
    expect(useAuthStore.getState().user?.email).toBe('a@b.co');
  });

  it('creates an account', async () => {
    view = await mount(
      <MemoryRouter>
        <AuthForm mode="register" />
      </MemoryRouter>,
    );
    expect(view.container.textContent).toContain('At least 8 characters');
    await change(view.container.querySelector('#email')!, 'a@b.co');
    await change(view.container.querySelector('#password')!, 'correct-horse');
    await submit(view.container.querySelector('form')!);
    expect(api.register).toHaveBeenCalledWith({
      email: 'a@b.co',
      password: 'correct-horse',
    });
  });

  it('shows the sign-in error', async () => {
    api.login.mockRejectedValueOnce(new Error('bad password'));
    view = await mount(
      <MemoryRouter>
        <AuthForm mode="login" />
      </MemoryRouter>,
    );
    await change(view.container.querySelector('#email')!, 'a@b.co');
    await change(view.container.querySelector('#password')!, 'nope');
    await submit(view.container.querySelector('form')!);
    expect(view.container.textContent).toContain('bad password');
  });

  it('hides login until the session check finishes, then redirects when signed in', async () => {
    useAuthStore.setState({ user: null, ready: false });
    view = await mount(
      <MemoryRouter>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(view.container.textContent).toBe('');
    view.unmount();
    useAuthStore.setState({ user, ready: true });
    view = await mount(
      <MemoryRouter initialEntries={['/login']}>
        <LoginPage />
      </MemoryRouter>,
    );
    expect(view.container.textContent).not.toContain('Sign in');
  });

  it('hides register until ready and redirects when signed in', async () => {
    useAuthStore.setState({ user: null, ready: false });
    view = await mount(
      <MemoryRouter>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(view.container.textContent).toBe('');
    view.unmount();
    useAuthStore.setState({ user, ready: true });
    view = await mount(
      <MemoryRouter initialEntries={['/register']}>
        <RegisterPage />
      </MemoryRouter>,
    );
    expect(view.container.textContent).not.toContain('Create account');
  });
});
