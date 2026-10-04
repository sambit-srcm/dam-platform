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
  sql,
} from 'drizzle-orm';
import {
  DOCUMENT_MIME_TYPES,
  type AssetKind,
} from '../../shared/lib/asset-kind.ts';
import { normalizeTag } from '../../shared/lib/tags.ts';
import { ONE_DAY_MS } from '../../shared/lib/time.ts';

export type AssetFilters = {
  q?: string;
  type?: AssetKind;
  tags?: string[];
  status?: AssetStatus;
  ownerId?: string;
  // Owned by this user, or shared with a team they belong to
  viewerId?: string;
  scope?: 'mine' | 'team';
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

function teamGrant(userId: string) {
  return sql`exists (
    select 1 from asset_team_grants g
    inner join team_members m on m.team_id = g.team_id
    where g.asset_id = ${assets.id} and m.user_id = ${userId}
  )`;
}

function visibleTo(filters: AssetFilters) {
  if (filters.ownerId) return eq(assets.ownerId, filters.ownerId);
  if (!filters.viewerId) return undefined;
  if (filters.scope === 'mine') return eq(assets.ownerId, filters.viewerId);
  if (filters.scope === 'team') return teamGrant(filters.viewerId);
  return or(eq(assets.ownerId, filters.viewerId), teamGrant(filters.viewerId));
}

export function assetWhere(filters: AssetFilters) {
  return and(
    matchesType(filters.type),
    matchesSearch(filters.q),
    filters.tags?.length ? arrayContains(assets.tags, filters.tags) : undefined,
    filters.status ? eq(assets.status, filters.status) : undefined,
    visibleTo(filters),
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
