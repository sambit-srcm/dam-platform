import type { UserRole } from '@dam/db';
import { currentUser } from './requireAuth.ts';
import type { Request, Response, NextFunction } from 'express';
import { ForbiddenError } from '../errors/AppError.ts';

export function requireRole(role: UserRole) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (currentUser(req).role !== role) {
      return next(new ForbiddenError());
    }
    next();
  };
}
