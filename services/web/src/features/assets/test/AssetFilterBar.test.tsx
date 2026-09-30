import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AssetFilterBar } from '../AssetFilterBar';
import type { AssetFilters } from '../types';

const show = (filters: Partial<AssetFilters> = {}, showStatus = false) =>
  renderToStaticMarkup(
    <AssetFilterBar
      filters={{ sort: 'createdAt', ...filters } as AssetFilters}
      loadTags={async () => []}
      showStatus={showStatus}
      onChange={() => {}}
    />,
  );

describe('asset filter bar', () => {
  it('shows the search box, type, dates and sort choices', () => {
    const html = show();
    expect(html).toContain('Search by name or tag');
    for (const text of ['All types', 'From', 'To', 'Newest first']) {
      expect(html).toContain(text);
    }
    expect(html).toContain('Most downloaded');
  });

  it('hides the status choice unless asked for', () => {
    expect(show()).not.toContain('All statuses');
    expect(show({}, true)).toContain('All statuses');
  });

  it('lists every status for the admin', () => {
    const html = show({}, true);
    for (const status of ['uploading', 'uploaded', 'processing', 'ready']) {
      expect(html).toContain(`>${status}</option>`);
    }
  });

  it('does not offer to clear filters when nothing is filtered', () => {
    expect(show()).not.toContain('Clear filters');
  });

  it('offers to clear filters once anything is filtered', () => {
    for (const filters of [
      { q: 'beach' },
      { type: 'image' as const },
      { tags: ['sea'] },
      { status: 'ready' as const },
      { from: '2026-01-01' },
      { to: '2026-02-01' },
    ]) {
      expect(show(filters, true)).toContain('Clear filters');
    }
  });

  it('starts with the current search text and dates filled in', () => {
    const html = show({ q: 'beach', from: '2026-01-01', to: '2026-02-01' });
    expect(html).toContain('value="beach"');
    expect(html).toContain('value="2026-01-01"');
    expect(html).toContain('value="2026-02-01"');
  });

  it('stops the dates from crossing over', () => {
    const html = show({ from: '2026-01-01', to: '2026-02-01' });
    expect(html).toContain('max="2026-02-01"');
    expect(html).toContain('min="2026-01-01"');
  });
});
