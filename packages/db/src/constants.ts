export const ASSET_STATUSES = [
  'uploaded',
  'processing',
  'ready',
  'failed',
  'uploading',
] as const;
export type AssetStatus = (typeof ASSET_STATUSES)[number];

export const USER_ROLES = ['user', 'admin'] as const;
export type UserRole = (typeof USER_ROLES)[number];
