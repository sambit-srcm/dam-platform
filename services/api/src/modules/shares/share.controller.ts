import type { Request, Response } from 'express';
import { z } from 'zod';
import type { Context } from '../../shared/lib/context.ts';
import { currentUser } from '../../shared/middlewares/requireAuth.ts';
import { createShareBody, shareTokenParam } from './share.schema.ts';
import {
  createShareLink,
  downloadShare,
  listAssetSharing,
  previewShare,
  revokeShare,
} from './share.service.ts';
import {
  shareAssetWithTeam,
  unshareAssetWithTeam,
} from '../teams/team.service.ts';

export function listSharingController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = z.uuid().parse(req.params.assetId);
    res.json(await listAssetSharing(ctx, currentUser(req), assetId));
  };
}

export function grantTeamController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = z.uuid().parse(req.params.assetId);
    const teamId = z.uuid().parse(req.params.teamId);
    await shareAssetWithTeam(ctx, currentUser(req), assetId, teamId);
    res.status(204).end();
  };
}

export function revokeTeamController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = z.uuid().parse(req.params.assetId);
    const teamId = z.uuid().parse(req.params.teamId);
    await unshareAssetWithTeam(ctx, currentUser(req), assetId, teamId);
    res.status(204).end();
  };
}

export function createShareController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = z.uuid().parse(req.params.assetId);
    const body = createShareBody.parse(req.body);
    res
      .status(201)
      .json(await createShareLink(ctx, currentUser(req), assetId, body));
  };
}

export function revokeShareController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = z.uuid().parse(req.params.assetId);
    const shareId = z.uuid().parse(req.params.shareId);
    await revokeShare(ctx, currentUser(req), assetId, shareId);
    res.status(204).end();
  };
}

export function previewShareController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const token = shareTokenParam.parse(req.params.token);
    res.json(await previewShare(ctx, token));
  };
}

export function downloadShareController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const token = shareTokenParam.parse(req.params.token);
    res.json(await downloadShare(ctx, token));
  };
}
