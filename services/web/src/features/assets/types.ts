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


export type UploadedAsset = {
  id: string;
  filename: string;
  status: AssetStatus;
};

export type UploadSession = {
  assetId: string;
  partSize: number;
  partCount: number;
};

export type SignedPart = {
  partNumber: number;
  url: string;
};
