import { FIELD_LIMITS } from '@dam/db';
import { z } from 'zod';

// Express types route params loosely, so the id is parsed rather than trusted
export const assetIdParam = z.uuid();

export const startUploadBody = z.object({
  filename: z.string().min(1).max(FIELD_LIMITS.filename),
  mimeType: z.string().min(1).max(FIELD_LIMITS.mimeType),
  size: z.coerce.number().int().positive(),
});

export const signPartsBody = z.object({
  partNumbers: z.array(z.number().int().positive()).min(1),
});

export const recordPartBody = z.object({
  partNumber: z.number().int().positive(),
  etag: z.string().min(1),
  size: z.number().int().positive(),
});
