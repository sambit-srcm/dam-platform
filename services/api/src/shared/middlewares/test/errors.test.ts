import type { NextFunction, Request, Response } from 'express';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import { ConflictError } from '../../errors/AppError.ts';
import { errorHandler } from '../errorHandler.ts';

function setup() {
  const log = { warn: vi.fn(), error: vi.fn() };
  const req = { id: 'req-1', log } as unknown as Request;
  const json = vi.fn();
  const res = { headersSent: false, json, status: vi.fn() };
  res.status.mockReturnValue(res);
  return { req, res: res as unknown as Response, mocks: res, log, json };
}

const next = (() => undefined) as NextFunction;

describe('errorHandler', () => {
  it('answers an app error with its own status, code and message', () => {
    const { req, res, mocks, json } = setup();

    errorHandler(new ConflictError('already exists'), req, res, next);

    expect(mocks.status).toHaveBeenCalledWith(409);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'conflict',
        message: 'already exists',
        requestId: 'req-1',
      },
    });
  });

  it('answers a validation failure with a 400 listing each field', () => {
    const { req, res, mocks, json } = setup();
    const parsed = z
      .object({ email: z.string().email(), age: z.number() })
      .safeParse({ email: 'nope', age: 'x' });

    errorHandler(parsed.error, req, res, next);

    expect(mocks.status).toHaveBeenCalledWith(400);
    const { error } = json.mock.calls[0]![0];
    expect(error.code).toBe('validation_error');
    expect(error.message).toContain('email:');
    expect(error.message).toContain('age:');
  });

  it('hides the details of an unexpected error', () => {
    const { req, res, mocks, json, log } = setup();

    errorHandler(new Error('db password is hunter2'), req, res, next);

    expect(mocks.status).toHaveBeenCalledWith(500);
    expect(json).toHaveBeenCalledWith({
      error: {
        code: 'internal_error',
        message: 'Something went wrong',
        requestId: 'req-1',
      },
    });
    expect(log.error).toHaveBeenCalledOnce();
  });
});
