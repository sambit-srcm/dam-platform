import { assets, type NewAsset, type Db } from '@dam/db';
import { and, eq, lt } from 'drizzle-orm';

export async function createAsset(db: Db, values: NewAsset) {
  const [asset] = await db.insert(assets).values(values).returning();
  return asset!;
}

export async function findAssetById(db: Db, id: string) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  return asset;
}

// Size comes from the finished object in storage, not from what the caller declared
export async function markUploadComplete(
  db: Db,
  id: string,
  sizeBytes: number,
) {
  await db
    .update(assets)
    .set({ status: 'uploaded', sizeBytes, upload: null, uploadExpiresAt: null })
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
