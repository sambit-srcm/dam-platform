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

// Caps shared by the database checks and the API. Password is the plaintext
// limit; the column stores a hash, which is longer than the password itself.
export const FIELD_LIMITS = {
  email: 254,
  password: 128,
  passwordHash: 255,
  filename: 255,
  mimeType: 255,
  storageKey: 512,
  failureReason: 500,
  tag: 32,
  tagCount: 32,
  renditionLabel: 32,
  teamName: 80,
} as const;
