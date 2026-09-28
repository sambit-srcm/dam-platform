import { markAssetFailed } from './repository.ts';
import { consumeJobs } from '@dam/queue';
import { config } from './config.ts';
import { createContext } from './context.ts';
import { logger } from './logger.ts';
import { processImage } from './processImage.ts';
import { writeFileSync } from 'node:fs';

const ctx = await createContext();
function touchHeartbeat() {
  writeFileSync(config.HEARTBEAT_FILE, Date.now().toString());
}
touchHeartbeat();
const heartbeatTimer = setInterval(touchHeartbeat, 30_000);
heartbeatTimer.unref();

const stopConsuming = await consumeJobs(
  ctx.queue,
  'image.process',
  async ({ assetId }) => {
    await processImage(ctx, assetId);
    touchHeartbeat();
  },
  {
    prefetch: config.WORKER_PREFETCH,
    onError: async (error, { type, attempt, willRetry, payload }) => {
      logger.error(
        { err: error, jobType: type, attempt, willRetry },
        'job failed',
      );

      // Out of retries: record it on the asset instead of leaving it at processing
      if (!willRetry && payload) {
        await markAssetFailed(ctx.db, payload.assetId);
      }
    },
  },
);

logger.info(
  { prefetch: config.WORKER_PREFETCH, thumbnailWidth: config.THUMBNAIL_WIDTH },
  'image worker started',
);

let shuttingDown = false;

async function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'shutting down');

  await stopConsuming();
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
