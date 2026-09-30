import { assets, users, type Db } from '@dam/db';
import { count, desc, eq, gt, gte, inArray, sql } from 'drizzle-orm';
import { HAS_OBJECT } from '../../shared/lib/asset-status.ts';
import {
  assetOrder,
  assetWhere,
  type AssetFilters,
  type AssetSort,
} from '../assets/asset.filters.ts';

// Every user's assets, so this must only be reachable from admin routes
export async function listAllAssets(
  db: Db,
  {
    limit,
    offset,
    sort,
    ...filters
  }: AssetFilters & { limit: number; offset: number; sort: AssetSort },
) {
  const where = assetWhere(filters);

  const [rows, [total]] = await Promise.all([
    db
      .select({ asset: assets, ownerEmail: users.email })
      .from(assets)
      // Left join, because old assets can have no owner and must still show up
      .leftJoin(users, eq(users.id, assets.ownerId))
      .where(where)
      .orderBy(...assetOrder(sort))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(assets).where(where),
  ]);

  return { rows, total: Number(total?.value ?? 0) };
}

export async function findAdminAsset(db: Db, id: string) {
  const [row] = await db
    .select({ asset: assets, ownerEmail: users.email })
    .from(assets)
    .leftJoin(users, eq(users.id, assets.ownerId))
    .where(eq(assets.id, id));
  return row;
}

// The sum() columns come back as strings, so they are converted by the caller
export async function dashboardTotals(db: Db) {
  const [[assetTotals], [userTotals]] = await Promise.all([
    db
      .select({
        assets: count(),
        storageBytes: sql<string>`coalesce(sum(${assets.sizeBytes}) filter (where ${inArray(assets.status, HAS_OBJECT)}), 0)`,
        downloads: sql<string>`coalesce(sum(${assets.downloadCount}), 0)`,
      })
      .from(assets),
    db.select({ value: count() }).from(users),
  ]);

  return {
    assets: Number(assetTotals?.assets ?? 0),
    storageBytes: Number(assetTotals?.storageBytes ?? 0),
    downloads: Number(assetTotals?.downloads ?? 0),
    users: Number(userTotals?.value ?? 0),
  };
}

export async function countByStatus(db: Db) {
  return db
    .select({ key: assets.status, count: count() })
    .from(assets)
    .groupBy(assets.status);
}

export async function countByType(db: Db) {
  const type = sql<string>`case
    when ${assets.mimeType} like 'image/%' then 'image'
    when ${assets.mimeType} like 'video/%' then 'video'
    else 'document' end`;

  return db.select({ key: type, count: count() }).from(assets).groupBy(type);
}

// One row per UTC day that had uploads; days without any are filled in by the caller
export async function uploadsPerDay(db: Db, since: Date) {
  const day = sql<string>`to_char(${assets.createdAt} at time zone 'UTC', 'YYYY-MM-DD')`;

  return db
    .select({ day, count: count() })
    .from(assets)
    .where(gte(assets.createdAt, since))
    .groupBy(day);
}

export async function topDownloaded(db: Db, limit: number) {
  return db
    .select({ asset: assets, ownerEmail: users.email })
    .from(assets)
    .leftJoin(users, eq(users.id, assets.ownerId))
    .where(gt(assets.downloadCount, 0))
    .orderBy(desc(assets.downloadCount), desc(assets.id))
    .limit(limit);
}
