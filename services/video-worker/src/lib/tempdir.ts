import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { config } from '../config.ts';

// Gives the job its own folder and always removes it, even when the job fails
export async function withTempDir<T>(work: (dir: string) => Promise<T>) {
  const dir = await mkdtemp(join(config.TMP_DIR, 'video-job-'));
  try {
    return await work(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
