import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import type { JobType } from '@dam/queue';
import { ValidationError } from '../errors/AppError.ts';

export type AssetKind = 'image' | 'video' | 'document';

// Bucket folder for the original file of each kind
const FOLDERS: Record<AssetKind, string> = {
  image: 'images',
  video: 'videos',
  document: 'documents',
};

// Documents need no processing, so they have no job
const JOBS: Record<AssetKind, JobType | null> = {
  image: 'image.process',
  video: 'video.process',
  document: null,
};

export const DOCUMENT_MIME_TYPES = ['application/pdf'];

export function assetKindFor(mimeType: string): AssetKind {
  if (mimeType.startsWith('image/')) return 'image';
  if (mimeType.startsWith('video/')) return 'video';
  if (DOCUMENT_MIME_TYPES.includes(mimeType)) return 'document';
  throw new ValidationError('Only image, video and PDF files are supported');
}

export function jobTypeFor(kind: AssetKind): JobType | null {
  return JOBS[kind];
}

export function storageKeyFor(kind: AssetKind, filename: string) {
  return `${FOLDERS[kind]}/${randomUUID()}${extname(filename)}`;
}
