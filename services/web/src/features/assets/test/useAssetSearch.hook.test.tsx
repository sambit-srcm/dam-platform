/** @vitest-environment jsdom */
import { afterEach, describe, expect, it } from 'vitest';
import { mount } from '../../../test/mount';
import { useAssetSearch } from '../useAssetSearch';

let view: Awaited<ReturnType<typeof mount>>;

afterEach(() => {
  view?.unmount();
});

function Probe({
  fetchPage,
}: {
  fetchPage: () => Promise<{ items: { id: string }[]; total: number }>;
}) {
  const { page, error } = useAssetSearch(fetchPage, {
    sort: 'createdAt',
    limit: 24,
    offset: 0,
  });
  return (
    <p>
      {page ? `${page.total} items` : 'none'} {error ?? ''}
    </p>
  );
}

describe('useAssetSearch', () => {
  it('loads a page and then an error', async () => {
    view = await mount(
      <Probe fetchPage={async () => ({ items: [{ id: 'a1' }], total: 1 })} />,
    );
    expect(view.container.textContent).toContain('1 items');

    const failing = async () => {
      throw new Error('search failed');
    };
    await view.rerender(<Probe fetchPage={failing} />);
    expect(view.container.textContent).toContain('search failed');
  });
});
