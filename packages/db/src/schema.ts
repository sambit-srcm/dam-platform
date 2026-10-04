import {
  bigint,
  boolean,
  check,
  index,
  integer,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid,
  jsonb,
  unique,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { ASSET_STATUSES, FIELD_LIMITS, USER_ROLES } from './constants.ts';

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

// What the thumbnail worker learns about an image. Sizes are after rotation.
export type ImageMetadata = {
  width: number;
  height: number;
  format: string;
};
export type AssetMetadata = ImageMetadata | VideoMetadata;

export const assetStatus = pgEnum('asset_status', ASSET_STATUSES);
export const userRole = pgEnum('user_role', USER_ROLES);

export const users = pgTable(
  'users',
  {
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
  },
  (table) => [
    check(
      'users_email_length',
      sql`char_length(${table.email}) <= ${sql.raw(String(FIELD_LIMITS.email))}`,
    ),
    check(
      'users_password_hash_length',
      sql`char_length(${table.passwordHash}) <= ${sql.raw(String(FIELD_LIMITS.passwordHash))}`,
    ),
  ],
);

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
    // Set by the workers; empty for documents
    metadata: jsonb().$type<AssetMetadata>(),
    // Made from the filename and file details
    tags: text()
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
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
    index('assets_tags_idx').using('gin', table.tags),
    // Makes searching for part of a filename fast
    index('assets_filename_trgm_idx').using(
      'gin',
      table.filename.op('gin_trgm_ops'),
    ),
    check(
      'assets_filename_length',
      sql`char_length(${table.filename}) <= ${sql.raw(String(FIELD_LIMITS.filename))}`,
    ),
    check(
      'assets_mime_type_length',
      sql`char_length(${table.mimeType}) <= ${sql.raw(String(FIELD_LIMITS.mimeType))}`,
    ),
    check(
      'assets_storage_key_length',
      sql`char_length(${table.storageKey}) <= ${sql.raw(String(FIELD_LIMITS.storageKey))}`,
    ),
    check(
      'assets_thumbnail_key_length',
      sql`${table.thumbnailKey} is null or char_length(${table.thumbnailKey}) <= ${sql.raw(String(FIELD_LIMITS.storageKey))}`,
    ),
    check(
      'assets_failure_reason_length',
      sql`${table.failureReason} is null or char_length(${table.failureReason}) <= ${sql.raw(String(FIELD_LIMITS.failureReason))}`,
    ),
    check('assets_tags_length', sql`tags_within_limit(${table.tags})`),
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
    check(
      'renditions_label_length',
      sql`char_length(${table.label}) <= ${sql.raw(String(FIELD_LIMITS.renditionLabel))}`,
    ),
    check(
      'renditions_storage_key_length',
      sql`char_length(${table.storageKey}) <= ${sql.raw(String(FIELD_LIMITS.storageKey))}`,
    ),
    check(
      'renditions_mime_type_length',
      sql`char_length(${table.mimeType}) <= ${sql.raw(String(FIELD_LIMITS.mimeType))}`,
    ),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;

export type Rendition = typeof renditions.$inferSelect;
export type NewRendition = typeof renditions.$inferInsert;

export const teams = pgTable(
  'teams',
  {
    id: uuid().primaryKey().defaultRandom(),
    name: text().notNull(),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    check(
      'teams_name_length',
      sql`char_length(${table.name}) between 1 and ${sql.raw(String(FIELD_LIMITS.teamName))}`,
    ),
  ],
);

export const teamMembers = pgTable(
  'team_members',
  {
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    userId: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.teamId, table.userId] }),
    index('team_members_user_id_idx').on(table.userId),
  ],
);

// A team may preview and download an asset the owner shared with them
export const assetTeamGrants = pgTable(
  'asset_team_grants',
  {
    assetId: uuid()
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    teamId: uuid()
      .notNull()
      .references(() => teams.id, { onDelete: 'cascade' }),
    grantedBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    primaryKey({ columns: [table.assetId, table.teamId] }),
    index('asset_team_grants_team_id_idx').on(table.teamId),
  ],
);

// The raw token is shown once. Only its hash is stored.
export const shareLinks = pgTable(
  'share_links',
  {
    id: uuid().primaryKey().defaultRandom(),
    assetId: uuid()
      .notNull()
      .references(() => assets.id, { onDelete: 'cascade' }),
    tokenHash: text().notNull().unique('share_links_token_hash_unique'),
    canDownload: boolean().notNull().default(false),
    expiresAt: timestamp({ withTimezone: true }).notNull(),
    revokedAt: timestamp({ withTimezone: true }),
    createdBy: uuid()
      .notNull()
      .references(() => users.id, { onDelete: 'restrict' }),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index('share_links_asset_id_idx').on(table.assetId)],
);

export type Team = typeof teams.$inferSelect;
export type TeamMember = typeof teamMembers.$inferSelect;
export type AssetTeamGrant = typeof assetTeamGrants.$inferSelect;
export type ShareLink = typeof shareLinks.$inferSelect;
