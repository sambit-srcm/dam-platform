import { beforeEach, describe, expect, it, vi } from 'vitest';
import { downloadsDaykey } from '../../../shared/lib/stats.ts';
import { ASSET_ID, makeAsset, makeCtx } from '../../../test/helpers.ts';

vi.mock('../admin.repository.ts', () => ({
  countByStatus: vi.fn(),
  countByType: vi.fn(),
  dashboardTotals: vi.fn(),
  findAdminAsset: vi.fn(),
  listAllAssets: vi.fn(),
  topDownloaded: vi.fn(),
  uploadsPerDay: vi.fn(),
}));
vi.mock('../../assets/asset.repository.ts', () => ({
  findRenditions: vi.fn().mockResolvedValue([]),
  listTags: vi.fn(),
}));

import { listTags } from '../../assets/asset.repository.ts';
import {
  countByStatus,
  countByType,
  dashboardTotals,
  findAdminAsset,
  listAllAssets,
  topDownloaded,
  uploadsPerDay,
} from '../admin.repository.ts';
import {
  getAdminAsset,
  getDashboard,
  listAdminAssets,
  listAllTags,
} from '../admin.service.ts';

let h: ReturnType<typeof makeCtx>;
const today = () => new Date().toISOString().slice(0, 10);

beforeEach(() => {
  vi.clearAllMocks();
  h = makeCtx();
  vi.mocked(dashboardTotals).mockResolvedValue({
    users: 3,
    assets: 10,
    bytes: 999,
    downloads: 4,
  } as never);
  vi.mocked(countByStatus).mockResolvedValue([
    { key: 'ready', count: 8 },
    { key: 'failed', count: 2 },
  ] as never);
  vi.mocked(countByType).mockResolvedValue([
    { key: 'image', count: 9 },
  ] as never);
  vi.mocked(uploadsPerDay).mockResolvedValue([]);
  vi.mocked(topDownloaded).mockResolvedValue([]);
  vi.mocked(listAllAssets).mockResolvedValue({ rows: [], total: 0 });
});

describe('the admin asset list', () => {
  it('shows the owner’s email next to each asset', async () => {
    vi.mocked(listAllAssets).mockResolvedValue({
      rows: [{ asset: makeAsset(), ownerEmail: 'alice@example.com' }],
      total: 1,
    } as never);

    const page = await listAdminAssets(h.ctx, {
      limit: 24,
      offset: 0,
      sort: 'createdAt',
    });

    expect(page.items[0]).toMatchObject({
      filename: 'beach.jpg',
      ownerEmail: 'alice@example.com',
    });
    expect(page.total).toBe(1);
  });

  it('lists tags across everybody', async () => {
    vi.mocked(listTags).mockResolvedValue([{ tag: 'beach', count: 5 }]);
    await listAllTags(h.ctx);
    expect(vi.mocked(listTags).mock.calls[0]![1]).toBeUndefined();
  });
});

describe('opening any asset as admin', () => {
  it('includes the failure reason and a way to play it', async () => {
    vi.mocked(findAdminAsset).mockResolvedValue({
      asset: makeAsset({ failureReason: null }),
      ownerEmail: 'alice@example.com',
    } as never);

    const result = await getAdminAsset(h.ctx, ASSET_ID);

    expect(result.view).toEqual({
      kind: 'image',
      url: 'https://files.test/images/beach.jpg',
    });
    expect(result).toHaveProperty('failureReason');
  });

  it('says not found for a missing asset', async () => {
    vi.mocked(findAdminAsset).mockResolvedValue(undefined as never);
    await expect(getAdminAsset(h.ctx, ASSET_ID)).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe('the dashboard', () => {
  it('gives exactly the number of days asked for, oldest first, ending today', async () => {
    const result = await getDashboard(h.ctx, { days: 7 });

    expect(result.days).toHaveLength(7);
    expect(result.days.at(-1)!.day).toBe(today());
    const days = result.days.map((d) => d.day);
    expect([...days].sort()).toEqual(days);
  });

  it('shows zero uploads on days nothing was uploaded', async () => {
    vi.mocked(uploadsPerDay).mockResolvedValue([
      { day: today(), count: 3 },
    ] as never);

    const result = await getDashboard(h.ctx, { days: 3 });

    expect(result.days.map((d) => d.uploads)).toEqual([0, 0, 3]);
  });

  it('reads the download counters for the very same days', async () => {
    await getDashboard(h.ctx, { days: 3 });

    const asked = h.redis.mGet.mock.calls[0]![0] as string[];
    expect(asked).toHaveLength(3);
    expect(asked.at(-1)).toBe(downloadsDaykey(new Date()));
  });

  it('shows "unknown" instead of zero when the counters cannot be read', async () => {
    h.redis.mGet.mockRejectedValue(new Error('redis down'));

    const result = await getDashboard(h.ctx, { days: 3 });

    expect(result.days.every((d) => d.downloads === null)).toBe(true);
    expect(result.totals).toBeDefined();
  });

  it('only shows finished assets in the latest list', async () => {
    await getDashboard(h.ctx, { days: 3 });
    expect(vi.mocked(listAllAssets).mock.calls[0]![1]).toMatchObject({
      status: 'ready',
      limit: 5,
    });
  });
});
