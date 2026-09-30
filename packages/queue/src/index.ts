import { randomUUID } from 'node:crypto';
import {
  connect,
  type ChannelModel,
  type ConfirmChannel,
  type ConsumeMessage,
} from 'amqplib';
import type { JobPayloads, JobType } from './jobs.ts';
import {
  DELIVERY_LIMIT,
  JOBS_EXCHANGE,
  queues,
  setupTopology,
} from './topology.ts';

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
export type JobErrorContext<T extends JobType = JobType> = {
  type: T;
  queue: string;
  /** Which attempt this was, starting at 1 */
  attempt: number;
  /** False means the job is being dead-lettered now */
  willRetry: boolean;
  /** Missing only when the message could not be parsed */
  payload?: JobPayloads[T];
};

export type JobErrorHandler<T extends JobType = JobType> = (
  error: unknown,
  context: JobErrorContext<T>,
) => void | Promise<void>;

// Used when a consumer passes no onError, so a failure is never silent
function logToConsole(error: unknown, context: JobErrorContext) {
  console.error(
    `job ${context.type} failed on attempt ${context.attempt} (willRetry=${context.willRetry})`,
    error,
  );
}

export async function consumeJobs<T extends JobType>(
  jobQueue: JobQueue,
  type: T,
  handler: JobHandler<T>,
  {
    prefetch = 1,
    onError = logToConsole,
  }: { prefetch?: number; onError?: JobErrorHandler<T> } = {},
) {
  const channel = await jobQueue.connection.createChannel();
  await channel.prefetch(prefetch);

  const { consumerTag } = await channel.consume(
    queues[type].queue,
    async (message) => {
      // null means RabbitMQ cancelled the consumer, e.g. the queue was deleted
      if (!message) return;

      // Quorum queues count redeliveries for us
      const attempt =
        Number(message.properties.headers?.['x-delivery-count'] ?? 0) + 1;

      const report = async (
        error: unknown,
        willRetry: boolean,
        payload?: JobPayloads[T],
      ) => {
        try {
          await onError(error, {
            type,
            queue: queues[type].queue,
            attempt,
            willRetry,
            payload,
          });
        } catch (reporterError) {
          console.error('onError handler threw', reporterError);
        }
      };

      let payload: JobPayloads[T];
      try {
        payload = JSON.parse(message.content.toString());
      } catch (error) {
        // Bad JSON will never succeed, so don't retry it
        await report(error, false);
        channel.nack(message, false, false);
        return;
      }

      try {
        await handler(payload, message);
        channel.ack(message);
      } catch (error) {
        // Requeued jobs are dead-lettered once they pass DELIVERY_LIMIT
        const retry = !(error instanceof NonRetryableJobError);
        await report(error, retry && attempt < DELIVERY_LIMIT, payload);
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

// Ids of jobs RabbitMQ handed back because no queue was bound for them
const returnedByChannel = new WeakMap<ConfirmChannel, Set<string>>();

function returnedJobs(channel: ConfirmChannel) {
  let returned = returnedByChannel.get(channel);
  if (!returned) {
    const ids = new Set<string>();
    channel.on('return', (message: ConsumeMessage) => {
      ids.add(String(message.properties.messageId));
    });
    returnedByChannel.set(channel, ids);
    returned = ids;
  }
  return returned;
}

// A job with no queue to go to is still confirmed, so without "mandatory" it would
// vanish. RabbitMQ sends the return before the confirm, so it is known by then.
function publishConfirmed(
  channel: ConfirmChannel,
  type: JobType,
  content: Buffer,
) {
  const returned = returnedJobs(channel);
  const messageId = randomUUID();

  return new Promise<void>((resolve, reject) => {
    channel.publish(
      JOBS_EXCHANGE,
      type,
      content,
      {
        persistent: true,
        contentType: 'application/json',
        mandatory: true,
        messageId,
      },
      (error) => {
        if (error) return reject(error);
        if (returned.delete(messageId)) {
          return reject(new Error(`No queue is bound for "${type}" jobs`));
        }
        resolve();
      },
    );
  });
}
