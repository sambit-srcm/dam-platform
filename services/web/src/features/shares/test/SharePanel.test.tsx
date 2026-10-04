/** @vitest-environment jsdom */
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { change, click, mount, submit } from '../../../test/mount';

const api = vi.hoisted(() => ({
  listTeams: vi.fn(),
  getSharing: vi.fn(),
  grantTeam: vi.fn(),
  revokeTeam: vi.fn(),
  createShare: vi.fn(),
  revokeShare: vi.fn(),
}));

vi.mock('../../teams/api', () => ({ listTeams: api.listTeams }));
vi.mock('../api', () => ({
  getSharing: api.getSharing,
  grantTeam: api.grantTeam,
  revokeTeam: api.revokeTeam,
  createShare: api.createShare,
  revokeShare: api.revokeShare,
}));

import { SharePanel } from '../SharePanel';

const sharing = {
  teams: [
    {
      teamId: 't1',
      teamName: 'Editors',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  links: [
    {
      id: 's1',
      canDownload: true,
      expiresAt: '2026-10-06T12:00:00.000Z',
      revokedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
    {
      id: 's2',
      canDownload: false,
      expiresAt: '2026-10-06T12:00:00.000Z',
      revokedAt: '2026-10-05T00:00:00.000Z',
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
};

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  api.listTeams.mockResolvedValue([{ id: 't1', name: 'Editors' }]);
  api.getSharing.mockResolvedValue(sharing);
  api.grantTeam.mockResolvedValue(undefined);
  api.revokeTeam.mockResolvedValue(undefined);
  api.createShare.mockResolvedValue({
    id: 's3',
    token: 'secret',
    canDownload: false,
    expiresAt: '2026-10-06T00:00:00.000Z',
  });
  api.revokeShare.mockResolvedValue(undefined);
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { origin: 'http://localhost:5173' },
  });
});

afterEach(() => {
  view?.unmount();
});

describe('SharePanel', () => {
  it('loads teams and existing grants', async () => {
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    expect(view.container.textContent).toContain('Editors');
    expect(view.container.textContent).toContain('Revoked');
    expect(view.container.textContent).toContain('download');
    expect(view.container.textContent).toContain('preview only');
  });

  it('shows a load error', async () => {
    api.listTeams.mockRejectedValueOnce(new Error('offline'));
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    expect(view.container.textContent).toContain('offline');
  });

  it('grants the selected team', async () => {
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    await click(view.container.querySelector('button')!);
    expect(api.grantTeam).toHaveBeenCalledWith('a1', 't1');
  });

  it('reports a grant failure', async () => {
    api.grantTeam.mockRejectedValueOnce(new Error('not a member'));
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    await click(view.container.querySelector('button')!);
    expect(view.container.textContent).toContain('not a member');
  });

  it('creates a one-time link', async () => {
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    await change(
      view.container.querySelector('input[type="datetime-local"]')!,
      '2026-10-06T12:00',
    );
    await click(view.container.querySelector('input[type="checkbox"]')!);
    await submit(view.container.querySelector('form')!);
    expect(api.createShare).toHaveBeenCalledWith('a1', {
      canDownload: true,
      expiresAt: new Date('2026-10-06T12:00').toISOString(),
    });
    expect(view.container.textContent).toContain(
      'http://localhost:5173/share/secret',
    );
  });

  it('reports a create failure', async () => {
    api.createShare.mockRejectedValueOnce(new Error('too far ahead'));
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    await change(
      view.container.querySelector('input[type="datetime-local"]')!,
      '2026-10-06T12:00',
    );
    await submit(view.container.querySelector('form')!);
    expect(view.container.textContent).toContain('too far ahead');
  });

  it('revokes a team grant and a live link', async () => {
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    const buttons = [...view.container.querySelectorAll('button')];
    await click(buttons.find((button) => button.textContent === 'Remove')!);
    expect(api.revokeTeam).toHaveBeenCalledWith('a1', 't1');
    await click(buttons.find((button) => button.textContent === 'Revoke')!);
    expect(api.revokeShare).toHaveBeenCalledWith('a1', 's1');
  });

  it('reports revoke failures', async () => {
    api.revokeTeam.mockRejectedValueOnce(new Error('cannot revoke'));
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Remove',
      )!,
    );
    expect(view.container.textContent).toContain('cannot revoke');
  });

  it('leaves grant disabled when there are no teams', async () => {
    api.listTeams.mockResolvedValueOnce([]);
    api.getSharing.mockResolvedValueOnce({ teams: [], links: [] });
    view = await mount(
      <MemoryRouter>
        <SharePanel assetId="a1" />
      </MemoryRouter>,
    );
    expect(view.container.textContent).toContain('No teams yet');
    expect(
      (view.container.querySelector('button') as HTMLButtonElement).disabled,
    ).toBe(true);
  });
});
