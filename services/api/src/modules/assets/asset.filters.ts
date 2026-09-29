import { assets, type AssetStatus } from '@dam/db';
import {
  and,
  arrayContains,
  desc,
  eq,
  gte,
  ilike,
  inArray,
  like,
  lt,
  or,
} from 'drizzle-orm';
import {
  DOCUMENT_MIME_TYPES,
  type AssetKind,
} from '../../shared/lib/asset-kind.ts';
import { normalizeTag } from '../../shared/lib/tags.ts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export type AssetFilters = {
  q?: string;
  type?: AssetKind;
  tags?: string[];
  status?: AssetStatus;
  ownerId?: string;
  from?: string;
  to?: string;
};

export type AssetSort = 'createdAt' | 'downloadCount';

function matchesType(type: AssetKind | undefined) {
  if (type === 'image') return like(assets.mimeType, 'image/%');
  if (type === 'video') return like(assets.mimeType, 'video/%');
  if (type === 'document') return inArray(assets.mimeType, DOCUMENT_MIME_TYPES);
  return undefined;
}

// A search for 50% must not match everything
function escapeLike(text: string) {
  return text.replace(/[\\%_]/g, '\\$&');
}

function matchesSearch(q: string | undefined) {
  if (!q) return undefined;

  const tag = normalizeTag(q);

  return or(
    ilike(assets.filename, `%${escapeLike(q)}%`),
    tag ? arrayContains(assets.tags, [tag]) : undefined,
  );
}

// The first moment after `to`, so the last day is fully included
function dayAfter(date: string) {
  return new Date(new Date(`${date}T00:00:00.000Z`).getTime() + ONE_DAY_MS);
}

export function assetWhere(filters: AssetFilters) {
  return and(
    matchesType(filters.type),
    matchesSearch(filters.q),
    filters.tags?.length ? arrayContains(assets.tags, filters.tags) : undefined,
    filters.status ? eq(assets.status, filters.status) : undefined,
    filters.ownerId ? eq(assets.ownerId, filters.ownerId) : undefined,
    filters.from
      ? gte(assets.createdAt, new Date(`${filters.from}T00:00:00.000Z`))
      : undefined,
    filters.to ? lt(assets.createdAt, dayAfter(filters.to)) : undefined,
  );
}

// The id keeps the order stable, so pages never repeat or skip rows
export function assetOrder(sort: AssetSort) {
  const column =
    sort === 'downloadCount' ? assets.downloadCount : assets.createdAt;
  return [desc(column), desc(assets.id)];
}
