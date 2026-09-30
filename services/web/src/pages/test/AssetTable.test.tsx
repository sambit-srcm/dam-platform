import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { AdminAsset } from '../../features/admin/types';
import { findElements } from '../../test/findElements';
import { AssetTable } from '../AdminAssetsPage';

const asset = (overrides: Partial<AdminAsset> = {}): AdminAsset => ({
  id: 'a1',
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  status: 'ready',
  tags: ['sea', 'sand'],
  createdAt: '2026-09-28T08:30:00.000Z',
  thumbnailUrl: 'https://files.test/t.webp',
  ownerId: 'u1',
  ownerEmail: 'alice@example.com',
  downloadCount: 7,
  ...overrides,
});

const show = (items: AdminAsset[]) =>
  renderToStaticMarkup(<AssetTable items={items} onSelect={() => {}} />);

describe('admin asset table', () => {
  it('shows every column heading', () => {
    const html = show([]);
    for (const heading of ['Asset', 'Tags', 'Owner', 'Size', 'Status']) {
      expect(html).toContain(`>${heading}<`);
    }
    expect(html).toContain('>Downloads<');
    expect(html).toContain('>Uploaded<');
  });

  it('shows one row with the asset details', () => {
    const html = show([asset()]);
    expect(html).toContain('beach.jpg');
    expect(html).toContain('alice@example.com');
    expect(html).toContain('2 KB');
    expect(html).toContain('>ready<');
    expect(html).toContain('>7<');
    expect(html).toContain('https://files.test/t.webp');
  });

  it('says "No owner" and skips the picture when they are missing', () => {
    const html = show([asset({ ownerEmail: null, thumbnailUrl: null })]);
    expect(html).toContain('No owner');
    expect(html).not.toContain('<img');
  });

  it('says "No assets match" for an empty list', () => {
    expect(show([])).toContain('No assets match');
  });

  it('only makes ready assets look clickable', () => {
    const ready = show([asset({ status: 'ready' })]);
    const busy = show([asset({ status: 'processing' })]);
    expect(ready).toContain('cursor-pointer');
    expect(busy).not.toContain('cursor-pointer');
  });

  it('opens the asset when a ready row is clicked, but not a busy one', () => {
    const onSelect = vi.fn();
    const rowsOf = (items: AdminAsset[]) =>
      findElements(AssetTable({ items, onSelect }), 'tr').filter(
        (row) => row.props.onClick,
      );

    const ready = asset({ status: 'ready' });
    rowsOf([ready])[0]!.props.onClick?.();
    expect(onSelect).toHaveBeenCalledWith(ready);

    onSelect.mockClear();
    rowsOf([asset({ status: 'failed' })])[0]!.props.onClick?.();
    expect(onSelect).not.toHaveBeenCalled();
  });
});
