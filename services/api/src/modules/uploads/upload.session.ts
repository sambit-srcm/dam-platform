import { config } from '../../config.ts';
import type { Context } from '../../shared/lib/context.ts';

export type UploadedPart = {
  partNumber: number;
  etag: string;
  size: number;
};

const partsKey = (assetId: string) => `upload:${assetId}:parts`;

export async function recordPart(
  ctx: Context,
  assetId: string,
  part: UploadedPart,
) {
  const key = partsKey(assetId);
  await ctx.redis.hSet(key, String(part.partNumber), JSON.stringify(part));
  await ctx.redis.expire(key, config.UPLOAD_SESSION_TTL_SECONDS);
}

export async function recordedParts(ctx: Context, assetId: string) {
  const entries = await ctx.redis.hGetAll(partsKey(assetId));
  return Object.values(entries)
    .map((value) => JSON.parse(value) as UploadedPart)
    .sort((a, b) => a.partNumber - b.partNumber);
}

export async function clearSession(ctx: Context, assetId: string) {
  await ctx.redis.del(partsKey(assetId));
}
