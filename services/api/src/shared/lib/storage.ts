import type { Asset } from '@dam/db';
import { config } from '../../config.ts';
import type { Context } from './context.ts';

type AssetFile = Pick<Asset, 'filename' | 'storageKey' | 'thumbnailKey'>;

export async function thumbnailUrl(
  ctx: Context,
  asset: AssetFile,
): Promise<string | null> {
  if (!asset.thumbnailKey) return null;

  return ctx.publicStorage.presignedGetObject(
    ctx.bucket,
    asset.thumbnailKey,
    config.THUMBNAIL_TTL_SECONDS,
  );
}

function contentDisposition(filename: string): string {
  const ascii = filename.replace(/[^\x20-\x7e]/g, '_').replace(/["\\]/g, '');
  return `attachment; filename="${ascii}"; filename*=UTF-8''${encodeURIComponent(filename)}`;
}

export async function downloadUrl(ctx: Context, asset: AssetFile) {
  return ctx.publicStorage.presignedGetObject(
    ctx.bucket,
    asset.storageKey,
    config.PRESIGNED_TTL_SECONDS,
    { 'response-content-disposition': contentDisposition(asset.filename) },
  );
}
