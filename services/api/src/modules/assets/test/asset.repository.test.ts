import { describe, expect, it } from 'vitest';
import {
  createAsset,
  failAsset,
  findAssetById,
  incrementDownloadCount,
  listAssets,
  listTags,
  markUploadComplete,
} from '../asset.repository.ts';
import { alice, ASSET_ID, makeAsset } from '../../../test/helpers.ts';
import { fakeDb } from '../../../test/support.ts';

describe('saving a new asset', () => {
  it('stores the values and gives back the saved asset', async () => {
    const saved = makeAsset();
    const { db, stepsOf, argsOf } = fakeDb([saved]);

    const asset = await createAsset(db, { filename: 'beach.jpg' } as never);

    expect(asset).toEqual(saved);
    expect(stepsOf(0)).toEqual(['insert', 'values', 'returning']);
    expect(argsOf(0, 'values')).toEqual([{ filename: 'beach.jpg' }]);
  });
});

describe('finding an asset by id', () => {
  it('gives back the asset when it exists', async () => {
    const { db } = fakeDb([makeAsset()]);

    expect(await findAssetById(db, ASSET_ID)).toEqual(makeAsset());
  });

  it('gives back nothing when it does not exist', async () => {
    const { db } = fakeDb([]);

    expect(await findAssetById(db, 'missing')).toBeUndefined();
  });
});

describe('listing assets', () => {
  const options = {
    limit: 10,
    offset: 20,
    sort: 'createdAt',
    viewerId: alice.id,
  } as const;

  it('gives back the rows and the total as a real number', async () => {
    const { db } = fakeDb([makeAsset()], [{ value: '42' }]);

    const result = await listAssets(db, options);

    expect(result.rows).toEqual([makeAsset()]);
    expect(result.total).toBe(42);
  });

  it('counts zero when the count row is missing', async () => {
    const { db } = fakeDb([], []);

    expect((await listAssets(db, options)).total).toBe(0);
  });
});

describe('listing tags', () => {
  it('gives back the tags with how many assets use each', async () => {
    const rows = [{ tag: 'sea', count: 3 }];
    const { db, stepsOf } = fakeDb({ rows });

    expect(await listTags(db, { userId: alice.id, scope: 'mine' })).toEqual(
      rows,
    );
    expect(stepsOf(0)).toEqual(['execute']);
  });

  it('works for all owners when no owner is given', async () => {
    const { db } = fakeDb({ rows: [] });

    expect(await listTags(db)).toEqual([]);
  });
});

describe('marking an upload complete', () => {
  it('saves the real size and status and clears the upload details', async () => {
    const { db, stepsOf, argsOf } = fakeDb();

    await markUploadComplete(db, ASSET_ID, 2048, 'uploaded');

    expect(stepsOf(0)).toEqual(['update', 'set', 'where']);
    expect(argsOf(0, 'set')).toEqual([
      {
        status: 'uploaded',
        sizeBytes: 2048,
        upload: null,
        uploadExpiresAt: null,
      },
    ]);
  });
});

describe('counting a download', () => {
  it('adds one to the download count without changing the last-updated time', async () => {
    const { db, stepsOf, argsOf } = fakeDb();

    await incrementDownloadCount(db, ASSET_ID);

    expect(stepsOf(0)).toEqual(['update', 'set', 'where']);
    const values = argsOf(0, 'set')![0] as Record<string, unknown>;
    expect(Object.keys(values).sort()).toEqual(['downloadCount', 'updatedAt']);
  });
});

describe('failing an asset', () => {
  it('marks it failed with the reason and clears the upload details', async () => {
    const { db, argsOf } = fakeDb();

    await failAsset(db, ASSET_ID, 'queue_unavailable');

    expect(argsOf(0, 'set')).toEqual([
      {
        status: 'failed',
        failureReason: 'queue_unavailable',
        upload: null,
        uploadExpiresAt: null,
      },
    ]);
  });
});
