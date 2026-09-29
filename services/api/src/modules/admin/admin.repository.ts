import { assets, users, type AssetStatus, type Db } from '@dam/db';
import { and, count, desc, eq, gte, inArray, like, lt } from 'drizzle-orm';
import {
  DOCUMENT_MIME_TYPES,
  type AssetKind,
} from '../../shared/lib/asset-kind.ts';

type AdminAssetFilters = {
  limit: number;
  offset: number;
  type?: AssetKind;
  status?: AssetStatus;
  ownerId?: string;
  from?: Date;
  // The first moment after the range, so the last day is fully included
  toExclusive?: Date;
  sort: 'createdAt' | 'downloadCount';
};

function matchesType(type: AssetKind | undefined) {
  if (type === 'image') return like(assets.mimeType, 'image/%');
  if (type === 'video') return like(assets.mimeType, 'video/%');
  if (type === 'document') return inArray(assets.mimeType, DOCUMENT_MIME_TYPES);
  return undefined;
}

// Every user's assets, so this must only be reachable from admin routes
export async function listAllAssets(db: Db, filters: AdminAssetFilters) {
  const where = and(
    matchesType(filters.type),
    filters.status ? eq(assets.status, filters.status) : undefined,
    filters.ownerId ? eq(assets.ownerId, filters.ownerId) : undefined,
    filters.from ? gte(assets.createdAt, filters.from) : undefined,
    filters.toExclusive ? lt(assets.createdAt, filters.toExclusive) : undefined,
  );

  const sortColumn =
    filters.sort === 'downloadCount' ? assets.downloadCount : assets.createdAt;

  const [rows, [total]] = await Promise.all([
    db
      .select({ asset: assets, ownerEmail: users.email })
      .from(assets)
      // Left join, because old assets can have no owner and must still show up
      .leftJoin(users, eq(users.id, assets.ownerId))
      .where(where)
      // The id keeps the order stable, so pages never repeat or skip rows
      .orderBy(desc(sortColumn), desc(assets.id))
      .limit(filters.limit)
      .offset(filters.offset),
    db.select({ value: count() }).from(assets).where(where),
  ]);

  return { rows, total: Number(total?.value ?? 0) };
}
