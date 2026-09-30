import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// The settings file reads the environment the moment it is loaded, so each test loads a fresh copy
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

describe('worker settings', () => {
  it('loads when everything needed is present', async () => {
    const config = await loadConfig();
    expect(config.DATABASE_URL).toBe(
      'postgres://test:test@localhost:5432/test',
    );
    expect(config.MINIO_BUCKET).toBe('test-bucket');
  });

  it('turns numbers written as text into real numbers', async () => {
    vi.stubEnv('MINIO_API_PORT', '9100');
    expect((await loadConfig()).MINIO_API_PORT).toBe(9100);
  });

  it('fills in a default when a setting is left out', async () => {
    expect((await loadConfig()).MINIO_API_PORT).toBe(9000);
  });

  it('refuses to start when a required setting is missing', async () => {
    vi.stubEnv('DATABASE_URL', undefined as never);
    delete process.env.DATABASE_URL;

    await expect(loadConfig()).rejects.toThrow('exit 1');
  });

  it('names the setting that is wrong', async () => {
    delete process.env.MINIO_BUCKET;

    await expect(loadConfig()).rejects.toThrow('exit 1');
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('MINIO_BUCKET'),
    );
  });

  it('refuses a setting that is not a number when a number is needed', async () => {
    vi.stubEnv('MINIO_API_PORT', 'not-a-number');
    await expect(loadConfig()).rejects.toThrow('exit 1');
  });
});
