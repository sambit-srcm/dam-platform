import { publishJob, type JobType } from '@dam/queue';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { Context } from '../../shared/lib/context.ts';
import { ValidationError } from '../../shared/errors/AppError.ts';
import { createAsset } from './asset.repository.ts';

export type UploadFile = {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
  size: number;
};

function jobTypeFor(mimeType: string): JobType {
  if (mimeType.startsWith('image/')) return 'image.process';
  if (mimeType.startsWith('video/')) return 'video.process';
  throw new ValidationError('Only image and video files are supported');
}

export async function uploadAsset(ctx: Context, file: UploadFile) {
  const jobType = jobTypeFor(file.mimetype);
  const storageKey = `${randomUUID()}${extname(file.originalname)}`;

  await ctx.storage.putObject(ctx.bucket, storageKey, file.buffer, file.size, {
    'Content-Type': file.mimetype,
  });

  const asset = await createAsset(ctx.db, {
    filename: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    storageKey,
  });

  await publishJob(ctx.queue, jobType, { assetId: asset!.id });

  return asset;
}
