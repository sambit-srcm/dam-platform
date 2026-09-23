export type AssetStatus =
  'uploaded' | 'processing' | 'ready' | 'failed' | 'uploading';

export type Asset = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: AssetStatus;
  createdAt: string;
  thumbnailUrl: string | null;
};

export type AssetListResponse = {
  items: Asset[];
  total: number;
  limit: number;
  offset: number;
};

export type ListAssetsParams = {
  limit?: number;
  offset?: number;
  status?: AssetStatus;
};
