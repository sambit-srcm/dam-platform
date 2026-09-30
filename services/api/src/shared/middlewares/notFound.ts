import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../errors/AppError.ts';

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
