import { createApp } from './app.ts';
import { config } from './config.ts';
import { createContext } from './shared/lib/context.ts';
import { logger } from './shared/lib/logger.ts';

const ctx = await createContext();
const server = createApp(ctx).listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'api started');
});

// Give in-flight requests this long to finish before the process exits anyway
const SHUTDOWN_TIMEOUT_MS = 10_000;

let shuttingDown = false;

// Finish in-flight requests, then close the database and queue connections
function shutdown(signal: string) {
  if (shuttingDown) return;
  shuttingDown = true;

  logger.info({ signal }, 'shutting down');

  // Idle keep-alive connections would otherwise hold the server open
  server.closeIdleConnections();

  const forceExit = setTimeout(() => {
    logger.warn({ timeoutMs: SHUTDOWN_TIMEOUT_MS }, 'shutdown timed out');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close(async () => {
    try {
      await ctx.close();
    } catch (error) {
      logger.error({ err: error }, 'failed to close connections cleanly');
    }
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
  process.exit(1);
});
