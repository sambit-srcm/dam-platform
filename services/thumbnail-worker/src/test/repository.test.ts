import { describe, expect, it, vi } from 'vitest';
import type { Db } from '@dam/db';
import {
  findAssetById,
  markAssetFailed,
  markAssetProcessing,
  markAssetReady,
  updateAssetThumbnail,
} from '../repository.ts';

// A stand-in database that remembers what was written and returns the rows we hand it
function fakeDb(rows: unknown[] = []) {
  const written: Record<string, unknown>[] = [];
  const where = vi.fn().mockResolvedValue(undefined);
  const db = {
    update: vi.fn(() => ({
      set: (values: Record<string, unknown>) => {
        written.push(values);
        return { where };
      },
    })),
    select: vi.fn(() => ({
      from: () => ({ where: vi.fn().mockResolvedValue(rows) }),
    })),
  };
  return { db: db as unknown as Db, written, where };
}

describe('thumbnail worker database calls', () => {
  it('finds an asset by its id', async () => {
    const { db } = fakeDb([{ id: 'a1', filename: 'x.jpg' }]);
    expect(await findAssetById(db, 'a1')).toEqual({
      id: 'a1',
      filename: 'x.jpg',
    });
  });

  it('gives back nothing when the asset does not exist', async () => {
    const { db } = fakeDb([]);
    expect(await findAssetById(db, 'missing')).toBeUndefined();
  });

  it('marks an asset as processing', async () => {
    const { db, written, where } = fakeDb();
    await markAssetProcessing(db, 'a1');
    expect(written).toEqual([{ status: 'processing' }]);
    expect(where).toHaveBeenCalledOnce();
  });

  it('marks an asset as failed', async () => {
    const { db, written } = fakeDb();
    await markAssetFailed(db, 'a1');
    expect(written).toEqual([{ status: 'failed' }]);
  });

  it('saves only the thumbnail location when a poster is added', async () => {
    const { db, written } = fakeDb();
    await updateAssetThumbnail(db, 'a1', 'thumbnails/a1.webp');
    expect(written).toEqual([{ thumbnailKey: 'thumbnails/a1.webp' }]);
  });

  it('marks an asset ready with its thumbnail, details and tags', async () => {
    const { db, written } = fakeDb();
    const metadata = { width: 10, height: 20 } as never;
    await markAssetReady(db, 'a1', {
      thumbnailKey: 'thumbnails/a1.webp',
      metadata,
      tags: ['beach'],
    });

    expect(written[0]).toMatchObject({
      status: 'ready',
      thumbnailKey: 'thumbnails/a1.webp',
      metadata,
    });
    expect(written[0]!.tags).toBeDefined();
  });
});
