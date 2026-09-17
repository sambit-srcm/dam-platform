import { pingDb } from '@dam/db';
import { Router } from 'express';
import { config } from './config.ts';
import type { Context } from './context.ts';

type CheckResult = {
  status: 'up' | 'down';
  latencyMs: number;
  error?: string;
};

function withTimeout<T>(promise: Promise<T>, ms: number) {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`timed out after ${ms}ms`)),
      ms,
    );
    promise.then(resolve, reject).finally(() => clearTimeout(timer));
  });
}

async function runCheck(check: () => Promise<unknown>): Promise<CheckResult> {
  const startedAt = process.hrtime.bigint();
  const latency = () =>
    Math.round(Number(process.hrtime.bigint() - startedAt) / 1_000_000);

  try {
    await withTimeout(check(), config.HEALTH_TIMEOUT_MS);
    return { status: 'up', latencyMs: latency() };
  } catch (error) {
    return {
      status: 'down',
      latencyMs: latency(),
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function healthRoutes(ctx: Context) {
  const router = Router();

  // Is the process alive. Used for restarts, so it never touches other services.
  router.get('/live', (_req, res) => {
    res.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) });
  });

  // Can the API reach everything it needs. Used to decide whether to send it traffic.
  router.get('/ready', async (req, res) => {
    const [postgres, redis, minio, rabbitmq] = await Promise.all([
      runCheck(() => pingDb(ctx.db)),
      runCheck(() => ctx.redis.ping()),
      runCheck(async () => {
        const exists = await ctx.storage.bucketExists(ctx.bucket);
        if (!exists) throw new Error(`bucket "${ctx.bucket}" not found`);
      }),
      runCheck(async () => {
        // Opening and closing a channel proves the connection is usable
        const channel = await ctx.queue.connection.createChannel();
        await channel.close();
      }),
    ]);

    const checks = { postgres, redis, minio, rabbitmq };
    const ready = Object.values(checks).every((c) => c.status === 'up');

    if (!ready) {
      req.log.warn({ checks }, 'readiness check failed');
    }

    res.status(ready ? 200 : 503).json({
      status: ready ? 'ok' : 'degraded',
      checks,
    });
  });

  router.get('/', (_req, res) => {
    res.json({ status: 'ok' });
  });

  return router;
}
