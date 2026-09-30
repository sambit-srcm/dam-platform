import type { ConsumeMessage } from 'amqplib';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { consumeJobs, publishJob, type JobQueue } from '../src/index.ts';
import { DELIVERY_LIMIT, JOBS_EXCHANGE, queues } from '../src/topology.ts';

type Deliver = (message: ConsumeMessage | null) => Promise<void>;

const message = (body: unknown, deliveryCount?: number) =>
  ({
    content: Buffer.from(
      typeof body === 'string' ? body : JSON.stringify(body),
    ),
    properties: {
      headers:
        deliveryCount === undefined
          ? {}
          : { 'x-delivery-count': deliveryCount },
    },
  }) as unknown as ConsumeMessage;

// A pretend RabbitMQ: captures the function that receives each job
function setup() {
  let deliver!: Deliver;
  const channel = {
    prefetch: vi.fn().mockResolvedValue(undefined),
    consume: vi.fn(async (_queue: string, callback: Deliver) => {
      deliver = callback;
      return { consumerTag: 'tag-1' };
    }),
    ack: vi.fn(),
    nack: vi.fn(),
    cancel: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
  };
  const jobQueue = {
    connection: { createChannel: vi.fn().mockResolvedValue(channel) },
  } as unknown as JobQueue;

  return { channel, jobQueue, send: (m: ConsumeMessage | null) => deliver(m) };
}

describe('doing jobs', () => {
  const onError = vi.fn();
  beforeEach(() => {
    onError.mockReset();
  });

  it('listens on the right queue for the job type', async () => {
    const { channel, jobQueue } = setup();
    await consumeJobs(jobQueue, 'video.process', async () => {});
    expect(channel.consume.mock.calls[0]![0]).toBe(
      queues['video.process'].queue,
    );
  });

  it('takes one job at a time unless told otherwise', async () => {
    const { channel, jobQueue } = setup();
    await consumeJobs(jobQueue, 'video.process', async () => {});
    expect(channel.prefetch).toHaveBeenCalledWith(1);
  });

  it('can be told to take several jobs at once', async () => {
    const { channel, jobQueue } = setup();
    await consumeJobs(jobQueue, 'thumbnail.generate', async () => {}, {
      prefetch: 4,
    });
    expect(channel.prefetch).toHaveBeenCalledWith(4);
  });

  it('hands the job’s data to the handler and confirms it when it succeeds', async () => {
    const { channel, jobQueue, send } = setup();
    const handler = vi.fn().mockResolvedValue(undefined);
    await consumeJobs(jobQueue, 'video.process', handler);

    const msg = message({ assetId: 'a1' });
    await send(msg);

    expect(handler).toHaveBeenCalledWith({ assetId: 'a1' }, msg);
    expect(channel.ack).toHaveBeenCalledWith(msg);
    expect(channel.nack).not.toHaveBeenCalled();
  });

  it('puts a failed job back for another try', async () => {
    const { channel, jobQueue, send } = setup();
    await consumeJobs(
      jobQueue,
      'video.process',
      async () => {
        throw new Error('ffmpeg crashed');
      },
      { onError },
    );

    const msg = message({ assetId: 'a1' });
    await send(msg);

    expect(channel.nack).toHaveBeenCalledWith(msg, false, true);
    expect(channel.ack).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'ffmpeg crashed' }),
      expect.objectContaining({
        attempt: 1,
        willRetry: true,
        payload: { assetId: 'a1' },
      }),
    );
  });

  it('counts attempts from the number of earlier deliveries', async () => {
    const { jobQueue, send } = setup();
    await consumeJobs(
      jobQueue,
      'video.process',
      async () => {
        throw new Error('x');
      },
      { onError },
    );

    await send(message({ assetId: 'a1' }, 2));

    expect(onError.mock.calls[0]![1]).toMatchObject({
      attempt: 3,
      willRetry: true,
    });
  });

  it('says the job is giving up on its last allowed attempt', async () => {
    const { jobQueue, send } = setup();
    await consumeJobs(
      jobQueue,
      'video.process',
      async () => {
        throw new Error('x');
      },
      { onError },
    );

    await send(message({ assetId: 'a1' }, DELIVERY_LIMIT - 1));

    expect(onError.mock.calls[0]![1]).toMatchObject({
      attempt: DELIVERY_LIMIT,
      willRetry: false,
    });
  });
});

// A pretend publish channel. "returnIt" makes RabbitMQ hand the job back as unroutable.
function publishChannel(options: { error?: Error; returnIt?: boolean } = {}) {
  let onReturn: ((message: ConsumeMessage) => void) | undefined;
  const publish = vi.fn(
    (
      _exchange: string,
      _key: string,
      _content: Buffer,
      opts: { messageId: string },
      done: (e?: Error) => void,
    ) => {
      // Like RabbitMQ: the return arrives before the confirm
      if (options.returnIt) {
        onReturn?.({
          properties: { messageId: opts.messageId },
        } as unknown as ConsumeMessage);
      }
      done(options.error);
    },
  );
  const on = vi.fn((event: string, listener: typeof onReturn) => {
    if (event === 'return') onReturn = listener;
  });
  const jobQueue = { publishChannel: { publish, on } } as unknown as JobQueue;
  return { publish, jobQueue };
}

describe('adding a job to the queue', () => {
  it('sends it as saved JSON under the job name, and waits for RabbitMQ to confirm', async () => {
    const { publish, jobQueue } = publishChannel();

    await publishJob(jobQueue, 'thumbnail.generate', { assetId: 'a1' });

    const [exchange, key, content, options] = publish.mock.calls[0]!;
    expect(exchange).toBe(JOBS_EXCHANGE);
    expect(key).toBe('thumbnail.generate');
    expect(JSON.parse(content.toString())).toEqual({ assetId: 'a1' });
    expect(options).toMatchObject({ persistent: true, mandatory: true });
  });

  it('fails if RabbitMQ refuses the job', async () => {
    const { jobQueue } = publishChannel({ error: new Error('queue full') });

    await expect(
      publishJob(jobQueue, 'video.process', { assetId: 'a1' }),
    ).rejects.toThrow('queue full');
  });

  it('fails instead of losing the job when no queue is bound for it', async () => {
    const { jobQueue } = publishChannel({ returnIt: true });

    await expect(
      publishJob(jobQueue, 'video.process', { assetId: 'a1' }),
    ).rejects.toThrow('No queue is bound for "video.process" jobs');
  });

  it('keeps working for the next job after one was returned', async () => {
    const { jobQueue } = publishChannel({ returnIt: true });
    await publishJob(jobQueue, 'video.process', { assetId: 'a1' }).catch(
      () => undefined,
    );

    const ok = publishChannel();
    await expect(
      publishJob(ok.jobQueue, 'video.process', { assetId: 'a2' }),
    ).resolves.toBeUndefined();
  });
});
