import { eq } from 'drizzle-orm';
import type { Db } from './index.ts';
import { assets } from './schema.ts';

export async function findAssetById(db: Db, id: string) {
  const [asset] = await db.select().from(assets).where(eq(assets.id, id));
  return asset;
}

export async function markAssetProcessing(db: Db, id: string) {
  await db
    .update(assets)
    .set({ status: 'processing' })
    .where(eq(assets.id, id));
}

export async function markAssetReady(db: Db, id: string, thumbnailKey: string) {
  await db
    .update(assets)
    .set({ status: 'ready', thumbnailKey })
    .where(eq(assets.id, id));
}

export async function markAssetFailed(db: Db, id: string) {
  await db.update(assets).set({ status: 'failed' }).where(eq(assets.id, id));
}
