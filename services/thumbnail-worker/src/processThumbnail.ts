import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { buffer } from 'node:stream/consumers';
import type { Asset } from '@dam/db';
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

const PROBE_TIMEOUT_MS = 60_000;
const FRAME_TIMEOUT_MS = 60_000;
// The frame is taken this far into the video, up to THUMBNAIL_FRAME_MAX_SECONDS
const FRAME_POSITION = 0.1;

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
  try {
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
  await markAssetReady(ctx.db, asset.id, thumbnailKey);
  log.info({ thumbnailKey, bytes: thumbnail.length }, 'thumbnail created');
}

async function videoDuration(source: string) {
  const { stdout } = await run(
    config.FFPROBE_PATH,
    [
      '-v',
      'error',
      '-show_entries',
      'format=duration',
      '-of',
      'default=noprint_wrappers=1:nokey=1',
      source,
    ],
    { timeoutMs: PROBE_TIMEOUT_MS },
  );
  const seconds = Number(stdout.trim());
  return Number.isFinite(seconds) && seconds > 0 ? seconds : 0;
}

// Returns false when there is no frame at that position
async function extractFrame(source: string, output: string, seconds: number) {
  await run(
    config.FFMPEG_PATH,
    [
      '-v',
      'error',
      '-ss',
      seconds.toFixed(3),
      '-i',
      source,
      '-frames:v',
      '1',
      '-y',
      output,
    ],
    { timeoutMs: FRAME_TIMEOUT_MS },
  );
  // A seek past the real end makes ffmpeg exit cleanly without writing a file
  return stat(output).then(
    () => true,
    () => false,
  );
}

// The video worker owns the status, so this only ever sets the thumbnail key
async function processVideo(ctx: Context, asset: Asset) {
  // The video worker already gave up on this file
  if (asset.status === 'failed') return;

  const log = logger.child({
    assetId: asset.id,
    storageKey: asset.storageKey,
  });

  await withTempDir(async (dir) => {
    const source = join(dir, 'source');
    const frame = join(dir, 'frame.png');

    await ctx.storage.fGetObject(ctx.bucket, asset.storageKey, source);

    let gotFrame: boolean;
    try {
      const duration = await videoDuration(source);
      const at = Math.min(
        duration * FRAME_POSITION,
        config.THUMBNAIL_FRAME_MAX_SECONDS,
      );
      gotFrame =
        (await extractFrame(source, frame, at)) ||
        (at > 0 && (await extractFrame(source, frame, 0)));
    } catch (error) {
      // A timeout may pass on a retry; a file ffmpeg rejects never will
      if (error instanceof ExecError && !error.timedOut) {
        throw new NonRetryableJobError(
          `Asset ${asset.id} could not be read by ffmpeg: ${error.stderr.trim().slice(-300)}`,
        );
      }
      throw error;
    }
    if (!gotFrame) {
      throw new NonRetryableJobError(`Asset ${asset.id} has no video frame`);
    }

    let thumbnail: Buffer;
    try {
      thumbnail = await makeThumbnail(frame);
    } catch (error) {
      throw new NonRetryableJobError(
        `Asset ${asset.id} frame could not be converted: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }

    const thumbnailKey = await uploadThumbnail(ctx, asset.id, thumbnail);
    await updateAssetThumbnail(ctx.db, asset.id, thumbnailKey);
    log.info({ thumbnailKey, bytes: thumbnail.length }, 'video poster created');
  });
}
