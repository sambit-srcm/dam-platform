import { consumeJobs } from '@dam/queue';
import { config } from './config.ts';
import { createContext } from './context.ts';
import { UnprocessableMediaError } from './lib/errors.ts';
import { killAllChildren } from './lib/exec.ts';
import { logger } from './logger.ts';
import { processVideo } from './processVideo.ts';
import { markAssetFailed } from './repository.ts';

const ctx = await createContext();

// The job running right now, so shutdown can wait for it to clean up after itself
let inFlight: Promise<void> = Promise.resolve();

const stopConsuming = await consumeJobs(
  ctx.queue,
  'video.process',
  async ({ assetId }) => {
    const job = processVideo(ctx, assetId);
    inFlight = job.catch(() => undefined);
    await job;
  },
  {
    prefetch: config.VIDEO_PREFETCH,
    onError: async (error, { type, attempt, willRetry, payload }) => {
      logger.error(
        { err: error, jobType: type, attempt, willRetry },
        'job failed',
      );

      // Out of retries: record it on the asset instead of leaving it at processing.
      // A bad file already has a specific reason, so don't overwrite that one.
      if (
        !willRetry &&
        payload &&
        !(error instanceof UnprocessableMediaError)
      ) {
        await markAssetFailed(ctx.db, payload.assetId, 'processing_failed');
      }
    },
  },
);

logger.info(
  { prefetch: config.VIDEO_PREFETCH, threads: config.FFMPEG_THREADS },
  'video worker started',
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

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
  // The interrupted job can't report back once the channel is closed, which is expected
  if (!shuttingDown) process.exit(1);
});
