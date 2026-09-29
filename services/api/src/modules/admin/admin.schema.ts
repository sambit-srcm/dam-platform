import { z } from 'zod';
import { ASSET_STATUSES } from '@dam/db';

// from and to are plain dates like 2026-09-29, and both days are included
export const listAdminAssetsQuery = z
  .object({
    limit: z.coerce.number().int().min(1).max(100).default(24),
    offset: z.coerce.number().int().min(0).default(0),
    type: z.enum(['image', 'video', 'document']).optional(),
    status: z.enum(ASSET_STATUSES).optional(),
    ownerId: z.uuid().optional(),
    from: z.iso.date().optional(),
    to: z.iso.date().optional(),
    sort: z.enum(['createdAt', 'downloadCount']).default('createdAt'),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export type ListAdminAssetsQuery = z.infer<typeof listAdminAssetsQuery>;
