import type { NextFunction, Request, Response } from 'express';
import { MulterError } from 'multer';
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

  // Rejected uploads are the caller's problem, not a server fault
  if (error instanceof MulterError) {
    const tooLarge = error.code === 'LIMIT_FILE_SIZE';
    log.warn({ err: error, code: error.code }, 'upload rejected');
    res.status(tooLarge ? 413 : 400).json({
      error: {
        code: tooLarge ? 'file_too_large' : 'upload_error',
        message: tooLarge
          ? `File is larger than the ${config.MAX_UPLOAD_MB} MB limit`
          : error.message,
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
