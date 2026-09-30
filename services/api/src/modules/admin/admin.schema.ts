import { z } from 'zod';
import { STATS_RETENTION_DAYS } from '../../shared/lib/stats.ts';
import { assetFilters, fromIsBeforeTo, page } from '../assets/asset.schema.ts';

export const listAdminAssetsQuery = z
  .object({ ...page, ...assetFilters, ownerId: z.uuid().optional() })
  .refine(fromIsBeforeTo, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export type ListAdminAssetsQuery = z.infer<typeof listAdminAssetsQuery>;

export const adminAssetIdParam = z.uuid();

export const dashboardQuery = z.object({
  days: z.coerce.number().int().min(1).max(STATS_RETENTION_DAYS).default(14),
});

export type DashboardQuery = z.infer<typeof dashboardQuery>;
