import {
  bigint,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { ASSET_STATUSES, USER_ROLES } from './constants.ts';

export type UploadedSession = {
  uploadId: string;
  partSize: number;
  partCount: number;
};
// What the video worker learns about a file by probing it. Sizes are after rotation.
export type VideoMetadata = {
  durationSeconds: number;
  width: number;
  height: number;
  videoCodec: string;
  audioCodec: string | null;
};

export const assetStatus = pgEnum('asset_status', ASSET_STATUSES);
export const userRole = pgEnum('user_role', USER_ROLES);

export const users = pgTable('users', {
  id: uuid().primaryKey().defaultRandom(),
  // Stored lowercased, so the unique constraint is case-insensitive
  email: text().notNull().unique('users_email_unique'),
  passwordHash: text().notNull(),
  role: userRole().notNull().default('user'),
  createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp({ withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const assets = pgTable(
  'assets',
  {
    id: uuid().primaryKey().defaultRandom(),
    filename: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    // Null only for assets uploaded before accounts existed; nobody can see those yet
    ownerId: uuid().references(() => users.id, { onDelete: 'restrict' }),
    storageKey: text().notNull().unique('assets_storage_key_unique'),
    // Set by the worker once a thumbnail has been generated
    thumbnailKey: text(),
    status: assetStatus().notNull().default('uploaded'),
    upload: jsonb().$type<UploadedSession>(),
    // Set by the video worker; empty for images and documents
    metadata: jsonb().$type<VideoMetadata>(),
    uploadExpiresAt: timestamp({ withTimezone: true }),
    //column for handling download counts
    downloadCount: integer().notNull().default(0),

    failureReason: text(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('assets_owner_id_idx').on(table.ownerId),
    index('assets_status_idx').on(table.status),
    index('assets_created_at_idx').on(table.createdAt),
    index('assets_upload_expires_at_idx').on(table.uploadExpiresAt),
  ],
);

// Playable copies of an asset at different sizes, made by the video worker
export const renditions = pgTable(
  'renditions',
  {
    id: uuid().primaryKey().defaultRandom(),
    assetId: uuid()
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    // Which size this is, e.g. "720p"
    label: text().notNull(),
    storageKey: text().notNull().unique('renditions_storage_key_unique'),
    mimeType: text().notNull(),
    width: integer().notNull(),
    height: integer().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  // One row per size, so a retried job replaces its rendition instead of adding another
  (table) => [
    unique('renditions_asset_label_unique').on(table.assetId, table.label),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

export type Rendition = typeof renditions.$inferSelect;
export type NewRendition = typeof renditions.$inferInsert;
