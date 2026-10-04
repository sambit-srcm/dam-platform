export type AssetStatus =
  'uploaded' | 'processing' | 'ready' | 'failed' | 'uploading';

export type AssetKind = 'image' | 'video' | 'document';
export type AssetSort = 'createdAt' | 'downloadCount';

export type Asset = {
  id: string;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  status: AssetStatus;
  tags: string[];
  createdAt: string;
  thumbnailUrl: string | null;
  access?: 'owner' | 'team';
};

export type AssetListResponse = {
  items: Asset[];
  total: number;
  limit: number;
  offset: number;
};

// Everything the gallery and the admin browser can narrow the list by
export type AssetFilters = {
  q?: string;
  type?: AssetKind;
  tags?: string[];
  status?: AssetStatus;
  // Plain dates like 2026-09-29, both days included
  from?: string;
  to?: string;
  sort?: AssetSort;
  scope?: 'mine' | 'team';
};

export type ListAssetsParams = AssetFilters & {
  limit?: number;
  offset?: number;
};

export type TagCount = { tag: string; count: number };

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

export type UploadStatus = {
  partSize: number;
  partCount: number;
  received: number[];
  remaining: number[];
};

export type SignedPart = {
  partNumber: number;
  url: string;
};

export type VideoSource = {
  label: string;
  width: number | null;
  height: number | null;
  url: string;
};

// What the viewer needs to show an asset in full
export type AssetView =
  | { kind: 'video'; renditions: VideoSource[] }
  | { kind: 'image' | 'document'; url: string };
