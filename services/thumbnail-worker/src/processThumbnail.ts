import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { buffer } from 'node:stream/consumers';
import type { Asset, ImageMetadata } from '@dam/db';
import { NonRetryableJobError } from '@dam/queue';
import sharp from 'sharp';
import { config } from './config.ts';
import type { Context } from './context.ts';
import { ExecError, run } from './lib/exec.ts';
import { withTempDir } from './lib/tempdir.ts';
import { logger } from './logger.ts';
import {
  findAssetById,
  markAssetFailed,
  markAssetProcessing,
  markAssetReady,
  updateAssetThumbnail,
} from './repository.ts';

const FRAME_TIMEOUT_MS = 60_000;

export async function processThumbnail(ctx: Context, assetId: string) {
  const asset = await findAssetById(ctx.db, assetId);
  if (!asset) {
    // Retrying will not make the asset appear
    throw new NonRetryableJobError(`Asset ${assetId} was not found`);
  }

  if (asset.mimeType.startsWith('image/')) return processImage(ctx, asset);
  if (asset.mimeType.startsWith('video/')) return processVideo(ctx, asset);

  throw new NonRetryableJobError(
    `Asset ${assetId} is neither an image nor a video`,
  );
}

// Input is the file bytes or a path to an image file
function makeThumbnail(input: Buffer | string) {
  return sharp(input)
    .rotate() // uses the orientation stored in the file
    .resize({ width: config.THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer();
}

async function uploadThumbnail(
  ctx: Context,
  assetId: string,
  thumbnail: Buffer,
) {
  // Named after the asset, so a retry overwrites instead of piling up
  const thumbnailKey = `thumbnails/${assetId}.webp`;
  await ctx.storage.putObject(
    ctx.bucket,
    thumbnailKey,
    thumbnail,
    thumbnail.length,
    { 'Content-Type': 'image/webp' },
  );
  return thumbnailKey;
}

// Sizes are after rotation, the way the picture is shown
async function readImageDetails(input: Buffer): Promise<ImageMetadata> {
  const { width, height, format, orientation } = await sharp(input).metadata();
  if (!width || !height || !format) throw new Error('the image has no size');

  // Orientations 5 to 8 store the picture on its side
  const onItsSide = orientation !== undefined && orientation >= 5;
  return onItsSide
    ? { width: height, height: width, format }
    : { width, height, format };
}

function imageTags({ width, height }: ImageMetadata) {
  const pixels = width * height;
  const tags = [
    width === height ? 'square' : width > height ? 'landscape' : 'portrait',
  ];
  if (pixels >= 8_000_000) tags.push('high-res');
  if (pixels < 500_000) tags.push('low-res');
  return tags;
}

async function processImage(ctx: Context, asset: Asset) {
  // Jobs are delivered at least once, so a repeat of finished work is dropped
  if (asset.status === 'ready' && asset.thumbnailKey) return;

  const log = logger.child({
    assetId: asset.id,
    storageKey: asset.storageKey,
  });
  await markAssetProcessing(ctx.db, asset.id);

  const original = await buffer(
    await ctx.storage.getObject(ctx.bucket, asset.storageKey),
  );

  let thumbnail: Buffer;
  let metadata: ImageMetadata;
  try {
    metadata = await readImageDetails(original);
    thumbnail = await makeThumbnail(original);
  } catch (error) {
    // A file that can't be decoded will never succeed, so stop retrying it
    await markAssetFailed(ctx.db, asset.id);
    throw new NonRetryableJobError(
      `Asset ${asset.id} could not be read as an image: ${
        error instanceof Error ? error.message : String(error)
      }`,
    );
  }

  const thumbnailKey = await uploadThumbnail(ctx, asset.id, thumbnail);
  await markAssetReady(ctx.db, asset.id, {
    thumbnailKey,
    metadata,
    tags: imageTags(metadata),
  });
  log.info({ thumbnailKey, bytes: thumbnail.length }, 'thumbnail created');
}

// A frame from the first seconds. A video shorter than that has no frame at 1s, so it falls back to the start.
async function extractFrame(source: string, output: string) {
  for (const seconds of [1, 0]) {
    await run(
      config.FFMPEG_PATH,
      [
        '-v',
        'error',
        '-ss',
        String(seconds),
        '-i',
        source,
        '-frames:v',
        '1',
        '-y',
        output,
      ],
      { timeoutMs: FRAME_TIMEOUT_MS },
    );
    // A seek past the end makes ffmpeg exit cleanly without writing a file
    if (
      await stat(output).then(
        () => true,
        () => false,
      )
    )
      return;
  }
  throw new NonRetryableJobError('The video has no frame to use');
}

// The video worker owns the status, so this only ever sets the thumbnail key
async function processVideo(ctx: Context, asset: Asset) {
  // The video worker already gave up on this file
  if (asset.status === 'failed') return;

  await withTempDir(async (dir) => {
    const source = join(dir, 'source');
    const frame = join(dir, 'frame.png');

    await ctx.storage.fGetObject(ctx.bucket, asset.storageKey, source);

    try {
      await extractFrame(source, frame);
    } catch (error) {
      // A timeout may pass on a retry; a file ffmpeg rejects never will
      if (error instanceof ExecError && !error.timedOut) {
        throw new NonRetryableJobError(
          `ffmpeg could not read the video: ${error.stderr.trim().slice(-300)}`,
        );
      }
      throw error;
    }

    const thumbnail = await makeThumbnail(frame);
    const thumbnailKey = await uploadThumbnail(ctx, asset.id, thumbnail);
    await updateAssetThumbnail(ctx.db, asset.id, thumbnailKey);
    logger.info(
      { assetId: asset.id, thumbnailKey, bytes: thumbnail.length },
      'video poster created',
    );
  });
}
