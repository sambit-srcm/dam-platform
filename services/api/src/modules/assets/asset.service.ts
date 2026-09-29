import type { Asset, AssetStatus } from '@dam/db';
import { downloadUrl, thumbnailUrl } from '../../shared/lib/storage.ts';
import type { Context } from '../../shared/lib/context.ts';
import {
  NotFoundError,
  ValidationError,
} from '../../shared/errors/AppError.ts';
import { canAccess, type AuthUser } from '../../shared/lib/actor.ts';
import {
  findAssetById,
  incrementDownloadCount,
  listAssets,
} from './asset.repository.ts';
import {
  STATS_RETENTION_SECONDS,
  downloadsDaykey,
} from '../../shared/lib/stats.ts';
import { logger } from '../../shared/lib/logger.ts';
import { HAS_OBJECT } from '../../shared/lib/asset-status.ts';

export type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

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

export async function downloadAsset(ctx: Context, id: string, actor: AuthUser) {
  const asset = await findAssetById(ctx.db, id);

  if (!asset || !canAccess(actor, asset)) {
    throw new NotFoundError('Asset not found');
  }
  const ready = HAS_OBJECT.includes(asset.status);
  if (!ready) {
    throw new ValidationError('Asset has no file to download');
  }
  const download = await downloadUrl(ctx, asset);
  await incrementDownloadCount(ctx.db, id);

  try {
    const key = downloadsDaykey(new Date());
    const count = await ctx.redis.incr(key);

    if (count === 1) {
      await ctx.redis.expire(key, STATS_RETENTION_SECONDS);
    }
  } catch (error) {
    logger.warn({ err: error }, 'failed to record download stat');
  }
  return {
    url: download,
  };
}
