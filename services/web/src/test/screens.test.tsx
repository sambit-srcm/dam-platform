import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Server-side rendering only sees the store's starting state, so a stand-in
// lets each test choose who is signed in. Effects do not run here, so these
// tests look at what a screen shows the moment it first appears.
const session = vi.hoisted(() => ({
  state: { token: null, user: null } as {
    token: string | null;
    user: { email: string; role: string } | null;
    setSession: () => void;
    logout: () => void;
  },
}));

vi.mock('../features/auth/store', () => ({
  useAuthStore: (select: (state: typeof session.state) => unknown) =>
    select(session.state),
}));

import { AppLayout } from '../app/AppLayout';
import { AssetFilterBar } from '../features/assets/AssetFilterBar';
import { AssetViewer } from '../features/assets/AssetViewer';
import { AuthForm } from '../features/auth/AuthForm';
import { AdminAssetsPage } from '../pages/AdminAssetsPage';
import { AdminDashboardPage } from '../pages/AdminDashboardPage';
import { GalleryPage } from '../pages/GalleryPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { UploadPage } from '../pages/UploadPage';

const noop = () => {};

function signedInAs(role: string) {
  session.state = {
    token: 't',
    user: { email: `${role}@example.com`, role },
    setSession: noop,
    logout: noop,
  };
}

const show = (ui: React.ReactElement, path = '/') =>
  renderToStaticMarkup(<StaticRouter location={path}>{ui}</StaticRouter>);

beforeEach(() => {
  session.state = { token: null, user: null, setSession: noop, logout: noop };
});

describe('sign in and sign up forms', () => {
  it('shows the sign in form with a link to create an account', () => {
    const html = show(<AuthForm mode="login" />);
    expect(html).toContain('Sign in');
    expect(html).toContain('Create one');
    expect(html).toContain('href="/register"');
    expect(html).toContain('autoComplete="current-password"');
  });

  it('shows the sign up form with a password hint and a link back', () => {
    const html = show(<AuthForm mode="register" />);
    expect(html).toContain('Create account');
    expect(html).toContain('At least 8 characters');
    expect(html).toContain('minLength="8"');
    expect(html).toContain('href="/login"');
  });

  it('does not show the password hint on the sign in form', () => {
    expect(show(<AuthForm mode="login" />)).not.toContain('At least 8');
  });

  it('starts with no error message and an enabled button', () => {
    const html = show(<AuthForm mode="login" />);
    expect(html).not.toContain('role="alert"');
    expect(html).not.toContain('disabled=""');
  });

  it('shows the login page to someone who is signed out', () => {
    expect(show(<LoginPage />)).toContain('Sign in');
  });

  it('shows the register page to someone who is signed out', () => {
    expect(show(<RegisterPage />)).toContain('Create account');
  });

  it('sends a signed-in person away from the login page', () => {
    signedInAs('user');
    expect(show(<LoginPage />)).not.toContain('Sign in');
  });

  it('sends a signed-in person away from the register page', () => {
    signedInAs('user');
    expect(show(<RegisterPage />)).not.toContain('Create account');
  });
});

describe('the page frame', () => {
  it('shows the gallery and upload links and who is signed in', () => {
    signedInAs('user');
    const html = show(<AppLayout />);
    expect(html).toContain('Gallery');
    expect(html).toContain('Upload');
    expect(html).toContain('user@example.com');
    expect(html).toContain('Sign out');
  });

  it('hides the admin links from ordinary users', () => {
    signedInAs('user');
    const html = show(<AppLayout />);
    expect(html).not.toContain('Dashboard');
    expect(html).not.toContain('All assets');
  });

  it('shows the admin links to admins', () => {
    signedInAs('admin');
    const html = show(<AppLayout />);
    expect(html).toContain('Dashboard');
    expect(html).toContain('All assets');
  });

  it('starts by saying it is still checking the API', () => {
    signedInAs('user');
    expect(show(<AppLayout />)).toContain('API checking');
  });
});

