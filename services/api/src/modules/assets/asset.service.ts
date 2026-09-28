import { publishJob } from '@dam/queue';
import type { Asset, AssetStatus } from '@dam/db';
import { downloadUrl, thumbnailUrl } from '../../shared/lib/storage.ts';
import type { Context } from '../../shared/lib/context.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { canAccess, type AuthUser } from '../../shared/lib/actor.ts';
import {
  assetKindFor,
  jobTypeFor,
  storageKeyFor,
} from '../../shared/lib/asset-kind.ts';
import { createAsset, findAssetById, listAssets } from './asset.repository.ts';

export type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

// The statuses where a finished object actually exists in storage
const HAS_OBJECT: AssetStatus[] = ['uploaded', 'processing', 'ready'];

export async function presentAsset(ctx: Context, asset: Asset) {
  const ready = HAS_OBJECT.includes(asset.status);

  return {
    id: asset.id,
    ownerId: asset.ownerId,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    failureReason: asset.failureReason,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    thumbnailUrl: ready ? await thumbnailUrl(ctx, asset) : null,
    downloadUrl: ready ? await downloadUrl(ctx, asset) : null,
  };
}

export async function getAsset(ctx: Context, id: string, actor: AuthUser) {
  const asset = await findAssetById(ctx.db, id);
  // Someone else's asset looks the same as a missing one, so ids can't be probed
  if (!asset || !canAccess(actor, asset)) {
    throw new NotFoundError('Asset not found');
  }

  return presentAsset(ctx, asset);
}

// Everything a gallery card needs, without handing out a download link per row
export async function presentAssetSummary(ctx: Context, asset: Asset) {
  const ready = HAS_OBJECT.includes(asset.status);

  return {
    id: asset.id,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    createdAt: asset.createdAt,
    thumbnailUrl: ready ? await thumbnailUrl(ctx, asset) : null,
  };
}

export async function listAssetsPage(
  ctx: Context,
  query: { limit: number; offset: number; status?: AssetStatus },
  actor: AuthUser,
) {
  const { rows, total } = await listAssets(ctx.db, {
    ...query,
    ownerId: actor.id,
  });

  return {
    items: await Promise.all(
      rows.map((asset) => presentAssetSummary(ctx, asset)),
    ),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}
