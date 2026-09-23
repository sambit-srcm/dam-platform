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
import type { Context } from '../../shared/lib/context.ts';
import { s3, s3Public } from '../../shared/lib/s3.ts';
import {
  createAsset,
  failAsset,
  findAssetById,
  markUploadComplete,
} from '../assets/asset.repository.ts';
import {
  assetKindFor,
  jobTypeFor,
  storageKeyFor,
} from '../../shared/lib/asset-kind.ts';
import { clearSession, recordedParts } from './upload.session.ts';
import { planParts } from './utils/part-plan.ts';

export async function startUpload(
  ctx: Context,
  input: { filename: string; mimeType: string; size: number },
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
    status: 'uploading',
    upload: { uploadId: created.UploadId!, partSize, partCount },
    uploadExpiresAt: new Date(
      Date.now() + config.UPLOAD_SESSION_TTL_SECONDS * 1000,
    ),
  });

  return { assetId: asset.id, partSize, partCount };
}

async function activeUpload(ctx: Context, assetId: string) {
  const asset = await findAssetById(ctx.db, assetId);
  if (!asset) throw new NotFoundError('Upload not found');
  if (asset.status !== 'uploading' || !asset.upload) {
    throw new ValidationError('This upload is no longer in progress');
  }
  return asset;
}

export async function signParts(
  ctx: Context,
  assetId: string,
  partNumbers: number[],
) {
  const asset = await activeUpload(ctx, assetId);
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

export async function uploadStatus(ctx: Context, assetId: string) {
  const asset = await activeUpload(ctx, assetId);
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

export async function finishUpload(ctx: Context, assetId: string) {
  const asset = await activeUpload(ctx, assetId);
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

  const jobType = jobTypeFor(assetKindFor(asset.mimeType));

  await markUploadComplete(
    ctx.db,
    assetId,
    head.ContentLength ?? total,
    jobType ? 'uploaded' : 'ready',
  );
  await clearSession(ctx, assetId);
  if (jobType) await publishJob(ctx.queue, jobType, { assetId });

  return findAssetById(ctx.db, assetId);
}

export async function abortUpload(ctx: Context, assetId: string) {
  const asset = await activeUpload(ctx, assetId);
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
