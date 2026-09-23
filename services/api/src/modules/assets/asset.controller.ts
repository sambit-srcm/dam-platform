import type { Request, Response } from 'express';
import { ValidationError } from '../../shared/errors/AppError.ts';
import type { Context } from '../../shared/lib/context.ts';
import { getAsset, listAssetsPage, uploadAsset } from './asset.service.ts';
import { z } from 'zod';
import { listAssetsQuery } from './asset.schema.ts';

export function uploadAssetController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const file = req.file;
    if (!file) {
      throw new ValidationError('A file is required in the "file" field');
    }

    const asset = await uploadAsset(ctx, file);

    req.log.info(
      { assetId: asset.id, storageKey: asset.storageKey },
      'asset uploaded',
    );
    res.status(201).json(asset);
  };
}

export function getAssetController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = z.uuid().parse(req.params.assetId);

    res.json(await getAsset(ctx, assetId));
  };
}

export function listAssetsController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const query = listAssetsQuery.parse(req.query);

    res.json(await listAssetsPage(ctx, query));
  };
}
