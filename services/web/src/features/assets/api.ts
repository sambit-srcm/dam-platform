import axios from 'axios';
import type { AssetListResponse, ListAssetsParams } from './types';

export async function getAssets(
  params: ListAssetsParams = {},
): Promise<AssetListResponse> {
  const res = await axios.get<AssetListResponse>('/api/assets', { params });
  return res.data;
}
