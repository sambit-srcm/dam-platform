import type { Db } from '@dam/db';
import type { Request, Response } from 'express';
import { vi } from 'vitest';
import type { AuthUser } from '../shared/lib/actor.ts';

type Step = { method: string; args: unknown[] };

// A stand-in for the database. Each query started (select, insert, update, execute)
// takes the next answer you gave, and every step chained onto it is written down.
export function fakeDb(...answers: unknown[]) {
  const queue = [...answers];
  const queries: Step[][] = [];

  const start =
    (method: string) =>
    (...args: unknown[]) => {
      const steps: Step[] = [{ method, args }];
      queries.push(steps);
      const answer = queue.length > 0 ? queue.shift() : [];

      const chain: object = new Proxy(
        {},
        {
          get(_target, name) {
            if (name === 'then') {
              return (
                resolve: (value: unknown) => void,
                reject: (reason: unknown) => void,
              ) => Promise.resolve(answer).then(resolve, reject);
            }
            return (...stepArgs: unknown[]) => {
              steps.push({ method: String(name), args: stepArgs });
              return chain;
            };
          },
        },
      );
      return chain;
    };

  const db = {
    select: start('select'),
    insert: start('insert'),
    update: start('update'),
    execute: start('execute'),
  };

  return {
    db: db as unknown as Db,
    queries,
    // The chained steps of one query, e.g. ['select', 'from', 'where']
    stepsOf: (index: number) => queries[index]!.map((step) => step.method),
    // The arguments given to a step, e.g. the number passed to limit()
    argsOf: (index: number, method: string) =>
      queries[index]!.find((step) => step.method === method)?.args,
  };
}

export function fakeReq(
  parts: {
    body?: unknown;
    params?: Record<string, string>;
    query?: Record<string, string>;
    user?: AuthUser;
  } = {},
) {
  const log = { info: vi.fn() };
  const req = { body: {}, params: {}, query: {}, ...parts, log };
  return { req: req as unknown as Request, log };
}

export function fakeRes() {
  const res = {
    json: vi.fn(),
    status: vi.fn(),
    end: vi.fn(),
    cookie: vi.fn(),
    clearCookie: vi.fn(),
  };
  res.status.mockReturnValue(res);
  return { res: res as unknown as Response, mocks: res };
}
