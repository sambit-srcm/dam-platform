import { findAssetById, markAssetFailed } from './repository.ts';
import { consumeJobs } from '@dam/queue';
import { config } from './config.ts';
import { createContext } from './context.ts';
import { logger } from './logger.ts';
import { killAllChildren } from './lib/exec.ts';
import { processThumbnail } from './processThumbnail.ts';
import { writeFileSync } from 'node:fs';

const ctx = await createContext();
function touchHeartbeat() {
  writeFileSync(config.HEARTBEAT_FILE, Date.now().toString());
}
touchHeartbeat();
const heartbeatTimer = setInterval(touchHeartbeat, 30_000);
heartbeatTimer.unref();

// The job running right now, so shutdown can wait for it to clean up after itself
let inFlight: Promise<void> = Promise.resolve();

const stopConsuming = await consumeJobs(
  ctx.queue,
  'thumbnail.generate',
  async ({ assetId }) => {
    const job = processThumbnail(ctx, assetId);
    inFlight = job.catch(() => undefined);
    await job;
    touchHeartbeat();
  },
  {
    prefetch: config.WORKER_PREFETCH,
    onError: async (error, { type, attempt, willRetry, payload }) => {
      logger.error(
        { err: error, jobType: type, attempt, willRetry },
        'job failed',
      );

      // Out of retries: an image is stuck at processing, so mark it failed.
      // A video keeps the status the video worker gave it, poster or not.
      if (!willRetry && payload) {
        const asset = await findAssetById(ctx.db, payload.assetId);
        if (asset?.mimeType.startsWith('image/')) {
          await markAssetFailed(ctx.db, payload.assetId);
        }
      }
    },
  },
);

logger.info(
  { prefetch: config.WORKER_PREFETCH, thumbnailWidth: config.THUMBNAIL_WIDTH },
  'thumbnail worker started',
);

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'shutting down');

  // Stops taking new jobs; the running one goes back on the queue unacknowledged
  await stopConsuming();
  killAllChildren();
  // Killing ffmpeg makes the job fail, and its temp folder is removed as it unwinds
  await inFlight;
  await ctx.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));
ctx.queue.connection.on('close', () => {
  logger.error('rabbitmq connection closed');
  if (!shuttingDown) process.exit(1);
});
ctx.queue.connection.on('error', (error) => {
  logger.error({ err: error }, 'rabbitmq connection error');
});

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
  process.exit(1);
});
