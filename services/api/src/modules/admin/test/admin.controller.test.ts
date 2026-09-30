import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ASSET_ID, makeCtx } from '../../../test/helpers.ts';
import { fakeReq, fakeRes } from '../../../test/support.ts';

vi.mock('../admin.service.ts', () => ({
  listAdminAssets: vi.fn(),
  getAdminAsset: vi.fn(),
  getDashboard: vi.fn(),
  listAllTags: vi.fn(),
}));

import {
  dashboardController,
  getAdminAssetController,
  listAdminAssetsController,
  listAllTagsController,
} from '../admin.controller.ts';
import {
  getAdminAsset,
  getDashboard,
  listAdminAssets,
  listAllTags,
} from '../admin.service.ts';

let ctx: ReturnType<typeof makeCtx>['ctx'];

beforeEach(() => {
  vi.resetAllMocks();
  ctx = makeCtx().ctx;
});

describe('admin asset list endpoint', () => {
  it('refuses an owner that is not a proper id', async () => {
    const { req } = fakeReq({ query: { ownerId: 'bob' } });

    await expect(
      listAdminAssetsController(ctx)(req, fakeRes().res),
    ).rejects.toThrow();
    expect(listAdminAssets).not.toHaveBeenCalled();
  });

  it('sends back what the service found', async () => {
    const page = { items: [{ id: 'a' }], total: 1 };
    vi.mocked(listAdminAssets).mockResolvedValue(page as never);
    const { res, mocks } = fakeRes();

    await listAdminAssetsController(ctx)(fakeReq().req, res);

    expect(mocks.json).toHaveBeenCalledWith(page);
  });
});

describe('admin single asset endpoint', () => {
  it('returns the asset', async () => {
    vi.mocked(getAdminAsset).mockResolvedValue({ id: ASSET_ID } as never);
    const { req } = fakeReq({ params: { assetId: ASSET_ID } });
    const { res, mocks } = fakeRes();

    await getAdminAssetController(ctx)(req, res);

    expect(getAdminAsset).toHaveBeenCalledWith(ctx, ASSET_ID);
    expect(mocks.json).toHaveBeenCalledWith({ id: ASSET_ID });
  });

  it('refuses an id that is not a proper id', async () => {
    const { req } = fakeReq({ params: { assetId: 'nope' } });

    await expect(
      getAdminAssetController(ctx)(req, fakeRes().res),
    ).rejects.toThrow();
    expect(getAdminAsset).not.toHaveBeenCalled();
  });
});

describe('dashboard endpoint', () => {
  it('looks at the last 14 days unless told otherwise', async () => {
    vi.mocked(getDashboard).mockResolvedValue({} as never);

    await dashboardController(ctx)(fakeReq().req, fakeRes().res);

    expect(getDashboard).toHaveBeenCalledWith(ctx, { days: 14 });
  });
});

describe('admin tag list endpoint', () => {
  it('wraps every tag in "items"', async () => {
    vi.mocked(listAllTags).mockResolvedValue([
      { tag: 'sea', count: 3 },
    ] as never);
    const { res, mocks } = fakeRes();

    await listAllTagsController(ctx)(fakeReq().req, res);

    expect(mocks.json).toHaveBeenCalledWith({
      items: [{ tag: 'sea', count: 3 }],
    });
  });
});
