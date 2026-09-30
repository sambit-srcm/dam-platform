import { renderToStaticMarkup } from 'react-dom/server';
import { StaticRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// The search hook is replaced, so each test decides what list the page was handed
const search = vi.hoisted(() => ({
  result: { page: null, error: null } as {
    page: { items: unknown[]; total: number } | null;
    error: string | null;
  },
}));

vi.mock('../../features/assets/useAssetSearch', () => ({
  useAssetSearch: () => search.result,
}));

import { AdminAssetsPage } from '../AdminAssetsPage';
import { GalleryPage } from '../GalleryPage';

const asset = (overrides = {}) => ({
  id: 'a1',
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2 * 1024 * 1024,
  status: 'ready',
  tags: ['beach', 'sunset'],
  createdAt: '2026-09-28T08:30:00.000Z',
  thumbnailUrl: 'https://files.test/thumb.webp',
  ownerId: 'u1',
  ownerEmail: 'alice@example.com',
  downloadCount: 7,
  ...overrides,
});

const show = (ui: React.ReactElement) =>
  renderToStaticMarkup(<StaticRouter location="/">{ui}</StaticRouter>);

beforeEach(() => {
  search.result = { page: null, error: null };
});

describe('gallery with a list', () => {
  it('shows each asset with its name, size and tags', () => {
    search.result = { page: { items: [asset()], total: 1 }, error: null };
    const html = show(<GalleryPage />);
    expect(html).toContain('beach.jpg');
    expect(html).toContain('2.0 MB');
    expect(html).toContain('beach');
    expect(html).toContain('sunset');
  });

  it('shows the thumbnail of a ready asset and lets people open it', () => {
    search.result = { page: { items: [asset()], total: 1 }, error: null };
    const html = show(<GalleryPage />);
    expect(html).toContain('https://files.test/thumb.webp');
    expect(html).toContain('aria-label="View beach.jpg"');
  });

  it('says "No preview" for a ready asset without a thumbnail', () => {
    search.result = {
      page: { items: [asset({ thumbnailUrl: null })], total: 1 },
      error: null,
    };
    expect(show(<GalleryPage />)).toContain('No preview');
  });

  it('shows a spinner while an asset is still being processed', () => {
    search.result = {
      page: { items: [asset({ status: 'processing' })], total: 1 },
      error: null,
    };
    const html = show(<GalleryPage />);
    expect(html).toContain('Processing…');
    expect(html).toContain('aria-label="Processing"');
    expect(html).not.toContain('aria-label="View beach.jpg"');
  });

  it('says so when an asset failed', () => {
    search.result = {
      page: { items: [asset({ status: 'failed' })], total: 1 },
      error: null,
    };
    expect(show(<GalleryPage />)).toContain('Processing failed');
  });

  it('says "No assets match" for an empty list', () => {
    search.result = { page: { items: [], total: 0 }, error: null };
    const html = show(<GalleryPage />);
    expect(html).toContain('No assets match');
    expect(html).not.toContain('Loading…');
  });

  it('shows the error instead of "Loading…"', () => {
    search.result = { page: null, error: 'Network Error' };
    const html = show(<GalleryPage />);
    expect(html).toContain('Network Error');
    expect(html).not.toContain('Loading…');
  });

  it('shows the page counter', () => {
    search.result = { page: { items: [asset()], total: 40 }, error: null };
    expect(show(<GalleryPage />)).toContain('40');
  });
});

describe('admin table with a list', () => {
  it('shows a row with owner, size, status, downloads and date', () => {
    search.result = { page: { items: [asset()], total: 1 }, error: null };
    const html = show(<AdminAssetsPage />);
    expect(html).toContain('beach.jpg');
    expect(html).toContain('alice@example.com');
    expect(html).toContain('2.0 MB');
    expect(html).toContain('>ready<');
    expect(html).toContain('>7<');
    expect(html).toContain('2026');
  });

  it('says "No owner" for an asset nobody owns', () => {
    search.result = {
      page: { items: [asset({ ownerEmail: null })], total: 1 },
      error: null,
    };
    expect(show(<AdminAssetsPage />)).toContain('No owner');
  });

  it('only lets admins open rows that are ready', () => {
    search.result = {
      page: {
        items: [asset(), asset({ id: 'a2', status: 'processing' })],
        total: 2,
      },
      error: null,
    };
    const html = show(<AdminAssetsPage />);
    expect(html.match(/cursor-pointer/g)).toHaveLength(1);
  });

  it('says "No assets match" for an empty list', () => {
    search.result = { page: { items: [], total: 0 }, error: null };
    expect(show(<AdminAssetsPage />)).toContain('No assets match');
  });

  it('shows the error message', () => {
    search.result = { page: null, error: 'Forbidden' };
    expect(show(<AdminAssetsPage />)).toContain('Forbidden');
  });
});
