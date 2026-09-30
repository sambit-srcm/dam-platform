import { Readable } from 'node:stream';
import { NonRetryableJobError } from '@dam/queue';
import sharp from 'sharp';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Context } from '../context.ts';
import { ExecError } from '../lib/exec.ts';

const mocks = vi.hoisted(() => ({
  findAssetById: vi.fn(),
  markAssetProcessing: vi.fn(),
  markAssetReady: vi.fn(),
  markAssetFailed: vi.fn(),
  updateAssetThumbnail: vi.fn(),
  run: vi.fn(),
  stat: vi.fn(),
}));

vi.mock('../repository.ts', () => ({
  findAssetById: mocks.findAssetById,
  markAssetProcessing: mocks.markAssetProcessing,
  markAssetReady: mocks.markAssetReady,
  markAssetFailed: mocks.markAssetFailed,
  updateAssetThumbnail: mocks.updateAssetThumbnail,
}));
vi.mock('../lib/exec.ts', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../lib/exec.ts')>()),
  run: mocks.run,
}));
vi.mock('node:fs/promises', () => ({ stat: mocks.stat }));
vi.mock('../lib/tempdir.ts', () => ({
  withTempDir: async (work: (dir: string) => Promise<unknown>) =>
    work('/tmp/job'),
}));

import { processThumbnail } from '../processThumbnail.ts';

const storage = {
  getObject: vi.fn(),
  fGetObject: vi.fn(),
  putObject: vi.fn(),
};
const ctx = { db: {}, storage, bucket: 'test-bucket' } as unknown as Context;

// A real picture of the given size, made in memory
async function picture(width: number, height: number, orientation?: number) {
  const image = sharp({
    create: { width, height, channels: 3, background: '#3a7' },
  }).jpeg();
  return (orientation ? image.withMetadata({ orientation }) : image).toBuffer();
}

const imageAsset = (overrides = {}) => ({
  id: 'asset-1',
  mimeType: 'image/jpeg',
  storageKey: 'images/a.jpg',
  status: 'uploaded',
  thumbnailKey: null,
  ...overrides,
});

const serve = (bytes: Buffer) =>
  storage.getObject.mockResolvedValue(Readable.from([bytes]));
const savedTags = () => mocks.markAssetReady.mock.calls[0]![2].tags as string[];
const savedMetadata = () => mocks.markAssetReady.mock.calls[0]![2].metadata;

beforeEach(() => {
  vi.resetAllMocks();
  mocks.findAssetById.mockResolvedValue(imageAsset());
});

describe('making a thumbnail for a picture', () => {
  it('saves a small web-friendly copy and marks the picture ready', async () => {
    serve(await picture(1600, 1000));

    await processThumbnail(ctx, 'asset-1');

    expect(mocks.markAssetProcessing).toHaveBeenCalledWith(ctx.db, 'asset-1');
    const [bucket, key, data, length, headers] =
      storage.putObject.mock.calls[0]!;
    expect(bucket).toBe('test-bucket');
    expect(key).toBe('thumbnails/asset-1.webp');
    expect(length).toBe(data.length);
    expect(headers).toEqual({ 'Content-Type': 'image/webp' });

    const made = await sharp(data).metadata();
    expect(made.format).toBe('webp');
    expect(made.width).toBe(400);
    expect(made.height).toBe(250);

    expect(mocks.markAssetReady).toHaveBeenCalledWith(
      ctx.db,
      'asset-1',
      expect.objectContaining({ thumbnailKey: 'thumbnails/asset-1.webp' }),
    );
  });

  it('never blows a small picture up', async () => {
    serve(await picture(200, 100));
    await processThumbnail(ctx, 'asset-1');

    const made = await sharp(storage.putObject.mock.calls[0]![2]).metadata();
    expect(made.width).toBe(200);
  });

  it('remembers the real size and format of the original', async () => {
    serve(await picture(1600, 1000));
    await processThumbnail(ctx, 'asset-1');
    expect(savedMetadata()).toEqual({
      width: 1600,
      height: 1000,
      format: 'jpeg',
    });
  });

  it('turns a sideways photo upright and swaps its width and height', async () => {
    serve(await picture(1600, 1000, 6));
    await processThumbnail(ctx, 'asset-1');

    expect(savedMetadata()).toMatchObject({ width: 1000, height: 1600 });
    expect(savedTags()).toContain('portrait');
    const made = await sharp(storage.putObject.mock.calls[0]![2]).metadata();
    expect(made.height).toBeGreaterThan(made.width!);
  });
});

describe('tagging a picture by its shape and size', () => {
  it.each([
    [1600, 1000, 'landscape'],
    [1000, 1600, 'portrait'],
    [1000, 1000, 'square'],
  ])('a %ix%i picture is %s', async (width, height, tag) => {
    serve(await picture(width, height));
    await processThumbnail(ctx, 'asset-1');
    expect(savedTags()).toContain(tag);
  });

  it('marks a picture of 8 million pixels or more as high-res', async () => {
    serve(await picture(3200, 2500));
    await processThumbnail(ctx, 'asset-1');
    expect(savedTags()).toContain('high-res');
    expect(savedTags()).not.toContain('low-res');
  });

  it('marks a picture under half a million pixels as low-res', async () => {
    serve(await picture(300, 200));
    await processThumbnail(ctx, 'asset-1');
    expect(savedTags()).toContain('low-res');
  });

  it('gives an ordinary picture neither', async () => {
    serve(await picture(1600, 1000));
    await processThumbnail(ctx, 'asset-1');
    expect(savedTags()).toEqual(['landscape']);
  });
});

