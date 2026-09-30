import { beforeEach, describe, expect, it, vi } from 'vitest';

const router = vi.hoisted(() => ({
  params: new URLSearchParams(),
  setParams: vi.fn(),
}));

vi.mock('react-router', () => ({
  useSearchParams: () => [router.params, router.setParams],
}));

import { useAssetQuery } from '../useAssetQuery';

const lastAddress = () =>
  (router.setParams.mock.calls.at(-1)![0] as URLSearchParams).toString();

beforeEach(() => {
  router.params = new URLSearchParams();
  router.setParams.mockReset();
});

describe('asset query kept in the address bar', () => {
  it('starts with newest first and the first page', () => {
    const { filters, offset } = useAssetQuery();
    expect(filters.sort).toBe('createdAt');
    expect(filters.q).toBeUndefined();
    expect(offset).toBe(0);
  });

  it('reads filters and the page from the address', () => {
    router.params = new URLSearchParams(
      'q=beach&type=image&tags=sea,sand&status=ready&from=2026-01-01&to=2026-02-01&sort=downloadCount&offset=48',
    );
    const { filters, offset } = useAssetQuery();
    expect(filters).toEqual({
      q: 'beach',
      type: 'image',
      tags: ['sea', 'sand'],
      status: 'ready',
      from: '2026-01-01',
      to: '2026-02-01',
      sort: 'downloadCount',
    });
    expect(offset).toBe(48);
  });

  it('writes a new filter into the address and replaces history', () => {
    useAssetQuery().update({ q: 'beach' });
    expect(lastAddress()).toBe('q=beach');
    expect(router.setParams.mock.calls[0]![1]).toEqual({ replace: true });
  });

  it('joins several tags with commas', () => {
    useAssetQuery().update({ tags: ['sea', 'sand'] });
    expect(lastAddress()).toBe('tags=sea%2Csand');
  });

  it('removes a filter that is cleared', () => {
    router.params = new URLSearchParams('q=beach&type=image');
    useAssetQuery().update({ q: undefined });
    expect(lastAddress()).toBe('type=image');
  });

  it('goes back to the first page when a filter changes', () => {
    router.params = new URLSearchParams('offset=48');
    useAssetQuery().update({ type: 'video' });
    expect(lastAddress()).toBe('type=video');
  });

  it('keeps the page when the page itself is what changed', () => {
    useAssetQuery().update({ offset: 24 });
    expect(lastAddress()).toBe('offset=24');
  });

  it('leaves page 0 out of the address', () => {
    router.params = new URLSearchParams('offset=24');
    useAssetQuery().update({ offset: 0 });
    expect(lastAddress()).toBe('');
  });
});
