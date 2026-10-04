/** @vitest-environment jsdom */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { change, click, mount, waitFor } from '../../../test/mount';
import { AssetFilterBar } from '../AssetFilterBar';
import type { AssetFilters } from '../types';

let view: Awaited<ReturnType<typeof mount>>;
const onChange = vi.fn();

beforeEach(() => {
  onChange.mockReset();
});

afterEach(() => {
  view?.unmount();
  vi.useRealTimers();
});

const filters: AssetFilters = { sort: 'createdAt' };

describe('AssetFilterBar actions', () => {
  it('loads tag chips and toggles one', async () => {
    view = await mount(
      <AssetFilterBar
        filters={filters}
        loadTags={async () => [{ tag: 'sea', count: 3 }]}
        onChange={onChange}
      />,
    );
    await waitFor(() => {
      expect(view.container.textContent).toContain('sea');
    });
    await click(
      [...view.container.querySelectorAll('button')].find((button) =>
        button.textContent?.includes('sea'),
      )!,
    );
    expect(onChange).toHaveBeenCalledWith({ tags: ['sea'] });
  });

  it('debounces search text and clears filters', async () => {
    view = await mount(
      <AssetFilterBar
        filters={{ ...filters, q: 'old' }}
        loadTags={async () => []}
        onChange={onChange}
      />,
    );
    vi.useFakeTimers();
    await change(
      view.container.querySelector('input[type="search"]')!,
      'beach',
    );
    await vi.advanceTimersByTimeAsync(300);
    expect(onChange).toHaveBeenCalledWith({ q: 'beach' });
    await click(
      [...view.container.querySelectorAll('button')].find(
        (button) => button.textContent === 'Clear filters',
      )!,
    );
    expect(onChange).toHaveBeenCalledWith({
      q: undefined,
      type: undefined,
      tags: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
    });
  });

  it('changes type, status, dates and sort', async () => {
    view = await mount(
      <AssetFilterBar
        filters={filters}
        showStatus
        loadTags={async () => []}
        onChange={onChange}
      />,
    );
    await change(
      view.container.querySelector('[aria-label="Asset type"]')!,
      'image',
    );
    expect(onChange).toHaveBeenCalledWith({ type: 'image' });
    await change(
      view.container.querySelector('[aria-label="Status"]')!,
      'ready',
    );
    expect(onChange).toHaveBeenCalledWith({ status: 'ready' });
    const dates = view.container.querySelectorAll('input[type="date"]');
    await change(dates[0]!, '2026-01-01');
    expect(onChange).toHaveBeenCalledWith({ from: '2026-01-01' });
    await change(dates[1]!, '2026-02-01');
    expect(onChange).toHaveBeenCalledWith({ to: '2026-02-01' });
    await change(
      view.container.querySelector('[aria-label="Sort"]')!,
      'downloadCount',
    );
    expect(onChange).toHaveBeenCalledWith({ sort: 'downloadCount' });
  });

  it('ignores a failed tag load', async () => {
    view = await mount(
      <AssetFilterBar
        filters={filters}
        loadTags={async () => {
          throw new Error('tags down');
        }}
        onChange={onChange}
      />,
    );
    expect(view.container.querySelector('[aria-pressed]')).toBeNull();
  });
});
