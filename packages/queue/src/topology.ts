import type { Channel } from 'amqplib';
import type { JobType } from './jobs.ts';

export const JOBS_EXCHANGE = 'dam.jobs';
export const DEAD_LETTER_EXCHANGE = 'dam.jobs.dlx';

// How many times a failed job is put back on its queue before it is dead-lettered
export const DELIVERY_LIMIT = 5;

export const queues = {
  'image.process': {
    queue: 'dam.image-processing',
    deadLetterQueue: 'dam.image-processing.dlq',
  },
  'video.process': {
    queue: 'dam.video-processing',
    deadLetterQueue: 'dam.video-processing.dlq',
  },
} satisfies Record<JobType, { queue: string; deadLetterQueue: string }>;

// Declares exchanges, queues and bindings. Safe to run on every startup.
// Changing the arguments of an existing queue fails, so delete the queue first.
export async function setupTopology(channel: Channel) {
  await channel.assertExchange(JOBS_EXCHANGE, 'direct', { durable: true });
  await channel.assertExchange(DEAD_LETTER_EXCHANGE, 'direct', {
    durable: true,
  });

  for (const [jobType, { queue, deadLetterQueue }] of Object.entries(queues)) {
    await channel.assertQueue(deadLetterQueue, {
      durable: true,
      arguments: { 'x-queue-type': 'quorum' },
    });
    // Dead-lettered messages keep their routing key, which is the job type
    await channel.bindQueue(deadLetterQueue, DEAD_LETTER_EXCHANGE, jobType);

    await channel.assertQueue(queue, {
      durable: true,
      arguments: {
        'x-queue-type': 'quorum',
        'x-delivery-limit': DELIVERY_LIMIT,
        'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
        // Keeps the message in this queue until the dead letter queue confirms it
        'x-dead-letter-strategy': 'at-least-once',
        'x-overflow': 'reject-publish',
      },
    });
    await channel.bindQueue(queue, JOBS_EXCHANGE, jobType);
  }
}
