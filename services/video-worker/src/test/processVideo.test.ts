import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NonRetryableJobError } from '@dam/queue';
import { UnprocessableMediaError } from '../lib/errors.ts';
import type { Context } from '../context.ts';

const mocks = vi.hoisted(() => ({
  findAssetById: vi.fn(),
  markAssetProcessing: vi.fn(),
  markAssetFailed: vi.fn(),
  completeVideoAsset: vi.fn(),
  probeVideo: vi.fn(),
  transcodeRung: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('../repository.ts', () => ({
  findAssetById: mocks.findAssetById,
  markAssetProcessing: mocks.markAssetProcessing,
  markAssetFailed: mocks.markAssetFailed,
  completeVideoAsset: mocks.completeVideoAsset,
}));
vi.mock('../probe.ts', () => ({ probeVideo: mocks.probeVideo }));
vi.mock('../transcode.ts', () => ({ transcodeRung: mocks.transcodeRung }));
vi.mock('node:fs/promises', () => ({ stat: mocks.stat }));
vi.mock('../lib/tempdir.ts', () => ({
  withTempDir: async (work: (dir: string) => Promise<unknown>) =>
    work('/tmp/job'),
}));

import { processVideo } from '../processVideo.ts';

const storage = {
  fGetObject: vi.fn(),
  fPutObject: vi.fn(),
};
const ctx = { db: {}, storage, bucket: 'test-bucket' } as unknown as Context;

const video = (overrides = {}) => ({
  id: 'asset-1',
  mimeType: 'video/mp4',
  storageKey: 'videos/a.mp4',
  status: 'uploaded',
  ...overrides,
});

const metadata = {
  durationSeconds: 60,
  width: 1920,
  height: 1080,
  videoCodec: 'h264',
  audioCodec: 'aac',
};

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findAssetById.mockResolvedValue(video());
  mocks.probeVideo.mockResolvedValue(metadata);
  mocks.stat.mockResolvedValue({ size: 12345 });
});

describe('processing a video', () => {
  it('makes every size, saves them and marks the video ready', async () => {
    await processVideo(ctx, 'asset-1');

    expect(mocks.markAssetProcessing).toHaveBeenCalledWith(ctx.db, 'asset-1');
    expect(mocks.transcodeRung).toHaveBeenCalledTimes(2);
    expect(storage.fPutObject).toHaveBeenCalledTimes(2);

    const [, assetId, done] = mocks.completeVideoAsset.mock.calls[0]!;
    expect(assetId).toBe('asset-1');
    expect(done.outputs.map((o: { label: string }) => o.label)).toEqual([
      '1080p',
      '720p',
    ]);
    expect(done.metadata).toEqual(metadata);
    expect(done.tags).toEqual(expect.arrayContaining(['landscape', '1080p']));
  });

  it('downloads the original before looking at it', async () => {
    await processVideo(ctx, 'asset-1');
    expect(storage.fGetObject).toHaveBeenCalledWith(
      'test-bucket',
      'videos/a.mp4',
      '/tmp/job/source',
    );
  });

  it('saves each size under the asset’s own folder, so a retry replaces it', async () => {
    await processVideo(ctx, 'asset-1');

    const keys = storage.fPutObject.mock.calls.map((c) => c[1]);
    expect(keys).toEqual([
      'videos/renditions/asset-1/1080p.mp4',
      'videos/renditions/asset-1/720p.mp4',
    ]);
  });

  it('records the real file size of each output', async () => {
    await processVideo(ctx, 'asset-1');
    const outputs = mocks.completeVideoAsset.mock.calls[0]![2].outputs;
    expect(
      outputs.every((o: { sizeBytes: number }) => o.sizeBytes === 12345),
    ).toBe(true);
  });

  it('does one size at a time to keep disk use low', async () => {
    const order: string[] = [];
    mocks.transcodeRung.mockImplementation(
      async ({ rung }: { rung: { label: string } }) => {
        order.push(`convert ${rung.label}`);
      },
    );
    storage.fPutObject.mockImplementation(async (_b: string, key: string) => {
      order.push(`upload ${key.split('/').pop()}`);
    });

    await processVideo(ctx, 'asset-1');

    expect(order).toEqual([
      'convert 1080p',
      'upload 1080p.mp4',
      'convert 720p',
      'upload 720p.mp4',
    ]);
  });

  it('does nothing if the video is already finished', async () => {
    mocks.findAssetById.mockResolvedValue(video({ status: 'ready' }));

    await processVideo(ctx, 'asset-1');

    expect(mocks.markAssetProcessing).not.toHaveBeenCalled();
    expect(mocks.transcodeRung).not.toHaveBeenCalled();
  });

  it('will not retry when the asset does not exist', async () => {
    mocks.findAssetById.mockResolvedValue(undefined);
    await expect(processVideo(ctx, 'asset-1')).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it('will not retry when the asset is not a video', async () => {
    mocks.findAssetById.mockResolvedValue(video({ mimeType: 'image/jpeg' }));
    await expect(processVideo(ctx, 'asset-1')).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
    expect(mocks.markAssetProcessing).not.toHaveBeenCalled();
  });
});

describe('when a video cannot be processed', () => {
  it('records why a broken file failed, so the owner can see it', async () => {
    mocks.probeVideo.mockImplementation(() =>
      Promise.reject(new UnprocessableMediaError('video_too_long', 'too long')),
    );

    await expect(processVideo(ctx, 'asset-1')).rejects.toBeInstanceOf(
      UnprocessableMediaError,
    );

    expect(mocks.markAssetFailed).toHaveBeenCalledWith(
      ctx.db,
      'asset-1',
      'video_too_long',
    );
    expect(mocks.completeVideoAsset).not.toHaveBeenCalled();
  });

  it('leaves the video as processing after a temporary problem, so a retry can fix it', async () => {
    mocks.transcodeRung.mockImplementation(() =>
      Promise.reject(new Error('disk full')),
    );

    await expect(processVideo(ctx, 'asset-1')).rejects.toThrow('disk full');

    expect(mocks.markAssetFailed).not.toHaveBeenCalled();
    expect(mocks.completeVideoAsset).not.toHaveBeenCalled();
  });

  it('never marks a video ready if a later size failed', async () => {
    mocks.transcodeRung
      .mockResolvedValueOnce(undefined)
      .mockImplementationOnce(() =>
        Promise.reject(new Error('ffmpeg crashed')),
      );

    await expect(processVideo(ctx, 'asset-1')).rejects.toThrow(
      'ffmpeg crashed',
    );
    expect(mocks.completeVideoAsset).not.toHaveBeenCalled();
  });
});
