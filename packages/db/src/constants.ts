export const ASSET_STATUSES = [
  'uploaded',
  'processing',
  'ready',
  'failed',
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];
