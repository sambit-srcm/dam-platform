import { AxiosError } from 'axios';
import { describe, expect, it, vi } from 'vitest';
import { runSearch } from '../useAssetSearch';

const params = { sort: 'createdAt' as const, limit: 24, offset: 0 };
const page = { items: [{ id: 'a' }], total: 1 };

describe('running an asset search', () => {
  it('hands the fetched page over', async () => {
    const onPage = vi.fn();
    const onError = vi.fn();
    await runSearch(
      async () => page,
      params,
      () => false,
      onPage,
      onError,
    );
    expect(onPage).toHaveBeenCalledWith(page);
    expect(onError).not.toHaveBeenCalled();
  });

  it('asks the server with the given params', async () => {
    const fetchPage = vi.fn().mockResolvedValue(page);
    await runSearch(fetchPage, params, () => false, vi.fn(), vi.fn());
    expect(fetchPage).toHaveBeenCalledWith(params);
  });

  it('reports a readable message when the search fails', async () => {
    const onPage = vi.fn();
    const onError = vi.fn();
    await runSearch(
      async () => {
        throw new Error('Server is down');
      },
      params,
      () => false,
      onPage,
      onError,
    );
    expect(onError).toHaveBeenCalledWith('Server is down');
    expect(onPage).not.toHaveBeenCalled();
  });

  it('drops a result that arrives after the search was cancelled', async () => {
    const onPage = vi.fn();
    await runSearch(
      async () => page,
      params,
      () => true,
      onPage,
      vi.fn(),
    );
    expect(onPage).not.toHaveBeenCalled();
  });

  it('drops an error that arrives after the search was cancelled', async () => {
    const onError = vi.fn();
    await runSearch(
      async () => {
        throw new AxiosError('late');
      },
      params,
      () => true,
      vi.fn(),
      onError,
    );
    expect(onError).not.toHaveBeenCalled();
  });
});
