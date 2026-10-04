import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import { useAssetQuery } from '../useAssetQuery';

// Opens the gallery at an address and returns what the hook understood from it
function readAddress(search: string) {
  let result!: ReturnType<typeof useAssetQuery>;
  function Probe() {
    result = useAssetQuery();
    return null;
  }
  renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/${search}`]}>
      <Probe />
    </MemoryRouter>,
  );
  return result;
}

describe('useAssetQuery (filters kept in the address bar)', () => {
  it('starts with no filters and newest first on a clean address', () => {
    const { filters, offset } = readAddress('');
    expect(filters).toEqual({
      q: undefined,
      type: undefined,
      tags: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
      sort: 'createdAt',
      scope: 'mine',
    });
    expect(offset).toBe(0);
  });

  it('reads the search text', () => {
    expect(readAddress('?q=holiday').filters.q).toBe('holiday');
  });

  it('splits the tags on commas', () => {
    expect(readAddress('?tags=beach,sunset').filters.tags).toEqual([
      'beach',
      'sunset',
    ]);
  });

  it('reads type, status, dates and sort', () => {
    const { filters } = readAddress(
      '?type=video&status=ready&from=2026-09-01&to=2026-09-29&sort=downloadCount',
    );
    expect(filters).toMatchObject({
      type: 'video',
      status: 'ready',
      from: '2026-09-01',
      to: '2026-09-29',
      sort: 'downloadCount',
    });
  });

  it('reads the page position', () => {
    expect(readAddress('?offset=48').offset).toBe(48);
  });

  it('treats a nonsense page position as the first page', () => {
    expect(readAddress('?offset=abc').offset).toBe(0);
  });

  it('treats an empty value as not set', () => {
    expect(readAddress('?q=&type=').filters.q).toBeUndefined();
    expect(readAddress('?q=&type=').filters.type).toBeUndefined();
  });
});
