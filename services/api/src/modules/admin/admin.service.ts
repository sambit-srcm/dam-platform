import type { Asset } from '@dam/db';
import type { Context } from '../../shared/lib/context.ts';
import { HAS_OBJECT } from '../../shared/lib/asset-status.ts';
import { thumbnailUrl } from '../../shared/lib/storage.ts';
import { listAllAssets } from './admin.repository.ts';
import type { ListAdminAssetsQuery } from './admin.schema.ts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// No download link here, so browsing never skips the download counter
async function presentAdminAsset(
  ctx: Context,
  asset: Asset,
  ownerEmail: string | null,
) {
  const hasFile = HAS_OBJECT.includes(asset.status);

  return {
    id: asset.id,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    createdAt: asset.createdAt,
    ownerId: asset.ownerId,
    ownerEmail,
    downloadCount: asset.downloadCount,
    thumbnailUrl: hasFile ? await thumbnailUrl(ctx, asset) : null,
  };
}

export async function listAdminAssets(
  ctx: Context,
  query: ListAdminAssetsQuery,
) {
  const from = query.from ? new Date(`${query.from}T00:00:00.000Z`) : undefined;
  const lastDay = query.to ? new Date(`${query.to}T00:00:00.000Z`) : undefined;
  const toExclusive = lastDay
    ? new Date(lastDay.getTime() + ONE_DAY_MS)
    : undefined;

  const { rows, total } = await listAllAssets(ctx.db, {
    limit: query.limit,
    offset: query.offset,
    type: query.type,
    status: query.status,
    ownerId: query.ownerId,
    from,
    toExclusive,
    sort: query.sort,
  });

  return {
    items: await Promise.all(
      rows.map((row) => presentAdminAsset(ctx, row.asset, row.ownerEmail)),
    ),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}
