import type { Request, Response } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import {
  adminAssetIdParam,
  dashboardQuery,
  listAdminAssetsQuery,
} from './admin.schema.ts';
import {
  getAdminAsset,
  getDashboard,
  listAdminAssets,
  listAllTags,
} from './admin.service.ts';

export function listAdminAssetsController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const query = listAdminAssetsQuery.parse(req.query);

    res.json(await listAdminAssets(ctx, query));
  };
}

export function getAdminAssetController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = adminAssetIdParam.parse(req.params.assetId);

    res.json(await getAdminAsset(ctx, assetId));
  };
}

export function dashboardController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const query = dashboardQuery.parse(req.query);

    res.json(await getDashboard(ctx, query));
  };
}

export function listAllTagsController(ctx: Context) {
  return async (_req: Request, res: Response) => {
    res.json({ items: await listAllTags(ctx) });
  };
}
