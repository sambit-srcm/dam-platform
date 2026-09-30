import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { config } from '../../../config.ts';
import { makeAsset, makeCtx } from '../../../test/helpers.ts';

const send = vi.hoisted(() => vi.fn());
vi.mock('../../../shared/lib/s3.ts', () => ({ s3: { send }, s3Public: {} }));
vi.mock('../../assets/asset.repository.ts', () => ({
  failAsset: vi.fn(),
  findExpiredUploads: vi.fn(),
}));

import {
  failAsset,
  findExpiredUploads,
} from '../../assets/asset.repository.ts';
import { sweepExpiredUploads, startUploadCleanup } from '../upload.cleanup.ts';

const stale = (id: string) =>
  makeAsset({
    id,
    status: 'uploading',
    upload: { uploadId: `up-${id}`, partSize: 1, partCount: 1 },
  });

let h: ReturnType<typeof makeCtx>;

beforeEach(() => {
  vi.resetAllMocks();
  h = makeCtx();
  send.mockResolvedValue({});
});

describe('sweeping abandoned uploads', () => {
  it('cancels each one in storage and marks it as expired', async () => {
    vi.mocked(findExpiredUploads).mockResolvedValue([stale('a'), stale('b')]);

    const swept = await sweepExpiredUploads(h.ctx);

    expect(swept).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(failAsset).toHaveBeenCalledWith(h.ctx.db, 'a', 'upload_expired');
    expect(failAsset).toHaveBeenCalledWith(h.ctx.db, 'b', 'upload_expired');
    expect(h.redis.del).toHaveBeenCalledTimes(2);
  });
  it('takes the lock so two servers do not sweep at once', async () => {
    vi.mocked(findExpiredUploads).mockResolvedValue([]);
    await sweepExpiredUploads(h.ctx);
    expect(h.redis.set).toHaveBeenCalledWith(
      'lock:upload-cleanup',
      '1',
      expect.objectContaining({ NX: true }),
    );
  });
});

describe('the sweep timer', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('sweeps again and again until stopped', async () => {
    vi.mocked(findExpiredUploads).mockResolvedValue([]);
    const stop = startUploadCleanup(h.ctx);

    await vi.advanceTimersByTimeAsync(
      config.UPLOAD_CLEANUP_INTERVAL_SECONDS * 1000,
    );
    const runs = vi.mocked(findExpiredUploads).mock.calls.length;
    expect(runs).toBeGreaterThan(0);

    stop();
    await vi.advanceTimersByTimeAsync(
      config.UPLOAD_CLEANUP_INTERVAL_SECONDS * 10_000,
    );
    expect(vi.mocked(findExpiredUploads).mock.calls.length).toBe(runs);
  });

  it('survives a failed sweep', async () => {
    vi.mocked(findExpiredUploads).mockRejectedValue(new Error('db down'));
    const stop = startUploadCleanup(h.ctx);

    await expect(
      vi.advanceTimersByTimeAsync(
        config.UPLOAD_CLEANUP_INTERVAL_SECONDS * 2000,
      ),
    ).resolves.not.toThrow();
    stop();
  });
});
