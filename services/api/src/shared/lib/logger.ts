import { DrizzleQueryError } from 'drizzle-orm';
import { pino, stdSerializers } from 'pino';
import { config } from '../../config.ts';

// A failed query's message, stack and params hold the bound values, such as a password hash
function serializeError(error: unknown) {
  if (error instanceof DrizzleQueryError) {
    const cause = error.cause ?? new Error('database query failed');
    return { ...stdSerializers.err(cause as Error), type: error.name };
  }
  return stdSerializers.err(error as Error);
}

export const logger = pino({
  level: config.LOG_LEVEL,
  serializers: { err: serializeError },
  // Keep secrets out of the logs
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});
