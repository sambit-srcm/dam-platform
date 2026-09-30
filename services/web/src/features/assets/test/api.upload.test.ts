import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';

// Every request in this file is answered by the handler below instead of the network.
// It is set before the api file loads, because the storage client copies it on creation.
type Call = { method: string; url: string; data: unknown; params: unknown };
let calls: Call[] = [];
let handler: (call: Call, config: InternalAxiosRequestConfig) => unknown;

axios.defaults.adapter = async (config) => {
  const call: Call = {
    method: (config.method ?? 'get').toUpperCase(),
    url: config.url ?? '',
    data: config.data,
    params: config.params,
  };
  calls.push(call);
  const outcome = handler(call, config);
  if (outcome instanceof Error) {
    throw new AxiosError(outcome.message, 'ERR_BAD_RESPONSE', config);
  }
  return {
    data: outcome,
    status: 200,
    statusText: 'OK',
    headers: {},
    config,
  };
};

const { getAssets, getAssetView, getDownloadUrl, getTags, uploadAsset } =
  await import('../api');

const json = (call: Call) =>
  typeof call.data === 'string' ? JSON.parse(call.data) : call.data;

beforeEach(() => {
  calls = [];
});

describe('reading assets', () => {
  it('asks the API for the list, with tags joined and empty filters dropped', async () => {
    handler = () => ({ items: [], total: 0, limit: 24, offset: 0 });

    await getAssets({ q: '', tags: ['a', 'b'], limit: 24 });

    expect(calls[0]).toMatchObject({ method: 'GET', url: '/assets' });
    expect(calls[0]!.params).toMatchObject({
      q: undefined,
      tags: 'a,b',
      limit: 24,
    });
  });

  it('returns the page the API sent', async () => {
    handler = () => ({ items: [{ id: 'a1' }], total: 1, limit: 24, offset: 0 });
    expect((await getAssets()).total).toBe(1);
  });

  it('returns just the list of tags', async () => {
    handler = () => ({ items: [{ tag: 'beach', count: 2 }] });
    expect(await getTags()).toEqual([{ tag: 'beach', count: 2 }]);
    expect(calls[0]!.url).toBe('/assets/tags');
  });

  it('asks for the view of one asset', async () => {
    handler = () => ({ kind: 'image', url: 'https://files.test/x' });
    expect(await getAssetView('a1')).toMatchObject({ kind: 'image' });
    expect(calls[0]!.url).toBe('/assets/a1/view');
  });

  it('gets a download link with a POST, because it counts as a download', async () => {
    handler = () => ({ url: 'https://files.test/dl' });
    expect(await getDownloadUrl('a1')).toBe('https://files.test/dl');
    expect(calls[0]).toMatchObject({
      method: 'POST',
      url: '/assets/a1/download',
    });
  });
});

// A file of 12 bytes cut into parts of 5 gives parts of 5, 5 and 2
function serverForUpload(options: {
  partSize?: number;
  partCount?: number;
  failPut?: (url: string, attempt: number) => boolean;
}) {
  const { partSize = 5, partCount = 3, failPut } = options;
  const attempts = new Map<string, number>();

  handler = (call) => {
    if (call.url === '/assets/uploads') {
      return { assetId: 'a1', partSize, partCount };
    }
    if (call.url === '/assets/uploads/a1/parts') {
      const { partNumbers } = json(call) as { partNumbers: number[] };
      return {
        parts: partNumbers.map((partNumber) => ({
          partNumber,
          url: `https://storage.test/part/${partNumber}`,
        })),
      };
    }
    if (call.url.startsWith('https://storage.test/part/')) {
      const attempt = (attempts.get(call.url) ?? 0) + 1;
      attempts.set(call.url, attempt);
      if (failPut?.(call.url, attempt)) return new Error('storage hiccup');
      return {};
    }
    if (call.url === '/assets/uploads/a1/complete') {
      return { id: 'a1', filename: 'video.mp4', status: 'uploaded' };
    }
    return {};
  };
}