describe('search and filter bar', () => {
  const render = (
    filters = {},
    props: { showStatus?: boolean } = {},
    path = '/',
  ) =>
    show(
      <AssetFilterBar
        filters={{ sort: 'createdAt', ...filters }}
        loadTags={async () => []}
        onChange={noop}
        {...props}
      />,
      path,
    );

  it('offers search, type, dates and sorting', () => {
    const html = render();
    expect(html).toContain('Search by name or tag');
    expect(html).toContain('All types');
    expect(html).toContain('Newest first');
    expect(html).toContain('Most downloaded');
    expect(html).toContain('From');
    expect(html).toContain('To');
  });

  it('offers every kind of file', () => {
    const html = render();
    for (const kind of ['image', 'video', 'document']) {
      expect(html).toContain(`>${kind}<`);
    }
  });

  it('hides the status choice unless asked to show it', () => {
    expect(render()).not.toContain('All statuses');
  });

  it('shows the status choice for admins', () => {
    const html = render({}, { showStatus: true });
    expect(html).toContain('All statuses');
    expect(html).toContain('>processing<');
  });

  it('does not offer "Clear filters" when nothing is filtered', () => {
    expect(render()).not.toContain('Clear filters');
  });

  it('offers "Clear filters" once something is filtered', () => {
    expect(render({ type: 'video' })).toContain('Clear filters');
    expect(render({ q: 'beach' })).toContain('Clear filters');
    expect(render({ tags: ['a'] })).toContain('Clear filters');
  });

  it('puts the current search text in the box', () => {
    expect(render({ q: 'holiday' })).toContain('value="holiday"');
  });

  it('stops the two dates from crossing over', () => {
    const html = render({ from: '2026-09-01', to: '2026-09-29' });
    expect(html).toContain('max="2026-09-29"');
    expect(html).toContain('min="2026-09-01"');
  });
});

describe('asset viewer window', () => {
  const viewer = (props = {}) =>
    show(
      <AssetViewer
        assetId="a1"
        filename="beach.jpg"
        loadView={async () => ({ kind: 'image', url: 'https://x' })}
        onClose={noop}
        {...props}
      />,
    );

  it('shows the file name and a loading message at first', () => {
    const html = viewer();
    expect(html).toContain('beach.jpg');
    expect(html).toContain('Loading…');
    expect(html).toContain('role="dialog"');
  });

  it('has a Close button', () => {
    expect(viewer()).toContain('Close');
  });

  it('shows Download only when downloading is allowed', () => {
    expect(viewer()).not.toContain('Download');
    expect(viewer({ onDownload: noop })).toContain('Download');
  });

  it('shows the tags of the asset', () => {
    const html = viewer({ tags: ['beach', 'sunset'] });
    expect(html).toContain('beach');
    expect(html).toContain('sunset');
  });
});

describe('pages', () => {
  it('gallery says it is loading and shows the filters', () => {
    signedInAs('user');
    const html = show(<GalleryPage />);
    expect(html).toContain('Loading…');
    expect(html).toContain('Search by name or tag');
    expect(html).not.toContain('All statuses');
  });

  it('admin asset list says it is loading and offers the status filter', () => {
    signedInAs('admin');
    const html = show(<AdminAssetsPage />);
    expect(html).toContain('All assets');
    expect(html).toContain('Loading…');
    expect(html).toContain('All statuses');
  });

  it('admin dashboard says it is loading', () => {
    signedInAs('admin');
    expect(show(<AdminDashboardPage />)).toContain('Loading');
  });

  it('upload page invites people to drop files, with the size limit', () => {
    const html = show(<UploadPage />);
    expect(html).toContain('Drop files here or click to browse');
    expect(html).toContain('up to 5 GB each');
    expect(html).toContain('multiple');
  });

  it('upload page starts with an empty list', () => {
    expect(show(<UploadPage />)).not.toContain('<li');
  });
});
