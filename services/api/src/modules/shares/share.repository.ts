import { assets, shareLinks, type Db } from '@dam/db';
import { and, eq, isNull } from 'drizzle-orm';

export async function insertShareLink(
  db: Db,
  values: {
    assetId: string;
    tokenHash: string;
    canDownload: boolean;
    expiresAt: Date;
    createdBy: string;
  },
) {
  const [link] = await db.insert(shareLinks).values(values).returning();
  return link!;
}

export async function listShareLinks(db: Db, assetId: string) {
  return db
    .select({
      id: shareLinks.id,
      canDownload: shareLinks.canDownload,
      expiresAt: shareLinks.expiresAt,
      revokedAt: shareLinks.revokedAt,
      createdAt: shareLinks.createdAt,
    })
    .from(shareLinks)
    .where(eq(shareLinks.assetId, assetId));
}

export async function revokeShareLink(
  db: Db,
  assetId: string,
  shareId: string,
) {
  const [link] = await db
    .update(shareLinks)
    .set({ revokedAt: new Date() })
    .where(and(eq(shareLinks.id, shareId), eq(shareLinks.assetId, assetId)))
    .returning({ id: shareLinks.id });
  return link;
}

export async function findActiveShare(db: Db, tokenHash: string, now: Date) {
  const [row] = await db
    .select({
      link: shareLinks,
      asset: assets,
    })
    .from(shareLinks)
    .innerJoin(assets, eq(assets.id, shareLinks.assetId))
    .where(
      and(eq(shareLinks.tokenHash, tokenHash), isNull(shareLinks.revokedAt)),
    );
  if (!row || row.link.expiresAt <= now) return undefined;
  return row;
}
