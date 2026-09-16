import {
  bigint,
  index,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const assetStatus = pgEnum('asset_status', [
  'uploaded',
  'processing',
  'ready',
  'failed',
]);

export const assets = pgTable(
  'assets',
  {
    id: uuid().primaryKey().defaultRandom(),
    filename: text().notNull(),
    mimeType: text().notNull(),
    sizeBytes: bigint({ mode: 'number' }).notNull(),
    storageKey: text().notNull().unique('assets_storage_key_unique'),
    status: assetStatus().notNull().default('uploaded'),
    createdAt: timestamp({ withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp({ withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('assets_status_idx').on(table.status),
    index('assets_created_at_idx').on(table.createdAt),
  ],
);

export type Asset = typeof assets.$inferSelect;
export type NewAsset = typeof assets.$inferInsert;
