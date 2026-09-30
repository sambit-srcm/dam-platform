import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import type { Asset } from '../../features/assets/types';
import { findElements } from '../../test/findElements';
import { AssetGrid } from '../GalleryPage';

const asset = (overrides: Partial<Asset> = {}): Asset => ({
  id: 'a1',
  filename: 'beach.jpg',
  mimeType: 'image/jpeg',
  sizeBytes: 2048,
  status: 'ready',
  tags: ['sea'],
  createdAt: '2026-09-28T08:30:00.000Z',
  thumbnailUrl: 'https://files.test/t.webp',
  ...overrides,
});

const show = (items: Asset[]) =>
  renderToStaticMarkup(<AssetGrid items={items} onSelect={() => {}} />);

describe('gallery grid', () => {
  it('shows a ready asset as a button with its picture, name and size', () => {
    const html = show([asset()]);
    expect(html).toContain('aria-label="View beach.jpg"');
    expect(html).toContain('src="https://files.test/t.webp"');
    expect(html).toContain('>beach.jpg<');
    expect(html).toContain('2 KB');
  });

  it('says "No preview" when a ready asset has no picture', () => {
    expect(show([asset({ thumbnailUrl: null })])).toContain('No preview');
  });

  it('shows a spinner while an asset is being processed', () => {
    for (const status of ['uploaded', 'processing'] as const) {
      const html = show([asset({ status })]);
      expect(html).toContain('aria-label="Processing"');
      expect(html).not.toContain('View beach.jpg');
    }
  });

  it('says uploading, not processing, while the file is still being sent', () => {
    const html = show([asset({ status: 'uploading' })]);
    expect(html).toContain('aria-label="Uploading"');
    expect(html).toContain('Uploading…');
    expect(html).not.toContain('Processing…');
  });

  it('says processing failed for a failed asset, with no spinner', () => {
    const html = show([asset({ status: 'failed' })]);
    expect(html).toContain('Processing failed');
    expect(html).not.toContain('aria-label="Processing"');
  });

  it('opens the asset when its picture is clicked', () => {
    const onSelect = vi.fn();
    const target = asset();
    const buttons = findElements(
      AssetGrid({ items: [target], onSelect }),
      'button',
    );
    buttons[0]!.props.onClick?.();
    expect(onSelect).toHaveBeenCalledWith(target);
  });
});
