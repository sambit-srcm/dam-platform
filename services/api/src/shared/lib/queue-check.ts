import type { JobQueue } from '@dam/queue';
import { config } from '../../config.ts';
import { ServiceUnavailableError } from '../errors/AppError.ts';
import { withTimeout } from './timeout.ts';

// Opening and closing a channel proves the connection is usable
export async function pingQueue(queue: JobQueue) {
  const channel = await queue.connection.createChannel();
  await channel.close();
}

// Turns a down queue into a 503 before any work is started that needs it
export async function assertQueueAvailable(queue: JobQueue) {
  try {
    await withTimeout(pingQueue(queue), config.HEALTH_TIMEOUT_MS);
  } catch {
    throw new ServiceUnavailableError(
      'Uploads are unavailable right now, please try again shortly',
    );
  }
}
