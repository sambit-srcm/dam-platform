import { z } from 'zod';
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
  // Redis keeps the download series for 90 days
  days: z.coerce.number().int().min(1).max(90).default(14),
});

export type DashboardQuery = z.infer<typeof dashboardQuery>;
