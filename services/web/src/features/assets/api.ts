import axios from 'axios';
import { http } from '../../lib/http';
import type {
  AssetListResponse,
  AssetView,
  ListAssetsParams,
  SignedPart,
  TagCount,
  UploadedAsset,
  UploadSession,
  UploadStatus,
} from './types';

// The API wants tags as one comma separated value, and no empty parameters
export function toQuery(params: ListAssetsParams) {
  return {
    ...params,
    q: params.q || undefined,
    tags: params.tags?.join(',') || undefined,
  };
}

export async function getAssets(
  params: ListAssetsParams = {},
): Promise<AssetListResponse> {
  const res = await http.get<AssetListResponse>('/assets', {
    params: toQuery(params),
  });
  return res.data;
}

export async function getTags(): Promise<TagCount[]> {
  const res = await http.get<{ items: TagCount[] }>('/assets/tags');
  return res.data.items;
}

export async function getAssetView(id: string): Promise<AssetView> {
  const res = await http.get<AssetView>(`/assets/${id}/view`);
  return res.data;
}

// Counts as a download, unlike viewing
export async function getDownloadUrl(id: string): Promise<string> {
  const res = await http.post<{ url: string }>(`/assets/${id}/download`);
  return res.data.url;
}

// Must match MAX_UPLOAD_MB on the API
export const MAX_UPLOAD_MB = 300;
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024;

const PART_URL_BATCH_SIZE = 10;
const PART_CONCURRENCY = 3;
const PART_ATTEMPTS = 3;

const storage = axios.create();

async function putPart(
  url: string,
  chunk: Blob,
  onProgress: (loaded: number) => void,
) {
  for (let attempt = 1; ; attempt++) {
    try {
      await storage.put(url, chunk, {
        onUploadProgress: (event) => onProgress(event.loaded),
      });
      return;
    } catch (error) {
      onProgress(0);
      if (attempt >= PART_ATTEMPTS) throw error;
    }
  }
}

type SendPartsInput = {
  file: File;
  assetId: string;
  partSize: number;
  partCount: number;
  partNumbers: number[];
  alreadyReceived?: number[];
  onProgress?: (percent: number) => void;
};

// Sends the given parts straight to storage, a batch of links at a time and a few in parallel
async function sendParts({
  file,
  assetId,
  partSize,
  partCount,
  partNumbers,
  alreadyReceived = [],
  onProgress,
}: SendPartsInput) {
  const sizeOfPart = (partNumber: number) => {
    const start = (partNumber - 1) * partSize;
    return Math.min(start + partSize, file.size) - start;
  };

  const loadedByPart = new Array<number>(partCount + 1).fill(0);
  for (const partNumber of alreadyReceived) {
    loadedByPart[partNumber] = sizeOfPart(partNumber);
  }
  const report = () => {
    const loaded = loadedByPart.reduce((sum, bytes) => sum + bytes, 0);
    onProgress?.(Math.min(100, Math.round((loaded / file.size) * 100)));
  };
  report();

  for (let i = 0; i < partNumbers.length; i += PART_URL_BATCH_SIZE) {
    const { data } = await http.post<{ parts: SignedPart[] }>(
      `/assets/uploads/${assetId}/parts`,
      { partNumbers: partNumbers.slice(i, i + PART_URL_BATCH_SIZE) },
    );

    const queue = [...data.parts];
    const worker = async () => {
      for (let part = queue.shift(); part; part = queue.shift()) {
        const start = (part.partNumber - 1) * partSize;
        const chunk = file.slice(start, start + sizeOfPart(part.partNumber));
        await putPart(part.url, chunk, (loaded) => {
          loadedByPart[part.partNumber] = loaded;
          report();
        });
        loadedByPart[part.partNumber] = chunk.size;
        report();
      }
    };
    await Promise.all(Array.from({ length: PART_CONCURRENCY }, () => worker()));
  }
}

async function completeUpload(assetId: string) {
  const { data } = await http.post<UploadedAsset>(
    `/assets/uploads/${assetId}/complete`,
  );
  return data;
}

// The file goes straight to storage in parts; the API only plans, signs and finalises.
// A failure leaves the upload open, so resumeUpload can finish it until it expires.
export async function uploadAsset(
  file: File,
  onProgress?: (percent: number) => void,
  onStart?: (assetId: string) => void,
): Promise<UploadedAsset> {
  const { data: session } = await http.post<UploadSession>('/assets/uploads', {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  });
  onStart?.(session.assetId);

  await sendParts({
    file,
    assetId: session.assetId,
    partSize: session.partSize,
    partCount: session.partCount,
    partNumbers: Array.from({ length: session.partCount }, (_, i) => i + 1),
    onProgress,
  });
  return completeUpload(session.assetId);
}

// Asks storage which parts already arrived and sends only the rest
export async function resumeUpload(
  assetId: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedAsset> {
  const { data: status } = await http.get<UploadStatus>(
    `/assets/uploads/${assetId}`,
  );

  await sendParts({
    file,
    assetId,
    partSize: status.partSize,
    partCount: status.partCount,
    partNumbers: status.remaining,
    alreadyReceived: status.received,
    onProgress,
  });
  return completeUpload(assetId);
}
