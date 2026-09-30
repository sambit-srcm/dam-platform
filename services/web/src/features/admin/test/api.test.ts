import { AxiosError } from 'axios';
import { beforeEach, describe, expect, it } from 'vitest';
import { http } from '../../../lib/http';
import {
  getAdminAsset,
  getAdminAssets,
  getAdminAssetView,
  getAdminTags,
  getDashboard,
} from '../api';

type Call = { method: string; url: string; params: unknown };
let calls: Call[] = [];
let reply: unknown;

beforeEach(() => {
  calls = [];
  http.defaults.adapter = async (config) => {
    calls.push({
      method: (config.method ?? 'get').toUpperCase(),
      url: config.url ?? '',
      params: config.params,
    });
    if (reply instanceof Error) {
      throw new AxiosError(reply.message, 'ERR_BAD_RESPONSE', config);
    }
    return { data: reply, status: 200, statusText: 'OK', headers: {}, config };
  };
});

describe('admin API calls', () => {
  it('lists all assets, joining the tags', async () => {
    reply = { items: [], total: 0 };
    await getAdminAssets({ tags: ['a', 'b'], q: '' });
    expect(calls[0]).toMatchObject({ url: '/admin/assets' });
    expect(calls[0]!.params).toMatchObject({ tags: 'a,b', q: undefined });
  });

  it('lists all tags', async () => {
    reply = { items: [{ tag: 'a', count: 3 }] };
    expect(await getAdminTags()).toEqual([{ tag: 'a', count: 3 }]);
  });

  it('gets one asset in full', async () => {
    reply = { id: 'a1' };
    expect(await getAdminAsset('a1')).toEqual({ id: 'a1' });
    expect(calls[0]!.url).toBe('/admin/assets/a1');
  });

  it('takes the view out of the asset detail', async () => {
    reply = { id: 'a1', view: { kind: 'image', url: 'https://files.test/x' } };
    expect(await getAdminAssetView('a1')).toEqual({
      kind: 'image',
      url: 'https://files.test/x',
    });
  });

  it('says so when an asset has no file to view', async () => {
    reply = { id: 'a1', view: null };
    await expect(getAdminAssetView('a1')).rejects.toThrow('no file to view');
  });

  it('asks for 14 days on the dashboard unless told otherwise', async () => {
    reply = {};
    await getDashboard();
    expect(calls[0]).toMatchObject({
      url: '/admin/dashboard',
      params: { days: 14 },
    });
  });

  it('asks for the number of days it is given', async () => {
    reply = {};
    await getDashboard(30);
    expect(calls[0]!.params).toEqual({ days: 30 });
  });
});
