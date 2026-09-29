import type { Request, Response } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { listAdminAssetsQuery } from './admin.schema.ts';
import { listAdminAssets } from './admin.service.ts';

export function listAdminAssetsController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const query = listAdminAssetsQuery.parse(req.query);

    res.json(await listAdminAssets(ctx, query));
  };
}
