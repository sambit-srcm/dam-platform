import { z } from 'zod';
import { ASSET_STATUSES } from '@dam/db';
import { normalizeTag } from '../../shared/lib/tags.ts';

export const assetIdParam = z.uuid();

// Used by the gallery and the admin browser, which differ only in whose assets they see.
// from and to are plain dates like 2026-09-29, and both days are included.
export const assetFilters = {
  q: z.string().trim().min(1).max(100).optional(),
  type: z.enum(['image', 'video', 'document']).optional(),
  // Comma separated, and an asset must have all of them
  tags: z
    .string()
    .transform((value) =>
      value
        .split(',')
        .map(normalizeTag)
        .filter((tag) => tag !== null),
    )
    .pipe(z.array(z.string()).max(10))
    .optional(),
  status: z.enum(ASSET_STATUSES).optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  sort: z.enum(['createdAt', 'downloadCount']).default('createdAt'),
};

export const page = {
  limit: z.coerce.number().int().min(1).max(100).default(24),
  offset: z.coerce.number().int().min(0).default(0),
};

export function fromIsBeforeTo(query: { from?: string; to?: string }) {
  return !query.from || !query.to || query.from <= query.to;
}

export const listAssetsQuery = z
  .object({ ...page, ...assetFilters })
  .refine(fromIsBeforeTo, {
    message: 'from must be on or before to',
    path: ['from'],
  });

export type ListAssetsQuery = z.infer<typeof listAssetsQuery>;
