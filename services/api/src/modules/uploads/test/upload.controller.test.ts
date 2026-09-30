import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alice, ASSET_ID, makeCtx } from '../../../test/helpers.ts';
import { fakeReq, fakeRes } from '../../../test/support.ts';

vi.mock('../upload.service.ts', () => ({
  startUpload: vi.fn(),
  uploadStatus: vi.fn(),
  signParts: vi.fn(),
  recordUploadedPart: vi.fn(),
  finishUpload: vi.fn(),
  abortUpload: vi.fn(),
}));

import {
  completeUploadController,
  recordPartController,
  signPartsController,
  startUploadController,
  uploadStatusController,
} from '../upload.controller.ts';
import {
  finishUpload,
  recordUploadedPart,
  signParts,
  startUpload,
  uploadStatus,
} from '../upload.service.ts';

let ctx: ReturnType<typeof makeCtx>['ctx'];
const params = { assetId: ASSET_ID };

beforeEach(() => {
  vi.resetAllMocks();
  ctx = makeCtx().ctx;
});

describe('start upload endpoint', () => {
  const body = { filename: 'beach.jpg', mimeType: 'image/jpeg', size: 1000 };

  it('opens the upload and answers "201 created" with the plan', async () => {
    const plan = { assetId: ASSET_ID, partSize: 5, partCount: 1 };
    vi.mocked(startUpload).mockResolvedValue(plan);
    const { req, log } = fakeReq({ body, user: alice });
    const { res, mocks } = fakeRes();

    await startUploadController(ctx)(req, res);

    expect(startUpload).toHaveBeenCalledWith(ctx, body, alice);
    expect(mocks.status).toHaveBeenCalledWith(201);
    expect(mocks.json).toHaveBeenCalledWith(plan);
    expect(log.info).toHaveBeenCalledOnce();
  });

  it('accepts the size written as text', async () => {
    vi.mocked(startUpload).mockResolvedValue({} as never);
    const { req } = fakeReq({ body: { ...body, size: '1000' }, user: alice });

    await startUploadController(ctx)(req, fakeRes().res);

    expect(vi.mocked(startUpload).mock.calls[0]![1].size).toBe(1000);
  });

  it.each([
    ['no file name', { ...body, filename: '' }],
    ['a file name over 255 characters', { ...body, filename: 'a'.repeat(256) }],
    ['a size of zero', { ...body, size: 0 }],
    ['a negative size', { ...body, size: -5 }],
    ['no type', { filename: 'a.jpg', size: 5 }],
  ])('refuses %s', async (_name, badBody) => {
    const { req } = fakeReq({ body: badBody, user: alice });

    await expect(
      startUploadController(ctx)(req, fakeRes().res),
    ).rejects.toThrow();
    expect(startUpload).not.toHaveBeenCalled();
  });

  it('refuses when nobody is signed in', async () => {
    const { req } = fakeReq({ body });

    await expect(
      startUploadController(ctx)(req, fakeRes().res),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('upload progress endpoint', () => {
  it('returns which parts are in and which are still missing', async () => {
    const progress = { received: [1], remaining: [2] };
    vi.mocked(uploadStatus).mockResolvedValue(progress as never);
    const { res, mocks } = fakeRes();

    await uploadStatusController(ctx)(
      fakeReq({ params, user: alice }).req,
      res,
    );

    expect(uploadStatus).toHaveBeenCalledWith(ctx, ASSET_ID, alice);
    expect(mocks.json).toHaveBeenCalledWith(progress);
  });

  it('refuses an id that is not a proper id', async () => {
    const { req } = fakeReq({ params: { assetId: '1' }, user: alice });

    await expect(
      uploadStatusController(ctx)(req, fakeRes().res),
    ).rejects.toThrow();
  });
});

describe('sign parts endpoint', () => {
  it('returns the signed links under "parts"', async () => {
    vi.mocked(signParts).mockResolvedValue([{ partNumber: 1, url: 'u' }]);
    const { req } = fakeReq({
      params,
      body: { partNumbers: [1] },
      user: alice,
    });
    const { res, mocks } = fakeRes();

    await signPartsController(ctx)(req, res);

    expect(signParts).toHaveBeenCalledWith(ctx, ASSET_ID, [1], alice);
    expect(mocks.json).toHaveBeenCalledWith({
      parts: [{ partNumber: 1, url: 'u' }],
    });
  });
});

describe('record part endpoint', () => {
  const part = { partNumber: 2, etag: 'abc', size: 500 };

  it('saves the part and answers "204 no content"', async () => {
    const { req } = fakeReq({ params, body: part, user: alice });
    const { res, mocks } = fakeRes();

    await recordPartController(ctx)(req, res);

    expect(recordUploadedPart).toHaveBeenCalledWith(ctx, ASSET_ID, part, alice);
    expect(mocks.status).toHaveBeenCalledWith(204);
    expect(mocks.end).toHaveBeenCalledOnce();
    expect(mocks.json).not.toHaveBeenCalled();
  });

  it.each([
    ['no etag', { ...part, etag: '' }],
    ['a size of zero', { ...part, size: 0 }],
    ['a part number of zero', { ...part, partNumber: 0 }],
  ])('refuses %s', async (_name, body) => {
    const { req } = fakeReq({ params, body, user: alice });

    await expect(
      recordPartController(ctx)(req, fakeRes().res),
    ).rejects.toThrow();
    expect(recordUploadedPart).not.toHaveBeenCalled();
  });
});

describe('complete upload endpoint', () => {
  it('finishes the upload and returns the asset', async () => {
    vi.mocked(finishUpload).mockResolvedValue({ id: ASSET_ID } as never);
    const { req, log } = fakeReq({ params, user: alice });
    const { res, mocks } = fakeRes();

    await completeUploadController(ctx)(req, res);

    expect(finishUpload).toHaveBeenCalledWith(ctx, ASSET_ID, alice);
    expect(mocks.json).toHaveBeenCalledWith({ id: ASSET_ID });
    expect(log.info).toHaveBeenCalledOnce();
  });
});
