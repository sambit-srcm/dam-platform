import type { Request, RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit, type Store } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import { config } from '../../config.ts';
import { TooManyRequestsError } from '../errors/AppError.ts';
import type { Context } from '../lib/context.ts';

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type LimiterOptions = {
  windowMs: number;
  limit: number;
  message: string;
  // Who the count belongs to. Defaults to the client IP address.
  key?: (req: Request) => string;
  // Count only requests that end in an error
  onlyFailures?: boolean;
  // Let requests through when the counter store is down. Off for anything guarding passwords.
  failOpen?: boolean;
  skip?: (req: Request) => boolean;
  store?: Store;
};

const clientAddress = (req: Request) => ipKeyGenerator(req.ip ?? '');

export function buildLimiter(options: LimiterOptions): RequestHandler {
  return rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    keyGenerator: options.key ?? clientAddress,
    skip: options.skip,
    skipSuccessfulRequests: options.onlyFailures ?? false,
    passOnStoreError: options.failOpen ?? false,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    store: options.store,
    // Retry-After is already set by the time this runs
    handler: (_req, _res, next) =>
      next(new TooManyRequestsError(options.message)),
  });
}

export type RateLimiters = {
  global: RequestHandler;
  loginByAddress: RequestHandler;
  loginByAccount: RequestHandler;
  register: RequestHandler;
  perUser: RequestHandler;
  uploadStart: RequestHandler;
};

const passThrough: RequestHandler = (_req, _res, next) => next();

export const accountKey = (req: Request) => {
  const email: unknown = req.body?.email;
  const normalised =
    typeof email === 'string' ? email.trim().toLowerCase() : '';
  return `${clientAddress(req)}|${normalised}`;
};

const userKey = (req: Request) => req.user?.id ?? clientAddress(req);

// Counters live in Redis, so every API replica shares one count per caller
export function createRateLimiters(ctx: Context): RateLimiters {
  const make = (name: string, options: LimiterOptions) =>
    config.RATE_LIMIT_ENABLED
      ? buildLimiter({
          ...options,
          store: new RedisStore({
            prefix: `rl:${name}:`,
            sendCommand: (...args: string[]) =>
              ctx.redis.sendCommand(args) as Promise<never>,
          }),
        })
      : passThrough;

  return {
    // Cheap flood guard ahead of body parsing. Health probes must never be turned away.
    global: make('global', {
      windowMs: MINUTE,
      limit: 600,
      failOpen: true,
      skip: (req) => req.path.startsWith('/health'),
      message: 'Too many requests, please slow down',
    }),
    // Many guesses at many accounts from one address
    loginByAddress: make('login-address', {
      windowMs: 15 * MINUTE,
      limit: 30,
      onlyFailures: true,
      message: 'Too many failed sign-in attempts, try again later',
    }),
    // Repeated guesses at one account from one address
    loginByAccount: make('login-account', {
      windowMs: 15 * MINUTE,
      limit: 10,
      key: accountKey,
      onlyFailures: true,
      message: 'Too many failed sign-in attempts, try again later',
    }),
    register: make('register', {
      windowMs: HOUR,
      limit: 10,
      message: 'Too many accounts created from this address, try again later',
    }),
    // Behind requireAuth, so the count follows the person and not a shared office address
    perUser: make('user', {
      windowMs: MINUTE,
      limit: 600,
      key: userKey,
      failOpen: true,
      message: 'Too many requests, please slow down',
    }),
    // Every upload opens a multipart upload in storage and a database row
    uploadStart: make('upload-start', {
      windowMs: HOUR,
      limit: 60,
      key: userKey,
      failOpen: true,
      message: 'Too many uploads started, try again later',
    }),
  };
}
