/** @vitest-environment jsdom */
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount } from '../../test/mount';

const search = vi.hoisted(() => ({
  result: {
    page: null as null | { items: unknown[]; total: number },
    error: null as string | null,
  },
}));
const teams = vi.hoisted(() => ({ listTeams: vi.fn() }));
const assets = vi.hoisted(() => ({
  getAssets: vi.fn(),
  getAssetView: vi.fn(),
  getDownloadUrl: vi.fn(),
  getTags: vi.fn(),
}));
const shares = vi.hoisted(() => ({
  getSharing: vi.fn(),
  listTeams: vi.fn(),
  grantTeam: vi.fn(),
  revokeTeam: vi.fn(),
  createShare: vi.fn(),
  revokeShare: vi.fn(),
}));

vi.mock('../../features/assets/useAssetSearch', () => ({
  useAssetSearch: () => search.result,
}));
vi.mock('../../features/teams/api', () => ({ listTeams: teams.listTeams }));
vi.mock('../../features/assets/api', () => assets);
vi.mock('../../features/shares/api', () => shares);

import { GalleryPage } from '../GalleryPage';

const asset = {
  id: 'a1',
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  status: 'ready' as const,
  tags: ['sea'],
  createdAt: '2026-09-28T08:30:00.000Z',
  thumbnailUrl: 'https://files.test/t.webp',
  access: 'owner' as const,
};

const assign = vi.fn();
let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  search.result = { page: { items: [asset], total: 1 }, error: null };
  teams.listTeams.mockResolvedValue([{ id: 't1', name: 'Editors' }]);
  assets.getTags.mockResolvedValue([]);
  assets.getAssetView.mockResolvedValue({
    kind: 'image',
    url: 'https://files.test/a.jpg',
  });
  assets.getDownloadUrl.mockResolvedValue('https://files.test/dl.jpg');
  shares.getSharing.mockResolvedValue({ teams: [], links: [] });
  assign.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign, origin: 'http://localhost:5173' },
  });
});

afterEach(() => {
  view?.unmount();
});

function page(path = '/') {
  return (
    <MemoryRouter initialEntries={[path]}>
      <GalleryPage />
    </MemoryRouter>
  );
}

describe('GalleryPage actions', () => {
  it('opens an owned asset with sharing', async () => {
    view = await mount(page());
    expect(view.container.textContent).toContain('Add to team');
    expect(view.container.textContent).toContain('Share link');
    await click(view.container.querySelector('[aria-label="View beach.jpg"]')!);
    expect(view.container.textContent).toContain('Share');
    expect(view.container.textContent).toContain('Grant access');
  });

  it('downloads the selected asset and reports a failure', async () => {
    view = await mount(page());
    await click(view.container.querySelector('[aria-label="View beach.jpg"]')!);
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Download',
      )!,
    );
    expect(assign).toHaveBeenCalledWith('https://files.test/dl.jpg');

    assets.getDownloadUrl.mockRejectedValueOnce(new Error('quota'));
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Download',
      )!,
    );
    expect(view.container.textContent).toContain('quota');
  });

  it('switches to the team gallery', async () => {
    search.result = { page: { items: [], total: 0 }, error: null };
    view = await mount(page('/?scope=team'));
    expect(view.container.textContent).toContain(
      'Nothing has been shared with your teams',
    );
    await click(
      [...view.container.querySelectorAll('[role="tab"]')].find(
        (button) => button.textContent === 'My gallery',
      )!,
    );
    expect(view.container.textContent).toContain('No assets match');
  });

  it('does not offer sharing on a team-granted asset', async () => {
    search.result = {
      page: { items: [{ ...asset, access: 'team' }], total: 1 },
      error: null,
    };
    view = await mount(page('/?scope=team'));
    await click(view.container.querySelector('[aria-label="View beach.jpg"]')!);
    expect(view.container.textContent).not.toContain('Grant access');
  });

  it('shows a team list error', async () => {
    teams.listTeams.mockRejectedValueOnce(new Error('teams down'));
    view = await mount(page());
    expect(view.container.textContent).toContain('teams down');
  });
});
