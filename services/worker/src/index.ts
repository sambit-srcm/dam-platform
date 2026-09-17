import { consumeJobs } from '@dam/queue';
import { config } from './config.ts';
import { createContext } from './context.ts';
import { logger } from './logger.ts';
import { processImage } from './processImage.ts';

const ctx = await createContext();

const stopConsuming = await consumeJobs(
  ctx.queue,
  'image.process',
  async ({ assetId }) => {
    await processImage(ctx, assetId);
  },
  { prefetch: config.WORKER_PREFETCH },
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
  // Stops taking new jobs; anything unacknowledged goes back on the queue
  await stopConsuming();
  await ctx.close();
  process.exit(0);
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
  process.exit(1);
});
