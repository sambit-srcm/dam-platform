import {
  assets,
  renditions,
  type Db,
  type NewRendition,
  type VideoMetadata,
} from '@dam/db';
import { and, eq, notInArray } from 'drizzle-orm';

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

export async function markAssetFailed(
  db: Db,
  id: string,
  failureReason: string,
) {
  await db
    .update(assets)
    .set({ status: 'failed', failureReason })
    .where(eq(assets.id, id));
}

// Saves every output and marks the asset ready in one go, so a reader never sees
// a "ready" video with missing renditions. Renditions from an earlier run that are
// no longer planned are removed.
export async function completeVideoAsset(
  db: Db,
  assetId: string,
  {
    metadata,
    outputs,
  }: {
    metadata: VideoMetadata;
    outputs: Omit<NewRendition, 'assetId'>[];
  },
) {
  await db.transaction(async (tx) => {
    for (const output of outputs) {
      await tx
        .insert(renditions)
        .values({ ...output, assetId })
        .onConflictDoUpdate({
          target: [renditions.assetId, renditions.label],
          set: {
            storageKey: output.storageKey,
            mimeType: output.mimeType,
            width: output.width,
            height: output.height,
            sizeBytes: output.sizeBytes,
          },
        });
    }

    await tx.delete(renditions).where(
      and(
        eq(renditions.assetId, assetId),
        notInArray(
          renditions.label,
          outputs.map((output) => output.label),
        ),
      ),
    );

    await tx
      .update(assets)
      .set({ status: 'ready', metadata, failureReason: null })
      .where(eq(assets.id, assetId));
  });
}
