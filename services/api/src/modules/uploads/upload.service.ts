import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  HeadObjectCommand,
  ListPartsCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { publishJob } from '@dam/queue';
import { config } from '../../config.ts';
import {
  NotFoundError,
  ValidationError,
} from '../../shared/errors/AppError.ts';
import { canAccess, type AuthUser } from '../../shared/lib/actor.ts';
import type { Context } from '../../shared/lib/context.ts';
import { s3, s3Public } from '../../shared/lib/s3.ts';
import {
  createAsset,
  failAsset,
  findAssetById,
  markUploadComplete,
} from '../assets/asset.repository.ts';
import { presentAsset } from '../assets/asset.service.ts';
import {
  assetKindFor,
  jobTypesFor,
  storageKeyFor,
} from '../../shared/lib/asset-kind.ts';
import {
  clearSession,
  recordPart,
  recordedParts,
  type UploadedPart,
} from './upload.session.ts';
import { planParts } from './utils/part-plan.ts';
import { logger } from '../../shared/lib/logger.ts';

export async function startUpload(
  ctx: Context,
  input: { filename: string; mimeType: string; size: number },
  actor: AuthUser,
) {
  const kind = assetKindFor(input.mimeType); // rejects unsupported types before any S3 call
  const { partSize, partCount } = planParts(input.size);
  const storageKey = storageKeyFor(kind, input.filename);

  const created = await s3.send(
    new CreateMultipartUploadCommand({
      Bucket: ctx.bucket,
      Key: storageKey,
      ContentType: input.mimeType,
    }),
  );

  const asset = await createAsset(ctx.db, {
    filename: input.filename,
    mimeType: input.mimeType,
    sizeBytes: input.size,
    storageKey,
    ownerId: actor.id,
    status: 'uploading',
    upload: { uploadId: created.UploadId!, partSize, partCount },
    uploadExpiresAt: new Date(
      Date.now() + config.UPLOAD_SESSION_TTL_SECONDS * 1000,
    ),
  });

  return { assetId: asset.id, partSize, partCount };
}

async function activeUpload(ctx: Context, assetId: string, actor: AuthUser) {
  const asset = await findAssetById(ctx.db, assetId);
  // Someone else's upload looks the same as a missing one
  if (!asset || !canAccess(actor, asset)) {
    throw new NotFoundError('Upload not found');
  }
  if (asset.status !== 'uploading' || !asset.upload) {
    throw new ValidationError('This upload is no longer in progress');
  }
  return asset;
}

export async function signParts(
  ctx: Context,
  assetId: string,
  partNumbers: number[],
  actor: AuthUser,
) {
  const asset = await activeUpload(ctx, assetId, actor);
  const { partCount } = asset.upload!;

  if (partNumbers.some((partNumber) => partNumber > partCount)) {
    throw new ValidationError(`This upload only has ${partCount} parts`);
  }

  const wanted = partNumbers.slice(0, config.PART_URL_BATCH_SIZE);

  return Promise.all(
    wanted.map(async (partNumber) => ({
      partNumber,
      url: await getSignedUrl(
        s3Public,
        new UploadPartCommand({
          Bucket: ctx.bucket,
          Key: asset.storageKey,
          UploadId: asset.upload!.uploadId,
          PartNumber: partNumber,
        }),
        { expiresIn: config.PRESIGNED_TTL_SECONDS },
      ),
    })),
  );
}

export async function uploadStatus(
  ctx: Context,
  assetId: string,
  actor: AuthUser,
) {
  const asset = await activeUpload(ctx, assetId, actor);
  const listed = await s3.send(
    new ListPartsCommand({
      Bucket: ctx.bucket,
      Key: asset.storageKey,
      UploadId: asset.upload!.uploadId,
    }),
  );

  // Storage is the authority on what actually arrived
  const received = (listed.Parts ?? [])
    .map((part) => part.PartNumber!)
    .sort((a, b) => a - b);
  const all = Array.from({ length: asset.upload!.partCount }, (_, i) => i + 1);

  return {
    partSize: asset.upload!.partSize,
    partCount: asset.upload!.partCount,
    received,
    remaining: all.filter((partNumber) => !received.includes(partNumber)),
    // What the client told us it sent, kept only for progress reporting
    recorded: await recordedParts(ctx, assetId),
  };
}

export async function finishUpload(
  ctx: Context,
  assetId: string,
  actor: AuthUser,
) {
  const asset = await activeUpload(ctx, assetId, actor);
  const { uploadId, partSize, partCount } = asset.upload!;

  const listed = await s3.send(
    new ListPartsCommand({
      Bucket: ctx.bucket,
      Key: asset.storageKey,
      UploadId: uploadId,
    }),
  );
  const parts = (listed.Parts ?? []).sort(
    (a, b) => a.PartNumber! - b.PartNumber!,
  );

  const total = parts.reduce((sum, p) => sum + (p.Size ?? 0), 0);
  const sizesValid = parts.every(
    (p, i) => i === parts.length - 1 || p.Size === partSize,
  );

  if (parts.length !== partCount || total !== asset.sizeBytes || !sizesValid) {
    await s3.send(
      new AbortMultipartUploadCommand({
        Bucket: ctx.bucket,
        Key: asset.storageKey,
        UploadId: uploadId,
      }),
    );
    await failAsset(
      ctx.db,
      assetId,
      'uploaded_bytes_did_not_match_declared_size',
    );
    await clearSession(ctx, assetId);
    throw new ValidationError('Uploaded file does not match what was declared');
  }

  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: ctx.bucket,
      Key: asset.storageKey,
      UploadId: uploadId,
      MultipartUpload: {
        Parts: parts.map((p) => ({ ETag: p.ETag, PartNumber: p.PartNumber })),
      },
    }),
  );

  const head = await s3.send(
    new HeadObjectCommand({ Bucket: ctx.bucket, Key: asset.storageKey }),
  );

  const jobTypes = jobTypesFor(assetKindFor(asset.mimeType));

  await markUploadComplete(
    ctx.db,
    assetId,
    head.ContentLength ?? total,
    jobTypes.length > 0 ? 'uploaded' : 'ready',
  );
  await clearSession(ctx, assetId);

  for (const [index, jobType] of jobTypes.entries()) {
    try {
      await publishJob(ctx.queue, jobType, { assetId });
    } catch (error) {
      // The first job finishes the asset; later ones (a video poster) are optional
      if (index === 0) throw error;
      logger.warn({ err: error, assetId, jobType }, 'failed to queue job');
    }
  }

  const finished = await findAssetById(ctx.db, assetId);
  if (!finished) throw new NotFoundError('Upload not found');

  return presentAsset(ctx, finished);
}

export async function abortUpload(
  ctx: Context,
  assetId: string,
  actor: AuthUser,
) {
  const asset = await activeUpload(ctx, assetId, actor);
  await s3.send(
    new AbortMultipartUploadCommand({
      Bucket: ctx.bucket,
      Key: asset.storageKey,
      UploadId: asset.upload!.uploadId,
    }),
  );
  await failAsset(ctx.db, assetId, 'cancelled_by_user');
  await clearSession(ctx, assetId);
}

// Progress bookkeeping only, but still limited to the upload's owner
export async function recordUploadedPart(
  ctx: Context,
  assetId: string,
  part: UploadedPart,
  actor: AuthUser,
) {
  await activeUpload(ctx, assetId, actor);
  await recordPart(ctx, assetId, part);
}
