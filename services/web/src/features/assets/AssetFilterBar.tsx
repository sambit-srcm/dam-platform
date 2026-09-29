import { useEffect, useRef, useState } from 'react';
import type {
  AssetFilters,
  AssetKind,
  AssetSort,
  AssetStatus,
  TagCount,
} from './types';

const TYPES: AssetKind[] = ['image', 'video', 'document'];
const STATUSES: AssetStatus[] = [
  'uploading',
  'uploaded',
  'processing',
  'ready',
  'failed',
];
const SEARCH_DELAY_MS = 300;
const MAX_TAG_CHIPS = 20;

const inputClass = 'rounded border border-gray-300 bg-white px-2 py-1';

type Props = {
  filters: AssetFilters;
  // Must be a stable function, because it runs again whenever it changes
  loadTags: () => Promise<TagCount[]>;
  showStatus?: boolean;
  onChange: (patch: Partial<AssetFilters>) => void;
};

export function AssetFilterBar({
  filters,
  loadTags,
  showStatus,
  onChange,
}: Props) {
  const [text, setText] = useState(filters.q ?? '');
  const [tags, setTags] = useState<TagCount[]>([]);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    loadTags().then(
      (result) => {
        if (!cancelled) setTags(result);
      },
      // The chips are a shortcut, so the list still works without them
      () => undefined,
    );
    return () => {
      cancelled = true;
    };
  }, [loadTags]);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  function search(value: string) {
    setText(value);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(
      () => onChange({ q: value.trim() || undefined }),
      SEARCH_DELAY_MS,
    );
  }

  function toggleTag(tag: string) {
    const current = filters.tags ?? [];
    const next = current.includes(tag)
      ? current.filter((t) => t !== tag)
      : [...current, tag];
    onChange({ tags: next.length > 0 ? next : undefined });
  }

  function clear() {
    window.clearTimeout(timer.current);
    setText('');
    onChange({
      q: undefined,
      type: undefined,
      tags: undefined,
      status: undefined,
      from: undefined,
      to: undefined,
    });
  }

  const filtered = Boolean(
    filters.q ||
    filters.type ||
    filters.tags ||
    filters.status ||
    filters.from ||
    filters.to,
  );

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <input
          type="search"
          value={text}
          onChange={(e) => search(e.target.value)}
          placeholder="Search by name or tag"
          className={`${inputClass} w-56`}
        />
        <select
          value={filters.type ?? ''}
          onChange={(e) =>
            onChange({ type: (e.target.value || undefined) as AssetKind })
          }
          className={inputClass}
        >
          <option value="">All types</option>
          {TYPES.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
        {showStatus && (
          <select
            value={filters.status ?? ''}
            onChange={(e) =>
              onChange({
                status: (e.target.value || undefined) as AssetStatus,
              })
            }
            className={inputClass}
          >
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        )}
        <label className="flex items-center gap-1 text-gray-600">
          From
          <input
            type="date"
            value={filters.from ?? ''}
            max={filters.to}
            onChange={(e) => onChange({ from: e.target.value || undefined })}
            className={inputClass}
          />
        </label>
        <label className="flex items-center gap-1 text-gray-600">
          To
          <input
            type="date"
            value={filters.to ?? ''}
            min={filters.from}
            onChange={(e) => onChange({ to: e.target.value || undefined })}
            className={inputClass}
          />
        </label>
        <select
          value={filters.sort}
          onChange={(e) => onChange({ sort: e.target.value as AssetSort })}
          className={inputClass}
        >
          <option value="createdAt">Newest first</option>
          <option value="downloadCount">Most downloaded</option>
        </select>
        {filtered && (
          <button
            type="button"
            onClick={clear}
            className="text-blue-600 hover:text-blue-800"
          >
            Clear filters
          </button>
        )}
      </div>

      {tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {tags.slice(0, MAX_TAG_CHIPS).map(({ tag, count }) => {
            const active = filters.tags?.includes(tag);
            return (
              <button
                key={tag}
                type="button"
                onClick={() => toggleTag(tag)}
                aria-pressed={active}
                className={`rounded-full border px-2.5 py-0.5 text-xs transition ${
                  active
                    ? 'border-blue-600 bg-blue-600 text-white'
                    : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
                }`}
              >
                {tag} · {count}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
