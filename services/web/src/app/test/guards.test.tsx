import { renderToStaticMarkup } from 'react-dom/server';
import { Route, Routes, StaticRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../features/auth/types';
import { RequireAdmin } from '../RequireAdmin';
import { RequireAuth } from '../RequireAuth';

// Server-side rendering always reads the store's starting state, so the real store
// can't play a signed-in user here. This stand-in lets each test choose who is signed in.
const session = vi.hoisted(() => ({
  state: { token: null, user: null } as {
    token: string | null;
    user: { role: string } | null;
  },
}));

vi.mock('../../features/auth/store', () => ({
  useAuthStore: (select: (state: typeof session.state) => unknown) =>
    select(session.state),
}));

const person = (role: AuthUser['role']): AuthUser => ({
  id: 'u1',
  email: 'someone@example.com',
  role,
  createdAt: '2026-01-01T00:00:00.000Z',
});

const signIn = (role: AuthUser['role']) => {
  session.state = { token: 'token', user: person(role) };
};

// Opens the given address inside the guard and reports what ends up on screen
function visit(guard: 'auth' | 'admin', path: string) {
  const Guard = guard === 'auth' ? RequireAuth : RequireAdmin;
  return renderToStaticMarkup(
    <StaticRouter location={path}>
      <Routes>
        <Route element={<Guard />}>
          <Route path="/secret" element={<p>SECRET PAGE</p>} />
        </Route>
        <Route path="*" element={<p>SOMEWHERE ELSE</p>} />
      </Routes>
    </StaticRouter>,
  );
}

beforeEach(() => {
  session.state = { token: null, user: null };
});

describe('RequireAuth (pages for signed-in users)', () => {
  it('shows the page to a signed-in user', () => {
    signIn('user');
    expect(visit('auth', '/secret')).toContain('SECRET PAGE');
  });

  it('hides the page from someone who is not signed in', () => {
    expect(visit('auth', '/secret')).not.toContain('SECRET PAGE');
  });

  it('shows the page to an admin too', () => {
    signIn('admin');
    expect(visit('auth', '/secret')).toContain('SECRET PAGE');
  });
});

describe('RequireAdmin (pages for admins only)', () => {
  it('shows the page to an admin', () => {
    signIn('admin');
    expect(visit('admin', '/secret')).toContain('SECRET PAGE');
  });

  it('hides the page from an ordinary user', () => {
    signIn('user');
    expect(visit('admin', '/secret')).not.toContain('SECRET PAGE');
  });

  it('hides the page from someone who is not signed in', () => {
    expect(visit('admin', '/secret')).not.toContain('SECRET PAGE');
  });
});
