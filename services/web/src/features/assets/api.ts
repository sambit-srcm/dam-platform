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

// The file goes straight to storage in parts; the API only plans, signs and finalises
export async function uploadAsset(
  file: File,
  onProgress?: (percent: number) => void,
): Promise<UploadedAsset> {
  const { data: session } = await http.post<UploadSession>('/assets/uploads', {
    filename: file.name,
    mimeType: file.type,
    size: file.size,
  });
  const { assetId, partSize, partCount } = session;
  const base = `/assets/uploads/${assetId}`;

  const loadedByPart = new Array<number>(partCount + 1).fill(0);
  const report = () => {
    const loaded = loadedByPart.reduce((sum, bytes) => sum + bytes, 0);
    onProgress?.(Math.min(100, Math.round((loaded / file.size) * 100)));
  };

  try {
    const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1);

    for (let i = 0; i < partNumbers.length; i += PART_URL_BATCH_SIZE) {
      const { data } = await http.post<{ parts: SignedPart[] }>(
        `${base}/parts`,
        { partNumbers: partNumbers.slice(i, i + PART_URL_BATCH_SIZE) },
      );

      const queue = [...data.parts];
      const worker = async () => {
        for (let part = queue.shift(); part; part = queue.shift()) {
          const start = (part.partNumber - 1) * partSize;
          const chunk = file.slice(
            start,
            Math.min(start + partSize, file.size),
          );
          await putPart(part.url, chunk, (loaded) => {
            loadedByPart[part.partNumber] = loaded;
            report();
          });
          loadedByPart[part.partNumber] = chunk.size;
          report();
        }
      };
      await Promise.all(
        Array.from({ length: PART_CONCURRENCY }, () => worker()),
      );
    }

    const { data: asset } = await http.post<UploadedAsset>(`${base}/complete`);
    return asset;
  } catch (error) {
    await http.delete(base).catch(() => undefined);
    throw error;
  }
}
