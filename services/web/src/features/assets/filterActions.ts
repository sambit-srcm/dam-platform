import type { AssetFilters } from './types';

export const CLEARED_FILTERS: Partial<AssetFilters> = {
  q: undefined,
  type: undefined,
  tags: undefined,
  status: undefined,
  from: undefined,
  to: undefined,
};

// Adds the tag if it is missing and drops it if present; no tags left means no tag filter
export function toggleTag(current: string[] | undefined, tag: string) {
  const list = current ?? [];
  const next = list.includes(tag)
    ? list.filter((t) => t !== tag)
    : [...list, tag];
  return next.length > 0 ? next : undefined;
}
