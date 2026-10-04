import { useSearchParams } from 'react-router';
import type { AssetFilters, AssetKind, AssetSort, AssetStatus } from './types';

// The filters and page live in the address bar, so a refresh or a shared link shows the same list
export function useAssetQuery() {
  const [params, setParams] = useSearchParams();
  const get = (key: string) => params.get(key) || undefined;

  const filters: AssetFilters = {
    q: get('q'),
    type: get('type') as AssetKind | undefined,
    tags: get('tags')?.split(','),
    status: get('status') as AssetStatus | undefined,
    from: get('from'),
    to: get('to'),
    sort: (get('sort') ?? 'createdAt') as AssetSort,
    scope: get('scope') === 'team' ? 'team' : 'mine',
  };
  const offset = Number(params.get('offset')) || 0;

  // A different filter starts again from the first page, unless it sets the page itself
  function update(patch: Partial<AssetFilters> & { offset?: number }) {
    const next = new URLSearchParams(params);
    if (!('offset' in patch)) next.delete('offset');

    for (const [key, value] of Object.entries(patch)) {
      const text = Array.isArray(value) ? value.join(',') : String(value ?? '');
      // A page of 0 is the default, so it needs no place in the address
      if (text && text !== '0') next.set(key, text);
      else next.delete(key);
    }
    setParams(next, { replace: true });
  }

  return { filters, offset, update };
}
