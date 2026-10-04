/** @vitest-environment jsdom */
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { click, mount } from '../../test/mount';

const api = vi.hoisted(() => ({
  previewShare: vi.fn(),
  downloadShare: vi.fn(),
}));

vi.mock('../../features/shares/api', () => api);

import { SharePage } from '../SharePage';

const preview = {
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  canDownload: true,
  expiresAt: '2026-10-06T00:00:00.000Z',
  asset: {
    id: 'a1',
    filename: 'beach.jpg',
    mimeType: 'image/jpeg',
    sizeBytes: 10,
    status: 'ready' as const,
    tags: ['sea'],
    createdAt: '2026-01-01T00:00:00.000Z',
    thumbnailUrl: 'https://files.test/t.webp',
  },
  view: { kind: 'image' as const, url: 'https://files.test/a.jpg' },
};

const assign = vi.fn();

let view: Awaited<ReturnType<typeof mount>>;

beforeEach(() => {
  api.previewShare.mockResolvedValue(preview);
  api.downloadShare.mockResolvedValue('https://files.test/dl.jpg');
  assign.mockReset();
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: { assign, origin: 'http://localhost' },
  });
});

afterEach(() => {
  view?.unmount();
});

function page() {
  return (
    <MemoryRouter initialEntries={['/share/tok']}>
      <Routes>
        <Route path="/share/:token" element={<SharePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('SharePage', () => {
  it('shows the preview and downloads when allowed', async () => {
    view = await mount(page());
    expect(api.previewShare).toHaveBeenCalledWith('tok');
    expect(view.container.textContent).toContain('beach.jpg');
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
      'https://files.test/a.jpg',
    );
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Download',
      )!,
    );
    expect(api.downloadShare).toHaveBeenCalledWith('tok');
    expect(assign).toHaveBeenCalledWith('https://files.test/dl.jpg');
  });

  it('hides download when the link is preview only', async () => {
    api.previewShare.mockResolvedValueOnce({ ...preview, canDownload: false });
    view = await mount(page());
    expect(view.container.textContent).not.toContain('Download');
  });

  it('shows a preview error', async () => {
    api.previewShare.mockRejectedValueOnce(new Error('link expired'));
    view = await mount(page());
    expect(view.container.textContent).toContain('link expired');
  });

  it('closes back to the home page', async () => {
    view = await mount(page());
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Close',
      )!,
    );
    expect(assign).toHaveBeenCalledWith('/');
  });
});
