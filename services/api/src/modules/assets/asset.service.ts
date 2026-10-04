import type { Asset } from '@dam/db';
import {
  downloadUrl,
  thumbnailUrl,
  viewUrl,
} from '../../shared/lib/storage.ts';
import type { Context } from '../../shared/lib/context.ts';
import {
  NotFoundError,
  ValidationError,
} from '../../shared/errors/AppError.ts';
import { canAccess, type AuthUser } from '../../shared/lib/actor.ts';
import { hasTeamAccess } from '../teams/team.repository.ts';
import {
  findAssetById,
  findRenditions,
  incrementDownloadCount,
  listAssets,
  listTags,
} from './asset.repository.ts';
import {
  STATS_RETENTION_SECONDS,
  downloadsDaykey,
} from '../../shared/lib/stats.ts';
import { logger } from '../../shared/lib/logger.ts';
import { HAS_OBJECT } from '../../shared/lib/asset-status.ts';
import type { ListAssetsQuery } from './asset.schema.ts';

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
    tags: asset.tags,
    failureReason: asset.failureReason,
    createdAt: asset.createdAt,
    updatedAt: asset.updatedAt,
    thumbnailUrl: ready ? await thumbnailUrl(ctx, asset) : null,
  };
}

async function visibleAsset(ctx: Context, id: string, actor: AuthUser) {
  const asset = await findAssetById(ctx.db, id);
  // Someone else's asset looks the same as a missing one, so ids can't be probed
  if (!asset) throw new NotFoundError('Asset not found');
  if (canAccess(actor, asset)) return asset;
  if (await hasTeamAccess(ctx.db, asset.id, actor.id)) return asset;
  throw new NotFoundError('Asset not found');
}

export async function getAsset(ctx: Context, id: string, actor: AuthUser) {
  return presentAsset(ctx, await visibleAsset(ctx, id, actor));
}

// Everything a gallery card needs, without handing out a download link per row
export async function presentAssetSummary(
  ctx: Context,
  asset: Asset,
  actor?: AuthUser,
) {
  const ready = HAS_OBJECT.includes(asset.status);

  return {
    id: asset.id,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    tags: asset.tags,
    createdAt: asset.createdAt,
    thumbnailUrl: ready ? await thumbnailUrl(ctx, asset) : null,
    ...(actor
      ? {
          access:
            asset.ownerId === actor.id ? ('owner' as const) : ('team' as const),
        }
      : {}),
  };
}

export async function listAssetsPage(
  ctx: Context,
  query: ListAssetsQuery,
  actor: AuthUser,
) {
  const { rows, total } = await listAssets(ctx.db, {
    ...query,
    viewerId: actor.id,
  });

  return {
    items: await Promise.all(
      rows.map((asset) => presentAssetSummary(ctx, asset, actor)),
    ),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

export function listMyTags(
  ctx: Context,
  actor: AuthUser,
  scope?: 'mine' | 'team',
) {
  return listTags(ctx.db, { userId: actor.id, scope });
}

export async function downloadAsset(ctx: Context, id: string, actor: AuthUser) {
  const asset = await visibleAsset(ctx, id, actor);
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

// What a player needs to show the full asset: one link, or one per video size
export async function presentView(ctx: Context, asset: Asset) {
  if (!HAS_OBJECT.includes(asset.status)) {
    throw new ValidationError('Asset is not ready to view');
  }

  if (asset.mimeType.startsWith('video/')) {
    const found = await findRenditions(ctx.db, asset.id);
    // A video without sizes falls back to the original file
    const sources =
      found.length > 0
        ? found
        : [
            {
              label: 'original',
              width: asset.metadata?.width ?? null,
              height: asset.metadata?.height ?? null,
              storageKey: asset.storageKey,
              mimeType: asset.mimeType,
            },
          ];

    return {
      kind: 'video' as const,
      renditions: await Promise.all(
        sources.map(async (source) => ({
          label: source.label,
          width: source.width,
          height: source.height,
          url: await viewUrl(ctx, source.storageKey, source.mimeType),
        })),
      ),
    };
  }

  return {
    kind: asset.mimeType.startsWith('image/')
      ? ('image' as const)
      : ('document' as const),
    url: await viewUrl(ctx, asset.storageKey, asset.mimeType),
  };
}

export async function getAssetView(ctx: Context, id: string, actor: AuthUser) {
  return presentView(ctx, await visibleAsset(ctx, id, actor));
}
