import type {
  Asset,
  AssetKind,
  AssetStatus,
  AssetView,
  ListAssetsParams,
} from '../assets/types';

export type AdminAsset = Asset & {
  ownerId: string | null;
  ownerEmail: string | null;
  downloadCount: number;
};

export type AdminAssetListResponse = {
  items: AdminAsset[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminAssetDetail = AdminAsset & {
  failureReason: string | null;
  updatedAt: string;
  metadata: {
    durationSeconds: number;
    width: number;
    height: number;
    videoCodec: string;
    audioCodec: string | null;
  } | null;
  view: AssetView | null;
};

export type ListAdminAssetsParams = ListAssetsParams;

export type Dashboard = {
  totals: {
    assets: number;
    storageBytes: number;
    downloads: number;
    users: number;
  };
  byStatus: Partial<Record<AssetStatus, number>>;
  byType: Partial<Record<AssetKind, number>>;
  days: { day: string; uploads: number; downloads: number | null }[];
  latest: AdminAsset[];
  topDownloaded: {
    id: string;
    filename: string;
    mimeType: string;
    downloadCount: number;
    ownerEmail: string | null;
    thumbnailUrl: string | null;
  }[];
};
