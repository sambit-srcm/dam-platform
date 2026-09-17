import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { pino } from 'pino';
import { config } from './config.ts';

export const logger = pino({
  level: config.LOG_LEVEL,
  // Keep secrets out of the logs
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

declare global {
  namespace Express {
    interface Request {
      id: string;
      log: typeof logger;
    }
  }
}

// Gives every request an id and logs how it finished
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  req.id = randomUUID();
  req.log = logger.child({ requestId: req.id });
  res.setHeader('x-request-id', req.id);

  const startedAt = process.hrtime.bigint();

  res.on('finish', () => {
    const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    req.log.info(
      {
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(ms),
      },
      'request finished',
    );
  });

  next();
}
