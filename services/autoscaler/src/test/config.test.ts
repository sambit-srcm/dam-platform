import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

async function loadConfig() {
  vi.resetModules();
  return (await import('../config.ts')).config;
}

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
    throw new Error(`exit ${code}`);
  }) as never);
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('autoscaler settings', () => {
  it('loads when everything needed is present', async () => {
    const config = await loadConfig();
    expect(config.RABBITMQ_MGMT_URL).toBe('http://rabbit.test:15672');
    expect(config.STACK_NAME).toBe('dam-platform');
  });

  it('fills in sensible worker limits when none are given', async () => {
    const config = await loadConfig();
    expect(config.IMAGE_MIN_REPLICAS).toBeLessThanOrEqual(
      config.IMAGE_MAX_REPLICAS,
    );
    expect(config.VIDEO_MIN_REPLICAS).toBeLessThanOrEqual(
      config.VIDEO_MAX_REPLICAS,
    );
  });

  it('turns numbers written as text into real numbers', async () => {
    vi.stubEnv('VIDEO_MAX_REPLICAS', '8');
    expect((await loadConfig()).VIDEO_MAX_REPLICAS).toBe(8);
  });

  it('refuses to start without the RabbitMQ login', async () => {
    delete process.env.RABBITMQ_USER;
    await expect(loadConfig()).rejects.toThrow('exit 1');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('RABBITMQ_USER'),
    );
  });

  it('refuses a replica limit that is not a number', async () => {
    vi.stubEnv('IMAGE_MAX_REPLICAS', 'lots');
    await expect(loadConfig()).rejects.toThrow('exit 1');
  });
});
