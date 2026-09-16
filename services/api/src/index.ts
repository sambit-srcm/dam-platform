import { createApp } from './app.ts';
import { config } from './config.ts';
import { createContext } from './context.ts';
import { logger } from './logger.ts';

const ctx = await createContext();
const server = createApp(ctx).listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'api started');
});

// Finish in-flight requests, then close the database and queue connections
async function shutdown(signal: string) {
  logger.info({ signal }, 'shutting down');
  server.close(async () => {
    await ctx.close();
    process.exit(0);
  });
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error({ err: reason }, 'unhandled rejection');
  process.exit(1);
});
