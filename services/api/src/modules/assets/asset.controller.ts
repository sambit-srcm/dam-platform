import type { Request, Response } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { downloadAsset, getAsset, listAssetsPage } from './asset.service.ts';
import { z } from 'zod';
import { listAssetsQuery } from './asset.schema.ts';
import { currentUser } from '../../shared/middlewares/requireAuth.ts';

export function getAssetController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = z.uuid().parse(req.params.assetId);

    res.json(await getAsset(ctx, assetId, currentUser(req)));
  };
}

export function listAssetsController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const query = listAssetsQuery.parse(req.query);

    res.json(await listAssetsPage(ctx, query, currentUser(req)));
  };
}

export function downloadController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = z.uuid().parse(req.params.assetId);

    res.json(await downloadAsset(ctx, assetId, currentUser(req)));
  };
}
