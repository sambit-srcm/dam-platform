import { z } from 'zod';

const MAX_SHARE_MS = 30 * 24 * 60 * 60 * 1000;

export const createShareBody = z.object({
  canDownload: z.boolean().default(false),
  expiresAt: z.coerce.date().refine(
    (date) => {
      const now = Date.now();
      return date.getTime() > now && date.getTime() <= now + MAX_SHARE_MS;
    },
    { message: 'Expiry must be within the next 30 days' },
  ),
});

export const shareTokenParam = z.string().min(20).max(128);
