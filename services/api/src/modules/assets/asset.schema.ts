import { z } from 'zod';
import { ASSET_STATUSES } from '@dam/db';

export const assetIdParam = z.uuid();

export const listAssetsQuery = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
  status: z.enum(ASSET_STATUSES).optional(),
});
