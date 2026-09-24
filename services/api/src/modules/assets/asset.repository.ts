import { assets, type NewAsset, type Db } from '@dam/db';
import { and, count, desc, eq, lt } from 'drizzle-orm';
import type { AssetStatus } from '@dam/db';

export async function createAsset(db: Db, values: NewAsset) {
  const [asset] = await db.insert(assets).values(values).returning();
  return asset!;
}

export async function findAssetById(db: Db, id: string) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  return asset;
}

export async function listAssets(
  db: Db,
  {
    limit,
    offset,
    status,
    ownerId,
  }: {
    limit: number;
    offset: number;
    status?: AssetStatus;
    ownerId: string;
  },
) {
  const where = and(
    status ? eq(assets.status, status) : undefined,
    eq(assets.ownerId, ownerId),
  );

  const [rows, [total]] = await Promise.all([
    db
      .select()
      .from(assets)
      .where(where)
      .orderBy(desc(assets.createdAt))
      .limit(limit)
      .offset(offset),
    db.select({ value: count() }).from(assets).where(where),
  ]);

  return { rows, total: Number(total?.value ?? 0) };
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

export async function failAsset(db: Db, id: string, failureReason: string) {
  await db
    .update(assets)
    .set({
      status: 'failed',
      failureReason,
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
