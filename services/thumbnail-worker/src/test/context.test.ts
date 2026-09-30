import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  dbEnd: vi.fn().mockResolvedValue(undefined),
  createDb: vi.fn(),
  queueClose: vi.fn().mockResolvedValue(undefined),
  connectJobQueue: vi.fn(),
  minio: vi.fn(),
}));

vi.mock('@dam/db', () => ({ createDb: mocks.createDb }));
vi.mock('@dam/queue', () => ({ connectJobQueue: mocks.connectJobQueue }));
vi.mock('minio', () => ({
  Client: class {
    constructor(options: unknown) {
      mocks.minio(options);
    }
  },
}));

import { createContext } from '../context.ts';

beforeEach(() => {
  vi.clearAllMocks();
  mocks.createDb.mockReturnValue({ $client: { end: mocks.dbEnd } });
  mocks.connectJobQueue.mockResolvedValue({ close: mocks.queueClose });
});

describe('starting the worker', () => {
  it('connects to the database with the configured address', async () => {
    await createContext();
    expect(mocks.createDb).toHaveBeenCalledWith(
      'postgres://test:test@localhost:5432/test',
      { maxConnections: 10 },
    );
  });

  it('connects to the job queue', async () => {
    await createContext();
    expect(mocks.connectJobQueue).toHaveBeenCalledWith('amqp://localhost');
  });

  it('opens file storage with the configured login and no encryption', async () => {
    await createContext();
    expect(mocks.minio).toHaveBeenCalledWith({
      endPoint: 'localhost',
      port: 9000,
      useSSL: false,
      accessKey: 'test',
      secretKey: 'test-password',
    });
  });

  it('remembers which bucket to use', async () => {
    expect((await createContext()).bucket).toBe('test-bucket');
  });

  it('closes the queue and the database when shutting down', async () => {
    const ctx = await createContext();
    await ctx.close();
    expect(mocks.queueClose).toHaveBeenCalledOnce();
    expect(mocks.dbEnd).toHaveBeenCalledOnce();
  });
});
