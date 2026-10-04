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
const api = vi.hoisted(() => ({
  getAdminAssets: vi.fn(),
  getAdminAssetView: vi.fn(),
  getAdminTags: vi.fn(),
}));

vi.mock('../../features/assets/useAssetSearch', () => ({
  useAssetSearch: () => search.result,
}));
vi.mock('../../features/admin/api', () => api);

import { AdminAssetsPage } from '../AdminAssetsPage';

const asset = {
  id: 'a1',
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  status: 'ready' as const,
  tags: ['sea'],
  createdAt: '2026-09-28T08:30:00.000Z',
  thumbnailUrl: 'https://files.test/t.webp',
  ownerId: 'u1',
  ownerEmail: 'alice@example.com',
  downloadCount: 7,
};

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  search.result = { page: { items: [asset], total: 1 }, error: null };
  api.getAdminTags.mockResolvedValue([]);
  api.getAdminAssetView.mockResolvedValue({
    kind: 'image',
    url: 'https://files.test/a.jpg',
  });
});

afterEach(() => {
  view?.unmount();
});

describe('AdminAssetsPage', () => {
  it('opens a ready row in the viewer', async () => {
    view = await mount(
      <MemoryRouter>
        <AdminAssetsPage />
      </MemoryRouter>,
    );
    await click(view.container.querySelector('tbody tr')!);
    expect(view.container.querySelector('[role="dialog"]')).not.toBeNull();
    expect(view.container.textContent).toContain('beach.jpg');
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Close',
      )!,
    );
    expect(view.container.querySelector('[role="dialog"]')).toBeNull();
  });
});
