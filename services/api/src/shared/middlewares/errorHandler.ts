import type { NextFunction, Request, Response } from 'express';
import { ZodError } from 'zod';
import { logger } from '../lib/logger.ts';
import { AppError } from '../errors/AppError.ts';

// Postgres rejects these before the row is stored. The message stays generic so
// constraint names and column details never reach the client.
const DATABASE_CLIENT_ERRORS: Record<string, string> = {
  '22001': 'A value is too long',
  '22007': 'A date is invalid',
  '22008': 'A date is out of range',
  '22P02': 'A value has the wrong format',
  '23502': 'A required value is missing',
  '23514': 'A value is not allowed',
};

function readCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined;
  }
  const code = (error as { code: unknown }).code;
  return typeof code === 'string' ? code : undefined;
}

function databaseClientMessage(error: unknown): string | undefined {
  const direct = DATABASE_CLIENT_ERRORS[readCode(error) ?? ''];
  if (direct) return direct;
  if (typeof error !== 'object' || error === null || !('cause' in error)) {
    return undefined;
  }
  return DATABASE_CLIENT_ERRORS[readCode(error.cause) ?? ''];
}

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

  const dbMessage = databaseClientMessage(error);
  if (dbMessage) {
    log.warn({ err: error }, 'rejected by the database');
    res.status(400).json({
      error: {
        code: 'validation_error',
        message: dbMessage,
        requestId: req.id,
      },
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
