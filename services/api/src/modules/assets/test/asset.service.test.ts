import { beforeEach, describe, expect, it, vi } from 'vitest';
import { alice, ASSET_ID, makeAsset, makeCtx } from '../../../test/helpers.ts';

vi.mock('../asset.repository.ts', () => ({
  findAssetById: vi.fn(),
  findRenditions: vi.fn(),
  incrementDownloadCount: vi.fn(),
  listAssets: vi.fn(),
  listTags: vi.fn(),
}));

import {
  findAssetById,
  findRenditions,
  incrementDownloadCount,
  listAssets,
  listTags,
} from '../asset.repository.ts';
import {
  downloadAsset,
  getAsset,
  getAssetView,
  listAssetsPage,
  listMyTags,
  presentAsset,
} from '../asset.service.ts';

let h: ReturnType<typeof makeCtx>;

beforeEach(() => {
  vi.resetAllMocks();
  h = makeCtx();
  h.redis.incr.mockResolvedValue(1);
  h.publicStorage.presignedGetObject.mockImplementation(
    async (_b: string, key: string) => `https://files.test/${key}`,
  );
});

describe('opening one asset', () => {
  it('shows the owner their own asset with a thumbnail link', async () => {
    vi.mocked(findAssetById).mockResolvedValue(makeAsset());

    const result = await getAsset(h.ctx, ASSET_ID, alice);

    expect(result.filename).toBe('beach.jpg');
    expect(result.thumbnailUrl).toBe(
      'https://files.test/thumbnails/beach.webp',
    );
  });

  it('says not found for an id that does not exist', async () => {
    vi.mocked(findAssetById).mockResolvedValue(undefined as never);
    await expect(getAsset(h.ctx, ASSET_ID, alice)).rejects.toMatchObject({
      status: 404,
    });
  });

  it('gives no thumbnail link while the file is still uploading', async () => {
    const result = await presentAsset(
      h.ctx,
      makeAsset({ status: 'uploading' }),
    );
    expect(result.thumbnailUrl).toBeNull();
    expect(h.publicStorage.presignedGetObject).not.toHaveBeenCalled();
  });

  it('gives no thumbnail link when a thumbnail was never made', async () => {
    const result = await presentAsset(h.ctx, makeAsset({ thumbnailKey: null }));
    expect(result.thumbnailUrl).toBeNull();
  });
});

describe('the gallery list', () => {
  it('only ever asks for the signed-in person’s own assets', async () => {
    vi.mocked(listAssets).mockResolvedValue({ rows: [], total: 0 });

    await listAssetsPage(
      h.ctx,
      { limit: 24, offset: 0, sort: 'createdAt' },
      alice,
    );

    expect(vi.mocked(listAssets).mock.calls[0]![1]).toMatchObject({
      ownerId: alice.id,
    });
  });

  it('lists tags only from my own assets', async () => {
    vi.mocked(listTags).mockResolvedValue([{ tag: 'beach', count: 2 }]);

    await expect(listMyTags(h.ctx, alice)).resolves.toEqual([
      { tag: 'beach', count: 2 },
    ]);
    expect(vi.mocked(listTags).mock.calls[0]![1]).toBe(alice.id);
  });
});

describe('downloading', () => {
  it('gives a link that saves the file under its real name', async () => {
    vi.mocked(findAssetById).mockResolvedValue(makeAsset());

    const { url } = await downloadAsset(h.ctx, ASSET_ID, alice);

    expect(url).toBe('https://files.test/images/beach.jpg');
    const options = h.publicStorage.presignedGetObject.mock.calls[0]![3];
    expect(options['response-content-disposition']).toContain('attachment');
    expect(options['response-content-disposition']).toContain('beach.jpg');
  });

  it('counts the download', async () => {
    vi.mocked(findAssetById).mockResolvedValue(makeAsset());
    await downloadAsset(h.ctx, ASSET_ID, alice);

    expect(incrementDownloadCount).toHaveBeenCalledWith(h.ctx.db, ASSET_ID);
    expect(h.redis.incr).toHaveBeenCalled();
  });
});

describe('viewing in the browser', () => {
  it('shows an image with one inline link', async () => {
    vi.mocked(findAssetById).mockResolvedValue(makeAsset());

    const view = await getAssetView(h.ctx, ASSET_ID, alice);

    expect(view).toEqual({
      kind: 'image',
      url: 'https://files.test/images/beach.jpg',
    });
    expect(h.publicStorage.presignedGetObject.mock.calls[0]![3]).toMatchObject({
      'response-content-disposition': 'inline',
    });
  });

  it('shows a pdf as a document', async () => {
    vi.mocked(findAssetById).mockResolvedValue(
      makeAsset({ mimeType: 'application/pdf', storageKey: 'documents/a.pdf' }),
    );
    const view = await getAssetView(h.ctx, ASSET_ID, alice);
    expect(view.kind).toBe('document');
  });

  it('falls back to the original video when no sizes were made', async () => {
    vi.mocked(findAssetById).mockResolvedValue(
      makeAsset({
        mimeType: 'video/mp4',
        storageKey: 'videos/a.mp4',
        metadata: { width: 640, height: 360 } as never,
      }),
    );
    vi.mocked(findRenditions).mockResolvedValue([]);

    const view = await getAssetView(h.ctx, ASSET_ID, alice);

    expect('renditions' in view && view.renditions).toEqual([
      {
        label: 'original',
        width: 640,
        height: 360,
        url: 'https://files.test/videos/a.mp4',
      },
    ]);
  });
});
