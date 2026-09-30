import { useEffect, useState } from 'react';
import { whenLoaded } from '../../lib/whenLoaded';
import type { ListAssetsParams } from './types';

type Page<T> = { items: T[]; total: number };

const REFRESH_MS = 4000;

// Results that arrive after isCancelled turns true are dropped, so a slow old search cannot overwrite a newer one
export async function runSearch<T>(
  fetchPage: (params: ListAssetsParams) => Promise<Page<T>>,
  params: ListAssetsParams,
  isCancelled: () => boolean,
  onPage: (page: Page<T>) => void,
  onError: (message: string) => void,
) {
  return whenLoaded(fetchPage(params), isCancelled, onPage, onError);
}

// Loads a list again whenever the params change, keeping the old list on screen meanwhile.
// While isPending says some item is still in progress, it also reloads on a timer.
export function useAssetSearch<T>(
  fetchPage: (params: ListAssetsParams) => Promise<Page<T>>,
  params: ListAssetsParams,
  isPending?: (item: T) => boolean,
) {
  const [page, setPage] = useState<Page<T> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const key = JSON.stringify(params);
  const hasPending = !!isPending && !!page?.items.some(isPending);

  useEffect(() => {
    let cancelled = false;

    void runSearch(
      fetchPage,
      JSON.parse(key) as ListAssetsParams,
      () => cancelled,
      (result) => {
        setPage(result);
        setError(null);
      },
      setError,
    );

    return () => {
      cancelled = true;
    };
  }, [fetchPage, key, tick]);

  useEffect(() => {
    if (!hasPending) return;
    const timer = setInterval(() => setTick((n) => n + 1), REFRESH_MS);
    return () => clearInterval(timer);
  }, [hasPending]);

  return { page, error };
}
