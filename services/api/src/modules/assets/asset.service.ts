import { publishJob } from '@dam/queue';
import type { Asset, AssetStatus } from '@dam/db';
import { downloadUrl, thumbnailUrl } from '../../shared/lib/storage.ts';
import type { Context } from '../../shared/lib/context.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
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

export async function uploadAsset(ctx: Context, file: UploadFile) {
  const kind = assetKindFor(file.mimetype);
  const jobType = jobTypeFor(kind);
  const storageKey = storageKeyFor(kind, file.originalname);

  await ctx.storage.putObject(ctx.bucket, storageKey, file.buffer, file.size, {
    'Content-Type': file.mimetype,
  });

  const asset = await createAsset(ctx.db, {
    filename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageKey,
    // Nothing to process for documents, so they are usable straight away
    status: jobType ? 'uploaded' : 'ready',
  });

  if (jobType) await publishJob(ctx.queue, jobType, { assetId: asset.id });

  return asset;
}

// The statuses where a finished object actually exists in storage
const HAS_OBJECT: AssetStatus[] = ['uploaded', 'processing', 'ready'];

export async function presentAsset(ctx: Context, asset: Asset) {
  const ready = HAS_OBJECT.includes(asset.status);

  return {
    id: asset.id,
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

export async function getAsset(ctx: Context, id: string) {
  const asset = await findAssetById(ctx.db, id);
  if (!asset) throw new NotFoundError('Asset not found');

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
) {
  const { rows, total } = await listAssets(ctx.db, query);

  return {
    items: await Promise.all(
      rows.map((asset) => presentAssetSummary(ctx, asset)),
    ),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}
