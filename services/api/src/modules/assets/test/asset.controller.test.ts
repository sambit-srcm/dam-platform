import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alice, ASSET_ID, makeCtx } from '../../../test/helpers.ts';
import { fakeReq, fakeRes } from '../../../test/support.ts';

vi.mock('../asset.service.ts', () => ({
  getAsset: vi.fn(),
  listAssetsPage: vi.fn(),
  listMyTags: vi.fn(),
  downloadAsset: vi.fn(),
  getAssetView: vi.fn(),
}));

import {
  downloadController,
  getAssetController,
  listAssetsController,
  listTagsController,
  viewController,
} from '../asset.controller.ts';
import {
  downloadAsset,
  getAsset,
  getAssetView,
  listAssetsPage,
  listMyTags,
} from '../asset.service.ts';

let ctx: ReturnType<typeof makeCtx>['ctx'];

beforeEach(() => {
  vi.resetAllMocks();
  ctx = makeCtx().ctx;
});

describe('single asset endpoint', () => {
  it('returns the asset for the signed-in user', async () => {
    vi.mocked(getAsset).mockResolvedValue({ id: ASSET_ID } as never);
    const { req } = fakeReq({ params: { assetId: ASSET_ID }, user: alice });
    const { res, mocks } = fakeRes();

    await getAssetController(ctx)(req, res);

    expect(getAsset).toHaveBeenCalledWith(ctx, ASSET_ID, alice);
    expect(mocks.json).toHaveBeenCalledWith({ id: ASSET_ID });
  });

  it('refuses an id that is not a proper id', async () => {
    const { req } = fakeReq({ params: { assetId: '123' }, user: alice });

    await expect(getAssetController(ctx)(req, fakeRes().res)).rejects.toThrow();
    expect(getAsset).not.toHaveBeenCalled();
  });

  it('refuses when nobody is signed in', async () => {
    const { req } = fakeReq({ params: { assetId: ASSET_ID } });

    await expect(
      getAssetController(ctx)(req, fakeRes().res),
    ).rejects.toMatchObject({ status: 401 });
  });
});

describe('asset list endpoint', () => {
  it('uses the first page of 24, newest first, when no options are given', async () => {
    vi.mocked(listAssetsPage).mockResolvedValue({
      items: [],
      total: 0,
    } as never);
    const { req } = fakeReq({ user: alice });

    await listAssetsController(ctx)(req, fakeRes().res);

    expect(listAssetsPage).toHaveBeenCalledWith(
      ctx,
      { limit: 24, offset: 0, sort: 'createdAt' },
      alice,
    );
  });
});

describe('tag list endpoint', () => {
  it('wraps the user\'s tags in "items"', async () => {
    vi.mocked(listMyTags).mockResolvedValue([
      { tag: 'sea', count: 2 },
    ] as never);
    const { res, mocks } = fakeRes();

    await listTagsController(ctx)(fakeReq({ user: alice }).req, res);

    expect(listMyTags).toHaveBeenCalledWith(ctx, alice);
    expect(mocks.json).toHaveBeenCalledWith({
      items: [{ tag: 'sea', count: 2 }],
    });
  });
});

describe('download endpoint', () => {
  it('returns the download link for the asset', async () => {
    vi.mocked(downloadAsset).mockResolvedValue({ url: 'https://x' } as never);
    const { req } = fakeReq({ params: { assetId: ASSET_ID }, user: alice });
    const { res, mocks } = fakeRes();

    await downloadController(ctx)(req, res);

    expect(downloadAsset).toHaveBeenCalledWith(ctx, ASSET_ID, alice);
    expect(mocks.json).toHaveBeenCalledWith({ url: 'https://x' });
  });
});

describe('viewer endpoint', () => {
  it('returns what the viewer needs to show the asset', async () => {
    vi.mocked(getAssetView).mockResolvedValue({ kind: 'image' } as never);
    const { req } = fakeReq({ params: { assetId: ASSET_ID }, user: alice });
    const { res, mocks } = fakeRes();

    await viewController(ctx)(req, res);

    expect(getAssetView).toHaveBeenCalledWith(ctx, ASSET_ID, alice);
    expect(mocks.json).toHaveBeenCalledWith({ kind: 'image' });
  });

  it('refuses an id that is not a proper id', async () => {
    const { req } = fakeReq({ params: { assetId: 'abc' }, user: alice });

    await expect(viewController(ctx)(req, fakeRes().res)).rejects.toThrow();
  });
});
