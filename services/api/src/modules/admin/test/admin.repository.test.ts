import { describe, expect, it } from 'vitest';
import {
  countByStatus,
  countByType,
  dashboardTotals,
  findAdminAsset,
  listAllAssets,
} from '../admin.repository.ts';
import { makeAsset } from '../../../test/helpers.ts';
import { fakeDb } from '../../../test/support.ts';

const row = { asset: makeAsset(), ownerEmail: 'a@b.com' };

describe('listing every asset for admins', () => {
  const options = { limit: 24, offset: 48, sort: 'createdAt' } as const;

  it('gives back the rows with owner emails and the total as a real number', async () => {
    const { db } = fakeDb([row], [{ value: '7' }]);

    const result = await listAllAssets(db, options);

    expect(result.rows).toEqual([row]);
    expect(result.total).toBe(7);
  });

  it('asks for only the requested page', async () => {
    const { db, argsOf } = fakeDb([], [{ value: 0 }]);

    await listAllAssets(db, options);

    expect(argsOf(0, 'limit')).toEqual([24]);
    expect(argsOf(0, 'offset')).toEqual([48]);
  });
});

describe('finding one asset for admins', () => {
  it('gives back the asset with its owner email', async () => {
    const { db, stepsOf } = fakeDb([row]);

    expect(await findAdminAsset(db, row.asset.id)).toEqual(row);
    expect(stepsOf(0)).toEqual(['select', 'from', 'leftJoin', 'where']);
  });
});

describe('dashboard totals', () => {
  it('turns the text sums from the database into real numbers', async () => {
    const { db } = fakeDb(
      [{ assets: 5, storageBytes: '1048576', downloads: '12' }],
      [{ value: 3 }],
    );

    expect(await dashboardTotals(db)).toEqual({
      assets: 5,
      storageBytes: 1048576,
      downloads: 12,
      users: 3,
    });
  });
});

describe('counting assets by status', () => {
  it('gives back one row per status', async () => {
    const rows = [{ key: 'ready', count: 4 }];
    const { db, stepsOf } = fakeDb(rows);

    expect(await countByStatus(db)).toEqual(rows);
    expect(stepsOf(0)).toEqual(['select', 'from', 'groupBy']);
  });
});

describe('counting assets by type', () => {
  it('gives back one row per type', async () => {
    const rows = [{ key: 'image', count: 9 }];
    const { db, stepsOf } = fakeDb(rows);

    expect(await countByType(db)).toEqual(rows);
    expect(stepsOf(0)).toEqual(['select', 'from', 'groupBy']);
  });
});
