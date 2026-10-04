import {
  assets,
  FIELD_LIMITS,
  renditions,
  type AssetStatus,
  type Db,
  type NewAsset,
} from '@dam/db';
import { and, count, desc, eq, lt, sql } from 'drizzle-orm';
import {
  assetOrder,
  assetWhere,
  type AssetFilters,
  type AssetSort,
} from './asset.filters.ts';

export async function createAsset(db: Db, values: NewAsset) {
  const [asset] = await db.insert(assets).values(values).returning();
  return asset!;
}

export async function findAssetById(db: Db, id: string) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  return asset;
}

// Largest first, so the first one is the default to play
export async function findRenditions(db: Db, assetId: string) {
  return db
    .select()
    .from(renditions)
    .where(eq(renditions.assetId, assetId))
    .orderBy(desc(renditions.height));
}

export async function listAssets(
  db: Db,
  {
    limit,
    offset,
    sort,
    ...filters
  }: AssetFilters & {
    limit: number;
    offset: number;
    sort: AssetSort;
    viewerId: string;
  },
) {
  const where = assetWhere(filters);

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(assets)
      .where(where)
      .orderBy(...assetOrder(sort))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(assets).where(where),
  ]);

  return { rows, total: Number(total?.value ?? 0) };
}

// Every tag in use with how many assets have it, most used first
export async function listTags(
  db: Db,
  viewer?: { userId: string; scope?: 'mine' | 'team' },
) {
  const where = !viewer
    ? sql``
    : viewer.scope === 'mine'
      ? sql`where owner_id = ${viewer.userId}`
      : viewer.scope === 'team'
        ? sql`where exists (
              select 1 from asset_team_grants g
              inner join team_members m on m.team_id = g.team_id
              where g.asset_id = assets.id and m.user_id = ${viewer.userId}
            )`
        : sql`where owner_id = ${viewer.userId}
            or exists (
              select 1 from asset_team_grants g
              inner join team_members m on m.team_id = g.team_id
              where g.asset_id = assets.id and m.user_id = ${viewer.userId}
            )`;
  const { rows } = await db.execute<{ tag: string; count: number }>(sql`
    select tag, count(*)::int as count
    from (
      select unnest(tags) as tag from assets
      ${where}
    ) as used
    group by tag
    order by count desc, tag
    limit 100`);
  return rows;
}

// Size comes from the finished object in storage, not from what the caller declared
export async function markUploadComplete(
  db: Db,
  id: string,
  sizeBytes: number,
  status: AssetStatus,
) {
  await db
    .update(assets)
    .set({ status, sizeBytes, upload: null, uploadExpiresAt: null })
    .where(eq(assets.id, id));
}
export async function incrementDownloadCount(db: Db, id: string) {
  await db
    .update(assets)
    .set({
      downloadCount: sql`${assets.downloadCount} + 1`,
      updatedAt: assets.updatedAt,
    })
    .where(eq(assets.id, id));
}

export async function failAsset(db: Db, id: string, failureReason: string) {
  await db
    .update(assets)
    .set({
      status: 'failed',
      failureReason: failureReason.slice(0, FIELD_LIMITS.failureReason),
      upload: null,
      uploadExpiresAt: null,
    })
    .where(eq(assets.id, id));
}

// Uploads that were started but never finished, for the cleanup sweep
export async function findExpiredUploads(db: Db, now: Date) {
  return db
    .select()
    .from(assets)
    .where(
      and(eq(assets.status, 'uploading'), lt(assets.uploadExpiresAt, now)),
    );
}
