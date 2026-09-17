import type { NextFunction, Request, Response } from 'express';
import { logger } from './logger.ts';

export class AppError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, 'validation_error', message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(404, 'not_found', message);
  }
}

export function notFoundHandler(
  _req: Request,
  _res: Response,
  next: NextFunction,
) {
  next(new NotFoundError());
}

// Must be registered last. Express 5 also sends rejected promises here.
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
) {
  const log = req.log ?? logger;

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
