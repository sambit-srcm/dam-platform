import type { Asset } from '@dam/db';
import type { Context } from '../../shared/lib/context.ts';
import { HAS_OBJECT } from '../../shared/lib/asset-status.ts';
import { thumbnailUrl } from '../../shared/lib/storage.ts';
import { NotFoundError } from '../../shared/errors/AppError.ts';
import { logger } from '../../shared/lib/logger.ts';
import { downloadsDaykey } from '../../shared/lib/stats.ts';
import { listTags } from '../assets/asset.repository.ts';
import { presentView } from '../assets/asset.service.ts';
import {
  countByStatus,
  countByType,
  dashboardTotals,
  findAdminAsset,
  listAllAssets,
  topDownloaded,
  uploadsPerDay,
} from './admin.repository.ts';
import type { DashboardQuery, ListAdminAssetsQuery } from './admin.schema.ts';

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// No download link here, so browsing never skips the download counter
async function presentAdminAsset(
  ctx: Context,
  asset: Asset,
  ownerEmail: string | null,
) {
  const hasFile = HAS_OBJECT.includes(asset.status);

  return {
    id: asset.id,
    filename: asset.filename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    status: asset.status,
    tags: asset.tags,
    createdAt: asset.createdAt,
    ownerId: asset.ownerId,
    ownerEmail,
    downloadCount: asset.downloadCount,
    thumbnailUrl: hasFile ? await thumbnailUrl(ctx, asset) : null,
  };
}

export async function listAdminAssets(
  ctx: Context,
  query: ListAdminAssetsQuery,
) {
  const { rows, total } = await listAllAssets(ctx.db, query);

  return {
    items: await Promise.all(
      rows.map((row) => presentAdminAsset(ctx, row.asset, row.ownerEmail)),
    ),
    total,
    limit: query.limit,
    offset: query.offset,
  };
}

// Any asset, with the fields the owner never sees, plus what a player needs
export async function getAdminAsset(ctx: Context, id: string) {
  const row = await findAdminAsset(ctx.db, id);
  if (!row) throw new NotFoundError('Asset not found');

  const { asset, ownerEmail } = row;
  const hasFile = HAS_OBJECT.includes(asset.status);

  return {
    ...(await presentAdminAsset(ctx, asset, ownerEmail)),
    failureReason: asset.failureReason,
    metadata: asset.metadata,
    updatedAt: asset.updatedAt,
    view: hasFile ? await presentView(ctx, asset) : null,
  };
}

// The last `days` UTC days ending today, oldest first
function lastDays(days: number) {
  const now = new Date();
  const today = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate(),
  );
  return Array.from(
    { length: days },
    (_, i) => new Date(today - (days - 1 - i) * ONE_DAY_MS),
  );
}

async function downloadsSeries(ctx: Context, dates: Date[]) {
  try {
    const values = await ctx.redis.mGet(dates.map(downloadsDaykey));
    return values.map((value) => Number(value ?? 0));
  } catch (error) {
    // The daily counter is a nicety, so the dashboard still loads without it
    logger.warn({ err: error }, 'failed to read download stats');
    return null;
  }
}

export function listAllTags(ctx: Context) {
  return listTags(ctx.db);
}

export async function getDashboard(ctx: Context, query: DashboardQuery) {
  const dates = lastDays(query.days);
  const since = dates[0]!;

  const [totals, byStatus, byType, uploads, top, latest, downloads] =
    await Promise.all([
      dashboardTotals(ctx.db),
      countByStatus(ctx.db),
      countByType(ctx.db),
      uploadsPerDay(ctx.db, since),
      topDownloaded(ctx.db, 5),
      listAllAssets(ctx.db, {
        limit: 5,
        offset: 0,
        sort: 'createdAt',
        status: 'ready',
      }),
      downloadsSeries(ctx, dates),
    ]);

  const uploadsByDay = new Map(uploads.map((row) => [row.day, row.count]));

  return {
    totals,
    byStatus: Object.fromEntries(byStatus.map((r) => [r.key, r.count])),
    byType: Object.fromEntries(byType.map((r) => [r.key, r.count])),
    days: dates.map((date, i) => {
      const day = date.toISOString().slice(0, 10);
      return {
        day,
        uploads: uploadsByDay.get(day) ?? 0,
        // Null when Redis could not be read, so it is not mistaken for zero
        downloads: downloads ? (downloads[i] ?? 0) : null,
      };
    }),
    latest: await Promise.all(
      latest.rows.map((row) =>
        presentAdminAsset(ctx, row.asset, row.ownerEmail),
      ),
    ),
    topDownloaded: await Promise.all(
      top.map(async ({ asset, ownerEmail }) => ({
        id: asset.id,
        filename: asset.filename,
        mimeType: asset.mimeType,
        downloadCount: asset.downloadCount,
        ownerEmail,
        thumbnailUrl: await thumbnailUrl(ctx, asset),
      })),
    ),
  };
}
