import { assets } from '@dam/db';
import { publishJob, type JobType } from '@dam/queue';
import { Router } from 'express';
import multer from 'multer';
import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { config } from '../config.ts';
import type { Context } from '../context.ts';
import { ValidationError } from '../errors.ts';

// Files are held in memory, which is fine for images and short videos.
// Large uploads should stream straight to MinIO instead.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.MAX_UPLOAD_MB * 1024 * 1024 },
});

function jobTypeFor(mimeType: string): JobType {
  if (mimeType.startsWith('image/')) return 'image.process';
  if (mimeType.startsWith('video/')) return 'video.process';
  throw new ValidationError('Only image and video files are supported');
}

export function assetRoutes(ctx: Context) {
  const router = Router();

  router.post('/', upload.single('file'), async (req, res) => {
    const file = req.file;
    if (!file)
      throw new ValidationError('A file is required in the "file" field');

    const jobType = jobTypeFor(file.mimetype);
    const storageKey = `${randomUUID()}${extname(file.originalname)}`;

    await ctx.storage.putObject(
      ctx.bucket,
      storageKey,
      file.buffer,
      file.size,
      { 'Content-Type': file.mimetype },
    );

    const [asset] = await ctx.db
      .insert(assets)
      .values({
        filename: file.originalname,
        mimeType: file.mimetype,
        sizeBytes: file.size,
        storageKey,
      })
      .returning();

    await publishJob(ctx.queue, jobType, { assetId: asset!.id });

    req.log.info({ assetId: asset!.id, storageKey, jobType }, 'asset uploaded');
    res.status(201).json(asset);
  });

  return router;
}
