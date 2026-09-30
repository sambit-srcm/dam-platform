import { describe, expect, it } from 'vitest';
import {
  AppError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  UnauthorizedError,
  ValidationError,
} from '../AppError.ts';

describe('errors the API can show to people', () => {
  it.each([
    [new ValidationError('bad'), 400, 'validation_error'],
    [new UnauthorizedError(), 401, 'unauthorized'],
    [new ForbiddenError(), 403, 'forbidden'],
    [new NotFoundError(), 404, 'not_found'],
    [new ConflictError('taken'), 409, 'conflict'],
    [new ServiceUnavailableError(), 503, 'service_unavailable'],
  ])('%o carries the right status and code', (error, status, code) => {
    expect(error.status).toBe(status);
    expect(error.code).toBe(code);
    expect(error).toBeInstanceOf(AppError);
    expect(error).toBeInstanceOf(Error);
  });

  it('shows its own class name in logs', () => {
    expect(new NotFoundError().name).toBe('NotFoundError');
    expect(new ConflictError('x').name).toBe('ConflictError');
  });

  it('has a sensible default message', () => {
    expect(new NotFoundError().message).toBe('Not found');
    expect(new UnauthorizedError().message).toBe('Authentication required');
  });
});
