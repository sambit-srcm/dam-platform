import axios from 'axios';
import type {
  AssetListResponse,
  ListAssetsParams,
  SignedPart,
  UploadedAsset,
  UploadSession,
} from './types';

export async function getAssets(
  params: ListAssetsParams = {},
): Promise<AssetListResponse> {
  const res = await axios.get<AssetListResponse>('/api/assets', { params });
  return res.data;
}


export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

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
  const { data: session } = await axios.post<UploadSession>(
    '/api/assets/uploads',
    { filename: file.name, mimeType: file.type, size: file.size },
  );
  const { assetId, partSize, partCount } = session;
  const base = `/api/assets/uploads/${assetId}`;

  const loadedByPart = new Array<number>(partCount + 1).fill(0);
  const report = () => {
    const loaded = loadedByPart.reduce((sum, bytes) => sum + bytes, 0);
    onProgress?.(Math.min(100, Math.round((loaded / file.size) * 100)));
  };

  try {
    const partNumbers = Array.from({ length: partCount }, (_, i) => i + 1);

    for (let i = 0; i < partNumbers.length; i += PART_URL_BATCH_SIZE) {
      const { data } = await axios.post<{ parts: SignedPart[] }>(
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

    const { data: asset } = await axios.post<UploadedAsset>(`${base}/complete`);
    return asset;
  } catch (error) {

    await axios.delete(base).catch(() => undefined);
    throw error;
  }
}


export function getErrorMessage(error: unknown) {
  if (axios.isAxiosError(error)) {
    return error.response?.data?.error?.message ?? error.message;
  }
  return error instanceof Error ? error.message : 'Something went wrong';
}
