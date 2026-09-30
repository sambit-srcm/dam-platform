import { stat } from 'node:fs/promises';
import { join } from 'node:path';
import { NonRetryableJobError } from '@dam/queue';
import type { Context } from './context.ts';
import { UnprocessableMediaError } from './lib/errors.ts';
import { withTempDir } from './lib/tempdir.ts';
import { planRenditions } from './ladder.ts';
import { logger } from './logger.ts';
import { probeVideo } from './probe.ts';
import {
  completeVideoAsset,
  findAssetById,
  markAssetFailed,
  markAssetProcessing,
} from './repository.ts';
import { videoTags } from './tags.ts';
import { transcodeRung } from './transcode.ts';

export async function processVideo(ctx: Context, assetId: string) {
  const asset = await findAssetById(ctx.db, assetId);
  if (!asset) {
    // Retrying will not make the asset appear
    throw new NonRetryableJobError(`Asset ${assetId} was not found`);
  }
  if (!asset.mimeType.startsWith('video/')) {
    throw new NonRetryableJobError(`Asset ${assetId} is not a video`);
  }
  // Jobs are delivered at least once, so a repeat of finished work is simply dropped
  if (asset.status === 'ready') return;

  const log = logger.child({ assetId, storageKey: asset.storageKey });
  await markAssetProcessing(ctx.db, assetId);

  try {
    await withTempDir(async (dir) => {
      const source = join(dir, 'source');

      // Straight to disk, because a video can be far bigger than memory
      await ctx.storage.fGetObject(ctx.bucket, asset.storageKey, source);

      const metadata = await probeVideo(source);
      const plan = planRenditions(metadata);
      log.info({ metadata, plan: plan.map((r) => r.label) }, 'video probed');

      // One size at a time, deleting each file once it is uploaded, so the disk
      // never holds more than the original plus a single output
      const outputs = [];
      for (const rung of plan) {
        const outputPath = join(dir, `${rung.label}.mp4`);
        await transcodeRung({
          input: source,
          output: outputPath,
          rung,
          durationSeconds: metadata.durationSeconds,
        });

        // Named after the asset, so a retry overwrites instead of piling up
        const storageKey = `videos/renditions/${assetId}/${rung.label}.mp4`;
        await ctx.storage.fPutObject(ctx.bucket, storageKey, outputPath, {
          'Content-Type': 'video/mp4',
        });
        const { size } = await stat(outputPath);
        outputs.push({
          label: rung.label,
          storageKey,
          mimeType: 'video/mp4',
          width: rung.width,
          height: rung.height,
          sizeBytes: size,
        });
        log.info({ label: rung.label, bytes: size }, 'rendition created');
      }

      await completeVideoAsset(ctx.db, assetId, {
        metadata,
        tags: videoTags(metadata),
        outputs,
      });
      log.info({ renditions: outputs.length }, 'video ready');
    });
  } catch (error) {
    // Record why a bad file failed so the owner can see it
    if (error instanceof UnprocessableMediaError) {
      await markAssetFailed(ctx.db, assetId, error.reason);
    }
    throw error;
  }
}
