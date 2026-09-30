import type { Channel } from 'amqplib';
import { describe, expect, it, vi } from 'vitest';
import {
  DEAD_LETTER_EXCHANGE,
  DELIVERY_LIMIT,
  JOBS_EXCHANGE,
  queues,
  setupTopology,
} from '../src/topology.ts';

function fakeChannel() {
  return {
    assertExchange: vi.fn().mockResolvedValue({}),
    assertQueue: vi.fn().mockResolvedValue({}),
    bindQueue: vi.fn().mockResolvedValue({}),
  };
}

const setup = async () => {
  const channel = fakeChannel();
  await setupTopology(channel as unknown as Channel);
  return channel;
};

describe('setting up the job queues', () => {
  it('creates the two exchanges: one for jobs and one for jobs that gave up', async () => {
    const channel = await setup();
    const names = channel.assertExchange.mock.calls.map((c) => c[0]);
    expect(names).toEqual([JOBS_EXCHANGE, DEAD_LETTER_EXCHANGE]);
  });

  it('gives every kind of job a queue and a "gave up" queue', async () => {
    const channel = await setup();
    const declared = channel.assertQueue.mock.calls.map((c) => c[0]);

    for (const { queue, deadLetterQueue } of Object.values(queues)) {
      expect(declared).toContain(queue);
      expect(declared).toContain(deadLetterQueue);
    }
  });

  it('creates the "gave up" queue before the queue that points at it', async () => {
    const channel = await setup();
    const declared = channel.assertQueue.mock.calls.map((c) => c[0]);

    for (const { queue, deadLetterQueue } of Object.values(queues)) {
      expect(declared.indexOf(deadLetterQueue)).toBeLessThan(
        declared.indexOf(queue),
      );
    }
  });

  it('makes the queues survive a RabbitMQ restart', async () => {
    const channel = await setup();
    for (const [, options] of channel.assertQueue.mock.calls) {
      expect(options.durable).toBe(true);
    }
  });

  it('sends a job to the "gave up" queue after the allowed number of tries', async () => {
    const channel = await setup();
    const call = channel.assertQueue.mock.calls.find(
      (c) => c[0] === queues['video.process'].queue,
    )!;

    expect(call[1].arguments).toMatchObject({
      'x-delivery-limit': DELIVERY_LIMIT,
      'x-dead-letter-exchange': DEAD_LETTER_EXCHANGE,
    });
  });

  it('lets a job be tried a handful of times, not forever', () => {
    expect(DELIVERY_LIMIT).toBeGreaterThan(1);
    expect(DELIVERY_LIMIT).toBeLessThan(20);
  });

  it('connects each queue to its exchange using the job name', async () => {
    const channel = await setup();

    expect(channel.bindQueue).toHaveBeenCalledWith(
      queues['video.process'].queue,
      JOBS_EXCHANGE,
      'video.process',
    );
    expect(channel.bindQueue).toHaveBeenCalledWith(
      queues['thumbnail.generate'].deadLetterQueue,
      DEAD_LETTER_EXCHANGE,
      'thumbnail.generate',
    );
  });
});