const twelveBytes = () =>
  new File([new Uint8Array(12)], 'video.mp4', { type: 'video/mp4' });

const urls = (method?: string) =>
  calls.filter((c) => !method || c.method === method).map((c) => c.url);

describe('uploading a file', () => {
  it('tells the API about the file first', async () => {
    serverForUpload({});
    await uploadAsset(twelveBytes());

    expect(calls[0]).toMatchObject({ method: 'POST', url: '/assets/uploads' });
    expect(json(calls[0]!)).toEqual({
      filename: 'video.mp4',
      mimeType: 'video/mp4',
      size: 12,
    });
  });

  it('sends every part to storage and then completes the upload', async () => {
    serverForUpload({});
    const asset = await uploadAsset(twelveBytes());

    expect(urls('PUT').sort()).toEqual([
      'https://storage.test/part/1',
      'https://storage.test/part/2',
      'https://storage.test/part/3',
    ]);
    expect(urls().at(-1)).toBe('/assets/uploads/a1/complete');
    expect(asset).toMatchObject({ id: 'a1', status: 'uploaded' });
  });

  it('cuts the file into parts of the size the API chose', async () => {
    serverForUpload({});
    await uploadAsset(twelveBytes());

    const sizes = calls
      .filter((c) => c.method === 'PUT')
      .sort((a, b) => a.url.localeCompare(b.url))
      .map((c) => (c.data as Blob).size);
    expect(sizes).toEqual([5, 5, 2]);
  });

  it('asks for part links ten at a time', async () => {
    serverForUpload({ partSize: 1, partCount: 25 });
    await uploadAsset(new File([new Uint8Array(25)], 'big.bin'));

    const batches = calls
      .filter((c) => c.url === '/assets/uploads/a1/parts')
      .map((c) => (json(c) as { partNumbers: number[] }).partNumbers.length);
    expect(batches).toEqual([10, 10, 5]);
  });

  it('retries a part that fails and still finishes', async () => {
    serverForUpload({
      failPut: (url, attempt) => url.endsWith('/2') && attempt < 3,
    });

    await uploadAsset(twelveBytes());

    const part2 = calls.filter((c) => c.url === 'https://storage.test/part/2');
    expect(part2).toHaveLength(3);
    expect(urls().at(-1)).toBe('/assets/uploads/a1/complete');
  });

  it('gives up on a part after three tries and cancels the upload', async () => {
    serverForUpload({ failPut: (url) => url.endsWith('/2') });

    await expect(uploadAsset(twelveBytes())).rejects.toThrow('storage hiccup');

    expect(calls.filter((c) => c.url.endsWith('/part/2'))).toHaveLength(3);
    expect(urls()).not.toContain('/assets/uploads/a1/complete');
    expect(urls('DELETE')).toEqual(['/assets/uploads/a1']);
  });

  it('does not try to cancel when the upload never started', async () => {
    handler = () => new Error('API down');

    await expect(uploadAsset(twelveBytes())).rejects.toThrow('API down');

    expect(calls).toHaveLength(1);
  });

  it('reports progress that ends at 100 and never goes past it', async () => {
    serverForUpload({});
    const seen: number[] = [];
    const original = handler;
    handler = (call, config) => {
      if (call.method === 'PUT') {
        (config.onUploadProgress as (e: { loaded: number }) => void)?.({
          loaded: (call.data as Blob).size,
        });
      }
      return original(call, config);
    };

    await uploadAsset(twelveBytes(), (percent) => seen.push(percent));

    expect(seen.at(-1)).toBe(100);
    expect(Math.max(...seen)).toBeLessThanOrEqual(100);
    expect(seen.every((p) => p >= 0)).toBe(true);
  });

  it('works without a progress callback', async () => {
    serverForUpload({});
    await expect(uploadAsset(twelveBytes())).resolves.toBeDefined();
  });
});
