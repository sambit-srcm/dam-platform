import { MAX_UPLOAD_BYTES, MAX_UPLOAD_MB } from './api';

export type UploadItem = {
  id: string;
  file: File;
  state: 'queued' | 'uploading' | 'done' | 'error';
  progress: number;
  error?: string;
};

export function toUploadItem(file: File): UploadItem {
  const tooBig = file.size > MAX_UPLOAD_BYTES;
  return {
    id: crypto.randomUUID(),
    file,
    state: tooBig ? 'error' : 'queued',
    progress: 0,
    error: tooBig
      ? `Larger than the ${MAX_UPLOAD_MB} MB upload limit`
      : undefined,
  };
}
