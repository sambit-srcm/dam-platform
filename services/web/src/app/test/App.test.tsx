import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const session = vi.hoisted(() => ({
  state: { user: null, ready: true } as {
    user: { email: string; role: string } | null;
    ready: boolean;
    setUser: () => void;
    clearUser: () => void;
  },
}));

vi.mock('../../features/auth/store', () => ({
  useAuthStore: (select: (state: typeof session.state) => unknown) =>
    select(session.state),
}));

import { App } from '../App';

const noop = () => {};
const signedInAs = (role: string) => {
  session.state = {
    user: { email: `${role}@example.com`, role },
    ready: true,
    setUser: noop,
    clearUser: noop,
  };
};

const open = (path: string) =>
  renderToStaticMarkup(
    <StaticRouter location={path}>
      <App />
    </StaticRouter>,
  );

beforeEach(() => {
  session.state = { user: null, ready: true, setUser: noop, clearUser: noop };
});

describe('which screen each address shows', () => {
  it('shows the sign in form at /login', () => {
    expect(open('/login')).toContain('No account yet?');
  });

  it('shows the sign up form at /register', () => {
    expect(open('/register')).toContain('At least 8 characters');
  });

  it('shows the gallery inside the page frame at /', () => {
    signedInAs('user');
    const html = open('/');
    expect(html).toContain('Sign out');
    expect(html).toContain('Search by name or tag');
  });

  it('shows the upload page at /upload', () => {
    signedInAs('user');
    expect(open('/upload')).toContain('Drop files here');
  });

  it('shows nothing private at / when signed out', () => {
    const html = open('/');
    expect(html).not.toContain('Search by name or tag');
    expect(html).not.toContain('Sign out');
  });

  it('shows the admin asset list to an admin', () => {
    signedInAs('admin');
    expect(open('/admin/assets')).toContain('All statuses');
  });

  it('shows the dashboard route to an admin, loading at first', () => {
    signedInAs('admin');
    expect(open('/admin')).toContain('Loading');
  });

  it('keeps ordinary users out of the admin pages', () => {
    signedInAs('user');
    expect(open('/admin/assets')).not.toContain('All statuses');
    expect(open('/admin')).not.toContain('Loading');
  });
});
