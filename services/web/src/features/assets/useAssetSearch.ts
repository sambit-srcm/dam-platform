import { useEffect, useState } from 'react';
import { getErrorMessage } from '../../lib/http';
import type { ListAssetsParams } from './types';

type Page<T> = { items: T[]; total: number };

const REFRESH_MS = 4000;

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

    fetchPage(JSON.parse(key) as ListAssetsParams).then(
      (result) => {
        if (cancelled) return;
        setPage(result);
        setError(null);
      },
      (err: unknown) => {
        if (!cancelled) setError(getErrorMessage(err));
      },
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
