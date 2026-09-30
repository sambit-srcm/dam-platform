import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alice, ASSET_ID, makeAsset, makeCtx } from '../../../test/helpers.ts';

// getSignedUrl is mocked at module level; reset would clear it, so it is re-imported lazily
import { getSignedUrl as getSignedUrlStub } from '@aws-sdk/s3-request-presigner';

const send = vi.hoisted(() => vi.fn());

vi.mock('../../../shared/lib/s3.ts', () => ({ s3: { send }, s3Public: {} }));
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn(
    async (_c: unknown, command: { input: { PartNumber: number } }) =>
      `https://signed.test/part/${command.input.PartNumber}`,
  ),
}));
vi.mock('@dam/queue', () => ({ publishJob: vi.fn() }));
vi.mock('../../assets/asset.repository.ts', () => ({
  createAsset: vi.fn(),
  failAsset: vi.fn(),
  findAssetById: vi.fn(),
  markUploadComplete: vi.fn(),
}));

import { publishJob } from '@dam/queue';
import {
  createAsset,
  findAssetById,
  markUploadComplete,
} from '../../assets/asset.repository.ts';
import {
  finishUpload,
  signParts,
  startUpload,
  uploadStatus,
} from '../upload.service.ts';

const MIB = 1024 * 1024;
let h: ReturnType<typeof makeCtx>;

// What S3 was asked to do, in order, by command name
const sentCommands = () =>
  send.mock.calls.map(([command]) => command.constructor.name);

const uploadingAsset = (overrides = {}) =>
  makeAsset({
    status: 'uploading',
    sizeBytes: 12 * MIB,
    upload: { uploadId: 'upload-1', partSize: 5 * MIB, partCount: 3 },
    ...overrides,
  });

const parts = (...sizes: number[]) => ({
  Parts: sizes.map((size, i) => ({
    PartNumber: i + 1,
    Size: size,
    ETag: `etag-${i + 1}`,
  })),
});

beforeEach(() => {
  vi.resetAllMocks();
  h = makeCtx();
  vi.mocked(getSignedUrlStub).mockClear?.();
});

beforeEach(() => {
  vi.mocked(getSignedUrlStub).mockImplementation(
    (async (_c: unknown, command: { input: { PartNumber: number } }) =>
      `https://signed.test/part/${command.input.PartNumber}`) as never,
  );
});

describe('starting an upload', () => {
  beforeEach(() => {
    send.mockResolvedValue({ UploadId: 'upload-1' });
    vi.mocked(createAsset).mockResolvedValue(makeAsset({ id: ASSET_ID }));
  });

  it('opens an upload in storage and saves the asset as "uploading"', async () => {
    const result = await startUpload(
      h.ctx,
      { filename: 'beach.jpg', mimeType: 'image/jpeg', size: 12 * MIB },
      alice,
    );

    expect(result).toEqual({
      assetId: ASSET_ID,
      partSize: 5 * MIB,
      partCount: 3,
    });
    expect(sentCommands()).toEqual(['CreateMultipartUploadCommand']);
    expect(vi.mocked(createAsset).mock.calls[0]![1]).toMatchObject({
      status: 'uploading',
      ownerId: alice.id,
      filename: 'beach.jpg',
      upload: { uploadId: 'upload-1', partSize: 5 * MIB, partCount: 3 },
    });
  });

  it('refuses an image upload with a 503 when the queue is down, before touching storage', async () => {
    h.queue.connection.createChannel.mockRejectedValue(new Error('down'));

    await expect(
      startUpload(
        h.ctx,
        { filename: 'beach.jpg', mimeType: 'image/jpeg', size: MIB },
        alice,
      ),
    ).rejects.toMatchObject({ status: 503, code: 'service_unavailable' });
    expect(send).not.toHaveBeenCalled();
    expect(createAsset).not.toHaveBeenCalled();
  });

  it('turns away a file that is too big before talking to storage', async () => {
    await expect(
      startUpload(
        h.ctx,
        { filename: 'a.mp4', mimeType: 'video/mp4', size: 6 * 1024 * MIB },
        alice,
      ),
    ).rejects.toMatchObject({ status: 400 });
    expect(send).not.toHaveBeenCalled();
  });
});

describe('getting upload links for the parts', () => {
  it('gives one link per part asked for', async () => {
    vi.mocked(findAssetById).mockResolvedValue(uploadingAsset());

    const links = await signParts(h.ctx, ASSET_ID, [1, 3], alice);

    expect(links).toEqual([
      { partNumber: 1, url: 'https://signed.test/part/1' },
      { partNumber: 3, url: 'https://signed.test/part/3' },
    ]);
  });
});

describe('finishing an upload', () => {
  const goodParts = () => parts(5 * MIB, 5 * MIB, 2 * MIB);

  function storageAnswers(listed: object, size = 12 * MIB) {
    send.mockImplementation(
      async (command: { constructor: { name: string } }) => {
        switch (command.constructor.name) {
          case 'ListPartsCommand':
            return listed;
          case 'HeadObjectCommand':
            return { ContentLength: size };
          default:
            return {};
        }
      },
    );
  }

  beforeEach(() => {
    vi.mocked(findAssetById).mockResolvedValue(uploadingAsset());
  });

  it('stitches the parts together and queues a thumbnail for an image', async () => {
    storageAnswers(goodParts());

    await finishUpload(h.ctx, ASSET_ID, alice);

    expect(sentCommands()).toEqual([
      'ListPartsCommand',
      'CompleteMultipartUploadCommand',
      'HeadObjectCommand',
    ]);
    expect(markUploadComplete).toHaveBeenCalledWith(
      h.ctx.db,
      ASSET_ID,
      12 * MIB,
      'uploaded',
    );
    expect(publishJob).toHaveBeenCalledWith(h.ctx.queue, 'thumbnail.generate', {
      assetId: ASSET_ID,
    });
  });
});

describe('checking upload progress', () => {
  it('lists received and missing parts from what storage holds', async () => {
    vi.mocked(findAssetById).mockResolvedValue(uploadingAsset());
    send.mockResolvedValueOnce({
      Parts: [{ PartNumber: 1 }, { PartNumber: 3 }],
    });

    const status = await uploadStatus(h.ctx, ASSET_ID, alice);

    expect(status).toMatchObject({ received: [1, 3], remaining: [2] });
  });

  it('keeps reading until storage says there are no more parts', async () => {
    vi.mocked(findAssetById).mockResolvedValue(
      uploadingAsset({
        upload: { uploadId: 'upload-1', partSize: 5 * MIB, partCount: 4 },
      }),
    );
    send
      .mockResolvedValueOnce({
        Parts: [{ PartNumber: 1 }, { PartNumber: 2 }],
        IsTruncated: true,
        NextPartNumberMarker: '2',
      })
      .mockResolvedValueOnce({ Parts: [{ PartNumber: 3 }] });

    const status = await uploadStatus(h.ctx, ASSET_ID, alice);

    expect(status.received).toEqual([1, 2, 3]);
    expect(status.remaining).toEqual([4]);
    expect(send.mock.calls[1]![0].input.PartNumberMarker).toBe('2');
  });
});
