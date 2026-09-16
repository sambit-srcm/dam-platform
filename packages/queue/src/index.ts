import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
} from 'amqplib';
import type { JobPayloads, JobType } from './jobs.ts';
import { JOBS_EXCHANGE, queues, setupTopology } from './topology.ts';

export * from './jobs.ts';
export * from './topology.ts';

// Throw from a job handler to skip retries and send the job straight to its dead letter queue
export class NonRetryableJobError extends Error {
  name = 'NonRetryableJobError';
}

export type JobQueue = {
  connection: ChannelModel;
  publishChannel: ConfirmChannel;
  close(): Promise<void>;
};

export type JobHandler<T extends JobType> = (
  payload: JobPayloads[T],
  message: ConsumeMessage,
) => Promise<void>;

export async function connectJobQueue(url: string): Promise<JobQueue> {
  const connection = await connect(url);
  const publishChannel = await connection.createConfirmChannel();
  await setupTopology(publishChannel);

  return {
    connection,
    publishChannel,
    close: () => connection.close(),
  };
}

// Resolves once RabbitMQ has stored the job, rejects if it was refused
export function publishJob<T extends JobType>(
  jobQueue: JobQueue,
  type: T,
  payload: JobPayloads[T],
) {
  return publishConfirmed(
    jobQueue.publishChannel,
    type,
    Buffer.from(JSON.stringify(payload)),
  );
}

// Runs the handler for each job. Returns a function that stops consuming.
export async function consumeJobs<T extends JobType>(
  jobQueue: JobQueue,
  type: T,
  handler: JobHandler<T>,
  { prefetch = 1 }: { prefetch?: number } = {},
) {
  const channel = await jobQueue.connection.createChannel();
  await channel.prefetch(prefetch);

  const { consumerTag } = await channel.consume(
    queues[type].queue,
    async (message) => {
      // null means RabbitMQ cancelled the consumer, e.g. the queue was deleted
      if (!message) return;

      let payload: JobPayloads[T];
      try {
        payload = JSON.parse(message.content.toString());
      } catch {
        // Bad JSON will never succeed, so don't retry it
        channel.nack(message, false, false);
        return;
      }

      try {
        await handler(payload, message);
        channel.ack(message);
      } catch (error) {
        // Requeued jobs are dead-lettered once they pass DELIVERY_LIMIT
        const retry = !(error instanceof NonRetryableJobError);
        channel.nack(message, false, retry);
      }
    },
  );

  return async () => {
    await channel.cancel(consumerTag);
    await channel.close();
  };
}

// Moves jobs from a dead letter queue back to their main queue. Returns how many were moved.
export async function replayDeadLetters(
  jobQueue: JobQueue,
  type: JobType,
  limit = Infinity,
) {
  const channel = await jobQueue.connection.createConfirmChannel();
  let replayed = 0;

  try {
    while (replayed < limit) {
      const message = await channel.get(queues[type].deadLetterQueue);
      if (!message) break;

      await publishConfirmed(channel, type, message.content);
      // Ack only after the replayed copy is stored, so a failure leaves it in the dead letter queue
      channel.ack(message);
      replayed++;
    }
  } finally {
    await channel.close();
  }

  return replayed;
}

function publishConfirmed(
  channel: ConfirmChannel,
  type: JobType,
  content: Buffer,
) {
  return new Promise<void>((resolve, reject) => {
    channel.publish(
      JOBS_EXCHANGE,
      type,
      content,
      { persistent: true, contentType: 'application/json' },
      (error) => (error ? reject(error) : resolve()),
    );
  });
}
