import { afterEach, describe, expect, it, vi } from 'vitest';
import { messagesReady } from '../rabbitmq.ts';

const answer = (init: { ok: boolean; status?: number; body?: unknown }) => {
  const fetchMock = vi.fn().mockResolvedValue({
    ok: init.ok,
    status: init.status ?? 200,
    json: async () => init.body,
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
};

afterEach(() => vi.unstubAllGlobals());

describe('asking RabbitMQ how many jobs are waiting', () => {
  it('returns the number of jobs not yet picked up', async () => {
    answer({
      ok: true,
      body: { messages_ready: 7, messages_unacknowledged: 3 },
    });
    expect(await messagesReady('dam.video-processing')).toBe(7);
  });

  it('treats a missing number as zero', async () => {
    answer({ ok: true, body: {} });
    expect(await messagesReady('q')).toBe(0);
  });

  it('asks about the right queue, using the login', async () => {
    const fetchMock = answer({ ok: true, body: {} });
    await messagesReady('dam.video-processing');

    const [url, options] = fetchMock.mock.calls[0]!;
    expect(url).toBe(
      'http://rabbit.test:15672/api/queues/%2F/dam.video-processing',
    );
    expect(options.headers.Authorization).toBe(
      `Basic ${Buffer.from('guest:secret').toString('base64')}`,
    );
  });

  it('reports an error instead of guessing when RabbitMQ refuses', async () => {
    answer({ ok: false, status: 401 });
    await expect(messagesReady('q')).rejects.toThrow(/401.*"q"/);
  });
});
