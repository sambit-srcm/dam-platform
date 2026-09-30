import { existsSync } from 'node:fs';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { withTempDir } from '../tempdir.ts';

describe('temporary job folder', () => {
  it('gives the job a folder that exists while it works', async () => {
    await withTempDir(async (dir) => {
      expect(existsSync(dir)).toBe(true);
    });
  });

  it('names the folder after the video job', async () => {
    await withTempDir(async (dir) => {
      expect(dir).toContain('video-job-');
    });
  });

  it('returns whatever the job returns', async () => {
    expect(await withTempDir(async () => 42)).toBe(42);
  });

  it('removes the folder and its files when the job is done', async () => {
    let seen = '';
    await withTempDir(async (dir) => {
      seen = dir;
      await writeFile(join(dir, 'big-file.bin'), 'data');
    });
    expect(existsSync(seen)).toBe(false);
  });

  it('removes the folder even when the job fails', async () => {
    let seen = '';
    await expect(
      withTempDir(async (dir) => {
        seen = dir;
        throw new Error('ffmpeg blew up');
      }),
    ).rejects.toThrow('ffmpeg blew up');
    expect(existsSync(seen)).toBe(false);
  });

  it('gives each job its own folder', async () => {
    const seen: string[] = [];
    await Promise.all([
      withTempDir(async (dir) => void seen.push(dir)),
      withTempDir(async (dir) => void seen.push(dir)),
    ]);
    expect(new Set(seen).size).toBe(2);
  });
});
