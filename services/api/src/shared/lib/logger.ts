import { pino } from 'pino';
import { config } from '../../config.ts';

export const logger = pino({
  level: config.LOG_LEVEL,
  // Keep secrets out of the logs
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});
