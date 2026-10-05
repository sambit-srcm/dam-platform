import { beforeEach, describe, expect, it } from 'vitest';
import { http } from '../../../lib/http';
import {
  createShare,
  downloadShare,
  getSharing,
  grantTeam,
  previewShare,
  revokeShare,
  revokeTeam,
} from '../api';

let sent: { method: string; url: string; data?: unknown }[] = [];
let next: unknown = {};

beforeEach(() => {
  sent = [];
  next = {};
  http.defaults.adapter = async (config) => {
    sent.push({
      method: (config.method ?? '').toUpperCase(),
      url: config.url ?? '',
      data: config.data === undefined ? undefined : JSON.parse(config.data),
    });
    return { data: next, status: 200, statusText: 'OK', headers: {}, config };
  };
});

describe('share API calls', () => {
  it('loads grants and links for an asset', async () => {
    const sharing = { teams: [], links: [] };
    next = sharing;
    await expect(getSharing('a1')).resolves.toEqual(sharing);
    expect(sent[0]).toMatchObject({ method: 'GET', url: '/assets/a1/sharing' });
  });

  it('grants and revokes a team', async () => {
    await grantTeam('a1', 't1');
    await revokeTeam('a1', 't1');
    expect(sent.map((call) => call.method + ' ' + call.url)).toEqual([
      'PUT /assets/a1/teams/t1',
      'DELETE /assets/a1/teams/t1',
    ]);
  });

  it('creates and revokes a link', async () => {
    const created = {
      id: 's1',
      token: 'secret',
      canDownload: true,
      expiresAt: '2026-10-06T00:00:00.000Z',
    };
    next = created;
    const input = { canDownload: true, expiresAt: created.expiresAt };
    await expect(createShare('a1', input)).resolves.toEqual(created);
    expect(sent[0]).toEqual({
      method: 'POST',
      url: '/assets/a1/shares',
      data: input,
    });

    await revokeShare('a1', 's1');
    expect(sent[1]).toMatchObject({
      method: 'DELETE',
      url: '/assets/a1/shares/s1',
    });
  });

  it('previews and downloads through the public token', async () => {
    next = { filename: 'a.jpg', canDownload: true };
    await expect(previewShare('a/b')).resolves.toMatchObject({
      filename: 'a.jpg',
    });
    expect(sent[0]).toMatchObject({ method: 'GET', url: '/shares/a%2Fb' });

    next = { url: 'https://files.test/a.jpg' };
    await expect(downloadShare('a/b')).resolves.toBe(
      'https://files.test/a.jpg',
    );
    expect(sent[1]).toMatchObject({
      method: 'POST',
      url: '/shares/a%2Fb/download',
    });
  });
});
