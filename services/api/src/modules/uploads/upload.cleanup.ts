import { AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { config } from '../../config.ts';
import type { Context } from '../../shared/lib/context.ts';
import { logger } from '../../shared/lib/logger.ts';
import { s3 } from '../../shared/lib/s3.ts';
import { failAsset, findExpiredUploads } from '../assets/asset.repository.ts';
import { clearSession } from './upload.session.ts';

// Throws away uploads that were started but never finished, so the parts
// already in storage stop being paid for and the row stops looking pending.
export async function sweepExpiredUploads(ctx: Context) {
  const expired = await findExpiredUploads(ctx.db, new Date());
  let swept = 0;

  for (const asset of expired) {
    const log = logger.child({ assetId: asset.id });

    try {
      if (asset.upload) {
        await s3.send(
          new AbortMultipartUploadCommand({
            Bucket: ctx.bucket,
            Key: asset.storageKey,
            UploadId: asset.upload.uploadId,
          }),
        );
      }

      await failAsset(ctx.db, asset.id, 'upload_expired');
      await clearSession(ctx, asset.id);

      swept += 1;
      log.info('expired upload cleaned up');
    } catch (error) {
      // One bad row must not stop the rest of the sweep
      log.error({ err: error }, 'failed to clean up an expired upload');
    }
  }

  return swept;
}

// Runs the sweep on a timer and hands back a way to stop it
export function startUploadCleanup(ctx: Context) {
  const everyMs = config.UPLOAD_CLEANUP_INTERVAL_SECONDS * 1000;

  const timer = setInterval(() => {
    sweepExpiredUploads(ctx).catch((error: unknown) => {
      logger.error({ err: error }, 'upload cleanup sweep failed');
    });
  }, everyMs);

  // The timer must not keep the process alive while it is shutting down
  timer.unref();

  return () => clearInterval(timer);
}
