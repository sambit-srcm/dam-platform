import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { config } from '../../config.ts';
import { logger } from '../lib/logger.ts';
import { AppError } from '../errors/AppError.ts';

// Must be registered last. Express 5 also sends rejected promises here.
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const log = req.log ?? logger;

  // Headers are already out, so the response can't be changed any more
  if (res.headersSent) {
    log.error({ err: error }, 'error after the response had started');
    res.destroy();
    return;
  }

  if (error instanceof ZodError) {
    log.warn({ err: error }, 'invalid request body');
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; '),
        requestId: req.id,
      },
    });
    return;
  }

  if (error instanceof AppError) {
    log.warn({ err: error, code: error.code }, error.message);
    res.status(error.status).json({
      error: { code: error.code, message: error.message, requestId: req.id },
    });
    return;
  }

  // Anything else is a bug, so don't leak its details to the caller
  log.error({ err: error }, 'unhandled error');
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something went wrong',
      requestId: req.id,
    },
  });
}
