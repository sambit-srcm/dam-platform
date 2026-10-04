import { findAssetById } from '../assets/asset.repository.ts';
import {
  downloadAsset,
  presentAssetSummary,
  presentView,
} from '../assets/asset.service.ts';
import { listAssetTeams } from '../teams/team.service.ts';
import {
  NotFoundError,
  ValidationError,
} from '../../shared/errors/AppError.ts';
import { canAccess, type AuthUser } from '../../shared/lib/actor.ts';
import type { Context } from '../../shared/lib/context.ts';
import {
  findActiveShare,
  insertShareLink,
  listShareLinks,
  revokeShareLink,
} from './share.repository.ts';
import { hashShareToken, newShareToken } from './token.ts';

async function requireAssetOwner(
  ctx: Context,
  assetId: string,
  actor: AuthUser,
) {
  const asset = await findAssetById(ctx.db, assetId);
  if (!asset || !canAccess(actor, asset)) {
    throw new NotFoundError('Asset not found');
  }
  return asset;
}

export async function createShareLink(
  ctx: Context,
  actor: AuthUser,
  assetId: string,
  input: { canDownload: boolean; expiresAt: Date },
) {
  await requireAssetOwner(ctx, assetId, actor);
  const token = newShareToken();
  const link = await insertShareLink(ctx.db, {
    assetId,
    tokenHash: hashShareToken(token),
    canDownload: input.canDownload,
    expiresAt: input.expiresAt,
    createdBy: actor.id,
  });
  return {
    id: link.id,
    token,
    canDownload: link.canDownload,
    expiresAt: link.expiresAt,
  };
}

export async function listAssetSharing(
  ctx: Context,
  actor: AuthUser,
  assetId: string,
) {
  const [teams, links] = await Promise.all([
    listAssetTeams(ctx, actor, assetId),
    requireAssetOwner(ctx, assetId, actor).then(() =>
      listShareLinks(ctx.db, assetId),
    ),
  ]);
  return { teams, links };
}

export async function revokeShare(
  ctx: Context,
  actor: AuthUser,
  assetId: string,
  shareId: string,
) {
  await requireAssetOwner(ctx, assetId, actor);
  const link = await revokeShareLink(ctx.db, assetId, shareId);
  if (!link) throw new NotFoundError('Share link not found');
}

async function openShare(ctx: Context, token: string) {
  const found = await findActiveShare(
    ctx.db,
    hashShareToken(token),
    new Date(),
  );
  if (!found) throw new NotFoundError('Share link not found');
  return found;
}

export async function previewShare(ctx: Context, token: string) {
  const { link, asset } = await openShare(ctx, token);
  return {
    filename: asset.filename,
    mimeType: asset.mimeType,
    canDownload: link.canDownload,
    expiresAt: link.expiresAt,
    asset: await presentAssetSummary(ctx, asset),
    view: await presentView(ctx, asset),
  };
}

export async function downloadShare(ctx: Context, token: string) {
  const { link, asset } = await openShare(ctx, token);
  if (!link.canDownload) {
    throw new ValidationError('This link does not allow download');
  }
  // The owner check inside downloadAsset would hide a shared file, so count here
  // through the same path by acting as the owner of this one asset.
  return downloadAsset(ctx, asset.id, {
    id: asset.ownerId ?? '',
    role: 'user',
  });
}
