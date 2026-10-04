import type { NextFunction, Request, Response } from 'express';
import { randomUUID } from 'node:crypto';
import { logger } from '../lib/logger.ts';

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
    const path = (req.originalUrl.split('?')[0] ?? req.originalUrl).replace(
      /(\/shares\/)[^/]+/,
      '$1[redacted]',
    );
    // Health probes run constantly; only log them when they fail
    if (path.startsWith('/health') && res.statusCode < 400) return;

    const ms = Number(process.hrtime.bigint() - startedAt) / 1_000_000;
    req.log.info(
      {
        method: req.method,
        path,
        status: res.statusCode,
        durationMs: Math.round(ms),
      },
      'request finished',
    );
  });

  next();
}
