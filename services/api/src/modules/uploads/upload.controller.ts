import type { Request, Response } from 'express';
import type { Context } from '../../shared/lib/context.ts';
import { currentUser } from '../../shared/middlewares/requireAuth.ts';
import {
  assetIdParam,
  recordPartBody,
  signPartsBody,
  startUploadBody,
} from './upload.schema.ts';
import {
  abortUpload,
  finishUpload,
  recordUploadedPart,
  signParts,
  startUpload,
  uploadStatus,
} from './upload.service.ts';

export function startUploadController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const body = startUploadBody.parse(req.body);
    const session = await startUpload(ctx, body, currentUser(req));

    req.log.info(
      { assetId: session.assetId, filename: body.filename, size: body.size },
      'upload started',
    );
    res.status(201).json(session);
  };
}

export function uploadStatusController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = assetIdParam.parse(req.params.assetId);

    res.json(await uploadStatus(ctx, assetId, currentUser(req)));
  };
}

export function signPartsController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = assetIdParam.parse(req.params.assetId);
    const { partNumbers } = signPartsBody.parse(req.body);

    res.json({
      parts: await signParts(ctx, assetId, partNumbers, currentUser(req)),
    });
  };
}

export function recordPartController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = assetIdParam.parse(req.params.assetId);
    const part = recordPartBody.parse(req.body);

    await recordUploadedPart(ctx, assetId, part, currentUser(req));
    res.status(204).end();
  };
}

export function completeUploadController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = assetIdParam.parse(req.params.assetId);
    const asset = await finishUpload(ctx, assetId, currentUser(req));

    req.log.info({ assetId }, 'upload completed');
    res.json(asset);
  };
}

export function abortUploadController(ctx: Context) {
  return async (req: Request, res: Response) => {
    const assetId = assetIdParam.parse(req.params.assetId);

    await abortUpload(ctx, assetId, currentUser(req));
    req.log.info({ assetId }, 'upload cancelled');
    res.status(204).end();
  };
}
