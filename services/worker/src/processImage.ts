import {
  findAssetById,
  markAssetFailed,
  markAssetProcessing,
  markAssetReady,
} from './repository.ts';
import { NonRetryableJobError } from '@dam/queue';
import { buffer } from 'node:stream/consumers';
import sharp from 'sharp';
import { config } from './config.ts';
import type { Context } from './context.ts';
import { logger } from './logger.ts';

export async function processImage(ctx: Context, assetId: string) {
  const asset = await findAssetById(ctx.db, assetId);
  if (!asset) {
    // Retrying will not make the asset appear
    throw new NonRetryableJobError(`Asset ${assetId} was not found`);
  }

  const log = logger.child({ assetId, storageKey: asset.storageKey });
  await markAssetProcessing(ctx.db, assetId);

  const original = await buffer(
    await ctx.storage.getObject(ctx.bucket, asset.storageKey),
  );

  let thumbnail: Buffer;
  try {
    thumbnail = await sharp(original)
      .rotate() // uses the orientation stored in the file
      .resize({ width: config.THUMBNAIL_WIDTH, withoutEnlargement: true })
      .webp({ quality: 80 })
      .toBuffer();
  } catch (error) {
    // A file that can't be decoded will never succeed, so stop retrying it
    await markAssetFailed(ctx.db, assetId);
    throw new NonRetryableJobError(
      `Asset ${assetId} could not be read as an image: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const thumbnailKey = `thumbnails/${assetId}.webp`;
  await ctx.storage.putObject(
    ctx.bucket,
    thumbnailKey,
    thumbnail,
    thumbnail.length,
    { 'Content-Type': 'image/webp' },
  );

  await markAssetReady(ctx.db, assetId, thumbnailKey);
  log.info({ thumbnailKey, bytes: thumbnail.length }, 'thumbnail created');
}
