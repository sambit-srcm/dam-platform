import { EventEmitter } from 'node:events';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const request = vi.hoisted(() => vi.fn());
vi.mock('node:http', () => ({ request }));

import { fullServiceName, getService, scaleService } from '../docker.ts';

type Reply = { status: number; body?: unknown };
const sent: { options: Record<string, unknown>; written: string[] }[] = [];

// A pretend Docker: answers each request in turn
function dockerReplies(...replies: Reply[]) {
  request.mockImplementation((options, onResponse) => {
    const call = { options, written: [] as string[] };
    sent.push(call);
    const reply = replies.shift()!;
    const req = Object.assign(new EventEmitter(), {
      write: (text: string) => call.written.push(text),
      end: () => {
        const res = Object.assign(new EventEmitter(), {
          statusCode: reply.status,
        });
        onResponse(res);
        if (reply.body !== undefined)
          res.emit('data', JSON.stringify(reply.body));
        res.emit('end');
      },
    });
    return req;
  });
}

const service = () => ({
  ID: 'svc-1',
  Version: { Index: 42 },
  Spec: { Name: 'x', Mode: { Replicated: { Replicas: 2 } } },
});

beforeEach(() => {
  request.mockReset();
  sent.length = 0;
});

describe('talking to Docker', () => {
  it('adds the stack name in front of a service name', () => {
    expect(fullServiceName('video-worker')).toBe('dam-platform_video-worker');
  });

  it('looks a service up by its full name', async () => {
    dockerReplies({ status: 200, body: service() });

    const found = await getService('video-worker');

    expect(found.Spec.Mode.Replicated.Replicas).toBe(2);
    expect(sent[0]!.options).toMatchObject({
      method: 'GET',
      path: '/services/dam-platform_video-worker',
    });
  });

  it('reports what Docker complained about', async () => {
    dockerReplies({ status: 404, body: 'no such service' });
    await expect(getService('video-worker')).rejects.toThrow(/404/);
  });

  it('changes the number of copies by sending the whole service back with the version it read', async () => {
    dockerReplies({ status: 200, body: service() }, { status: 200 });

    await scaleService('video-worker', 5);

    const update = sent[1]!;
    expect(update.options).toMatchObject({
      method: 'POST',
      path: '/services/svc-1/update?version=42',
    });
    const body = JSON.parse(update.written.join(''));
    expect(body.Mode.Replicated.Replicas).toBe(5);
    expect(body.Name).toBe('x');
  });

  it('does not change anything if the service could not be read first', async () => {
    dockerReplies({ status: 500, body: 'boom' });

    await expect(scaleService('video-worker', 5)).rejects.toThrow();
    expect(sent).toHaveLength(1);
  });
});