describe('pictures that cannot be handled', () => {
  it('gives up on a file that is not really a picture, without retrying', async () => {
    serve(Buffer.from('this is not an image'));

    await expect(processThumbnail(ctx, 'asset-1')).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );

    expect(mocks.markAssetFailed).toHaveBeenCalledWith(ctx.db, 'asset-1');
    expect(storage.putObject).not.toHaveBeenCalled();
    expect(mocks.markAssetReady).not.toHaveBeenCalled();
  });

  it('gives up when the asset does not exist', async () => {
    mocks.findAssetById.mockResolvedValue(undefined);
    await expect(processThumbnail(ctx, 'asset-1')).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it('gives up on something that is neither a picture nor a video', async () => {
    mocks.findAssetById.mockResolvedValue(
      imageAsset({ mimeType: 'application/pdf' }),
    );
    await expect(processThumbnail(ctx, 'asset-1')).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it('skips a picture that already has its thumbnail', async () => {
    mocks.findAssetById.mockResolvedValue(
      imageAsset({ status: 'ready', thumbnailKey: 'thumbnails/asset-1.webp' }),
    );

    await processThumbnail(ctx, 'asset-1');

    expect(mocks.markAssetProcessing).not.toHaveBeenCalled();
    expect(storage.getObject).not.toHaveBeenCalled();
  });

  it('lets a storage problem be retried', async () => {
    storage.getObject.mockImplementation(() =>
      Promise.reject(new Error('minio down')),
    );

    await expect(processThumbnail(ctx, 'asset-1')).rejects.toThrow(
      'minio down',
    );
    expect(mocks.markAssetFailed).not.toHaveBeenCalled();
  });
});

describe('making a poster for a video', () => {
  const videoAsset = (overrides = {}) =>
    imageAsset({
      mimeType: 'video/mp4',
      storageKey: 'videos/a.mp4',
      ...overrides,
    });

  // ffmpeg "writes" a real picture to the frame file, which sharp then reads
  let framePath: string;
  beforeEach(async () => {
    mocks.findAssetById.mockResolvedValue(videoAsset());
    const { mkdtemp, writeFile } =
      await vi.importActual<typeof import('node:fs/promises')>(
        'node:fs/promises',
      );
    const dir = await mkdtemp(
      (await import('node:os')).tmpdir() + '/poster-test-',
    );
    framePath = `${dir}/frame.png`;
    await writeFile(
      framePath,
      await sharp({
        create: { width: 800, height: 450, channels: 3, background: '#c33' },
      })
        .png()
        .toBuffer(),
    );
    mocks.stat.mockResolvedValue({});
    mocks.run.mockResolvedValue({ stdout: '' });
  });

  it('sets only the thumbnail and leaves the status to the video worker', async () => {
    // Point the frame at the real file made above
    vi.doMock('node:path', async (orig) => ({
      ...(await orig<typeof import('node:path')>()),
      join: (_d: string, name: string) =>
        name === 'frame.png' ? framePath : `/tmp/job/${name}`,
    }));
    vi.resetModules();
    const fresh = await import('../processThumbnail.ts');

    await fresh.processThumbnail(ctx, 'asset-1');

    expect(mocks.updateAssetThumbnail).toHaveBeenCalledWith(
      ctx.db,
      'asset-1',
      'thumbnails/asset-1.webp',
    );
    expect(mocks.markAssetReady).not.toHaveBeenCalled();
    expect(mocks.markAssetProcessing).not.toHaveBeenCalled();
    vi.doUnmock('node:path');
  });

  it('leaves alone a video the video worker already failed', async () => {
    mocks.findAssetById.mockResolvedValue(videoAsset({ status: 'failed' }));

    await processThumbnail(ctx, 'asset-1');

    expect(storage.fGetObject).not.toHaveBeenCalled();
  });

  it('tries the very start of a short video when there is no frame at one second', async () => {
    mocks.stat
      .mockImplementationOnce(() => Promise.reject(new Error('missing')))
      .mockImplementation(() => Promise.reject(new Error('missing')));

    await expect(processThumbnail(ctx, 'asset-1')).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );

    const seeks = mocks.run.mock.calls.map((c) => (c[1] as string[])[3]);
    expect(seeks).toEqual(['1', '0']);
  });

  it('gives up without retrying when ffmpeg says the video is unreadable', async () => {
    mocks.run.mockImplementation(() =>
      Promise.reject(
        new ExecError('exit 1', {
          exitCode: 1,
          timedOut: false,
          stderr: 'Invalid data',
        }),
      ),
    );

    await expect(processThumbnail(ctx, 'asset-1')).rejects.toBeInstanceOf(
      NonRetryableJobError,
    );
  });

  it('allows a retry after a timeout', async () => {
    const timeout = new ExecError('timed out', {
      exitCode: null,
      timedOut: true,
      stderr: '',
    });
    mocks.run.mockImplementation(() => Promise.reject(timeout));

    await expect(processThumbnail(ctx, 'asset-1')).rejects.toBe(timeout);
  });
});
