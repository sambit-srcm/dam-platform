import { http } from '../../lib/http';
import { toQuery } from '../assets/api';
import type { AssetView, TagCount } from '../assets/types';
import type {
  AdminAssetDetail,
  AdminAssetListResponse,
  Dashboard,
  ListAdminAssetsParams,
} from './types';

export async function getAdminAssets(params: ListAdminAssetsParams = {}) {
  const res = await http.get<AdminAssetListResponse>('/admin/assets', {
    params: toQuery(params),
  });
  return res.data;
}

export async function getAdminTags(): Promise<TagCount[]> {
  const res = await http.get<{ items: TagCount[] }>('/admin/tags');
  return res.data.items;
}

export async function getAdminAsset(id: string) {
  const res = await http.get<AdminAssetDetail>(`/admin/assets/${id}`);
  return res.data;
}

// Admins view through the asset detail, because they may not own the asset
export async function getAdminAssetView(id: string): Promise<AssetView> {
  const asset = await getAdminAsset(id);
  if (!asset.view) throw new Error('Asset has no file to view');
  return asset.view;
}

export async function getDashboard(days = 14) {
  const res = await http.get<Dashboard>('/admin/dashboard', {
    params: { days },
  });
  return res.data;
}
