import { http } from '../../lib/http';
import type { Asset, AssetView } from '../assets/types';

export type AssetGrant = {
  teamId: string;
  teamName: string;
  createdAt: string;
};

export type ShareLink = {
  id: string;
  canDownload: boolean;
  expiresAt: string;
  revokedAt: string | null;
  createdAt: string;
};

export type AssetSharing = {
  teams: AssetGrant[];
  links: ShareLink[];
};

export type CreatedShare = {
  id: string;
  token: string;
  canDownload: boolean;
  expiresAt: string;
};

export type SharePreview = {
  filename: string;
  mimeType: string;
  canDownload: boolean;
  expiresAt: string;
  asset: Asset;
  view: AssetView;
};

export async function getSharing(assetId: string): Promise<AssetSharing> {
  const res = await http.get<AssetSharing>(`/assets/${assetId}/sharing`);
  return res.data;
}

export async function grantTeam(
  assetId: string,
  teamId: string,
): Promise<void> {
  await http.put(`/assets/${assetId}/teams/${teamId}`);
}

export async function revokeTeam(
  assetId: string,
  teamId: string,
): Promise<void> {
  await http.delete(`/assets/${assetId}/teams/${teamId}`);
}

export async function createShare(
  assetId: string,
  input: { canDownload: boolean; expiresAt: string },
): Promise<CreatedShare> {
  const res = await http.post<CreatedShare>(`/assets/${assetId}/shares`, input);
  return res.data;
}

export async function revokeShare(
  assetId: string,
  shareId: string,
): Promise<void> {
  await http.delete(`/assets/${assetId}/shares/${shareId}`);
}

export async function previewShare(token: string): Promise<SharePreview> {
  const res = await http.get<SharePreview>(
    `/shares/${encodeURIComponent(token)}`,
  );
  return res.data;
}

export async function downloadShare(token: string): Promise<string> {
  const res = await http.post<{ url: string }>(
    `/shares/${encodeURIComponent(token)}/download`,
  );
  return res.data.url;
}
